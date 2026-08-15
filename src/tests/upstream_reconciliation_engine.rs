use super::upstream_reconciliation::{local_ts, reconciliation_test_db_path};
use super::*;

#[tokio::test]
async fn reconciliation_failure_states_are_independent() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-independent-failures"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    let candidate = UpstreamReconciliationCandidate {
        token_id: "independent-failure-token".to_string(),
        period_code: "2026-07-15/S1".to_string(),
        project_id: "independent-failure-project".to_string(),
        billing_subject: "token:independent-failure-token".to_string(),
        settlement_mode: "shadow".to_string(),
        period_start: now - 4_000,
        period_end: now - 900,
        pending_research: 0,
        degraded: false,
    };
    sqlx::query(
        r#"INSERT INTO upstream_reconciliation_work (
             token_id, period_code, project_id, billing_subject, settlement_mode,
             period_start, period_end, scheduling_key_id, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'independent-failure-key', ?)"#,
    )
    .bind(&candidate.token_id)
    .bind(&candidate.period_code)
    .bind(&candidate.project_id)
    .bind(&candidate.billing_subject)
    .bind(&candidate.settlement_mode)
    .bind(candidate.period_start)
    .bind(candidate.period_end)
    .bind(now)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert durable work");

    proxy
        .key_store
        .mark_reconciliation_retry(
            &candidate,
            "waiting",
            now,
            Some("transport"),
            RECONCILIATION_OUTCOME_TRANSPORT_FAILURE,
            None,
        )
        .await
        .expect("record transport failure");
    proxy
        .key_store
        .mark_reconciliation_retry(
            &candidate,
            "waiting",
            now,
            Some("semantic"),
            RECONCILIATION_OUTCOME_SEMANTIC_FAILURE,
            None,
        )
        .await
        .expect("record semantic failure");
    let state: (i64, i64, i64, i64, i64) = sqlx::query_as(
        r#"SELECT transport_failure_streak, transport_retry_at,
                  semantic_failure_streak, semantic_retry_at, next_attempt_at
           FROM upstream_reconciliation_work
           WHERE token_id = ? AND period_code = ?"#,
    )
    .bind(&candidate.token_id)
    .bind(&candidate.period_code)
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read independent retry state");
    assert_eq!(state, (1, now + 30, 1, now + 300, now + 300));

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_projection_is_cancellation_safe() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let (backend_time, _) = BackendTime::manual_from_ts(1_752_500_000);
    let proxy = Arc::new(
        TavilyProxy::with_options_and_time(
            vec!["tvly-reconciliation-projection-cancel"],
            "http://127.0.0.1:9",
            &db_string,
            TavilyProxyOptions::from_database_path(&db_string),
            backend_time,
        )
        .await
        .expect("create proxy"),
    );
    sqlx::query("DROP TRIGGER trg_upstream_reconciliation_usage_work_insert")
        .execute(&proxy.key_store.pool)
        .await
        .expect("disable live projection");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("mark projection incomplete");
    sqlx::query(
        r#"INSERT INTO upstream_reconciliation_usage (
             token_id, key_id, period_code, project_id, billing_subject,
             period_start, period_end, request_count, first_used_at,
             last_used_at, updated_at, settlement_mode
           ) VALUES ('cancel-token', 'cancel-key', '2026-07-15/S1', 'cancel-project',
                     'token:cancel-token', 1, 2, 1, 1, 2, 2, 'shadow')"#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert pending projection source");
    let lock_pool = connect_sqlite_test_pool(&db_string).await;
    let mut writer = lock_pool.acquire().await.expect("acquire writer");
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *writer)
        .await
        .expect("hold writer lock");
    let cancelled_proxy = Arc::clone(&proxy);
    let task = tokio::spawn(async move {
        cancelled_proxy
            .key_store
            .advance_upstream_reconciliation_work_projection()
            .await
    });
    tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    task.abort();
    assert!(
        task.await
            .expect_err("projection task is cancelled")
            .is_cancelled()
    );
    sqlx::query("ROLLBACK")
        .execute(&mut *writer)
        .await
        .expect("release writer lock");
    drop(writer);
    lock_pool.close().await;

    let cursor: (String, String, String) = sqlx::query_as(
        "SELECT cursor_token_id, cursor_key_id, cursor_period_code FROM upstream_reconciliation_projection_state WHERE id = 'local'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read unchanged cursor");
    assert_eq!(cursor, (String::new(), String::new(), String::new()));
    let tx = proxy
        .key_store
        .sqlite_runtime
        .begin_immediate(SqliteOperation::ReconciliationProjection)
        .await
        .expect("next transaction begins on a clean connection");
    tx.rollback().await.expect("rollback clean transaction");

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_projection_rejects_stale_claim() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let (backend_time, clock) = BackendTime::manual_from_ts(1_752_500_000);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-projection-stale"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("mark projection incomplete");
    let queued = proxy
        .scheduled_job_enqueue("upstream_reconciliation", "auto", None, 1)
        .await
        .expect("enqueue representative");
    let claim = proxy
        .scheduled_job_mark_running(queued.job_id)
        .await
        .expect("claim representative")
        .expect("representative becomes running");
    clock.set_now_ts(1_752_500_061);
    assert_eq!(proxy.recover_stale_scheduled_jobs().await.unwrap(), 1);

    assert_eq!(
        proxy
            .key_store
            .advance_upstream_reconciliation_work_projection_claimed(
                claim.id,
                claim.claim_generation,
            )
            .await
            .expect("reject stale projection claim"),
        ReconciliationProjectionSliceOutcome::StaleClaim
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}
