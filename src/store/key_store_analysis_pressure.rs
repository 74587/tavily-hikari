#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum ServerPressureBucketsRebuildOutcome {
    Completed { upper_bound_request_log_id: i64 },
    Cancelled,
}

/// A coalesced derived-pressure delta. It contains no request payload or
/// identity and can always be rebuilt from the observability request log.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct ServerPressureBucketDelta {
    pub(crate) bucket_kind: &'static str,
    pub(crate) bucket_start: i64,
    pub(crate) bucket_secs: i64,
    pub(crate) success_count: i64,
    pub(crate) failure_count: i64,
}

impl KeyStore {
    pub(crate) fn try_admit_server_pressure_rebuild(
        &self,
    ) -> Result<SqliteMaintenanceBulkPermit, SqliteAdmissionDeferReason> {
        self.sqlite_runtime
            .try_admit_maintenance_bulk(SqliteOperation::ServerPressureRebuild)
    }

    pub(crate) fn try_admit_observability_deferred_write(
        &self,
    ) -> Result<SqliteMaintenanceBulkPermit, SqliteAdmissionDeferReason> {
        self.sqlite_runtime
            .try_admit_maintenance_bulk(SqliteOperation::ObservabilityDeferredWrite)
    }

    pub(crate) async fn upsert_server_pressure_bucket_deltas(
        &self,
        deltas: &[ServerPressureBucketDelta],
    ) -> Result<(), ProxyError> {
        if deltas.is_empty() {
            return Ok(());
        }
        let updated_at = self.backend_time.now_ts();
        let mut tx = self
            .sqlite_runtime
            .begin_immediate(SqliteOperation::ObservabilityDeferredWrite)
            .await?;
        for delta in deltas {
            sqlx::query(
                r#"
                INSERT INTO observability.server_pressure_buckets (
                    bucket_kind, bucket_start, bucket_secs, success_count, failure_count, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(bucket_kind, bucket_start) DO UPDATE SET
                    success_count = server_pressure_buckets.success_count + excluded.success_count,
                    failure_count = server_pressure_buckets.failure_count + excluded.failure_count,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(delta.bucket_kind)
            .bind(delta.bucket_start)
            .bind(delta.bucket_secs)
            .bind(delta.success_count)
            .bind(delta.failure_count)
            .bind(updated_at)
            .execute(&mut *tx)
            .await?;
        }
        tx.finish(Ok(())).await
    }

    async fn request_logs_support_server_pressure_rebuild(&self) -> Result<bool, ProxyError> {
        for column in [
            "request_user_id",
            "counts_business_quota",
            "upstream_operation",
            "result_status",
            "visibility",
            "created_at",
        ] {
            let exists = sqlx::query_scalar::<_, i64>(
                "SELECT 1 FROM observability.pragma_table_info('request_logs') WHERE name = ? LIMIT 1",
            )
            .bind(column)
            .fetch_optional(&self.pool)
            .await?;
            if exists.is_none() {
                return Ok(false);
            }
        }
        Ok(true)
    }

    pub(crate) async fn fetch_server_pressure_event_for_request_log(
        &self,
        request_log_id: i64,
    ) -> Result<Option<UserBusinessCallEventWrite>, ProxyError> {
        sqlx::query_as::<_, (i64, String, i64, String)>(
            r#"
            SELECT id, request_user_id, created_at, result_status
            FROM observability.request_logs
            WHERE id = ?
              AND visibility = ?
              AND request_user_id IS NOT NULL
              AND counts_business_quota = 1
              AND upstream_operation IS NOT NULL
              AND result_status != ?
            LIMIT 1
            "#,
        )
        .bind(request_log_id)
        .bind(REQUEST_LOG_VISIBILITY_VISIBLE)
        .bind(OUTCOME_QUOTA_EXHAUSTED)
        .fetch_optional(&self.pool)
        .await
        .map(|row| {
            row.map(
                |(request_log_id, user_id, created_at, result_status)| {
                    UserBusinessCallEventWrite {
                        user_id,
                        request_log_id: Some(request_log_id),
                        created_at,
                        result_status,
                    }
                },
            )
        })
        .map_err(ProxyError::from)
    }

    pub(crate) async fn ensure_server_pressure_bucket_schema(&self) -> Result<(), ProxyError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS observability.server_pressure_buckets (
                bucket_kind TEXT NOT NULL,
                bucket_start INTEGER NOT NULL,
                bucket_secs INTEGER NOT NULL,
                success_count INTEGER NOT NULL,
                failure_count INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (bucket_kind, bucket_start)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        for sql in [
            r#"CREATE INDEX IF NOT EXISTS observability.idx_server_pressure_buckets_kind_time
               ON server_pressure_buckets(bucket_kind, bucket_start DESC)"#,
            r#"CREATE INDEX IF NOT EXISTS observability.idx_server_pressure_buckets_time
               ON server_pressure_buckets(bucket_start DESC)"#,
        ] {
            sqlx::query(sql).execute(&self.pool).await?;
        }

        Ok(())
    }

    pub(crate) async fn rebuild_server_pressure_buckets_with_cancel<F>(
        &self,
        should_continue: F,
    ) -> Result<ServerPressureBucketsRebuildOutcome, ProxyError>
    where
        F: Fn() -> bool,
    {
        self.ensure_server_pressure_bucket_schema().await?;
        if self.uses_legacy_single_db_observability_compatibility() {
            return Ok(ServerPressureBucketsRebuildOutcome::Completed {
                upper_bound_request_log_id: 0,
            });
        }
        if !self.request_logs_support_server_pressure_rebuild().await? {
            return Ok(ServerPressureBucketsRebuildOutcome::Completed {
                upper_bound_request_log_id: 0,
            });
        }

        let updated_at = self.backend_time.now_ts();
        let five_minute_since = updated_at.saturating_sub(48 * SECS_PER_HOUR);
        let hour_since = updated_at.saturating_sub(8 * SECS_PER_DAY);
        let upper_bound_request_log_id = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(MAX(id), 0)
            FROM observability.request_logs
            WHERE visibility = ?
              AND created_at >= ?
              AND request_user_id IS NOT NULL
              AND counts_business_quota = 1
              AND upstream_operation IS NOT NULL
              AND result_status != ?
            "#,
        )
        .bind(REQUEST_LOG_VISIBILITY_VISIBLE)
        .bind(five_minute_since)
        .bind(OUTCOME_QUOTA_EXHAUSTED)
        .fetch_one(&self.pool)
        .await?;
        let insert_sql = r#"
            INSERT INTO observability.server_pressure_buckets (
                bucket_kind,
                bucket_start,
                bucket_secs,
                success_count,
                failure_count,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
        "#;

        if !should_continue() {
            return Ok(ServerPressureBucketsRebuildOutcome::Cancelled);
        }

        // Source aggregation can scan a production-sized observability history.
        // Keep it outside the immediate transaction so startup rehydration never
        // owns SQLite's single writer while it performs analytical reads.
        let five_minute_rows = sqlx::query_as::<_, (i64, i64, i64)>(
                r#"
                SELECT
                    (created_at / ?) * ? AS bucket_start,
                    SUM(CASE WHEN result_status = ? THEN 1 ELSE 0 END) AS success_count,
                    SUM(CASE WHEN result_status != ? THEN 1 ELSE 0 END) AS failure_count
                FROM observability.request_logs
                WHERE visibility = ?
                  AND created_at >= ?
                  AND request_user_id IS NOT NULL
                  AND counts_business_quota = 1
                  AND upstream_operation IS NOT NULL
                  AND result_status != ?
                  AND id <= ?
                GROUP BY bucket_start
                ORDER BY bucket_start
                "#,
            )
            .bind(SECS_PER_FIVE_MINUTES)
            .bind(SECS_PER_FIVE_MINUTES)
            .bind(OUTCOME_SUCCESS)
            .bind(OUTCOME_SUCCESS)
            .bind(REQUEST_LOG_VISIBILITY_VISIBLE)
            .bind(five_minute_since)
            .bind(OUTCOME_QUOTA_EXHAUSTED)
            .bind(upper_bound_request_log_id)
            .fetch_all(&self.pool)
            .await?;
        let hour_rows = sqlx::query_as::<_, (i64, i64, i64)>(
                r#"
                SELECT
                    CAST(
                        strftime(
                            '%s',
                            strftime('%Y-%m-%d %H:00:00', created_at, 'unixepoch', 'localtime'),
                            'utc'
                        ) AS INTEGER
                    ) AS bucket_start,
                    SUM(CASE WHEN result_status = ? THEN 1 ELSE 0 END) AS success_count,
                    SUM(CASE WHEN result_status != ? THEN 1 ELSE 0 END) AS failure_count
                FROM observability.request_logs
                WHERE visibility = ?
                  AND created_at >= ?
                  AND request_user_id IS NOT NULL
                  AND counts_business_quota = 1
                  AND upstream_operation IS NOT NULL
                  AND result_status != ?
                  AND id <= ?
                GROUP BY bucket_start
                ORDER BY bucket_start
                "#,
            )
            .bind(OUTCOME_SUCCESS)
            .bind(OUTCOME_SUCCESS)
            .bind(REQUEST_LOG_VISIBILITY_VISIBLE)
            .bind(hour_since)
            .bind(OUTCOME_QUOTA_EXHAUSTED)
            .bind(upper_bound_request_log_id)
            .fetch_all(&self.pool)
            .await?;

        if !should_continue() {
            return Ok(ServerPressureBucketsRebuildOutcome::Cancelled);
        }

        let mut conn = self
            .sqlite_runtime
            .begin_immediate(SqliteOperation::ServerPressureRebuild)
            .await?;
        let result = async {
            sqlx::query("DELETE FROM observability.server_pressure_buckets")
                .execute(&mut *conn)
                .await?;
            for (bucket_start, success_count, failure_count) in five_minute_rows {
                sqlx::query(insert_sql)
                    .bind("five_minute")
                    .bind(bucket_start)
                    .bind(SECS_PER_FIVE_MINUTES)
                    .bind(success_count)
                    .bind(failure_count)
                    .bind(updated_at)
                    .execute(&mut *conn)
                    .await?;
            }
            for (bucket_start, success_count, failure_count) in hour_rows {
                sqlx::query(insert_sql)
                    .bind("hour")
                    .bind(bucket_start)
                    .bind(SECS_PER_HOUR)
                    .bind(success_count)
                    .bind(failure_count)
                    .bind(updated_at)
                    .execute(&mut *conn)
                    .await?;
            }
            if !should_continue() {
                return Ok(ServerPressureBucketsRebuildOutcome::Cancelled);
            }
            Ok(ServerPressureBucketsRebuildOutcome::Completed {
                upper_bound_request_log_id,
            })
        }
        .await;
        match result {
            Ok(ServerPressureBucketsRebuildOutcome::Completed {
                upper_bound_request_log_id,
            }) => {
                conn.finish(Ok(())).await?;
                Ok(ServerPressureBucketsRebuildOutcome::Completed {
                    upper_bound_request_log_id,
                })
            }
            Ok(ServerPressureBucketsRebuildOutcome::Cancelled) => {
                let _ = conn.rollback().await;
                Ok(ServerPressureBucketsRebuildOutcome::Cancelled)
            }
            Err(err) => {
                let _ = conn.rollback().await;
                Err(err)
            }
        }
    }

    pub(crate) async fn upsert_server_pressure_event(
        &self,
        created_at: i64,
        result_status: &str,
    ) -> Result<(), ProxyError> {
        self.ensure_server_pressure_bucket_schema().await?;
        let success = if result_status == OUTCOME_SUCCESS { 1_i64 } else { 0_i64 };
        let failure = if result_status == OUTCOME_SUCCESS { 0_i64 } else { 1_i64 };
        let Some(utc_dt) = chrono::Utc.timestamp_opt(created_at, 0).single() else {
            return Ok(());
        };
        let local_dt = utc_dt.with_timezone(&chrono::Local);
        let five_minute_bucket_start = created_at - created_at.rem_euclid(SECS_PER_FIVE_MINUTES);
        let hour_bucket_start = start_of_local_hour_utc_ts(local_dt);

        self.upsert_server_pressure_bucket_deltas(&[
            ServerPressureBucketDelta {
                bucket_kind: "five_minute",
                bucket_start: five_minute_bucket_start,
                bucket_secs: SECS_PER_FIVE_MINUTES,
                success_count: success,
                failure_count: failure,
            },
            ServerPressureBucketDelta {
                bucket_kind: "hour",
                bucket_start: hour_bucket_start,
                bucket_secs: SECS_PER_HOUR,
                success_count: success,
                failure_count: failure,
            },
        ])
        .await
    }

    pub(crate) async fn fetch_server_pressure_points(
        &self,
        bucket_kind: &str,
        since: i64,
        until: i64,
    ) -> Result<Vec<AnalysisPressurePoint>, ProxyError> {
        self.ensure_server_pressure_bucket_schema().await?;
        let rows = sqlx::query_as::<_, (i64, i64, i64, i64)>(
            r#"
            SELECT bucket_start, success_count, failure_count, bucket_secs
            FROM observability.server_pressure_buckets
            WHERE bucket_kind = ?
              AND bucket_start >= ?
              AND bucket_start < ?
            ORDER BY bucket_start ASC
            "#,
        )
        .bind(bucket_kind)
        .bind(since)
        .bind(until)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(bucket_start, success_count, failure_count, _bucket_secs)| AnalysisPressurePoint {
                bucket_start,
                display_bucket_start: bucket_start,
                pressure: success_count + failure_count,
                success_count,
                failure_count,
            })
            .collect())
    }
}
