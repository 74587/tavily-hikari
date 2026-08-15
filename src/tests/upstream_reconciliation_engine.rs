use super::upstream_reconciliation::{local_ts, reconciliation_test_db_path};
use super::*;

#[test]
fn projection_defer_does_not_block_existing_main_candidates() {
    assert!(!ReconciliationEngine::projection_defer_exhausts_preparation(20));
    assert!(ReconciliationEngine::projection_defer_exhausts_preparation(
        0
    ));
}

#[tokio::test]
async fn reconciliation_one_shot_waits_for_a_transient_bulk_admission() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let (backend_time, _) = BackendTime::manual_from_ts(1_752_500_000);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-one-shot-admission"],
        "http://127.0.0.1:9",
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    let admission = tokio::time::timeout(std::time::Duration::from_secs(1), async {
        loop {
            match proxy.admit_upstream_reconciliation_projection() {
                SqliteAdmissionOutcome::Admitted(admission) => return admission,
                SqliteAdmissionOutcome::Deferred { .. } => {
                    tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                }
            }
        }
    })
    .await
    .expect("obtain temporary reconciliation admission");

    let release_admission = async {
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
        drop(admission);
    };
    let (settled, ()) = tokio::join!(
        proxy.run_upstream_reconciliation_once("http://127.0.0.1:9"),
        release_admission,
    );
    assert_eq!(
        settled.expect("one-shot reconciliation completes after admission clears"),
        0
    );

    let _ = std::fs::remove_file(db_path);
}

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
async fn claimed_projection_keeps_its_admission_after_the_caller_is_cancelled() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let proxy = Arc::new(
        TavilyProxy::with_endpoint(
            vec!["tvly-reconciliation-projection-owner"],
            "http://127.0.0.1:9",
            &db_string,
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
           ) VALUES ('owner-token', 'owner-key', '2026-07-15/S1', 'owner-project',
                     'token:owner-token', 1, 2, 1, 1, 2, 2, 'shadow')"#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert pending projection source");
    let queued = proxy
        .scheduled_job_enqueue("upstream_reconciliation", "auto", None, 1)
        .await
        .expect("enqueue representative");
    let claim = proxy
        .scheduled_job_mark_running(queued.job_id)
        .await
        .expect("claim representative")
        .expect("representative becomes running");
    let admission = match proxy.admit_upstream_reconciliation_projection() {
        SqliteAdmissionOutcome::Admitted(admission) => admission,
        SqliteAdmissionOutcome::Deferred { reason } => panic!("admission deferred: {reason}"),
    };
    let lock_pool = connect_sqlite_test_pool(&db_string).await;
    let mut writer = lock_pool.acquire().await.expect("acquire writer");
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *writer)
        .await
        .expect("hold writer lock");

    let cancelled_proxy = Arc::clone(&proxy);
    let task = tokio::spawn(async move {
        cancelled_proxy
            .advance_claimed_reconciliation_projection_safe(
                claim.id,
                claim.claim_generation,
                admission,
            )
            .await
    });
    tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    task.abort();
    assert!(task.await.expect_err("caller is cancelled").is_cancelled());
    sqlx::query("ROLLBACK")
        .execute(&mut *writer)
        .await
        .expect("release writer lock");
    drop(writer);
    lock_pool.close().await;

    tokio::time::timeout(std::time::Duration::from_secs(1), async {
        loop {
            let scanned_rows: i64 = sqlx::query_scalar(
                "SELECT scanned_rows FROM upstream_reconciliation_projection_state WHERE id = 'local'",
            )
            .fetch_one(&proxy.key_store.pool)
            .await
            .expect("read projection progress");
            if scanned_rows > 0 {
                break;
            }
            tokio::task::yield_now().await;
        }
    })
    .await
    .expect("detached projection reaches its durable boundary");
    assert_eq!(
        proxy
            .key_store
            .sqlite_runtime
            .discarded_connections_for_test(SqliteOperation::ReconciliationProjection),
        0,
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_projection_rolls_back_sql_errors_without_discarding_connection() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-projection-error"],
        "http://127.0.0.1:9",
        &db_string,
    )
    .await
    .expect("create proxy");
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
           ) VALUES ('error-token', 'error-key', '2026-07-15/S1', 'error-project',
                     'token:error-token', 1, 2, 1, 1, 2, 2, 'shadow')"#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert pending projection source");
    sqlx::query(
        r#"CREATE TRIGGER fail_projection_work_insert
           BEFORE INSERT ON upstream_reconciliation_work
           BEGIN
             SELECT RAISE(ABORT, 'injected projection write failure');
           END"#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("inject projection write failure");

    let err = proxy
        .key_store
        .advance_upstream_reconciliation_work_projection()
        .await
        .expect_err("projection write fails");
    assert!(
        err.to_string()
            .contains("injected projection write failure")
    );
    assert_eq!(
        proxy
            .key_store
            .sqlite_runtime
            .discarded_connections_for_test(SqliteOperation::ReconciliationProjection),
        0,
        "ordinary SQL errors must rollback instead of discarding the connection"
    );
    let tx = proxy
        .key_store
        .sqlite_runtime
        .begin_immediate(SqliteOperation::ReconciliationProjection)
        .await
        .expect("next transaction begins on the rolled-back connection");
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

#[tokio::test]
async fn unclaimed_projection_preserves_typed_defer() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-projection-defer"],
        "http://127.0.0.1:9",
        &db_string,
    )
    .await
    .expect("create proxy");
    sqlx::query(
        "UPDATE upstream_reconciliation_projection_state SET completed = 0 WHERE id = 'local'",
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("mark projection incomplete");
    let lock_pool = connect_sqlite_test_pool(&db_string).await;
    let mut writer = lock_pool.acquire().await.expect("acquire writer");
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut *writer)
        .await
        .expect("hold writer lock");

    assert!(matches!(
        proxy
            .key_store
            .advance_upstream_reconciliation_work_projection()
            .await
            .expect("projection returns typed pressure"),
        ReconciliationProjectionSliceOutcome::Deferred {
            reason: "sqlite_pressure"
        }
    ));

    sqlx::query("ROLLBACK")
        .execute(&mut *writer)
        .await
        .expect("release writer lock");
    drop(writer);
    lock_pool.close().await;
    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_without_an_eligible_key_records_semantic_retry() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-missing-key"],
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
        .expect("enable compare reconciliation");
    sqlx::query(
        r#"INSERT INTO upstream_reconciliation_work (
             token_id, period_code, project_id, billing_subject, settlement_mode,
             period_start, period_end, scheduling_key_id, updated_at
           ) VALUES ('missing-key-token', '2026-07-15/S1', 'missing-key-project',
                     'token:missing-key-token', 'shadow', ?, ?, 'deleted-key', ?)"#,
    )
    .bind(now - 4_000)
    .bind(now - 900)
    .bind(now - 900)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert work without an eligible key");

    proxy
        .run_upstream_reconciliation_once("http://127.0.0.1:9")
        .await
        .expect("run reconciliation without a key");
    let retry: (String, i64, i64, i64) = sqlx::query_as(
        r#"SELECT last_outcome, semantic_failure_streak, semantic_retry_at,
                  completed_generation
           FROM upstream_reconciliation_work
           WHERE token_id = 'missing-key-token' AND period_code = '2026-07-15/S1'"#,
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read semantic retry state");
    assert_eq!(retry.0, RECONCILIATION_OUTCOME_SEMANTIC_FAILURE);
    assert_eq!(retry.1, 1);
    assert_eq!(retry.2, now + 300);
    assert_eq!(retry.3, 0, "retryable work must remain incomplete");

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_does_not_partially_fetch_a_candidate_over_remote_limit() {
    let db_path = reconciliation_test_db_path();
    let db_string = db_path.to_string_lossy().to_string();
    let now = local_ts(2026, 7, 15, 12, 0);
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-multi-key"],
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
        .expect("enable compare reconciliation");
    for index in 0..3 {
        let key_id = proxy
            .add_or_undelete_key(&format!("tvly-reconciliation-multi-key-{index}"))
            .await
            .expect("create upstream key");
        sqlx::query(
            r#"INSERT INTO upstream_reconciliation_usage (
                 token_id, key_id, period_code, project_id, billing_subject,
                 period_start, period_end, request_count, first_used_at,
                 last_used_at, updated_at, settlement_mode
               ) VALUES ('multi-key-token', ?, '2026-07-15/S1', 'multi-key-project',
                         'token:multi-key-token', ?, ?, 1, ?, ?, ?, 'shadow')"#,
        )
        .bind(key_id)
        .bind(now - 4_000)
        .bind(now - 900)
        .bind(now - 1_000)
        .bind(now - 900)
        .bind(now - 900)
        .execute(&proxy.key_store.pool)
        .await
        .expect("insert multi-key usage");
    }

    proxy
        .run_upstream_reconciliation_once("http://127.0.0.1:9")
        .await
        .expect("classify candidate before remote fetch");
    let state: (String, i64, i64) = sqlx::query_as(
        r#"SELECT last_outcome, semantic_failure_streak, completed_generation
           FROM upstream_reconciliation_work
           WHERE token_id = 'multi-key-token' AND period_code = '2026-07-15/S1'"#,
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read multi-key retry state");
    assert_eq!(state.0, RECONCILIATION_OUTCOME_SEMANTIC_FAILURE);
    assert_eq!(state.1, 1);
    assert_eq!(state.2, 0, "partial fetch must not complete work");

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}
