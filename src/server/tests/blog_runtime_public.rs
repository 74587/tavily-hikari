use super::*;
use axum::body::{Body, to_bytes};
use axum::http::Request;
use std::sync::atomic::{AtomicUsize, Ordering};
use tavily_hikari::{PublicBlogRuntimeDay, PublicBlogRuntimeHour};
use tower::ServiceExt;

fn blog_runtime_state(proxy: TavilyProxy) -> Arc<AppState> {
    Arc::new(AppState {
        proxy,
        static_dir: None,
        forward_auth: ForwardAuthConfig::new(None, None, None, None),
        forward_auth_enabled: false,
        builtin_admin: BuiltinAdminAuth::new(false, None, None),
        admin_passkey: AdminPasskeyOptions::disabled(),
        linuxdo_oauth: LinuxDoOAuthOptions::disabled(),
        linuxdo_credit: LinuxDoCreditOptions::disabled(),
        ha: tavily_hikari::HaRuntime::new(tavily_hikari::HaConfig::default()),
        dev_open_admin: false,
        usage_base: "http://127.0.0.1:58088".to_string(),
        api_key_ip_geo_origin: "http://127.0.0.1:1".to_string(),
        dashboard_overview_cache: new_dashboard_overview_cache(),
        remote_attempt_admission: new_remote_attempt_admission(),
    })
}

fn blog_runtime_app(state: Arc<AppState>) -> Router {
    let cors = public_blog_runtime_cors_layer(
        parse_public_blog_runtime_cors_origins(None).expect("default CORS origins"),
    );
    Router::new()
        .route(
            "/api/public/blog-runtime/v1/tavily-hikari",
            public_blog_runtime_method_router(cors),
        )
        .with_state(state)
}

#[tokio::test]
async fn public_blog_runtime_response_has_only_the_contract_fields_and_supports_etag() {
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_str = temp_dir
        .path()
        .join("blog-runtime-contract.db")
        .to_string_lossy()
        .to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-blog-runtime-contract".to_string()],
        "http://127.0.0.1:1",
        &db_str,
    )
    .await
    .expect("proxy created with local-only upstream");
    let app = blog_runtime_app(blog_runtime_state(proxy));
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .header("origin", "https://ivanli.cc")
                .body(Body::empty())
                .expect("GET request"),
        )
        .await
        .expect("public endpoint response");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("https://ivanli.cc")
    );
    assert_eq!(
        response
            .headers()
            .get(CACHE_CONTROL)
            .and_then(|value| value.to_str().ok()),
        Some("public, max-age=15")
    );
    let etag = response
        .headers()
        .get(ETAG)
        .expect("etag header")
        .clone();
    let body = to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("response body");
    let json: Value = serde_json::from_slice(&body).expect("valid JSON response");
    let mut keys = json
        .as_object()
        .expect("object response")
        .keys()
        .map(String::as_str)
        .collect::<Vec<_>>();
    keys.sort_unstable();
    assert_eq!(
        keys,
        [
            "monthCredits",
            "requestActivity90d",
            "todayCredits",
            "todayRequests",
            "totalCredits",
        ]
    );
    assert_eq!(json["todayRequests"]["trend"]["points"].as_array().unwrap().len(), 25);
    assert_eq!(json["todayCredits"]["trend"]["points"].as_array().unwrap().len(), 25);
    assert_eq!(json["monthCredits"]["trend"]["points"].as_array().unwrap().len(), 12);
    assert_eq!(json["totalCredits"]["trend"]["points"].as_array().unwrap().len(), 12);
    assert_eq!(json["requestActivity90d"].as_array().unwrap().len(), 90);
    assert_eq!(
        json["monthCredits"]["trend"]["points"][11]["value"],
        json["monthCredits"]["value"]
    );
    assert_eq!(
        json["totalCredits"]["trend"]["points"][11]["value"],
        json["totalCredits"]["value"]
    );
    assert!(json["todayRequests"]["trend"]["points"][24]["value"].is_null());
    assert!(json["todayRequests"]["trend"]["points"][0]["timestamp"]
        .as_str()
        .unwrap()
        .ends_with("+08:00"));

    let conditional = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .header("origin", "https://ivanli.cc")
                .header(IF_NONE_MATCH, format!("W/{}", etag.to_str().unwrap()))
                .body(Body::empty())
                .expect("conditional request"),
        )
        .await
        .expect("conditional response");
    assert_eq!(conditional.status(), StatusCode::NOT_MODIFIED);
    assert_eq!(conditional.headers().get(ETAG), Some(&etag));

    let head = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::HEAD)
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .body(Body::empty())
                .expect("HEAD request"),
        )
        .await
        .expect("HEAD response");
    assert_eq!(head.status(), StatusCode::METHOD_NOT_ALLOWED);
    let post = app
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .body(Body::empty())
                .expect("POST request"),
        )
        .await
        .expect("POST response");
    assert_eq!(post.status(), StatusCode::METHOD_NOT_ALLOWED);
}

