use super::upstream_reconciliation::{local_ts, reconciliation_test_db_path};
use super::*;
use axum::{Json, Router, routing::get};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    time::Duration,
};
use tokio::net::TcpListener;

#[tokio::test]
async fn reconciliation_projection_micro_slices_resume() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-projection-slices"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    sqlx::query("DROP TRIGGER trg_upstream_reconciliation_usage_work_insert")
        .execute(&proxy.key_store.pool)
        .await
        .expect("disable live projection for backfill fixture");
    proxy
        .key_store
        .set_meta_i64(
            META_KEY_UPSTREAM_RECONCILIATION_WORK_PROJECTION_COMPLETE_V1,
            0,
        )
        .await
        .expect("mark historical projection pending");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("reset projection controller state");
    sqlx::query(
        r#"WITH RECURSIVE rows(n) AS (
             VALUES(1) UNION ALL SELECT n + 1 FROM rows WHERE n < 60
           )
           INSERT INTO upstream_reconciliation_usage (
             token_id, key_id, period_code, project_id, billing_subject,
             period_start, period_end, request_count, first_used_at,
             last_used_at, updated_at, settlement_mode
           )
           SELECT printf('slice-token-%03d', n), printf('slice-key-%03d', n),
                  '2026-07-15/S1', printf('slice-project-%03d', n),
                  printf('token:slice-%03d', n), ?, ?, 1, ?, ?, ?, 'shadow'
           FROM rows"#,
    )
    .bind(now - 4_000)
    .bind(now - 900)
    .bind(now - 1_000)
    .bind(now - 900)
    .bind(now - 900)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert projection fixture");

    proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect("advance one projection slice");
    let projected: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM upstream_reconciliation_work")
        .fetch_one(&proxy.key_store.pool)
        .await
        .expect("count projected work");
    assert_eq!(
        projected, 25,
        "the first durable micro-slice starts at 25 rows"
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_research_sweep_does_not_hold_an_empty_main_run() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-research-budget"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_project_id_mode = UpstreamProjectIdMode::AccessToken;
    settings.api_rebalance_enabled = true;
    settings.api_rebalance_percent = 100;
    settings.rebalance_mcp_enabled = true;
    settings.rebalance_mcp_session_percent = 100;
    settings.upstream_precise_reconciliation_enabled = false;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("save reconciliation settings");
    let key_id = proxy
        .add_or_undelete_key("tvly-reconciliation-research-budget")
        .await
        .expect("create reconciliation key");
    sqlx::query(
        r#"
        INSERT INTO upstream_reconciliation_usage (
            token_id, key_id, period_code, project_id, billing_subject, period_start, period_end,
            request_count, first_used_at, last_used_at, updated_at, settlement_mode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        "#,
    )
    .bind("research-budget-token")
    .bind(&key_id)
    .bind("2026-07-15/R1")
    .bind("project-research-budget")
    .bind("token:research-budget-token")
    .bind(now - 4_000)
    .bind(now - 900)
    .bind(now - 1_000)
    .bind(now - 900)
    .bind(now - 900)
    .bind("shadow")
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert research usage");
    sqlx::query(
        r#"
        INSERT INTO upstream_reconciliation_research (
            request_id, token_id, key_id, period_code, created_at, terminal_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, ?)
        "#,
    )
    .bind("research-budget-slow")
    .bind("research-budget-token")
    .bind(&key_id)
    .bind("2026-07-15/R1")
    .bind(now - 900)
    .bind(now - 900)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert pending research");
    sqlx::query(
        r#"
        UPDATE upstream_reconciliation_work
        SET completed_generation = work_generation
        WHERE token_id = 'research-budget-token' AND period_code = '2026-07-15/R1'
        "#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("complete main work before research-only run");

    let research_started = Arc::new(AtomicBool::new(false));
    let research_started_for_route = Arc::clone(&research_started);
    let app = Router::new().route(
        "/research/research-budget-slow",
        get(move || {
            let research_started = Arc::clone(&research_started_for_route);
            async move {
                research_started.store(true, Ordering::SeqCst);
                tokio::time::sleep(Duration::from_secs(10)).await;
                Json(serde_json::json!({ "status": "completed" }))
            }
        }),
    );
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind research upstream");
    let addr = listener
        .local_addr()
        .expect("read research upstream address");
    tokio::spawn(async move {
        axum::serve(listener, app.into_make_service())
            .await
            .expect("serve research upstream");
    });

    let started_at = std::time::Instant::now();
    let settled = proxy
        .run_upstream_reconciliation_once(&format!("http://{addr}"))
        .await
        .expect("run reconciliation with research-only work");
    assert_eq!(settled, 0);
    assert!(research_started.load(Ordering::SeqCst));
    assert!(
        started_at.elapsed() < Duration::from_secs(5),
        "a slow research probe must not consume the 20-second main settlement budget"
    );
    let (_, attempted, _, _, _, budget_exhausted) = proxy
        .key_store
        .upstream_reconciliation_last_run_stats()
        .await
        .expect("read reconciliation observation");
    assert_eq!(attempted, 0);
    assert!(
        !budget_exhausted,
        "research's independent budget must not report primary local pressure"
    );

    for _ in 0..3 {
        proxy.fail_next_reconciliation_research_read_for_test();
        assert_eq!(
            proxy
                .run_upstream_reconciliation_once(&format!("http://{addr}"))
                .await
                .expect("defer transient research pressure"),
            0
        );
    }
    let (streak, level, backoff_until) = proxy
        .key_store
        .upstream_reconciliation_local_backoff_state()
        .await
        .expect("read research pressure backoff");
    assert_eq!((streak, level), (3, 1));
    assert!(backoff_until >= now + 30);
    assert!(
        proxy
            .key_store
            .upstream_reconciliation_continuation_at()
            .await
            .expect("read durable continuation")
            .is_some_and(|continuation_at| continuation_at >= backoff_until)
    );
    let (work_generation, completed_generation): (i64, i64) = sqlx::query_as(
        "SELECT work_generation, completed_generation FROM upstream_reconciliation_work \
         WHERE token_id = 'research-budget-token' AND period_code = '2026-07-15/R1'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read preserved main terminal work");
    assert_eq!(completed_generation, work_generation);
    assert_eq!(
        proxy
            .key_store
            .sqlite_runtime
            .discarded_connections_for_test(SqliteOperation::ReconciliationProjection),
        0
    );
    let transaction = proxy
        .key_store
        .sqlite_runtime
        .begin_immediate(SqliteOperation::ReconciliationProjection)
        .await
        .expect("begin transaction after transient research read");
    transaction
        .rollback()
        .await
        .expect("rollback reusable projection connection");

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_projection_preserves_global_min_across_backfill_pages() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-projection-pages"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_project_id_mode = UpstreamProjectIdMode::AccessToken;
    settings.api_rebalance_enabled = true;
    settings.api_rebalance_percent = 100;
    settings.rebalance_mcp_enabled = true;
    settings.rebalance_mcp_session_percent = 100;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("enable reconciliation shadow gate");
    sqlx::query("DROP TRIGGER trg_upstream_reconciliation_usage_work_insert")
        .execute(&proxy.key_store.pool)
        .await
        .expect("disable live projection for backfill fixture");
    proxy
        .key_store
        .set_meta_i64(
            META_KEY_UPSTREAM_RECONCILIATION_WORK_PROJECTION_COMPLETE_V1,
            0,
        )
        .await
        .expect("mark existing usage projection pending");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("reset projection controller state");
    sqlx::query(
        r#"WITH RECURSIVE rows(n) AS (
             VALUES(1) UNION ALL SELECT n + 1 FROM rows WHERE n < 501
           )
           INSERT INTO upstream_reconciliation_usage (
             token_id, key_id, period_code, project_id, billing_subject,
             period_start, period_end, request_count, first_used_at,
             last_used_at, updated_at, settlement_mode
           )
           SELECT 'projection-token', printf('key-%03d', n), '2026-07-15/S1',
                  CASE WHEN n = 501 THEN 'project-a' ELSE 'project-z' END,
                  CASE WHEN n = 501 THEN 'account:a' ELSE 'account:z' END,
                  ?, ?, 1, ?, ?, ?,
                  CASE WHEN n = 501 THEN 'actual' ELSE 'shadow' END
           FROM rows"#,
    )
    .bind(now - 4_000)
    .bind(now - 900)
    .bind(now - 1_000)
    .bind(now - 900)
    .bind(now - 900)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert paged projection fixture");
    let projection_plan: Vec<String> = sqlx::query(
        "EXPLAIN QUERY PLAN SELECT token_id, key_id, period_code FROM upstream_reconciliation_usage WHERE (token_id, key_id, period_code) > ('', '', '') ORDER BY token_id, key_id, period_code LIMIT 25",
    )
    .fetch_all(&proxy.key_store.pool)
    .await
    .expect("explain projection continuation cursor")
    .into_iter()
    .map(|row| row.try_get("detail").expect("read plan detail"))
    .collect();
    assert!(
        projection_plan.iter().any(|detail| detail
            .contains("USING COVERING INDEX sqlite_autoindex_upstream_reconciliation_usage_1")),
        "the projection cursor must seek through the stable usage primary key"
    );

    assert!(
        proxy
            .key_store
            .next_upstream_reconciliation_candidates(1)
            .await
            .expect("select candidates without advancing legacy projection")
            .candidates
            .is_empty(),
        "candidate selection must not write or scan the legacy projection before main settlement"
    );
    for _ in 0..24 {
        proxy
            .key_store
            .advance_upstream_reconciliation_work_projection()
            .await
            .expect("advance projection micro-slice");
    }
    let projected: (String, String, String) = sqlx::query_as(
        "SELECT project_id, billing_subject, settlement_mode FROM upstream_reconciliation_work WHERE token_id = 'projection-token' AND period_code = '2026-07-15/S1'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read merged projection");
    assert_eq!(
        projected,
        (
            "project-a".to_string(),
            "account:a".to_string(),
            "actual".to_string()
        )
    );

    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_projection_continues_after_a_settled_backfill_page() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-projection-continuation"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_project_id_mode = UpstreamProjectIdMode::AccessToken;
    settings.api_rebalance_enabled = true;
    settings.api_rebalance_percent = 100;
    settings.rebalance_mcp_enabled = true;
    settings.rebalance_mcp_session_percent = 100;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("enable reconciliation shadow gate");
    sqlx::query("DROP TRIGGER trg_upstream_reconciliation_usage_work_insert")
        .execute(&proxy.key_store.pool)
        .await
        .expect("disable live projection for backfill fixture");
    proxy
        .key_store
        .set_meta_i64(
            META_KEY_UPSTREAM_RECONCILIATION_WORK_PROJECTION_COMPLETE_V1,
            0,
        )
        .await
        .expect("mark existing usage projection pending");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("reset projection controller state");
    sqlx::query(
        r#"WITH RECURSIVE rows(n) AS (
             VALUES(1) UNION ALL SELECT n + 1 FROM rows WHERE n < 501
           )
           INSERT INTO upstream_reconciliation_usage (
             token_id, key_id, period_code, project_id, billing_subject,
             period_start, period_end, request_count, first_used_at,
             last_used_at, updated_at, settlement_mode
           )
           SELECT printf('projection-page-%03d', n), printf('key-%03d', n),
                  '2026-07-15/S1', printf('project-%03d', n), printf('account:%03d', n),
                  ?, ?, 1, ?, ?, ?, 'shadow'
           FROM rows"#,
    )
    .bind(now - 4_000)
    .bind(now - 900)
    .bind(now - 1_000)
    .bind(now - 900)
    .bind(now - 900)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert paged projection fixture");

    proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect("project first page");
    sqlx::query("UPDATE upstream_reconciliation_work SET completed_generation = work_generation")
        .execute(&proxy.key_store.pool)
        .await
        .expect("settle first projection page");

    assert_eq!(
        proxy
            .key_store
            .upstream_reconciliation_continuation_at()
            .await
            .expect("continue incomplete source projection"),
        Some(now + 1),
        "low-pressure source projection must remain durable work after its current page drains"
    );
    proxy
        .ensure_upstream_reconciliation_representative_job()
        .await
        .expect("enqueue next projection page");
    let continuation: (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), MAX(available_at) FROM scheduled_jobs WHERE job_type = 'upstream_reconciliation' AND status = 'queued'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read next-page representative");
    assert_eq!(continuation, (1, now + 1));

    proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect("project second page");
    let next_page = proxy
        .key_store
        .next_upstream_reconciliation_candidates(1)
        .await
        .expect("select second projected page");
    assert_eq!(next_page.candidates.len(), 1);
    assert_eq!(next_page.candidates[0].token_id, "projection-page-026");

    let _ = std::fs::remove_file(db_path);
}
