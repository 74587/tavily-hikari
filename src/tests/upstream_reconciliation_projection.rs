use super::upstream_reconciliation::{local_ts, reconciliation_test_db_path};
use super::*;

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
        "EXPLAIN QUERY PLAN SELECT EXISTS(SELECT 1 FROM upstream_reconciliation_usage WHERE rowid > 0 LIMIT 1)",
    )
    .fetch_all(&proxy.key_store.pool)
    .await
    .expect("explain projection continuation cursor")
    .into_iter()
    .map(|row| row.try_get("detail").expect("read plan detail"))
    .collect();
    assert!(
        projection_plan
            .iter()
            .any(|detail| detail.contains("USING INTEGER PRIMARY KEY")),
        "the unfinished source projection check must seek by rowid, not scan usage"
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
    proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect("advance first projection page");
    proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect("advance second projection page");
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
        Some(now + 30),
        "the source cursor must remain durable work after its current projected page drains"
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
    assert_eq!(continuation, (1, now + 30));

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
    assert_eq!(next_page.candidates[0].token_id, "projection-page-501");

    let _ = std::fs::remove_file(db_path);
}