#[test]
fn public_blog_runtime_projects_fixed_rollups_into_contract_metrics() {
    let now = Utc
        .with_ymd_and_hms(2026, 4, 7, 12, 0, 0)
        .single()
        .expect("fixed evaluation time")
        .timestamp();
    let window = public_blog_runtime_window(now).expect("valid metric window");
    let mut historical_quota_limits = (0..12)
        .map(|index| Some(100 + index))
        .collect::<Vec<_>>();
    historical_quota_limits[5] = None;
    let data = PublicBlogRuntimeData {
        hours: vec![
            PublicBlogRuntimeHour {
                local_hour_start: window.today_start + 18 * 3600,
                requests: 7,
                credits: 13,
            },
            PublicBlogRuntimeHour {
                local_hour_start: window.today_start + 19 * 3600,
                requests: 2,
                credits: 7,
            },
        ],
        days: vec![
            PublicBlogRuntimeDay {
                date: "2026-01-08".to_string(),
                local_day_start: window.history_start,
                requests: 14,
                credits: 20,
            },
            PublicBlogRuntimeDay {
                date: "2026-04-06".to_string(),
                local_day_start: window.today_start - 86_400,
                requests: 10,
                credits: 50,
            },
            PublicBlogRuntimeDay {
                date: "2026-04-07".to_string(),
                local_day_start: window.today_start,
                requests: 9,
                credits: 20,
            },
        ],
        total_quota_limit: 900,
        historical_quota_limits,
    };

    let body = public_blog_runtime_body(data, &window).expect("contract payload");
    let json: Value = serde_json::from_slice(&body).expect("valid JSON response");
    assert_eq!(json["todayRequests"]["value"], 9);
    assert_eq!(json["todayCredits"]["value"], 20);
    assert_eq!(json["monthCredits"]["value"], 70);
    assert_eq!(json["totalCredits"]["value"], 900);
    assert_eq!(json["todayRequests"]["trend"]["points"][18]["value"], 7);
    assert_eq!(json["todayCredits"]["trend"]["points"][19]["value"], 7);
    assert_eq!(json["todayCredits"]["trend"]["points"][21]["value"], Value::Null);
    assert_eq!(
        json["monthCredits"]["trend"]["points"][9]["value"],
        50
    );
    assert_eq!(
        json["monthCredits"]["trend"]["points"][10]["value"],
        63
    );
    assert_eq!(json["monthCredits"]["trend"]["points"][11]["value"], 70);
    assert_eq!(json["totalCredits"]["trend"]["points"][0]["value"], 100);
    assert_eq!(json["totalCredits"]["trend"]["points"][5]["value"], Value::Null);
    assert_eq!(json["totalCredits"]["trend"]["points"][11]["value"], 900);
    assert_eq!(json["requestActivity90d"].as_array().unwrap().len(), 90);
    assert_eq!(json["requestActivity90d"][0]["date"], "2026-01-08");
    assert_eq!(json["requestActivity90d"][0]["value"], 14);
    assert_eq!(json["requestActivity90d"][89]["date"], "2026-04-07");
    assert_eq!(json["requestActivity90d"][89]["value"], 9);
    assert_eq!(
        json["todayRequests"]["trend"]["points"][0]["timestamp"],
        "2026-04-07T00:00:00+08:00"
    );
}

#[tokio::test]
async fn public_blog_runtime_cors_omits_unlisted_origins() {
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_str = temp_dir
        .path()
        .join("blog-runtime-cors.db")
        .to_string_lossy()
        .to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-blog-runtime-cors".to_string()],
        "http://127.0.0.1:1",
        &db_str,
    )
    .await
    .expect("proxy created with local-only upstream");
    let app = blog_runtime_app(blog_runtime_state(proxy));
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .header("origin", "https://unlisted.example")
                .body(Body::empty())
                .expect("GET request"),
        )
        .await
        .expect("public endpoint response");
    assert_eq!(response.status(), StatusCode::OK);
    assert!(!response.headers().contains_key("access-control-allow-origin"));
}

