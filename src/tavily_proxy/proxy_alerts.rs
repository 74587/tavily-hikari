impl TavilyProxy {
    #[doc(hidden)]
    pub fn admin_alert_read_defer_reason(&self) -> Option<&'static str> {
        match self.key_store.try_admit_alert_projection() {
            Ok(permit) => {
                drop(permit);
                None
            }
            Err(reason) => Some(reason.as_str()),
        }
    }

    async fn advance_dashboard_alert_projection_slice_outcome(
        &self,
    ) -> Result<AlertProjectionSliceOutcome, ProxyError> {
        self.key_store.advance_alert_projection_slice().await
    }

    pub async fn advance_dashboard_alert_projection_scheduler_step(
        &self,
    ) -> Result<(bool, bool), ProxyError> {
        match self.advance_dashboard_alert_projection_slice_outcome().await? {
            AlertProjectionSliceOutcome::Advanced {
                dashboard_dirty,
                complete,
                ..
            } => {
                if dashboard_dirty || complete {
                    self.key_store
                        .refresh_dashboard_alert_projection_summary()
                        .await?;
                }
                Ok((dashboard_dirty, false))
            }
            AlertProjectionSliceOutcome::Idle => {
                self.key_store
                    .refresh_dashboard_alert_projection_summary()
                    .await?;
                Ok((false, true))
            }
            AlertProjectionSliceOutcome::Deferred { .. } => Ok((false, false)),
        }
    }

    pub async fn refresh_dashboard_alert_projection_observation(&self) -> Result<bool, ProxyError> {
        self.key_store.refresh_alert_projection_observation().await
    }

    pub async fn advance_dashboard_alert_projection_slice(&self) -> Result<bool, ProxyError> {
        let outcome = self.advance_dashboard_alert_projection_slice_outcome().await?;
        let (dashboard_dirty, complete) = match outcome {
            AlertProjectionSliceOutcome::Advanced {
                dashboard_dirty: true,
                complete,
                ..
            } => (true, complete),
            AlertProjectionSliceOutcome::Advanced { complete, .. } => (false, complete),
            AlertProjectionSliceOutcome::Idle => (false, true),
            AlertProjectionSliceOutcome::Deferred { .. } => (false, false),
        };
        if dashboard_dirty || complete {
            self.key_store
                .refresh_dashboard_alert_projection_summary()
                .await?;
        }
        Ok(dashboard_dirty)
    }

    pub(crate) async fn dashboard_alert_projection_status(
        &self,
    ) -> Result<AlertProjectionStatus, ProxyError> {
        self.key_store.alert_projection_status().await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn alert_events_page(
        &self,
        alert_type: Option<&str>,
        since: Option<i64>,
        until: Option<i64>,
        user_id: Option<&str>,
        token_id: Option<&str>,
        key_id: Option<&str>,
        request_kinds: &[String],
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedAlertEvents, ProxyError> {
        self.key_store
            .fetch_alert_events_page(
                alert_type,
                since,
                until,
                user_id,
                token_id,
                key_id,
                request_kinds,
                page,
                per_page,
            )
            .await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn alert_groups_page(
        &self,
        alert_type: Option<&str>,
        since: Option<i64>,
        until: Option<i64>,
        user_id: Option<&str>,
        token_id: Option<&str>,
        key_id: Option<&str>,
        request_kinds: &[String],
        page: i64,
        per_page: i64,
    ) -> Result<PaginatedAlertGroups, ProxyError> {
        self.key_store
            .fetch_alert_groups_page(
                alert_type,
                since,
                until,
                user_id,
                token_id,
                key_id,
                request_kinds,
                page,
                per_page,
            )
            .await
    }

    pub async fn alert_catalog(&self) -> Result<AlertCatalog, ProxyError> {
        self.key_store.fetch_alert_catalog().await
    }

    pub async fn recent_alerts_summary(
        &self,
        window_hours: i64,
    ) -> Result<RecentAlertsSummary, ProxyError> {
        self.key_store
            .fetch_projected_recent_alerts_summary(window_hours)
            .await
    }
}
