#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ReconciliationOutcome {
    Settled,
    NoAdjustment,
    Observed,
    Upstream429,
    TransportFailure,
    SemanticFailure,
    LocalPressure,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[doc(hidden)]
pub enum ClaimedReconciliationRunOutcome {
    Completed {
        settled: i64,
        no_adjustment: i64,
        observed: i64,
    },
    Deferred { reason: &'static str },
    StaleClaim,
}

pub(crate) struct ReconciliationEngine;

impl ReconciliationEngine {
    const MAX_REMOTE_ATTEMPTS: i64 = 2;
    // The compatibility one-shot API has no durable representative job.
    const ONE_SHOT_ADMISSION_WAIT: std::time::Duration = std::time::Duration::from_millis(250);

    async fn run_claimed(
        proxy: &TavilyProxy,
        usage_base: &str,
        job_id: i64,
        claim_generation: i64,
        remote_io_permit: Option<tokio::sync::OwnedSemaphorePermit>,
    ) -> Result<ClaimedReconciliationRunOutcome, ProxyError> {
        let proxy = proxy.clone();
        let usage_base = usage_base.to_string();
        tokio::spawn(async move {
            let _remote_io_permit = remote_io_permit;
            let Some(_run_lease) = proxy.key_store.sqlite_runtime.try_start_maintenance_run() else {
                return Ok(ClaimedReconciliationRunOutcome::Deferred {
                    reason: "shutdown",
                });
            };
            match proxy
                .run_upstream_reconciliation_once_inner(
                    &usage_base,
                    Some((job_id, claim_generation)),
                )
                .await
            {
                Err(ProxyError::StaleClaim { .. }) => {
                    Ok(ClaimedReconciliationRunOutcome::StaleClaim)
                }
                result => result,
            }
        })
        .await
        .map_err(|err| ProxyError::Other(format!("reconciliation engine task failed: {err}")))?
    }

    fn outcome(
        settled: i64,
        no_adjustment: i64,
        observed: i64,
        upstream_429: bool,
        local_pressure: bool,
        transport_failure: bool,
        semantic_failure: bool,
    ) -> Option<ReconciliationOutcome> {
        if upstream_429 {
            Some(ReconciliationOutcome::Upstream429)
        } else if transport_failure {
            Some(ReconciliationOutcome::TransportFailure)
        } else if semantic_failure {
            Some(ReconciliationOutcome::SemanticFailure)
        } else if local_pressure {
            Some(ReconciliationOutcome::LocalPressure)
        } else if settled > no_adjustment {
            Some(ReconciliationOutcome::Settled)
        } else if observed > 0 {
            Some(ReconciliationOutcome::Observed)
        } else if no_adjustment > 0 {
            Some(ReconciliationOutcome::NoAdjustment)
        } else {
            None
        }
    }

    fn is_transport_failure(err: &ProxyError) -> bool {
        matches!(err, ProxyError::Http(_) | ProxyError::Database(_))
    }

    fn active_settlement_integrity_reason(err: &ProxyError) -> Option<&'static str> {
        let ProxyError::Other(message) = err else {
            return None;
        };
        if message.contains("invalid reconciliation billing subject") {
            Some("invalid_billing_subject")
        } else if message.contains("unsupported reconciliation billing subject") {
            Some("unsupported_billing_subject")
        } else {
            None
        }
    }

    async fn pause_active_settlement_integrity_failure(
        proxy: &TavilyProxy,
        settlement_mode: &str,
        error: &ProxyError,
    ) -> Result<(), ProxyError> {
        if settlement_mode != "shadow"
            && let Some(reason) = Self::active_settlement_integrity_reason(error)
        {
            proxy
                .key_store
                .pause_upstream_reconciliation_for_integrity(reason)
                .await?;
        }
        Ok(())
    }

    pub(crate) fn projection_defer_exhausts_preparation(candidate_count: usize) -> bool {
        candidate_count == 0
    }

    fn clears_local_pressure(outcome: ReconciliationOutcome) -> bool {
        matches!(
            outcome,
            ReconciliationOutcome::Settled
                | ReconciliationOutcome::NoAdjustment
                | ReconciliationOutcome::Observed
        )
    }

