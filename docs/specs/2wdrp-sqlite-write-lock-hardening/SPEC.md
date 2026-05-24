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
- Retry logs may include operation, attempt, backoff, and final error context.

## Acceptance

- Under a competing SQLite writer, acquiring a quota subject lock eventually succeeds after the
  writer releases within the existing wait budget.
- Under a competing SQLite writer, scheduled job start retries rather than immediately returning
  `database is locked`.
- Under a competing SQLite writer, forward-proxy startup runtime snapshot persistence retries
  transient lock errors rather than failing the startup path immediately.
- Existing billing tests continue to prove locked billing subject stability, pending billing
  replay, and account/token quota attribution.
- Existing MCP/API routing behavior remains unchanged, including research result GET key pinning.

## References

- `docs/specs/s2vd2-upstream-credits-billing/SPEC.md`
- `docs/specs/cp8s9-upstream-agnostic-api-rebalance/SPEC.md`
- `docs/specs/34pgu-mcp-session-privacy-affinity-hardening/SPEC.md`
- `docs/specs/3tyrc-admin-dashboard-quota-charge-cards/SPEC.md`
- `docs/solutions/operations/sqlite-write-lock-contention.md`
