use axum::http::header::{ETAG, IF_NONE_MATCH, RETRY_AFTER};
use axum::routing::MethodRouter;
use chrono::{FixedOffset, SecondsFormat, Timelike};
use tower_http::cors::CorsLayer;

#[derive(Debug, Clone)]
struct CachedPublicBlogRuntimeSnapshot {
    body: Bytes,
    etag: String,
    refreshed_at: tokio::time::Instant,
}

#[derive(Debug)]
struct PublicBlogRuntimeCache {
    snapshot: Option<CachedPublicBlogRuntimeSnapshot>,
    refreshing: bool,
    retry_not_before: Option<tokio::time::Instant>,
    notify: Arc<tokio::sync::Notify>,
    request_timestamps: VecDeque<tokio::time::Instant>,
}

impl Default for PublicBlogRuntimeCache {
    fn default() -> Self {
        Self {
            snapshot: None,
            refreshing: false,
            retry_not_before: None,
            notify: Arc::new(tokio::sync::Notify::new()),
            request_timestamps: VecDeque::new(),
        }
    }
}

const BLOG_RUNTIME_SNAPSHOT_TTL: Duration = Duration::from_secs(30);
const BLOG_RUNTIME_REFRESH_TIMEOUT: Duration = Duration::from_secs(5);
const BLOG_RUNTIME_REFRESH_RETRY_DELAY: Duration = Duration::from_secs(5);
const BLOG_RUNTIME_RATE_WINDOW: Duration = Duration::from_secs(60);
const BLOG_RUNTIME_RATE_LIMIT: usize = 600;
const BLOG_RUNTIME_CACHE_CONTROL: &str = "public, max-age=15";
const BLOG_RUNTIME_CORS_ORIGINS: [&str; 2] = [
    "https://ivanli.cc",
    "http://127.0.0.1:12620",
];

