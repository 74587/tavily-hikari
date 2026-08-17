use super::*;

async fn enable_reconciliation_shadow(proxy: &TavilyProxy) {
    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_project_id_mode = UpstreamProjectIdMode::AccessToken;
    settings.api_rebalance_enabled = true;
    settings.api_rebalance_percent = 100;
    settings.rebalance_mcp_enabled = true;
    settings.rebalance_mcp_session_percent = 100;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("enable shadow prerequisites");
}

#[tokio::test]
async fn reconciliation_controller_boundary_keeps_legacy_epoch_unset() {
    let db_path = temp_db_path("reconciliation-controller-legacy-boundary");
    let db_string = db_path.to_string_lossy().to_string();
    let now = business_period_for_timestamp(1_752_500_000).starts_at + 60;
    let (backend_time, clock) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-shadow-compare-epoch"],
        DEFAULT_UPSTREAM,
        &db_string,
        TavilyProxyOptions::from_database_path(&db_string),
        backend_time,
    )
    .await
    .expect("create proxy");
    enable_reconciliation_shadow(&proxy).await;

    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_precise_reconciliation_enabled = true;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("save precise settings");

    assert!(
        proxy
            .key_store
            .upstream_reconciliation_shadow_compare_active_with_settings(&settings)
            .await
            .expect("compute compare-active state before controller boundary")
    );
    let activation_boundary = proxy
        .key_store
        .upstream_reconciliation_control_state()
        .await
        .expect("load controller activation boundary")
        .activation_period_start
        .expect("new active controller records the next full period boundary");
    assert_eq!(
        activation_boundary,
        business_period_for_timestamp(now).ends_at
    );
    assert!(
        proxy
            .key_store
            .get_meta_i64("upstream_reconciliation_ready_after_v1")
            .await
            .expect("load legacy reconciliation epoch after controller activation")
            .unwrap_or(0)
            <= 0,
        "the controller must not create a positive legacy readiness boundary"
    );

    clock.set_now_ts(activation_boundary + 1);
    assert!(
        !proxy
            .key_store
            .upstream_reconciliation_shadow_compare_active_with_settings(&settings)
            .await
            .expect("compute compare-active state after controller boundary")
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_active_boundary_preserves_billing_truth() {
    let db_path = temp_db_path("reconciliation-controller-boundary");
    let db_str = db_path.to_string_lossy().to_string();
    let now = business_period_for_timestamp(1_752_500_000).starts_at + 60;
    let (backend_time, clock) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-controller-boundary".to_string()],
        DEFAULT_UPSTREAM,
        &db_str,
        TavilyProxyOptions::from_database_path(&db_str),
        backend_time,
    )
    .await
    .expect("create proxy");
    enable_reconciliation_shadow(&proxy).await;

    let current = business_period_for_timestamp(clock.now_ts());
    sqlx::query(
        r#"INSERT INTO upstream_reconciliation_work (
             token_id, period_code, project_id, billing_subject, settlement_mode,
             period_start, period_end, scheduling_key_id, updated_at,
             work_generation, completed_generation, last_outcome
           ) VALUES ('historical-token', ?, 'project', 'token:historical-token', 'shadow',
                     ?, ?, 'historical-key', ?, 1, 1, 'observed')"#,
    )
    .bind(&current.code)
    .bind(current.starts_at)
    .bind(current.ends_at)
    .bind(clock.now_ts())
    .execute(&proxy.key_store.pool)
    .await
    .expect("seed historical observed work");

    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_precise_reconciliation_enabled = true;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("request active mode");
    let controller = proxy
        .key_store
        .upstream_reconciliation_control_state()
        .await
        .expect("read controller");
    assert_eq!(controller.mode, ReconciliationMode::Active);
    assert!(!controller.legacy_active);
    assert_eq!(controller.activation_period_start, Some(current.ends_at));

    proxy
        .key_store
        .record_upstream_reconciliation_usage(
            "current-token",
            "current-key",
            "token:current-token",
            None,
        )
        .await
        .expect("record current-period usage");
    let current_mode: String = sqlx::query_scalar(
        "SELECT settlement_mode FROM upstream_reconciliation_usage WHERE token_id = 'current-token'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read current usage mode");
    assert_eq!(current_mode, "shadow");

    clock.set_now_ts(current.ends_at.saturating_add(1));
    proxy
        .key_store
        .record_upstream_reconciliation_usage("next-token", "next-key", "token:next-token", None)
        .await
        .expect("record next-period usage");
    let next_mode: String = sqlx::query_scalar(
        "SELECT settlement_mode FROM upstream_reconciliation_usage WHERE token_id = 'next-token'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read next usage mode");
    assert_eq!(next_mode, "actual");

    let historical: (String, i64, String) = sqlx::query_as(
        "SELECT settlement_mode, completed_generation, last_outcome FROM upstream_reconciliation_work WHERE token_id = 'historical-token'",
    )
    .fetch_one(&proxy.key_store.pool)
    .await
    .expect("read historical work");
    assert_eq!(
        historical,
        ("shadow".to_string(), 1, "observed".to_string())
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_controller_ha_control_baseline_replicates_switch_state() {
    let source_path = temp_db_path("reconciliation-controller-ha-source");
    let source_db = source_path.to_string_lossy().to_string();
    let source = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-controller-ha-source".to_string()],
        DEFAULT_UPSTREAM,
        &source_db,
    )
    .await
    .expect("create source");
    enable_reconciliation_shadow(&source).await;
    let mut settings = source.get_system_settings().await.expect("source settings");
    settings.upstream_precise_reconciliation_enabled = true;
    source
        .set_system_settings(&settings)
        .await
        .expect("activate source");
    let baseline = source
        .key_store
        .export_ha_baseline_ndjson(HaSyncChannel::Control, "source")
        .await
        .expect("export control baseline");
    assert!(
        baseline
            .ndjson
            .contains("upstream_reconciliation_control_state")
    );
    assert!(
        baseline
            .ndjson
            .contains(META_KEY_UPSTREAM_PRECISE_RECONCILIATION_ENABLED_V1)
    );

    let target_path = temp_db_path("reconciliation-controller-ha-target");
    let target_db = target_path.to_string_lossy().to_string();
    let target = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-controller-ha-target".to_string()],
        DEFAULT_UPSTREAM,
        &target_db,
    )
    .await
    .expect("create target");
    target
        .key_store
        .apply_ha_baseline_ndjson(HaSyncChannel::Control, &baseline.ndjson)
        .await
        .expect("apply control baseline");
    let state = target
        .key_store
        .upstream_reconciliation_control_state()
        .await
        .expect("read replicated controller");
    assert_eq!(state.mode, ReconciliationMode::Active);
    assert!(!state.legacy_active);
    assert!(
        target
            .get_system_settings()
            .await
            .expect("read replicated settings")
            .upstream_precise_reconciliation_enabled
    );

    drop(source);
    drop(target);
    let _ = std::fs::remove_file(source_path);
    let _ = std::fs::remove_file(target_path);
}

