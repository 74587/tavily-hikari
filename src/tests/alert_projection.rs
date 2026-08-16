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
