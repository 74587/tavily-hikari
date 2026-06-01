impl TavilyProxy {
    pub async fn restore_ha_snapshot_file(
        &self,
        snapshot_path: &std::path::Path,
    ) -> Result<usize, ProxyError> {
        self.key_store.restore_ha_snapshot_file(snapshot_path).await
    }

    pub async fn ha_wal_checkpoint(&self) -> Result<(), ProxyError> {
        let (busy, log_frames, checkpointed_frames): (i64, i64, i64) =
            sqlx::query_as("PRAGMA wal_checkpoint(TRUNCATE)")
                .fetch_one(&self.key_store.pool)
                .await?;
        if busy != 0 || checkpointed_frames < log_frames {
            return Err(ProxyError::Other(format!(
                "HA WAL checkpoint incomplete: busy={busy}, log_frames={log_frames}, checkpointed_frames={checkpointed_frames}"
            )));
        }
        Ok(())
    }

    pub async fn persist_ha_node_state(
        &self,
        node_id: &str,
        role: HaNodeRole,
        edgeone_origin: Option<&str>,
        message: Option<&str>,
    ) -> Result<(), ProxyError> {
        self.key_store
            .persist_ha_node_state(node_id, role, edgeone_origin, message)
            .await
    }

    pub async fn get_persisted_ha_node_role(&self) -> Result<Option<HaNodeRole>, ProxyError> {
        self.key_store.get_persisted_ha_node_role().await
    }

    pub async fn persist_ha_sync_watermark(
        &self,
        name: &str,
        source_node_id: Option<&str>,
        target_node_id: Option<&str>,
        watermark: i64,
        detail: Option<&str>,
    ) -> Result<(), ProxyError> {
        self.key_store
            .persist_ha_sync_watermark(name, source_node_id, target_node_id, watermark, detail)
            .await
    }

    pub async fn insert_ha_failover_operation(
        &self,
        record: &HaFailoverOperationRecord,
    ) -> Result<(), ProxyError> {
        self.key_store
            .insert_ha_failover_operation(record)
            .await
    }

    pub async fn insert_ha_edgeone_audit_log(
        &self,
        id: &str,
        action: &str,
        request_json: Option<&str>,
        response_json: Option<&str>,
        status: &str,
        message: Option<&str>,
    ) -> Result<(), ProxyError> {
        self.key_store
            .insert_ha_edgeone_audit_log(
                id,
                action,
                request_json,
                response_json,
                status,
                message,
            )
            .await
    }

    pub async fn claim_ha_recovery_batch(
        &self,
        batch_id: &str,
        source_node_id: &str,
        event_count: i64,
        checksum: &str,
    ) -> Result<bool, ProxyError> {
        self.key_store
            .claim_ha_recovery_batch(batch_id, source_node_id, event_count, checksum)
            .await
    }

    pub async fn complete_ha_recovery_batch(
        &self,
        batch_id: &str,
        status: &str,
        event_count: i64,
    ) -> Result<(), ProxyError> {
        self.key_store
            .complete_ha_recovery_batch(batch_id, status, event_count)
            .await
    }

    pub async fn import_ha_recovery_events(
        &self,
        request_logs: &[serde_json::Value],
        auth_token_logs: &[serde_json::Value],
    ) -> Result<i64, ProxyError> {
        self.key_store
            .import_ha_recovery_events(request_logs, auth_token_logs)
            .await
    }

    pub async fn rebuild_ha_recovery_rollups(&self) -> Result<(), ProxyError> {
        self.key_store.rebuild_request_log_catalog_rollups().await?;
        self.key_store.rebuild_api_key_usage_buckets().await?;
        self.key_store
            .rebuild_dashboard_request_rollup_buckets()
            .await?;
        self.key_store
            .rebuild_account_usage_rollup_buckets_v1()
            .await?;
        Ok(())
    }
}