    fn clears_upstream_429(outcome: ReconciliationOutcome) -> bool {
        Self::clears_local_pressure(outcome)
    }
}

#[cfg(test)]
mod reconciliation_engine_tests {
    use std::sync::atomic::AtomicI64;

    use crate::ProxyError;

    use super::{
        ReconciliationEngine, ReconciliationOutcome, should_emit_reconciliation_summary_at,
    };

    #[test]
    fn reconciliation_summary_logging_is_limited_to_one_per_minute() {
        let last_emitted_at = AtomicI64::new(0);

        assert!(should_emit_reconciliation_summary_at(&last_emitted_at, 1_000));
        assert!(!should_emit_reconciliation_summary_at(&last_emitted_at, 1_059));
        assert!(should_emit_reconciliation_summary_at(&last_emitted_at, 1_060));
    }

    #[test]
    fn non_success_outcomes_do_not_clear_upstream_429_state() {
        assert!(!ReconciliationEngine::clears_upstream_429(
            ReconciliationOutcome::TransportFailure
        ));
        assert!(!ReconciliationEngine::clears_upstream_429(
            ReconciliationOutcome::SemanticFailure
        ));
        assert!(!ReconciliationEngine::clears_upstream_429(
            ReconciliationOutcome::LocalPressure
        ));
        assert!(ReconciliationEngine::clears_upstream_429(
            ReconciliationOutcome::Settled
        ));
    }

    #[test]
    fn successful_terminal_outcomes_clear_both_backoffs() {
        assert!(ReconciliationEngine::clears_local_pressure(
            ReconciliationOutcome::Settled
        ));
        assert!(ReconciliationEngine::clears_local_pressure(
            ReconciliationOutcome::NoAdjustment
        ));
        assert!(ReconciliationEngine::clears_upstream_429(
            ReconciliationOutcome::NoAdjustment
        ));
    }

    #[test]
    fn failure_outcomes_prevent_a_same_round_success_from_clearing_429() {
        assert_eq!(
            ReconciliationEngine::outcome(1, 1, 0, false, false, true, false),
            Some(ReconciliationOutcome::TransportFailure)
        );
        assert_eq!(
            ReconciliationEngine::outcome(1, 0, 0, false, false, false, true),
            Some(ReconciliationOutcome::SemanticFailure)
        );
        assert_eq!(
            ReconciliationEngine::outcome(1, 1, 0, false, true, false, false),
            Some(ReconciliationOutcome::LocalPressure)
        );
    }

    #[test]
    fn compare_observation_is_not_classified_as_a_settlement() {
        assert_eq!(
            ReconciliationEngine::outcome(0, 0, 1, false, false, false, false),
            Some(ReconciliationOutcome::Observed)
        );
    }

    #[test]
    fn actual_settlement_integrity_failures_are_pauseable_but_retryable_errors_are_not() {
        assert_eq!(
            ReconciliationEngine::active_settlement_integrity_reason(&ProxyError::Other(
                "invalid reconciliation billing subject".to_string(),
            )),
            Some("invalid_billing_subject")
        );
        assert_eq!(
            ReconciliationEngine::active_settlement_integrity_reason(&ProxyError::Other(
                "database is locked".to_string(),
            )),
            None
        );
        assert_eq!(
            ReconciliationEngine::active_settlement_integrity_reason(&ProxyError::StaleClaim {
                job_id: 1,
                claim_generation: 2,
            }),
            None
        );
    }
}

impl ReconciliationOutcome {
    fn as_str(self) -> &'static str {
        match self {
            Self::Settled => RECONCILIATION_OUTCOME_SETTLED,
            Self::NoAdjustment => RECONCILIATION_OUTCOME_NO_ADJUSTMENT,
            Self::Observed => RECONCILIATION_OUTCOME_OBSERVED,
            Self::Upstream429 => RECONCILIATION_OUTCOME_UPSTREAM_429,
            Self::TransportFailure => RECONCILIATION_OUTCOME_TRANSPORT_FAILURE,
            Self::SemanticFailure => RECONCILIATION_OUTCOME_SEMANTIC_FAILURE,
            Self::LocalPressure => RECONCILIATION_OUTCOME_LOCAL_PRESSURE,
        }
    }
}
