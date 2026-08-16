use super::*;

async fn insert_projected_rate_limit_alert(proxy: &TavilyProxy, token_id: &str, created_at: i64) {
    sqlx::query(
        "INSERT OR IGNORE INTO users (id, display_name, username, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind("projection-user")
    .bind("Projection User")
    .bind("projection-user")
    .bind(created_at)
    .bind(created_at)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert projection user");
    sqlx::query("INSERT INTO auth_tokens (id, secret, created_at) VALUES (?, ?, ?)")
        .bind(token_id)
        .bind(format!("secret-{token_id}"))
        .bind(created_at)
        .execute(&proxy.key_store.pool)
        .await
        .expect("insert projection token");
    sqlx::query(
        "INSERT INTO user_token_bindings (user_id, token_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
    )
    .bind("projection-user")
    .bind(token_id)
    .bind(created_at)
    .bind(created_at)
    .execute(&proxy.key_store.pool)
    .await
    .expect("bind projection token");
    sqlx::query(
        r#"INSERT INTO auth_token_logs (
             token_id, method, path, request_kind_key, request_kind_label,
             request_kind_detail, result_status, error_message, key_effect_code,
             binding_effect_code, selection_effect_code, counts_business_quota, created_at
           ) VALUES (?, 'POST', '/mcp', 'mcp_call', 'MCP call', 'MCP call',
                     'quota_exhausted', 'user request rate limit exceeded on rolling 5m window (limit 25, used 25)',
                     'none', 'none', 'none', 0, ?)"#,
    )
    .bind(token_id)
    .bind(created_at)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert projection alert");
}

