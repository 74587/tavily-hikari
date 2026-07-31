impl KeyStore {
    async fn ensure_ha_outbox_gc_channel_state(&self) -> Result<(), ProxyError> {
        sqlx::query(
            r#"CREATE TABLE IF NOT EXISTS ha_outbox_gc_channel_state (
                channel TEXT PRIMARY KEY,
                last_attempt_at INTEGER,
                last_progress_at INTEGER,
                last_deleted_rows INTEGER NOT NULL DEFAULT 0,
                last_defer_reason TEXT,
                next_retry_at INTEGER,
                consecutive_no_progress INTEGER NOT NULL DEFAULT 0,
                batch_size INTEGER NOT NULL DEFAULT 250
            )"#,
        )
        .execute(&self.pool)
        .await?;
        for channel in ["control", "billing", "runtime"] {
            sqlx::query(
                "INSERT OR IGNORE INTO ha_outbox_gc_channel_state (channel) VALUES (?)",
            )
            .bind(channel)
            .execute(&self.pool)
            .await?;
        }
        Ok(())
    }
}