#[derive(Debug, Clone, Serialize)]
struct PublicBlogRuntimeTrendPoint {
    timestamp: String,
    value: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
struct PublicBlogRuntimeTrend {
    range: &'static str,
    points: Vec<PublicBlogRuntimeTrendPoint>,
}

#[derive(Debug, Clone, Serialize)]
struct PublicBlogRuntimeStat {
    value: i64,
    trend: PublicBlogRuntimeTrend,
}

#[derive(Debug, Clone, Serialize)]
struct PublicBlogRuntimeActivityPoint {
    date: String,
    value: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublicBlogRuntimeResponse {
    today_requests: PublicBlogRuntimeStat,
    today_credits: PublicBlogRuntimeStat,
    month_credits: PublicBlogRuntimeStat,
    total_credits: PublicBlogRuntimeStat,
    request_activity90d: Vec<PublicBlogRuntimeActivityPoint>,
}

#[derive(Debug)]
struct PublicBlogRuntimeWindow {
    now: i64,
    zone: FixedOffset,
    today_start: i64,
    month_start: i64,
    history_start: i64,
    history_start_date: NaiveDate,
    current_hour_start: i64,
    recent_timestamps: Vec<i64>,
    quota_timestamps: Vec<i64>,
    metric_start: i64,
}

fn public_blog_runtime_timestamp(timestamp: i64, zone: FixedOffset) -> Result<String, ()> {
    zone.timestamp_opt(timestamp, 0)
        .single()
        .map(|value| value.to_rfc3339_opts(SecondsFormat::Secs, false))
        .ok_or(())
}

fn public_blog_runtime_window(now: i64) -> Result<PublicBlogRuntimeWindow, ()> {
    let zone = FixedOffset::east_opt(8 * 60 * 60).ok_or(())?;
    let now_local = zone.timestamp_opt(now, 0).single().ok_or(())?;
    let today = now_local.date_naive();
    let today_start = zone
        .from_local_datetime(&today.and_hms_opt(0, 0, 0).ok_or(())?)
        .single()
        .ok_or(())?
        .timestamp();
    let month_start_date = today.with_day(1).ok_or(())?;
    let month_start = zone
        .from_local_datetime(&month_start_date.and_hms_opt(0, 0, 0).ok_or(())?)
        .single()
        .ok_or(())?
        .timestamp();
    let history_start_date = today
        .checked_sub_signed(ChronoDuration::days(89))
        .ok_or(())?;
    let history_start = zone
        .from_local_datetime(&history_start_date.and_hms_opt(0, 0, 0).ok_or(())?)
        .single()
        .ok_or(())?
        .timestamp();
    let current_hour_start = today_start + i64::from(now_local.hour()) * 3600;
    let recent_hour_start = current_hour_start - 11 * 3600;
    let recent_timestamps = (0..12)
        .map(|index| recent_hour_start + i64::from(index) * 3600)
        .collect::<Vec<_>>();
    let mut quota_timestamps = recent_timestamps.clone();
    if let Some(last) = quota_timestamps.last_mut() {
        *last = now;
    }
    let metric_start = today_start.min(recent_hour_start);

    Ok(PublicBlogRuntimeWindow {
        now,
        zone,
        today_start,
        month_start,
        history_start,
        history_start_date,
        current_hour_start,
        recent_timestamps,
        quota_timestamps,
        metric_start,
    })
}

async fn build_public_blog_runtime_body(state: Arc<AppState>) -> Result<Bytes, ()> {
    let window = public_blog_runtime_window(Utc::now().timestamp())?;
    let data = state
        .proxy
        .public_blog_runtime_data(
            window.metric_start,
            window.history_start,
            window.now,
            &window.quota_timestamps,
        )
        .await
        .map_err(|_| ())?;
    public_blog_runtime_body(data, &window)
}

fn public_blog_runtime_body(
    data: PublicBlogRuntimeData,
    window: &PublicBlogRuntimeWindow,
) -> Result<Bytes, ()> {
    let now = window.now;
    let zone = window.zone;
    let today_start = window.today_start;
    let month_start = window.month_start;
    let history_start_date = window.history_start_date;
    let current_hour_start = window.current_hour_start;
    let recent_timestamps = &window.recent_timestamps;
    let hours = data
        .hours
        .into_iter()
        .map(|hour| {
            (
                hour.local_hour_start,
                (hour.requests.max(0), hour.credits.max(0)),
            )
        })
        .collect::<HashMap<_, _>>();

    let today_requests = hours
        .iter()
        .filter(|(hour, _)| **hour >= today_start && **hour <= now)
        .map(|(_, (requests, _))| *requests)
        .sum::<i64>()
        .max(0);
    let today_credits = hours
        .iter()
        .filter(|(hour, _)| **hour >= today_start && **hour <= now)
        .map(|(_, (_, credits))| *credits)
        .sum::<i64>()
        .max(0);
    let completed_month_credits = data
        .days
        .iter()
        .filter(|day| day.local_day_start >= month_start && day.local_day_start < today_start)
        .map(|day| day.credits.max(0))
        .sum::<i64>();
    let month_credits = completed_month_credits
        + hours
        .iter()
        .filter(|(hour, _)| **hour >= month_start && **hour <= now)
        .map(|(_, (_, credits))| *credits)
        .sum::<i64>()
        .max(0);

    let today_request_points = (0..=24)
        .map(|hour| {
            let timestamp = today_start + i64::from(hour) * 3600;
            Ok(PublicBlogRuntimeTrendPoint {
                timestamp: public_blog_runtime_timestamp(timestamp, zone)?,
                value: if timestamp > current_hour_start {
                    None
                } else {
                    Some(hours.get(&timestamp).map(|value| value.0).unwrap_or_default())
                },
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;
    let today_credit_points = (0..=24)
        .map(|hour| {
            let timestamp = today_start + i64::from(hour) * 3600;
            Ok(PublicBlogRuntimeTrendPoint {
                timestamp: public_blog_runtime_timestamp(timestamp, zone)?,
                value: if timestamp > current_hour_start {
                    None
                } else {
                    Some(hours.get(&timestamp).map(|value| value.1).unwrap_or_default())
                },
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;
    let month_credit_points = recent_timestamps
        .iter()
        .enumerate()
        .map(|(index, timestamp)| {
            if index == recent_timestamps.len() - 1 {
                return Ok(PublicBlogRuntimeTrendPoint {
                    timestamp: public_blog_runtime_timestamp(*timestamp, zone)?,
                    value: Some(month_credits),
                });
            }
            if *timestamp < month_start {
                return Ok(PublicBlogRuntimeTrendPoint {
                    timestamp: public_blog_runtime_timestamp(*timestamp, zone)?,
                    value: Some(0),
                });
            }
            let point_date = zone
                .timestamp_opt(*timestamp, 0)
                .single()
                .ok_or(())?
                .date_naive();
            let point_day_start = zone
                .from_local_datetime(&point_date.and_hms_opt(0, 0, 0).ok_or(())?)
                .single()
                .ok_or(())?
                .timestamp();
            let completed_days = data
                .days
                .iter()
                .filter(|day| {
                    day.local_day_start >= month_start && day.local_day_start < point_day_start
                })
                .map(|day| day.credits.max(0))
                .sum::<i64>();
            let current_day_hours = hours
                .iter()
                .filter(|(hour, _)| **hour >= point_day_start && **hour < *timestamp)
                .map(|(_, (_, credits))| *credits)
                .sum::<i64>();
            Ok(PublicBlogRuntimeTrendPoint {
                timestamp: public_blog_runtime_timestamp(*timestamp, zone)?,
                value: Some((completed_days + current_day_hours).max(0)),
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;
    let total_credit_points = recent_timestamps
        .iter()
        .zip(data.historical_quota_limits.iter())
        .enumerate()
        .map(|(index, (timestamp, value))| {
            Ok(PublicBlogRuntimeTrendPoint {
                timestamp: public_blog_runtime_timestamp(*timestamp, zone)?,
                value: if index == recent_timestamps.len() - 1 {
                    Some(data.total_quota_limit.max(0))
                } else {
                    *value
                },
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;

    let daily_requests = data
        .days
        .into_iter()
        .map(|day| (day.date, day.requests.max(0)))
        .collect::<HashMap<_, _>>();
    let request_activity90d = (0..90)
        .map(|offset| {
            let date = history_start_date
                .checked_add_signed(ChronoDuration::days(offset))
                .ok_or(())?;
            let date = date.format("%Y-%m-%d").to_string();
            Ok(PublicBlogRuntimeActivityPoint {
                value: daily_requests.get(&date).copied().unwrap_or_default(),
                date,
            })
        })
        .collect::<Result<Vec<_>, ()>>()?;

    let response = PublicBlogRuntimeResponse {
        today_requests: PublicBlogRuntimeStat {
            value: today_requests,
            trend: PublicBlogRuntimeTrend {
                range: "today",
                points: today_request_points,
            },
        },
        today_credits: PublicBlogRuntimeStat {
            value: today_credits,
            trend: PublicBlogRuntimeTrend {
                range: "today",
                points: today_credit_points,
            },
        },
        month_credits: PublicBlogRuntimeStat {
            value: month_credits,
            trend: PublicBlogRuntimeTrend {
                range: "recent-hours",
                points: month_credit_points,
            },
        },
        total_credits: PublicBlogRuntimeStat {
            value: data.total_quota_limit.max(0),
            trend: PublicBlogRuntimeTrend {
                range: "recent-hours",
                points: total_credit_points,
            },
        },
        request_activity90d,
    };

    serde_json::to_vec(&response).map(Bytes::from).map_err(|_| ())
}

fn public_blog_runtime_etag(body: &[u8]) -> String {
    format!("\"{:x}\"", Sha256::digest(body))
}

fn spawn_public_blog_runtime_refresh<F, Fut>(
    cache: Arc<Mutex<DashboardOverviewCacheState>>,
    loader: F,
    refresh_timeout: Duration,
    retry_delay: Duration,
) where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<Bytes, ()>> + Send + 'static,
{
    tokio::spawn(async move {
        let body = tokio::time::timeout(refresh_timeout, loader())
            .await
            .ok()
            .and_then(Result::ok);
        let mut cache_state = cache.lock().await;
        let runtime = &mut cache_state.public_blog_runtime;
        if let Some(body) = body {
            runtime.snapshot = Some(CachedPublicBlogRuntimeSnapshot {
                etag: public_blog_runtime_etag(&body),
                body,
                refreshed_at: tokio::time::Instant::now(),
            });
            runtime.retry_not_before = None;
        } else {
            runtime.retry_not_before = Some(tokio::time::Instant::now() + retry_delay);
        }
        runtime.refreshing = false;
        let notify = runtime.notify.clone();
        drop(cache_state);
        notify.notify_waiters();
    });
}

async fn public_blog_runtime_snapshot_with<F, Fut>(
    cache: Arc<Mutex<DashboardOverviewCacheState>>,
    loader: F,
    refresh_timeout: Duration,
    retry_delay: Duration,
) -> Result<CachedPublicBlogRuntimeSnapshot, StatusCode>
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: std::future::Future<Output = Result<Bytes, ()>> + Send + 'static,
{
    let mut loader = Some(loader);
    loop {
        let notify = {
            cache
                .lock()
                .await
                .public_blog_runtime
                .notify
                .clone()
        };
        let notified = notify.notified();
        tokio::pin!(notified);
        notified.as_mut().enable();

        let now = tokio::time::Instant::now();
        let (snapshot, start_refresh, wait_for_refresh) = {
            let mut cache_state = cache.lock().await;
            let runtime = &mut cache_state.public_blog_runtime;
            if let Some(snapshot) = runtime.snapshot.as_ref()
                && now.saturating_duration_since(snapshot.refreshed_at) < BLOG_RUNTIME_SNAPSHOT_TTL
            {
                return Ok(snapshot.clone());
            }
            let snapshot = runtime.snapshot.clone();
            let can_retry = runtime
                .retry_not_before
                .is_none_or(|retry_not_before| now >= retry_not_before);
            let start_refresh = !runtime.refreshing && can_retry;
            if start_refresh {
                runtime.refreshing = true;
                runtime.retry_not_before = None;
            }
            let wait_for_refresh = snapshot.is_none() && (runtime.refreshing || can_retry);
            (snapshot, start_refresh, wait_for_refresh)
        };

        if start_refresh {
            spawn_public_blog_runtime_refresh(
                cache.clone(),
                loader.take().expect("refresh loader is consumed only by its owner"),
                refresh_timeout,
                retry_delay,
            );
        }
        if let Some(snapshot) = snapshot {
            return Ok(snapshot);
        }
        if !wait_for_refresh
            || tokio::time::timeout(refresh_timeout, notified).await.is_err()
        {
            return Err(StatusCode::SERVICE_UNAVAILABLE);
        }
    }
}

async fn public_blog_runtime_snapshot(
    state: Arc<AppState>,
) -> Result<CachedPublicBlogRuntimeSnapshot, StatusCode> {
    let cache = dashboard_overview_cache_for_state(state.as_ref());
    public_blog_runtime_snapshot_with(
        cache,
        move || async move { build_public_blog_runtime_body(state).await },
        BLOG_RUNTIME_REFRESH_TIMEOUT,
        BLOG_RUNTIME_REFRESH_RETRY_DELAY,
    )
    .await
}

async fn take_public_blog_runtime_rate_limit(
    cache: Arc<Mutex<DashboardOverviewCacheState>>,
) -> Option<u64> {
    let now = tokio::time::Instant::now();
    let mut cache_state = cache.lock().await;
    let requests = &mut cache_state.public_blog_runtime.request_timestamps;
    while requests
        .front()
        .is_some_and(|timestamp| now.saturating_duration_since(*timestamp) >= BLOG_RUNTIME_RATE_WINDOW)
    {
        requests.pop_front();
    }
    if requests.len() >= BLOG_RUNTIME_RATE_LIMIT {
        let remaining = requests
            .front()
            .map(|timestamp| {
                (BLOG_RUNTIME_RATE_WINDOW
                    .saturating_sub(now.saturating_duration_since(*timestamp)))
                .as_secs_f64()
                .ceil() as u64
            })
            .unwrap_or(1)
            .max(1);
        return Some(remaining);
    }
    requests.push_back(now);
    None
}

fn public_blog_runtime_if_none_match(headers: &HeaderMap, etag: &str) -> bool {
    headers
        .get_all(IF_NONE_MATCH)
        .iter()
        .filter_map(|value| value.to_str().ok())
        .flat_map(|value| value.split(','))
        .map(str::trim)
        .any(|candidate| {
            candidate == "*" || candidate.strip_prefix("W/").unwrap_or(candidate) == etag
        })
}

fn public_blog_runtime_response(
    status: StatusCode,
    snapshot: Option<CachedPublicBlogRuntimeSnapshot>,
) -> Response<Body> {
    let mut response = Response::new(match snapshot.as_ref() {
        Some(snapshot) if status == StatusCode::OK => Body::from(snapshot.body.clone()),
        _ => Body::empty(),
    });
    *response.status_mut() = status;
    response
        .headers_mut()
        .insert(CACHE_CONTROL, HeaderValue::from_static(BLOG_RUNTIME_CACHE_CONTROL));
    if let Some(snapshot) = snapshot {
        if let Ok(value) = HeaderValue::from_str(&snapshot.etag) {
            response.headers_mut().insert(ETAG, value);
        }
        if status == StatusCode::OK {
            response.headers_mut().insert(
                CONTENT_TYPE,
                HeaderValue::from_static("application/json; charset=utf-8"),
            );
        }
    }
    response
}

async fn get_public_blog_runtime(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Response<Body> {
    let cache = dashboard_overview_cache_for_state(state.as_ref());
    if let Some(retry_after) = take_public_blog_runtime_rate_limit(cache).await {
        let mut response = public_blog_runtime_response(StatusCode::TOO_MANY_REQUESTS, None);
        response
            .headers_mut()
            .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
        if let Ok(value) = HeaderValue::from_str(&retry_after.to_string()) {
            response.headers_mut().insert(RETRY_AFTER, value);
        }
        return response;
    }

    let snapshot = match public_blog_runtime_snapshot(state).await {
        Ok(snapshot) => snapshot,
        Err(status) => {
            let mut response = public_blog_runtime_response(status, None);
            response
                .headers_mut()
                .insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
                .headers_mut()
                .insert(RETRY_AFTER, HeaderValue::from_static("5"));
            return response;
        }
    };
    let status = if public_blog_runtime_if_none_match(&headers, &snapshot.etag) {
        StatusCode::NOT_MODIFIED
    } else {
        StatusCode::OK
    };
    public_blog_runtime_response(status, Some(snapshot))
}

fn parse_public_blog_runtime_cors_origins(config: Option<&str>) -> Result<Vec<HeaderValue>, String> {
    let origins = match config {
        Some(config) => config.split(',').map(str::trim).collect::<Vec<_>>(),
        None => BLOG_RUNTIME_CORS_ORIGINS.to_vec(),
    };
    if origins.is_empty() || origins.iter().any(|origin| origin.is_empty()) {
        return Err("BLOG_RUNTIME_CORS_ORIGINS must contain explicit origins".to_string());
    }

    let mut seen = HashSet::new();
    let mut headers = Vec::new();
    for origin in origins {
        if origin == "*" || !seen.insert(origin.to_string()) {
            if origin == "*" {
                return Err("BLOG_RUNTIME_CORS_ORIGINS does not allow wildcard origins".to_string());
            }
            continue;
        }
        let parsed = Url::parse(origin)
            .map_err(|_| format!("invalid public blog runtime CORS origin: {origin}"))?;
        if !matches!(parsed.scheme(), "http" | "https")
            || !parsed.username().is_empty()
            || parsed.password().is_some()
            || parsed.path() != "/"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
            || parsed.origin().ascii_serialization() != origin
        {
            return Err(format!("invalid public blog runtime CORS origin: {origin}"));
        }
        headers.push(
            HeaderValue::from_bytes(origin.as_bytes())
                .map_err(|_| format!("invalid public blog runtime CORS origin: {origin}"))?,
        );
    }
    Ok(headers)
}

fn public_blog_runtime_cors_layer(origins: Vec<HeaderValue>) -> CorsLayer {
    CorsLayer::new()
        .allow_origin(origins)
        .allow_methods([Method::GET])
        .allow_headers([IF_NONE_MATCH])
        .expose_headers([ETAG])
        .allow_credentials(false)
}

fn public_blog_runtime_method_router(cors: CorsLayer) -> MethodRouter<Arc<AppState>> {
    get(get_public_blog_runtime)
        .head(|| async { StatusCode::METHOD_NOT_ALLOWED })
        .layer(cors)
}

fn public_blog_runtime_cors_layer_from_env() -> Result<CorsLayer, String> {
    let config = match std::env::var("BLOG_RUNTIME_CORS_ORIGINS") {
        Ok(config) => Some(config),
        Err(std::env::VarError::NotPresent) => None,
        Err(std::env::VarError::NotUnicode(_)) => {
            return Err("BLOG_RUNTIME_CORS_ORIGINS must be valid UTF-8".to_string());
        }
    };
    let origins = parse_public_blog_runtime_cors_origins(config.as_deref())?;
    Ok(public_blog_runtime_cors_layer(origins))
}
