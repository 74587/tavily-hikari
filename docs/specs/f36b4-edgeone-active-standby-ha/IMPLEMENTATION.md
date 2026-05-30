# Implementation

## Backend

- Added `src/ha.rs` with HA mode, role state machine, runtime status view, and Tencent TC3-signed EdgeOne client calls.
- Added HA startup role detection from EdgeOne current origin.
- Added admin endpoints for HA status, promote, finalize, and recovery import.
- Added full-master fencing for system settings, upstream key creation, user token management, user quota changes, registration settings, OAuth login start, recharge order creation, and payment notify.
- Added HA schema tables for node state, sync watermarks, failover operations, recovery batches, and EdgeOne audit logs.

## Frontend

- Added API bindings for HA status, promote, and finalize.
- Added shared `HaStatusBanner` with admin and user presentation modes.
- Added admin banner with promote/finalize actions.
- Added user console banner for degraded HA states.
- Added Storybook scenarios for provisional, standby, and user degraded states.

## Remaining Hardening

- Persist runtime HA role changes into `ha_node_state` and audit EdgeOne calls into `ha_edgeone_audit_logs`.
- Implement actual SQLite snapshot/change-package transfer and idempotent recovery batch import.
- Add multi-node mock integration tests for EdgeOne concurrent promote and recovery import idempotency.
