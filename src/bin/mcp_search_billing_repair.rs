use std::{
    collections::BTreeSet,
    io::{self, Write},
};

use chrono::{TimeZone, Utc};
use clap::Parser;
use dotenvy::dotenv;
use serde::Serialize;
use serde_json::Value;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions};
use tavily_hikari::rebase_current_month_business_quota;

#[derive(Debug, Parser)]
#[command(
    author,
    version,
    about = "Repair historical MCP search logs that missed downstream billing"
)]
struct Cli {
    /// SQLite database path to inspect.
    #[arg(long, env = "PROXY_DB_PATH", default_value = "data/tavily_proxy.db")]
    db_path: String,

    /// Inclusive UTC unix timestamp lower bound.
    #[arg(long)]
    from_ts: i64,

    /// Inclusive UTC unix timestamp upper bound.
    #[arg(long)]
    to_ts: i64,

    /// Optional auth_token_id filter.
    #[arg(long)]
    token_id: Option<String>,

    /// Only report candidate rows without writing changes.
    #[arg(long, default_value_t = false)]
    dry_run: bool,
}

#[derive(Debug, Clone)]
struct RepairCandidate {
    id: i64,
    auth_token_id: String,
    created_at: i64,
    credits: i64,
}

#[derive(Debug, Serialize)]
struct RepairReport {
    dry_run: bool,
    from_ts: i64,
    to_ts: i64,
    token_id: Option<String>,
    candidate_count: usize,
    affected_token_count: usize,
    total_credits: i64,
    repaired_log_ids: Vec<i64>,
    monthly_rebase: Option<Value>,
}

fn expected_search_credits_from_request_body(bytes: &[u8]) -> Option<i64> {
    let payload: Value = serde_json::from_slice(bytes).ok()?;
    if payload.get("method").and_then(|value| value.as_str()) != Some("tools/call") {
        return None;
    }

    let params = payload.get("params")?;
    let tool_name = params
        .get("name")
        .and_then(|value| value.as_str())?
        .trim()
        .to_ascii_lowercase()
        .replace('_', "-");
    if tool_name != "tavily-search" {
        return None;
    }

    let search_depth = params
        .get("arguments")
        .and_then(|arguments| arguments.get("search_depth"))
        .and_then(|value| value.as_str())
        .unwrap_or("");

    Some(if search_depth.eq_ignore_ascii_case("advanced") {
        2
    } else {
        1
    })
}

async fn connect_sqlite_pool(db_path: &str) -> Result<sqlx::SqlitePool, sqlx::Error> {
    let options = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5));
    SqlitePoolOptions::new()
        .min_connections(1)
        .max_connections(5)
        .connect_with(options)
        .await
}

async fn load_candidates(
    pool: &sqlx::SqlitePool,
    from_ts: i64,
    to_ts: i64,
    token_id: Option<&str>,
) -> Result<Vec<RepairCandidate>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, auth_token_id, created_at, request_body
         FROM auth_token_logs
         WHERE request_kind_key = 'mcp:search'
           AND result_status = 'success'
           AND http_status = 200
           AND business_credits IS NULL
           AND COALESCE(billing_state, 'none') = 'none'
           AND created_at >= ?
           AND created_at <= ?
           AND (? IS NULL OR auth_token_id = ?)
         ORDER BY id ASC",
    )
    .bind(from_ts)
    .bind(to_ts)
    .bind(token_id)
    .bind(token_id)
    .fetch_all(pool)
    .await?;

    let mut candidates = Vec::new();
    for row in rows {
        let request_body = row.try_get::<Vec<u8>, _>("request_body")?;
        let Some(credits) = expected_search_credits_from_request_body(&request_body) else {
            continue;
        };
        candidates.push(RepairCandidate {
            id: row.try_get("id")?,
            auth_token_id: row.try_get("auth_token_id")?,
            created_at: row.try_get("created_at")?,
            credits,
        });
    }

    Ok(candidates)
}

