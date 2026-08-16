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
    ) -> Result<ClaimedReconciliationRunOutcome, ProxyError> {
        let Some(_run_lease) = proxy.key_store.sqlite_runtime.try_start_maintenance_run() else {
            return Ok(ClaimedReconciliationRunOutcome::Deferred {
                reason: "shutdown",
            });
        };
        match proxy
            .run_upstream_reconciliation_once_inner(
                usage_base,
                Some((job_id, claim_generation)),
            )
            .await
        {
            Err(ProxyError::StaleClaim { .. }) => {
                Ok(ClaimedReconciliationRunOutcome::StaleClaim)
            }
            result => result,
        }
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
