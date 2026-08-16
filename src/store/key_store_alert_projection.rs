const ALERT_PROJECTION_BATCH_ROWS: i64 = 100;
const ALERT_PROJECTION_STALE_SECS: i64 = 90;
const ALERT_PROJECTION_SUMMARY_ROW_LIMIT: i64 = 10_000;

const ALERT_PROJECTION_SOURCES: [&str; 3] = [
    ALERT_SOURCE_AUTH_TOKEN_LOG,
    ALERT_SOURCE_API_KEY_MAINTENANCE_RECORD,
    ALERT_SOURCE_SCHEDULED_JOB,
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AlertProjectionStatus {
    pub(crate) coverage: String,
    pub(crate) observed_at: Option<i64>,
    pub(crate) stale_reason: Option<String>,
}

#[derive(Debug, Clone)]
struct AlertProjectionSourceState {
    source_kind: String,
    cursor_occurred_at: i64,
    cursor_row_sort_id: String,
    fence_occurred_at: Option<i64>,
    fence_row_sort_id: Option<String>,
    generation: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum AlertProjectionSliceOutcome {
    Advanced { rows: i64, complete: bool },
    Deferred { reason: SqliteAdmissionDeferReason },
}

impl KeyStore {
    pub(crate) fn try_admit_alert_projection(
        &self,
    ) -> Result<SqliteMaintenanceBulkPermit, SqliteAdmissionDeferReason> {
        self.sqlite_runtime
            .try_admit_maintenance_bulk(SqliteOperation::AlertProjection)
    }

    async fn alert_projection_source_state(
        &self,
    ) -> Result<AlertProjectionSourceState, ProxyError> {
        let mut conn = self
            .sqlite_runtime
            .acquire_operation_connection(SqliteOperation::AlertProjection)
            .await?;
        let result = sqlx::query_as::<_, (
            String,
            i64,
            String,
            Option<i64>,
            Option<String>,
            i64,
        )>(
            r#"SELECT source_kind, cursor_occurred_at, cursor_row_sort_id,
                      fence_occurred_at, fence_row_sort_id, generation
                 FROM observability.dashboard_alert_projection_state
                ORDER BY generation ASC, source_kind ASC
                LIMIT 1"#,
        )
        .fetch_one(&mut *conn)
        .await;
        let (
            source_kind,
            cursor_occurred_at,
            cursor_row_sort_id,
            fence_occurred_at,
            fence_row_sort_id,
            generation,
        ) = conn.complete_query(result).await?;
        Ok(AlertProjectionSourceState {
            source_kind,
            cursor_occurred_at,
            cursor_row_sort_id,
            fence_occurred_at,
            fence_row_sort_id,
            generation,
        })
    }

    async fn alert_projection_source_fence(
        &self,
        source_kind: &str,
    ) -> Result<Option<(i64, String)>, ProxyError> {
        let filters = AlertEventFilters {
            alert_type: None,
            since: None,
            until: None,
            user_id: None,
            token_id: None,
            key_id: None,
            request_kinds: &[],
        };
        let mut query = QueryBuilder::new("");
        Self::push_alert_events_cte(&mut query, filters);
        query.push(
            " SELECT occurred_at, row_sort_id FROM alerts WHERE source_kind = ",
        );
        query.push_bind(source_kind);
        query.push(" ORDER BY occurred_at DESC, row_sort_id DESC LIMIT 1");
        let mut conn = self
            .sqlite_runtime
            .acquire_operation_connection(SqliteOperation::AlertProjection)
            .await?;
        let result = query
            .build_query_as::<(i64, String)>()
            .fetch_optional(&mut *conn)
            .await;
        conn.complete_query(result).await
    }

    async fn alert_projection_source_page(
        &self,
        source_kind: &str,
        cursor: (i64, &str),
        fence: (i64, &str),
    ) -> Result<Vec<AlertEventProjectionRow>, ProxyError> {
        let filters = AlertEventFilters {
            alert_type: None,
            since: None,
            until: None,
            user_id: None,
            token_id: None,
            key_id: None,
            request_kinds: &[],
        };
        let mut query = QueryBuilder::new("");
        Self::push_alert_events_cte(&mut query, filters);
        query.push(" SELECT * FROM alerts WHERE source_kind = ");
        query.push_bind(source_kind);
        query.push(" AND (occurred_at > ");
        query.push_bind(cursor.0);
        query.push(" OR (occurred_at = ");
        query.push_bind(cursor.0);
        query.push(" AND row_sort_id > ");
        query.push_bind(cursor.1);
        query.push(")) AND (occurred_at < ");
        query.push_bind(fence.0);
        query.push(" OR (occurred_at = ");
        query.push_bind(fence.0);
        query.push(" AND row_sort_id <= ");
        query.push_bind(fence.1);
        query.push(")) ORDER BY occurred_at ASC, row_sort_id ASC LIMIT ");
        query.push_bind(ALERT_PROJECTION_BATCH_ROWS);
        let mut conn = self
            .sqlite_runtime
            .acquire_operation_connection(SqliteOperation::AlertProjection)
            .await?;
        let result = query.build().fetch_all(&mut *conn).await;
        let rows = conn.complete_query(result).await?;
        rows.into_iter()
            .map(Self::decode_alert_event_projection_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(ProxyError::from)
    }

    pub(crate) async fn advance_alert_projection_slice(
        &self,
    ) -> Result<AlertProjectionSliceOutcome, ProxyError> {
        let _admission = match self.try_admit_alert_projection() {
            Ok(permit) => permit,
            Err(reason) => {
                tracing::debug!(
                    component = "dashboard_alert_projection",
                    event = "deferred",
                    defer_reason = reason.as_str(),
                    "deferred an alert projection slice before SQLite acquisition"
                );
                return Ok(AlertProjectionSliceOutcome::Deferred { reason });
            }
        };
        let state = self.alert_projection_source_state().await?;
        let fence = match (
            state.fence_occurred_at,
            state.fence_row_sort_id.as_deref(),
        ) {
            (Some(occurred_at), Some(row_sort_id)) => Some((occurred_at, row_sort_id.to_string())),
            _ => self.alert_projection_source_fence(&state.source_kind).await?,
        };
        let now = self.backend_time.now_ts();
        let Some(fence) = fence else {
            self.persist_alert_projection_slice(&state, None, &[], true, now)
                .await?;
            return Ok(AlertProjectionSliceOutcome::Advanced {
                rows: 0,
                complete: true,
            });
        };
        let rows = self
            .alert_projection_source_page(
                &state.source_kind,
                (state.cursor_occurred_at, &state.cursor_row_sort_id),
                (fence.0, &fence.1),
            )
            .await?;
        let last = rows
            .last()
            .map(|row| (row.occurred_at, row.row_sort_id.clone()));
        let complete = last
            .as_ref()
            .map(|cursor| cursor.0 == fence.0 && cursor.1 == fence.1)
            .unwrap_or(true)
            || rows.len() < ALERT_PROJECTION_BATCH_ROWS as usize;
        self.persist_alert_projection_slice(&state, Some(&fence), &rows, complete, now)
            .await?;
        tracing::debug!(
            component = "dashboard_alert_projection",
            event = "slice",
            source = state.source_kind,
            rows = rows.len(),
            complete,
            "advanced a bounded alert projection slice"
        );
        Ok(AlertProjectionSliceOutcome::Advanced {
            rows: rows.len() as i64,
            complete,
        })
    }

    async fn persist_alert_projection_slice(
        &self,
        state: &AlertProjectionSourceState,
        fence: Option<&(i64, String)>,
        rows: &[AlertEventProjectionRow],
        complete: bool,
        observed_at: i64,
    ) -> Result<(), ProxyError> {
        let next_cursor = rows
            .last()
            .map(|row| (row.occurred_at, row.row_sort_id.clone()))
            .unwrap_or_else(|| (state.cursor_occurred_at, state.cursor_row_sort_id.clone()));
        let mut tx = self
            .sqlite_runtime
            .begin_immediate(SqliteOperation::AlertProjection)
            .await?;
        let result = async {
            for row in rows {
                let payload_json = serde_json::to_string(row).map_err(|err| {
                    ProxyError::Other(format!("serialize alert projection event: {err}"))
                })?;
                sqlx::query(
                    r#"INSERT INTO observability.dashboard_alert_projection_events
                        (source_kind, source_id, occurred_at, row_sort_id, payload_json, projected_at)
                       VALUES (?, ?, ?, ?, ?, ?)
                       ON CONFLICT(source_kind, source_id) DO UPDATE SET
                         occurred_at = excluded.occurred_at,
                         row_sort_id = excluded.row_sort_id,
                         payload_json = excluded.payload_json,
                         projected_at = excluded.projected_at"#,
                )
                .bind(&row.source_kind)
                .bind(&row.source_id)
                .bind(row.occurred_at)
                .bind(&row.row_sort_id)
                .bind(payload_json)
                .bind(observed_at)
                .execute(&mut *tx)
                .await?;
            }
            let (fence_occurred_at, fence_row_sort_id, phase) = if complete {
                (None, None, "idle")
            } else {
                let (occurred_at, row_sort_id) = fence.ok_or_else(|| {
                    ProxyError::Other("alert projection slice is missing source fence".to_string())
                })?;
                (Some(*occurred_at), Some(row_sort_id.clone()), "catching_up")
            };
            let changed = sqlx::query(
                r#"UPDATE observability.dashboard_alert_projection_state
                    SET cursor_occurred_at = ?, cursor_row_sort_id = ?,
                        fence_occurred_at = ?, fence_row_sort_id = ?,
                        generation = generation + 1, phase = ?, observed_at = ?, stale_reason = NULL
                  WHERE source_kind = ? AND generation = ?"#,
            )
            .bind(next_cursor.0)
            .bind(next_cursor.1)
            .bind(fence_occurred_at)
            .bind(fence_row_sort_id)
            .bind(phase)
            .bind(observed_at)
            .bind(&state.source_kind)
            .bind(state.generation)
            .execute(&mut *tx)
            .await?;
            if changed.rows_affected() != 1 {
                return Err(ProxyError::Other(
                    "alert projection state changed while a slice was in flight".to_string(),
                ));
            }
            Ok::<(), ProxyError>(())
        }
        .await;
        tx.finish(result).await
    }

    pub(crate) async fn alert_projection_status(&self) -> Result<AlertProjectionStatus, ProxyError> {
        let now = self.backend_time.now_ts();
        let mut conn = self
            .sqlite_runtime
            .acquire_operation_connection(SqliteOperation::AlertProjection)
            .await?;
        let result = sqlx::query_as::<_, (i64, Option<i64>, i64, i64, Option<String>)>(
            r#"SELECT COUNT(*), MIN(observed_at),
                      SUM(CASE WHEN phase = 'idle' THEN 1 ELSE 0 END),
                      SUM(CASE WHEN observed_at IS NOT NULL AND observed_at >= ? THEN 1 ELSE 0 END),
                      MAX(stale_reason)
                 FROM observability.dashboard_alert_projection_state"#,
        )
        .bind(now.saturating_sub(ALERT_PROJECTION_STALE_SECS))
        .fetch_one(&mut *conn)
        .await;
        let (sources, observed_at, idle_sources, fresh_sources, stale_reason) =
            conn.complete_query(result).await?;
        let observations_expired = sources == ALERT_PROJECTION_SOURCES.len() as i64
            && idle_sources == sources
            && fresh_sources != sources;
        let coverage = if sources == ALERT_PROJECTION_SOURCES.len() as i64
            && idle_sources == sources
            && fresh_sources == sources
        {
            "ok"
        } else if stale_reason.is_some() || observations_expired {
            "stale"
        } else {
            "projecting"
        };
        Ok(AlertProjectionStatus {
            coverage: coverage.to_string(),
            observed_at,
            stale_reason: stale_reason.or_else(|| {
                observations_expired.then(|| "observation_expired".to_string())
            }),
        })
    }

    pub(crate) async fn fetch_projected_recent_alerts_summary(
        &self,
        window_hours: i64,
    ) -> Result<RecentAlertsSummary, ProxyError> {
        let clamped_window_hours = window_hours.clamp(1, 24 * 30);
        let now = self.backend_time.now_ts();
        let since = now.saturating_sub(clamped_window_hours.saturating_mul(3600));
        let mut conn = self
            .sqlite_runtime
            .acquire_operation_connection(SqliteOperation::AlertProjection)
            .await?;
        let result = sqlx::query_scalar::<_, String>(
            r#"SELECT payload_json
                 FROM observability.dashboard_alert_projection_events
                WHERE occurred_at >= ?
                ORDER BY occurred_at DESC, row_sort_id DESC
                LIMIT ?"#,
        )
        .bind(since)
        .bind(ALERT_PROJECTION_SUMMARY_ROW_LIMIT)
        .fetch_all(&mut *conn)
        .await;
        let payloads = conn.complete_query(result).await?;
        let events = payloads
            .into_iter()
            .filter_map(|payload| serde_json::from_str::<AlertEventProjectionRow>(&payload).ok())
            .filter_map(Self::build_alert_event_from_projection)
            .collect::<Vec<_>>();
        let status = self.alert_projection_status().await?;
        let summary_for = |window: i64| {
            let cutoff = now.saturating_sub(window.saturating_mul(3600));
            build_group_records_from_events(
                events
                    .iter()
                    .filter(|event| event.occurred_at >= cutoff)
                    .cloned()
                    .collect(),
            )
            .top_level_items
        };
        let top_groups = summary_for(clamped_window_hours)
            .into_iter()
            .take(10)
            .collect::<Vec<_>>();
        let grouped_count = summary_for(clamped_window_hours).len() as i64;
        let grouped_count_windows = [1_i64, 24, 24 * 7]
            .into_iter()
            .map(|window_hours| RecentAlertsGroupedWindowCount {
                window_hours,
                grouped_count: summary_for(window_hours).len() as i64,
            })
            .collect::<Vec<_>>();
        let mut counts_by_type = default_alert_type_counts();
        for count in &mut counts_by_type {
            count.count = events
                .iter()
                .filter(|event| event.alert_type == count.alert_type)
                .count() as i64;
        }
        let capped = events.len() == ALERT_PROJECTION_SUMMARY_ROW_LIMIT as usize;
        Ok(RecentAlertsSummary {
            window_hours: clamped_window_hours,
            total_events: events.len() as i64,
            grouped_count,
            grouped_count_windows,
            counts_by_type,
            top_groups,
            coverage: if capped { "bounded".to_string() } else { status.coverage },
            stale: capped || status.stale_reason.is_some(),
            error: status.stale_reason,
        })
    }
}