async fn repair_candidates(
    pool: &sqlx::SqlitePool,
    candidates: &[RepairCandidate],
) -> Result<Vec<i64>, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mut repaired_log_ids = Vec::new();

    for candidate in candidates {
        let result = sqlx::query(
            "UPDATE auth_token_logs
             SET business_credits = ?,
                 billing_state = 'charged',
                 billing_subject = COALESCE(billing_subject, auth_token_id)
             WHERE id = ?
               AND business_credits IS NULL
               AND COALESCE(billing_state, 'none') = 'none'",
        )
        .bind(candidate.credits)
        .bind(candidate.id)
        .execute(&mut *tx)
        .await?;

        if result.rows_affected() == 1 {
            repaired_log_ids.push(candidate.id);
        }
    }

    tx.commit().await?;
    Ok(repaired_log_ids)
}

fn build_report(
    cli: &Cli,
    candidates: &[RepairCandidate],
    repaired_log_ids: Vec<i64>,
    monthly_rebase: Option<Value>,
) -> RepairReport {
    let affected_tokens = candidates
        .iter()
        .map(|candidate| candidate.auth_token_id.clone())
        .collect::<BTreeSet<_>>();
    let _last_seen = candidates.iter().map(|candidate| candidate.created_at).max();

    RepairReport {
        dry_run: cli.dry_run,
        from_ts: cli.from_ts,
        to_ts: cli.to_ts,
        token_id: cli.token_id.clone(),
        candidate_count: candidates.len(),
        affected_token_count: affected_tokens.len(),
        total_credits: candidates.iter().map(|candidate| candidate.credits).sum(),
        repaired_log_ids,
        monthly_rebase,
    }
}

fn write_report(mut writer: impl Write, report: &RepairReport) -> io::Result<()> {
    serde_json::to_writer_pretty(&mut writer, report)?;
    writer.write_all(b"\n")?;
    writer.flush()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv().ok();
    let cli = Cli::parse();
    if cli.from_ts > cli.to_ts {
        return Err("--from-ts must be less than or equal to --to-ts".into());
    }

    let pool = connect_sqlite_pool(&cli.db_path).await?;
    let candidates = load_candidates(&pool, cli.from_ts, cli.to_ts, cli.token_id.as_deref()).await?;

    let (repaired_log_ids, monthly_rebase) = if cli.dry_run {
        (Vec::new(), None)
    } else {
        let repaired_log_ids = repair_candidates(&pool, &candidates).await?;
        let rebase_at = Utc
            .timestamp_opt(cli.to_ts, 0)
            .single()
            .unwrap_or_else(Utc::now);
        let rebase_report = rebase_current_month_business_quota(&cli.db_path, rebase_at).await?;
        (
            repaired_log_ids,
            Some(serde_json::to_value(rebase_report)?),
        )
    };

    let report = build_report(&cli, &candidates, repaired_log_ids, monthly_rebase);
    write_report(io::stdout().lock(), &report)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::expected_search_credits_from_request_body;
    use serde_json::json;

    #[test]
    fn parses_underscore_search_body() {
        let body = serde_json::to_vec(&json!({
            "method": "tools/call",
            "params": {
                "name": "tavily_search",
                "arguments": {
                    "query": "smoke",
                    "search_depth": "advanced"
                }
            }
        }))
        .expect("serialize body");

        assert_eq!(expected_search_credits_from_request_body(&body), Some(2));
    }

    #[test]
    fn parses_hyphenated_search_body() {
        let body = serde_json::to_vec(&json!({
            "method": "tools/call",
            "params": {
                "name": "tavily-search",
                "arguments": {
                    "query": "smoke"
                }
            }
        }))
        .expect("serialize body");

        assert_eq!(expected_search_credits_from_request_body(&body), Some(1));
    }

    #[test]
    fn ignores_non_search_tool_calls() {
        let body = serde_json::to_vec(&json!({
            "method": "tools/call",
            "params": {
                "name": "tavily_extract",
                "arguments": {
                    "urls": ["https://example.com"]
                }
            }
        }))
        .expect("serialize body");

        assert_eq!(expected_search_credits_from_request_body(&body), None);
    }
}
