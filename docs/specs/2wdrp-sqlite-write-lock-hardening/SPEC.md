# SQLite write-lock hardening（#2wdrp）

## Status

- Lifecycle: active
- Created: 2026-05-07
- Last: 2026-05-24

## Background

Production `tavily-hikari` `0.46.2` showed transient SQLite `database is locked` errors after API
rebalance was enabled. The service remained healthy, but logs included request-path failures such as
`token billing lock failed` for `/api/tavily/search` and `/api/tavily/extract`, plus MCP session
lock failures and background job start failures.

The observed behavior points to SQLite writer contention rather than API rebalance selector
misrouting. Billing, MCP session serialization, quota sync, scheduled job logging, LinuxDo OAuth
upserts, and rollups all share the same SQLite database and can briefly compete for the single
writer slot.

Forward-proxy startup also participates in this same lock budget: it refreshes subscription-backed
endpoints, syncs xray state, and persists runtime snapshots before the HTTP server reports itself
ready. That startup path can amplify a short writer collision into a slow first healthy when the
runtime snapshot write collides with other writers.

Dockrev `job_01KSEPDVXF8NAQCEQGJKV33T4F` showed a related startup-order failure after the previous
hardening: the service was healthy before restart, but startup still waited on remote subscription
refresh before restoring the locally persisted subscription runtime. A restart should recover known
proxy nodes from `forward_proxy_runtime` first; remote subscription refresh is only the calibration
source when a usable persisted runtime already exists.

## Goals

- Keep request-path billing and MCP session locks from failing on transient SQLite busy/locked
  errors when the existing bounded wait budget can absorb the contention.
- Preserve quota ledger correctness, pending billing replay, session affinity, research key pinning,
  and API rebalance behavior.
- Make background job bookkeeping tolerate transient lock pressure without amplifying request-path
  failures.
- Keep forward-proxy startup from turning short SQLite writer contention into a long readiness
  delay.
- Cover the lock-contention behavior with local tests that use only local/mock state.

## Non-goals

- No production data repair, destructive maintenance, or hand-written production ledger SQL.
- No increase to the SQLite connection pool as the primary fix.
- No billing reservation redesign unless this hardening proves insufficient.
- No change to public HTTP, MCP, DB schema, or frontend contracts.

## Requirements

- `quota_subject_locks` acquire/refresh/release writes must retry transient SQLite write errors with
  bounded backoff and must remain inside the existing lock timeout/lease budget.
- Token billing and MCP session lock callers must retain the current fail-closed semantics if the
  bounded retry window is exhausted.
- `scheduled_jobs` start/finish writes must retry transient SQLite write errors before surfacing a
  background job logging failure.
- LinuxDo OAuth account upsert/refresh calls must retry transient SQLite write errors at the proxy
  boundary so a short writer collision does not immediately fail user login/profile sync.
- `forward_proxy` startup runtime snapshot persistence must retry transient SQLite write errors with
  bounded backoff so a short writer collision does not delay readiness longer than necessary.
- Startup subscription refresh may fetch multiple subscription URLs concurrently, as long as the
  refresh still fails closed when every subscription fetch fails.
- Startup must restore persisted subscription endpoints before remote subscription refresh when
  their configured subscription ownership is unambiguous. When at least one restored subscription
  endpoint exists, startup must not block on remote refresh before xray sync/runtime persistence;
  without safely restorable endpoints, startup continues to wait for subscription readiness.
- `request_logs_gc` must not hold the SQLite write slot for an unbounded full-retention cleanup
  pass. It must delete old `request_logs` and `request_log_catalog_rollups` in bounded batches,
  yield between batches, report partial progress, and continue catch-up after a delay when more
  rows remain.
- A one-shot request-log GC CLI must reuse the same bounded cleanup path so production database
  samples can be validated deterministically without waiting for the daily scheduler.
- Request-log GC must avoid high-resource catch-up strategies such as rebuilding the whole
  `request_logs` table or generating a large WAL. Large backlogs are expected to catch up over
  repeated bounded windows.
- Retry logs may include operation, attempt, backoff, and final error context.

## Acceptance

- Under a competing SQLite writer, acquiring a quota subject lock eventually succeeds after the
  writer releases within the existing wait budget.
- Under a competing SQLite writer, scheduled job start retries rather than immediately returning
  `database is locked`.
- Under a competing SQLite writer, forward-proxy startup runtime snapshot persistence retries
  transient lock errors rather than failing the startup path immediately.
- With safely restorable persisted subscription runtime and a slow subscription endpoint, restart
  restores the local runtime and completes without waiting for the slow remote refresh.
- Without persisted subscription runtime, startup remains strict and waits for subscription
  readiness instead of reporting healthy from an empty proxy graph.
- With a large backlog of old request logs, one scheduler pass records bounded progress instead of
  running indefinitely; later catch-up passes eventually remove all rows older than the retention
  threshold.
- `request_logs_gc_once --run-until-complete --json` removes old request logs and catalog rollups
  from a production-derived validation sample and reports `completed=true` when no old rows remain,
  while keeping WAL growth and CPU time bounded.
- Existing billing tests continue to prove locked billing subject stability, pending billing
  replay, and account/token quota attribution.
- Existing MCP/API routing behavior remains unchanged, including research result GET key pinning.

## References

- `docs/specs/s2vd2-upstream-credits-billing/SPEC.md`
- `docs/specs/cp8s9-upstream-agnostic-api-rebalance/SPEC.md`
- `docs/specs/34pgu-mcp-session-privacy-affinity-hardening/SPEC.md`
- `docs/specs/3tyrc-admin-dashboard-quota-charge-cards/SPEC.md`
- `docs/solutions/operations/sqlite-write-lock-contention.md`