#[tokio::test]
async fn reconciliation_controller_ha_control_events_replicate_switch_state() {
    let source_path = temp_db_path("reconciliation-controller-ha-events-source");
    let source_db = source_path.to_string_lossy().to_string();
    let source = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-controller-ha-events-source".to_string()],
        DEFAULT_UPSTREAM,
        &source_db,
    )
    .await
    .expect("create source");
    enable_reconciliation_shadow(&source).await;
    source
        .key_store
        .configure_ha_event_writes(HaMode::ActiveStandby)
        .await
        .expect("enable source control outbox triggers");

    let mut settings = source.get_system_settings().await.expect("source settings");
    settings.upstream_precise_reconciliation_enabled = true;
    source
        .set_system_settings(&settings)
        .await
        .expect("activate source controller");
    let events = source
        .key_store
        .list_ha_events_after(HaSyncChannel::Control, 0, 100)
        .await
        .expect("read controller events");
    assert!(
        events
            .iter()
            .any(|event| { event.resource == "upstream_reconciliation_control_state" })
    );
    assert!(
        events
            .iter()
            .any(|event| { event.resource == "upstream_reconciliation_control_transitions" })
    );

    let mut lines = vec![serde_json::json!({
        "schemaVersion": 3,
        "kind": "events_start",
        "channel": "control",
        "after": 0,
        "limit": events.len(),
    })];
    for event in &events {
        lines.push(serde_json::json!({
            "schemaVersion": 3,
            "kind": "event",
            "channel": "control",
            "event": event,
        }));
    }
    lines.push(serde_json::json!({
        "schemaVersion": 3,
        "kind": "events_end",
        "channel": "control",
        "lastSeq": events.last().map_or(0, |event| event.seq),
        "eventCount": events.len(),
    }));
    let ndjson = lines
        .into_iter()
        .map(|line| line.to_string())
        .collect::<Vec<_>>()
        .join("\n");

    let target_path = temp_db_path("reconciliation-controller-ha-events-target");
    let target_db = target_path.to_string_lossy().to_string();
    let target = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-controller-ha-events-target".to_string()],
        DEFAULT_UPSTREAM,
        &target_db,
    )
    .await
    .expect("create target");
    target
        .key_store
        .apply_ha_events_ndjson(HaSyncChannel::Control, &ndjson)
        .await
        .expect("apply controller control events");
    let state = target
        .key_store
        .upstream_reconciliation_control_state()
        .await
        .expect("read replicated controller event state");
    assert_eq!(state.mode, ReconciliationMode::Active);
    assert!(!state.legacy_active);
    assert!(state.activation_period_start.is_some());

    drop(source);
    drop(target);
    let _ = std::fs::remove_file(source_path);
    let _ = std::fs::remove_file(target_path);
}