#[tokio::test]
async fn public_blog_runtime_allows_only_get_preflight_headers() {
    let temp_dir = tempfile::tempdir().expect("temp dir");
    let db_str = temp_dir
        .path()
        .join("blog-runtime-preflight.db")
        .to_string_lossy()
        .to_string();
    let proxy = TavilyProxy::with_endpoint(
        vec!["tvly-blog-runtime-preflight".to_string()],
        "http://127.0.0.1:1",
        &db_str,
    )
    .await
    .expect("proxy created with local-only upstream");
    let app = blog_runtime_app(blog_runtime_state(proxy));
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::OPTIONS)
                .uri("/api/public/blog-runtime/v1/tavily-hikari")
                .header("origin", "https://ivanli.cc")
                .header("access-control-request-method", "GET")
                .header("access-control-request-headers", "if-none-match")
                .body(Body::empty())
                .expect("CORS preflight"),
        )
        .await
        .expect("preflight response");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("https://ivanli.cc")
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-methods")
            .and_then(|value| value.to_str().ok()),
        Some("GET")
    );
}

#[tokio::test]
async fn public_blog_runtime_cold_requests_share_one_refresh() {
    let cache = new_dashboard_overview_cache();
    let refresh_count = Arc::new(AtomicUsize::new(0));
    let make_loader = |refresh_count: Arc<AtomicUsize>| move || async move {
        refresh_count.fetch_add(1, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(30)).await;
        Ok(Bytes::from_static(b"{}"))
    };
    let (first, second) = tokio::join!(
        public_blog_runtime_snapshot_with(
            cache.clone(),
            make_loader(refresh_count.clone()),
            Duration::from_secs(1),
            Duration::from_secs(1),
        ),
        public_blog_runtime_snapshot_with(
            cache,
            make_loader(refresh_count.clone()),
            Duration::from_secs(1),
            Duration::from_secs(1),
        ),
    );
    let first = first.expect("first snapshot");
    let second = second.expect("second snapshot");
    assert_eq!(refresh_count.load(Ordering::SeqCst), 1);
    assert_eq!(first.etag, second.etag);
}

#[tokio::test]
async fn public_blog_runtime_serves_last_good_and_bounds_cold_refresh() {
    let cache = new_dashboard_overview_cache();
    {
        let mut state = cache.lock().await;
        state.public_blog_runtime.snapshot = Some(CachedPublicBlogRuntimeSnapshot {
            body: Bytes::from_static(b"{\"lastGood\":true}"),
            etag: "\"last-good\"".to_string(),
            refreshed_at: tokio::time::Instant::now() - BLOG_RUNTIME_SNAPSHOT_TTL,
        });
    }
    let stale = public_blog_runtime_snapshot_with(
        cache.clone(),
        || async { Err(()) },
        Duration::from_millis(20),
        Duration::from_secs(1),
    )
    .await
    .expect("last-good snapshot");
    assert_eq!(stale.etag, "\"last-good\"");
    tokio::time::timeout(Duration::from_secs(1), async {
        loop {
            if !cache.lock().await.public_blog_runtime.refreshing {
                break;
            }
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await
    .expect("failed refresh completes");
    assert_eq!(
        cache
            .lock()
            .await
            .public_blog_runtime
            .snapshot
            .as_ref()
            .unwrap()
            .etag,
        "\"last-good\""
    );

    let cold_cache = new_dashboard_overview_cache();
    let cold_result = public_blog_runtime_snapshot_with(
        cold_cache.clone(),
        || async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            Ok(Bytes::from_static(b"{}"))
        },
        Duration::from_millis(10),
        Duration::from_secs(1),
    )
    .await;
    assert!(matches!(cold_result, Err(StatusCode::SERVICE_UNAVAILABLE)));
    tokio::time::timeout(Duration::from_secs(1), async {
        loop {
            if !cold_cache.lock().await.public_blog_runtime.refreshing {
                break;
            }
            tokio::time::sleep(Duration::from_millis(1)).await;
        }
    })
    .await
    .expect("timed out refresh completes");
    assert!(cold_cache.lock().await.public_blog_runtime.snapshot.is_none());
}

#[tokio::test]
async fn public_blog_runtime_rate_limit_allows_six_hundred_requests_per_window() {
    let cache = new_dashboard_overview_cache();
    for _ in 0..BLOG_RUNTIME_RATE_LIMIT {
        assert_eq!(take_public_blog_runtime_rate_limit(cache.clone()).await, None);
    }
    assert!(take_public_blog_runtime_rate_limit(cache).await.is_some());
}

#[test]
fn public_blog_runtime_cors_origins_are_explicit_and_validated() {
    let defaults = parse_public_blog_runtime_cors_origins(None).expect("defaults");
    assert_eq!(defaults.len(), 2);
    assert_eq!(
        parse_public_blog_runtime_cors_origins(Some("https://ivanli.cc, http://127.0.0.1:12620"))
            .expect("explicit list")
            .len(),
        2
    );
    assert!(parse_public_blog_runtime_cors_origins(Some("*")).is_err());
    assert!(parse_public_blog_runtime_cors_origins(Some("https://ivanli.cc/path")).is_err());
    assert!(parse_public_blog_runtime_cors_origins(Some("https://ivanli.cc,")).is_err());
}
