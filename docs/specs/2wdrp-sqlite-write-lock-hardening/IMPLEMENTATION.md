# Implementation

## Current Coverage

- Added a shared transient SQLite write retry helper for bounded backoff.
- `quota_subject_locks` acquire/refresh/release now retry transient SQLite busy/locked errors within
  the existing lock timeout or lease budget.
- Scheduled job start/finish writes now retry transient SQLite busy/locked errors before surfacing
  failure to background schedulers.
- OAuth account upsert/profile refresh wrapper calls now retry transient SQLite busy/locked errors
  before returning failures to LinuxDo login or daily sync flows.
- Forward-proxy startup now refreshes subscription-backed endpoints concurrently, syncs xray state
  from the restored snapshot, and retries runtime snapshot persistence when SQLite briefly denies
  the write slot.
- Added local contention tests for quota subject lock acquisition and scheduled job start.
- Added local contention coverage for forward-proxy startup subscription refresh and runtime
  snapshot persistence.

## Validation

- `cargo fmt --all`
- Targeted SQLite lock contention tests.
- Existing billing/MCP/quota-sync tests relevant to the touched paths.
- `cargo test`
- `cargo clippy -- -D warnings`
- Full `cargo test --locked --all-features`
- `cargo clippy -- -D warnings`

## Operations Notes

- Production baseline was read-only: container healthy, version `0.46.2`, database `8.3G`, WAL
  `235M`, and the most recent one-hour lock sample only showed LinuxDo OAuth upsert contention.
- The implementation does not perform production data mutation and does not alter pool size.
