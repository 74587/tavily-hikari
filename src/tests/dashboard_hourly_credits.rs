use super::*;

#[tokio::test]
async fn dashboard_hourly_request_window_reports_local_and_sampled_upstream_credits() {
    let db_path = temp_db_path("dashboard-hourly-credit-window");
    let db_str = db_path.to_string_lossy().to_string();

    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-dashboard-hourly-credit-window".to_string()],
        DEFAULT_UPSTREAM,
        &db_str,
    )
    .await
    .expect("proxy created");

    let key_id = proxy
        .list_api_key_metrics()
        .await
        .expect("list key metrics")
        .into_iter()
        .next()
        .expect("seeded key")
        .id;
    sqlx::query(
        r#"
        INSERT INTO api_keys (id, api_key, status, created_at) VALUES
            ('credit-key-2', 'tvly-dashboard-credit-2', 'active', 1),
            ('credit-key-3', 'tvly-dashboard-credit-3', 'active', 1)
        "#,
    )
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert additional credit test keys");

    let evaluation_time = Utc
        .with_ymd_and_hms(2026, 4, 7, 12, 10, 0)
        .single()
        .expect("valid utc evaluation time");
    let current_bucket_start =
        evaluation_time.timestamp() - evaluation_time.timestamp().rem_euclid(300);

    insert_summary_window_charged_logs(&proxy, &key_id, current_bucket_start + 30, 6, 1).await;

    let series_start = current_bucket_start - 588 * 300;
    sqlx::query(
        r#"
        INSERT INTO api_key_quota_sync_samples (
            key_id,
            quota_limit,
            quota_remaining,
            captured_at,
            source
        ) VALUES
            (?, 1000, 100, ?, 'hourly_credit_test'),
            (?, 1000, 90, ?, 'hourly_credit_test'),
            (?, 1000, 95, ?, 'hourly_credit_test'),
            (?, 1000, 80, ?, 'hourly_credit_test'),
            ('credit-key-2', 1000, 200, ?, 'hourly_credit_test'),
            ('credit-key-2', 1000, 193, ?, 'hourly_credit_test'),
            ('credit-key-2', 1000, 190, ?, 'hourly_credit_test'),
            ('credit-key-3', 1000, 300, ?, 'hourly_credit_test')
        "#,
    )
    .bind(&key_id)
    .bind(series_start - 60)
    .bind(&key_id)
    .bind(current_bucket_start - 600 + 30)
    .bind(&key_id)
    .bind(current_bucket_start - 300 + 30)
    .bind(&key_id)
    .bind(current_bucket_start + 30)
    .bind(current_bucket_start - 600 + 20)
    .bind(current_bucket_start - 600 + 40)
    .bind(current_bucket_start - 600 + 40)
    .bind(current_bucket_start - 900 + 30)
    .execute(&proxy.key_store.pool)
    .await
    .expect("insert quota samples for hourly credits");

    let window = proxy
        .dashboard_hourly_request_window_at(evaluation_time)
        .await
        .expect("hourly credit window");
    let bucket_at = |start| {
        window
            .buckets
            .iter()
            .find(|bucket| bucket.bucket_start == start)
            .expect("expected credit bucket")
    };

    assert_eq!(bucket_at(current_bucket_start).local_estimated_credits, 6);
    assert_eq!(
        bucket_at(current_bucket_start).upstream_actual_credits,
        Some(15)
    );
    assert_eq!(
        bucket_at(current_bucket_start - 300).upstream_actual_credits,
        Some(0),
        "quota recovery is a sampled zero rather than a missing value",
    );
    assert_eq!(
        bucket_at(current_bucket_start - 600).upstream_actual_credits,
        Some(20),
        "multiple keys and same-timestamp samples should be summed deterministically",
    );
    assert_eq!(
        bucket_at(current_bucket_start - 900).upstream_actual_credits,
        None,
        "a first sample without a baseline is not calculable",
    );
    assert_eq!(
        bucket_at(current_bucket_start - 1200).upstream_actual_credits,
        None,
        "an unsampled bucket stays missing",
    );

    let _ = std::fs::remove_file(db_path);
}
