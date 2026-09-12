#[derive(Debug, Default)]
struct ResearchSweepOutcome {
    polled: i64,
    terminal: i64,
    pending: i64,
    retries: i64,
    skipped_cooldown: i64,
    earliest_cooldown_until: Option<i64>,
    remote_attempt_budget_deferred: bool,
    budget_exhausted: bool,
    cursor_ready: bool,
}

fn should_emit_reconciliation_summary_at(last_emitted_at: &AtomicI64, now: i64) -> bool {
    let mut previous = last_emitted_at.load(Ordering::Relaxed);
    loop {
        if previous > 0 && now.saturating_sub(previous) < 60 {
            return false;
        }
        match last_emitted_at.compare_exchange(
            previous,
            now,
            Ordering::Relaxed,
            Ordering::Relaxed,
        ) {
            Ok(_) => return true,
            Err(observed) => previous = observed,
        }
    }
}

/// Owns a rate-attempt reservation until the corresponding upstream request
/// has actually started. Cancellation and task aborts must not leave a quota
/// row behind, so the drop path schedules the same bounded release used by
/// normal pre-request failures.
struct UpstreamUsageAttemptReservation {
    key_store: Arc<KeyStore>,
    reservation_id: Option<String>,
}

impl UpstreamUsageAttemptReservation {
    fn new(key_store: Arc<KeyStore>, reservation_id: String) -> Self {
        Self {
            key_store,
            reservation_id: Some(reservation_id),
        }
    }

    async fn release(&mut self) -> Result<(), ProxyError> {
        let Some(reservation_id) = self.reservation_id.as_deref() else {
            return Ok(());
        };
        self.key_store
            .release_upstream_usage_attempt(reservation_id)
            .await?;
        self.reservation_id = None;
        Ok(())
    }

    fn disarm(&mut self) {
        self.reservation_id = None;
    }
}

impl Drop for UpstreamUsageAttemptReservation {
    fn drop(&mut self) {
        let Some(reservation_id) = self.reservation_id.take() else {
            return;
        };
        let key_store = Arc::clone(&self.key_store);
        let spawn_fallback_id = reservation_id.clone();
        let runtime_fallback_id = spawn_fallback_id.clone();
        let cleanup_id = reservation_id.clone();
        let cleanup = async move {
            const RETRY_DELAYS_MS: [u64; 4] = [20, 50, 100, 200];
            let mut attempt = 0;
            loop {
                match key_store
                    .release_upstream_usage_attempt(&cleanup_id)
                    .await
                {
                    Ok(()) => return,
                    Err(_err) if attempt < RETRY_DELAYS_MS.len() => {
                        tokio::time::sleep(Duration::from_millis(RETRY_DELAYS_MS[attempt])).await;
                        attempt += 1;
                        tracing::debug!(
                            component = "reconciliation",
                            event = "rate_attempt_reservation_cleanup_retry",
                            attempt,
                            error_kind = "sqlite_write",
                        );
                    }
                    Err(_) => {
                        crate::store::remember_abandoned_upstream_usage_attempt(
                            reservation_id.clone(),
                        );
                        tracing::warn!(
                            component = "reconciliation",
                            event = "rate_attempt_reservation_cleanup_deferred",
                            "cancelled reconciliation reservation could not be released"
                        );
                        break;
                    }
                }
            }
        };
        // A cancellation can happen while the owning Tokio runtime is
        // shutting down. Always use a detached, short-lived runtime so the
        // reservation release does not depend on that runtime accepting new
        // tasks.
        if let Err(err) = std::thread::Builder::new()
            .name("reconciliation-reservation-cleanup".to_string())
            .spawn(move || {
                let runtime = match tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                {
                    Ok(runtime) => runtime,
                    Err(err) => {
                        crate::store::remember_abandoned_upstream_usage_attempt(
                            runtime_fallback_id.clone(),
                        );
                        tracing::warn!(
                            component = "reconciliation",
                            event = "rate_attempt_reservation_cleanup_deferred",
                            error_kind = "runtime_init",
                            error = %err,
                        );
                        return;
                    }
                };
                runtime.block_on(cleanup);
            })
        {
            tracing::warn!(
                component = "reconciliation",
                event = "rate_attempt_reservation_cleanup_deferred",
                error_kind = "thread_spawn",
                error = %err,
            );
            crate::store::remember_abandoned_upstream_usage_attempt(spawn_fallback_id);
        }
    }
}