#[tokio::test]
async fn reconciliation_legacy_toggle_transitions_without_preflight_blocker() {
    let db_path = temp_db_path("reconciliation-controller-toggle");
    let db_str = db_path.to_string_lossy().to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-reconciliation-controller-toggle".to_string()],
        DEFAULT_UPSTREAM,
        &db_str,
    )
    .await
    .expect("create proxy");

    let mut settings = proxy.get_system_settings().await.expect("load settings");
    assert!(
        !settings.api_rebalance_enabled && !settings.rebalance_mcp_enabled,
        "the test must not manufacture reconciliation readiness before the sole mode action"
    );
    settings.upstream_precise_reconciliation_enabled = true;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("enable active controller without a preflight");
    assert_eq!(
        proxy
            .key_store
            .upstream_reconciliation_control_state()
            .await
            .expect("read active controller")
            .mode,
        ReconciliationMode::Active
    );

    settings.upstream_precise_reconciliation_enabled = false;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("return controller to compare");
    assert_eq!(
        proxy
            .key_store
            .upstream_reconciliation_control_state()
            .await
            .expect("read compare controller")
            .mode,
        ReconciliationMode::Compare
    );

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}

#[tokio::test]
async fn reconciliation_integrity_pause_requires_a_new_legacy_switch_write_to_resume() {
    let db_path = temp_db_path("reconciliation-controller-integrity-pause");
    let db_str = db_path.to_string_lossy().to_string();
    let now = business_period_for_timestamp(1_752_500_000).starts_at + 60;
    let (backend_time, _) = BackendTime::manual_from_ts(now);
    let proxy = TavilyProxy::with_options_and_time(
        vec!["tvly-reconciliation-controller-integrity-pause".to_string()],
        DEFAULT_UPSTREAM,
        &db_str,
        TavilyProxyOptions::from_database_path(&db_str),
        backend_time,
    )
    .await
    .expect("create proxy");
    enable_reconciliation_shadow(&proxy).await;

    let mut settings = proxy.get_system_settings().await.expect("load settings");
    settings.upstream_precise_reconciliation_enabled = true;
    proxy
        .set_system_settings(&settings)
        .await
        .expect("activate controller");
    proxy
        .key_store
        .pause_upstream_reconciliation_for_integrity("test_integrity_failure")
        .await
        .expect("pause controller");
    assert!(
        !proxy
            .get_system_settings()
            .await
            .expect("load paused settings")
            .upstream_precise_reconciliation_enabled
    );
    assert_eq!(
        proxy
            .key_store
            .upstream_reconciliation_control_state()
            .await
            .expect("read paused state")
            .mode,
        ReconciliationMode::ActivePaused
    );

    let mut resumed = proxy
        .get_system_settings()
        .await
        .expect("load paused settings");
    resumed.upstream_precise_reconciliation_enabled = true;
    proxy
        .set_system_settings(&resumed)
        .await
        .expect("resume controller with the existing switch");
    let controller = proxy
        .key_store
        .upstream_reconciliation_control_state()
        .await
        .expect("read resumed state");
    assert_eq!(controller.mode, ReconciliationMode::Active);
    assert!(!controller.legacy_active);
    assert!(controller.activation_period_start.is_some());

    drop(proxy);
    let _ = std::fs::remove_file(db_path);
}