async fn advance_alert_projection_until(proxy: &TavilyProxy, projected_events: i64) {
    let mut outcomes = Vec::new();
    for _ in 0..12 {
        let outcome = proxy
            .key_store
            .advance_alert_projection_slice()
            .await
            .expect("advance alert projection slice");
        outcomes.push(format!("{outcome:?}"));
        if matches!(outcome, AlertProjectionSliceOutcome::Deferred { .. }) {
            // Production retries this background slice on a later scheduler wake.
            // Yielding here prevents a test-only tight loop from repeatedly
            // observing the same lazy-pool transition before returned handles
            // become idle.
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        let summary = proxy
            .recent_alerts_summary(24)
            .await
            .expect("read derived alert summary");
        if summary.total_events == projected_events && summary.coverage == "ok" {
            return;
        }
    }
    let summary = proxy
        .recent_alerts_summary(24)
        .await
        .expect("read final derived alert summary");
    panic!(
        "alert projection did not converge: expected {projected_events} events, got {} ({}) after {outcomes:?}",
        summary.total_events, summary.coverage,
    );
}

async fn advance_alert_projection_until_full_coverage(proxy: &TavilyProxy) {
    let mut outcomes = Vec::new();
    for _ in 0..24 {
        let outcome = proxy
            .key_store
            .advance_alert_projection_slice()
            .await
            .expect("advance alert projection history slice");
        outcomes.push(format!("{outcome:?}"));
        if matches!(outcome, AlertProjectionSliceOutcome::Deferred { .. }) {
            tokio::time::sleep(std::time::Duration::from_millis(10)).await;
        }
        let status = proxy
            .dashboard_alert_projection_status()
            .await
            .expect("read projection coverage");
        if status.coverage == "ok" {
            return;
        }
    }
    let status = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read final projection coverage");
    panic!(
        "alert projection history did not converge: {} after {outcomes:?}",
        status.coverage
    );
}

#[tokio::test]
async fn alert_projection_cursor_replays_tail_without_duplicates() {
    let db_path = temp_db_path("alert-projection-tail");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_500_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-tail".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    insert_projected_rate_limit_alert(&proxy, "projection-token-a", now).await;
    advance_alert_projection_until(&proxy, 1).await;
    let initial = proxy
        .recent_alerts_summary(24)
        .await
        .expect("read derived alert summary");
    assert_eq!(initial.total_events, 1);
    assert_eq!(initial.coverage, "ok");

    drop(proxy);
    let (resumed_time, _) = BackendTime::manual_from_ts(now + 1);
    let resumed = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-tail".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        resumed_time,
    )
    .await
    .expect("reopen proxy with projected alert cursor");
    insert_projected_rate_limit_alert(&resumed, "projection-token-b", now + 1).await;
    advance_alert_projection_until(&resumed, 2).await;
    let replayed = resumed
        .recent_alerts_summary(24)
        .await
        .expect("read tail-replayed alert summary");
    assert_eq!(replayed.total_events, 2);
    assert!(!replayed.stale);

    drop(resumed);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_serves_admin_events_and_groups_after_full_coverage() {
    let db_path = temp_db_path("alert-projection-admin-read-model");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_550_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-admin-read-model".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    insert_projected_rate_limit_alert(&proxy, "projection-admin-token", now).await;
    advance_alert_projection_until(&proxy, 1).await;
    advance_alert_projection_until_full_coverage(&proxy).await;
    let status = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read complete projection status");
    assert_eq!(status.coverage, "ok");

    // A complete projection is the administrator read source. Removing the
    // original alert source makes this regression fail if events or groups
    // accidentally rebuild their CTE from auth_token_logs.
    sqlx::query("DROP TABLE auth_token_logs")
        .execute(&proxy.key_store.pool)
        .await
        .expect("remove raw alert source after projection completed");

    let events = proxy
        .alert_events_page(None, None, None, None, None, None, &[], 1, 20)
        .await
        .expect("read projected administrator events");
    assert_eq!(events.total, 1);
    assert_eq!(events.items.len(), 1);
    assert_eq!(events.items[0].source.kind, ALERT_SOURCE_AUTH_TOKEN_LOG);

    let catalog = proxy
        .alert_catalog()
        .await
        .expect("read projected administrator alert catalog");
    assert_eq!(catalog.types.iter().map(|item| item.count).sum::<i64>(), 1);
    assert_eq!(catalog.tokens.len(), 1);

    let groups = proxy
        .alert_groups_page(None, None, None, None, None, None, &[], 1, 20)
        .await
        .expect("read projected administrator groups");
    assert_eq!(groups.total, 1);
    assert_eq!(groups.items.len(), 1);
    assert_eq!(
        groups.items[0].latest_event.source.kind,
        ALERT_SOURCE_AUTH_TOKEN_LOG
    );

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_keeps_dashboard_tail_complete_while_history_catches_up() {
    let db_path = temp_db_path("alert-projection-independent-history");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_560_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-independent-history".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    let history_at = now - 60 * 24 * 60 * 60;
    for index in 0..26 {
        insert_projected_rate_limit_alert(
            &proxy,
            &format!("projection-history-{index}"),
            history_at,
        )
        .await;
    }
    insert_projected_rate_limit_alert(&proxy, "projection-recent", now).await;

    for _ in 0..12 {
        proxy
            .key_store
            .advance_alert_projection_slice()
            .await
            .expect("advance independent projection lane");
        let status = proxy
            .dashboard_alert_projection_status()
            .await
            .expect("read projection status");
        let recent = proxy
            .recent_alerts_summary(24)
            .await
            .expect("read recent projected alert summary");
        if status.recent_coverage == "ok" && status.coverage == "projecting" {
            assert_eq!(recent.total_events, 1);
            assert!(!recent.stale);
            break;
        }
    }

    let status = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read final independent projection status");
    assert_eq!(status.recent_coverage, "ok");
    assert_eq!(status.coverage, "projecting");

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_does_not_offer_partial_tail_as_dashboard_data() {
    let db_path = temp_db_path("alert-projection-dashboard-partial");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_565_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-dashboard-partial".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    insert_projected_rate_limit_alert(&proxy, "projection-unprojected", now).await;
    let raw_projection = proxy
        .recent_alerts_summary(24)
        .await
        .expect("inspect incomplete projection");
    assert!(raw_projection.stale);
    assert_eq!(raw_projection.coverage, "projecting");
    assert!(
        proxy.dashboard_recent_alerts_summary(24).await.is_err(),
        "Dashboard must retain last-good data instead of accepting partial alerts"
    );

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_recent_summary_does_not_silently_truncate_events() {
    let db_path = temp_db_path("alert-projection-summary-exact-count");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_570_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-summary-exact-count".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    let payload = serde_json::json!({
        "source_kind": ALERT_SOURCE_AUTH_TOKEN_LOG,
        "source_id": "placeholder",
        "row_sort_id": "placeholder",
        "alert_type": ALERT_TYPE_UPSTREAM_RATE_LIMITED_429,
        "occurred_at": now,
        "token_id": "projection-summary-token",
        "key_id": null,
        "request_log_id": null,
        "method": null,
        "path": null,
        "query": null,
        "request_kind_key": null,
        "request_kind_label": null,
        "request_kind_detail": null,
        "result_status": null,
        "failure_kind": null,
        "error_message": null,
        "counts_business_quota": null,
        "user_id": null,
        "user_display_name": null,
        "user_username": null,
        "reason_code": null,
        "reason_summary": null,
        "reason_detail": null,
        "job_id": null,
        "job_type": null,
        "job_trigger_source": null,
        "job_status": null,
        "job_attempt": null,
        "job_message": null,
        "job_queued_at": null,
        "job_started_at": null,
        "job_finished_at": null,
    });
    let mut tx = proxy
        .key_store
        .pool
        .begin()
        .await
        .expect("begin sidecar seed");
    for index in 0..10_001_i64 {
        let source_id = format!("summary-{index}");
        let row_sort_id = format!("atl:{index:020}");
        let mut row = payload.clone();
        row["source_id"] = serde_json::Value::String(source_id.clone());
        row["row_sort_id"] = serde_json::Value::String(row_sort_id.clone());
        sqlx::query(
            r#"INSERT INTO observability.dashboard_alert_projection_events
                    (source_kind, source_id, occurred_at, row_sort_id, payload_json, projected_at)
               VALUES (?, ?, ?, ?, ?, ?)"#,
        )
        .bind(ALERT_SOURCE_AUTH_TOKEN_LOG)
        .bind(source_id)
        .bind(now)
        .bind(row_sort_id)
        .bind(row.to_string())
        .bind(now)
        .execute(&mut *tx)
        .await
        .expect("seed exact projected alert count");
    }
    tx.commit().await.expect("commit sidecar seed");
    sqlx::query(
        "UPDATE observability.dashboard_alert_projection_state \
         SET phase = 'idle', observed_at = ?, stale_reason = NULL",
    )
    .bind(now)
    .execute(&proxy.key_store.pool)
    .await
    .expect("mark Dashboard tail complete");

    let summary = proxy
        .dashboard_recent_alerts_summary(24)
        .await
        .expect("read exact derived summary");
    assert_eq!(summary.total_events, 10_001);
    assert_eq!(
        summary
            .counts_by_type
            .iter()
            .find(|count| count.alert_type == ALERT_TYPE_UPSTREAM_RATE_LIMITED_429)
            .map(|count| count.count),
        Some(10_001)
    );

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_admin_history_migration_preserves_sidecar_and_restarts_cursors() {
    let db_path = temp_db_path("alert-projection-admin-history-migration");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_575_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-admin-history-migration".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    let recent_window_start = now.saturating_sub(30 * 24 * 60 * 60);
    insert_projected_rate_limit_alert(&proxy, "projection-history-token", now).await;
    insert_projected_rate_limit_alert(
        &proxy,
        "projection-history-boundary-token",
        recent_window_start.saturating_sub(1),
    )
    .await;
    advance_alert_projection_until(&proxy, 1).await;
    sqlx::query(
        "UPDATE observability.dashboard_alert_projection_state \
         SET cursor_occurred_at = ?, cursor_row_sort_id = 'legacy-window', \
             phase = 'idle', observed_at = ?",
    )
    .bind(recent_window_start)
    .bind(now)
    .execute(&proxy.key_store.pool)
    .await
    .expect("simulate a completed recent-window projection");
    sqlx::query("DELETE FROM schema_migrations WHERE version = 14")
        .execute(&proxy.key_store.pool)
        .await
        .expect("simulate a pre-admin-history ledger");
    sqlx::query("DROP TABLE observability.dashboard_alert_projection_history_state")
        .execute(&proxy.key_store.pool)
        .await
        .expect("simulate a pre-admin-history sidecar");

    proxy
        .key_store
        .prepare_versioned_schema()
        .await
        .expect("apply the cursor-only administrator history migration");

    let (preserved_tail_sources, reset_history_sources, retained_events): (i64, i64, i64) = sqlx::query_as(
        "SELECT \
           (SELECT COUNT(*) FROM observability.dashboard_alert_projection_state \
             WHERE cursor_occurred_at = ? AND cursor_row_sort_id = 'legacy-window' AND phase = 'idle'), \
           (SELECT COUNT(*) FROM observability.dashboard_alert_projection_history_state \
             WHERE cursor_occurred_at = 0 AND cursor_row_sort_id = '' AND phase = 'catching_up'), \
           (SELECT COUNT(*) FROM observability.dashboard_alert_projection_events)",
    )
    .bind(recent_window_start)
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("verify cursor-only administrator history migration");
    assert_eq!(
        preserved_tail_sources, 3,
        "Dashboard tail must keep its complete cursor"
    );
    assert_eq!(
        reset_history_sources, 3,
        "admin history starts from an independent cursor"
    );
    assert_eq!(retained_events, 1, "migration must not rewrite the sidecar");

    advance_alert_projection_until_full_coverage(&proxy).await;
    let historical_boundary_events: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM observability.dashboard_alert_projection_events \
         WHERE source_kind = 'auth_token_log'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read projected history boundary events");
    assert_eq!(
        historical_boundary_events, 2,
        "history must include an alert from the second immediately below the tail boundary"
    );

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_idle_probe_does_not_persist_empty_cursors() {
    let db_path = temp_db_path("alert-projection-idle-no-write");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_575_100;
    let (backend_time, clock) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-idle-no-write".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    advance_alert_projection_until_full_coverage(&proxy).await;
    let before: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT SUM(generation) FROM observability.dashboard_alert_projection_state \
         UNION ALL \
         SELECT SUM(generation) FROM observability.dashboard_alert_projection_history_state",
    )
    .fetch_all(&proxy.key_store.pool)
    .await
    .expect("read cursor generations before idle probe")
    .into_iter()
    .sum();
    let outcome = proxy
        .key_store
        .advance_alert_projection_slice()
        .await
        .expect("run empty alert projection probe");
    assert_eq!(outcome, AlertProjectionSliceOutcome::Idle);
    let after: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT SUM(generation) FROM observability.dashboard_alert_projection_state \
         UNION ALL \
         SELECT SUM(generation) FROM observability.dashboard_alert_projection_history_state",
    )
    .fetch_all(&proxy.key_store.pool)
    .await
    .expect("read cursor generations after idle probe")
    .into_iter()
    .sum();
    assert_eq!(
        after, before,
        "an empty probe must not write projection state"
    );

    clock.advance_wall(std::time::Duration::from_secs(91));
    let stale = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read expired tail coverage");
    assert_eq!(stale.recent_coverage, "stale");
    assert!(
        proxy
            .refresh_dashboard_alert_projection_observation()
            .await
            .expect("refresh idle projection observation")
    );
    let recovered = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read refreshed tail coverage");
    assert_eq!(recovered.recent_coverage, "ok");
    let heartbeat_generation: i64 = sqlx::query_scalar::<_, i64>(
        "SELECT SUM(generation) FROM observability.dashboard_alert_projection_state \
         UNION ALL \
         SELECT SUM(generation) FROM observability.dashboard_alert_projection_history_state",
    )
    .fetch_all(&proxy.key_store.pool)
    .await
    .expect("read cursor generations after idle heartbeat")
    .into_iter()
    .sum();
    assert_eq!(
        heartbeat_generation, before,
        "the observation heartbeat must not advance a projection cursor"
    );

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_marks_expired_observation_as_stale() {
    let db_path = temp_db_path("alert-projection-stale-observation");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_500_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-stale".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");

    for _ in 0..3 {
        proxy
            .advance_dashboard_alert_projection_slice()
            .await
            .expect("observe each projection source");
    }
    sqlx::query(
        "UPDATE observability.dashboard_alert_projection_state \
         SET phase = 'idle', observed_at = ?, stale_reason = NULL",
    )
    .bind(now - 91)
    .execute(&proxy.key_store.pool)
    .await
    .expect("expire projection observations");

    let status = proxy
        .dashboard_alert_projection_status()
        .await
        .expect("read alert projection coverage");
    assert_eq!(status.coverage, "stale");
    assert_eq!(status.stale_reason.as_deref(), Some("observation_expired"));

    drop(proxy);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}

#[tokio::test]
async fn alert_projection_writer_contention_is_a_typed_defer() {
    let db_path = temp_db_path("alert-projection-writer-contention");
    let db_string = db_path.to_string_lossy().to_string();
    let now = 1_752_600_000;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-contention".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    insert_projected_rate_limit_alert(&proxy, "projection-token-contention", now).await;

    let mut holder =
        connect_sqlite_test_connection(&db_string, false, false, std::time::Duration::ZERO).await;
    sqlx::query("BEGIN IMMEDIATE")
        .execute(&mut holder)
        .await
        .expect("hold writer lock");

    let started = std::time::Instant::now();
    let outcome = proxy
        .key_store
        .advance_alert_projection_slice()
        .await
        .expect("writer contention is an expected projection defer");
    assert!(
        matches!(
            outcome,
            AlertProjectionSliceOutcome::Deferred {
                reason: SqliteAdmissionDeferReason::RecentContention
            }
        ),
        "expected a typed contention defer, got {outcome:?}"
    );
    assert!(
        started.elapsed() < std::time::Duration::from_millis(250),
        "projection must yield instead of waiting behind the writer lock"
    );

    sqlx::query("ROLLBACK")
        .execute(&mut holder)
        .await
        .expect("release writer lock");
    drop(holder);
    // Restart recovery uses a fresh runtime rather than relying on a
    // contention cooldown. The deferred slice did not advance its cursor,
    // so the durable source fence can safely replay it.
    drop(proxy);
    let (resumed_time, _) = BackendTime::manual_from_ts(now + 1);
    let resumed = TavilyProxy::with_options_and_time(
        vec!["tvly-alert-projection-contention".to_string()],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        resumed_time,
    )
    .await
    .expect("reopen after writer contention");
    advance_alert_projection_until(&resumed, 1).await;

    drop(resumed);
    let _ = std::fs::remove_file(&db_path);
    let _ = std::fs::remove_file(db_path.with_extension("db-shm"));
    let _ = std::fs::remove_file(db_path.with_extension("db-wal"));
}
