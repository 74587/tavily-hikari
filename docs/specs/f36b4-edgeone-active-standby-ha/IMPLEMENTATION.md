# Implementation

## Backend

- Added `src/ha.rs` with HA mode, role state machine, runtime status view, and Tencent TC3-signed EdgeOne client calls.
- Added HA startup role detection from EdgeOne current origin.
- Added admin endpoints for HA status, SQLite snapshot export/import, promote, finalize, and recovery import.
- Added standby snapshot restore through `ATTACH` on the current SQLite pool so the process does not need to replace an open database file.
- Added recovery batch idempotency, HA sync watermarks, failover operation persistence, and node state persistence.
- Adjusted EdgeOne origin switching to send host and origin port separately.
- Added full-master fencing for system settings, upstream key creation, user token management, user quota changes, registration settings, OAuth login start, recharge order creation, and payment notify.
- Added HA schema tables for node state, sync watermarks, failover operations, recovery batches, and EdgeOne audit logs.

## Frontend

- Added API bindings for HA status, promote, and finalize.
- Added shared `HaStatusBanner` with admin and user presentation modes.
- Added admin banner with promote/finalize actions.
- Added user console banner for degraded HA states.
- Added Storybook scenarios for provisional, standby, and user degraded states.

## Remaining Hardening

- Wire automatic 5-15 second peer push/pull scheduling once direct node-to-node URLs and internal auth token policy are configured.
- Store full request/response EdgeOne audit payloads from inside the EdgeOne client rather than only operation-level failover rows.
- Add multi-node mock integration tests for EdgeOne concurrent promote.
