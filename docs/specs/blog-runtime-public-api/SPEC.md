# Tavily Hikari Public Blog Runtime API

> This file is the durable topic requirements contract. Current implementation facts belong in `IMPLEMENTATION.md`; lifecycle and change references belong in `HISTORY.md`.

## Context and Scope

- Context: the IvanLi blog needs a public, low-cost summary of this service's real runtime activity.
- In scope: the dedicated read-only endpoint, its aggregate response, cache behavior, rate limit, browser origin policy, and its public API route domain.
- Out of scope: the blog client, implementation or modification of other projects' interfaces, operational dashboards, and raw request or account data.

## Terms and Interfaces

- `eligible key pool`: API keys that are not deleted and are not currently quarantined, matching the existing global quota summary.
- `known current quota`: a non-null `quota_limit` with a non-null, non-zero `quota_synced_at` for every key in the eligible key pool.
- `local estimated credits`: credit usage accumulated by the durable dashboard request rollup from billable request activity.
- Interface: `GET /api/public/blog-runtime/v1/tavily-hikari`.
- Public project API route grammar: `/api/public/{domain}/v1/{project}`; `blog-runtime` identifies this resource family.
- A Stat is `{ value, trend }`. A trend is `{ range, points }`; each point is `{ timestamp, value }`, where `value` may be `null` when unavailable or in the future.
- A daily activity point is `{ date, value }`, where `date` is an Asia/Shanghai calendar date and `value` is the request count.

## Requirements

### REQ-BLOG-RUNTIME-001

- The system MUST provide a dedicated GET-only endpoint at `/api/public/blog-runtime/v1/tavily-hikari` and return only `todayRequests`, `todayCredits`, `monthCredits`, `totalCredits`, and `requestActivity90d` in its JSON payload.
- Inputs: an unauthenticated public GET request.
- Outputs: the five approved aggregate fields, without identifiers, request content, key material, addresses, URLs, error details, or other operational fields.

### REQ-BLOG-RUNTIME-002

- The system MUST derive all metric values from the service's durable request rollups and key quota records; it MUST NOT fabricate or randomly generate values.
- Inputs: the persisted dashboard request rollups, API key quota limits, quota sync samples, key lifecycle, and quarantine lifecycle.
- Outputs: `todayRequests` is today's request count; `todayCredits` and `monthCredits` are local estimated credits for the current Asia/Shanghai day and month; `totalCredits` is the current sum of known `quota_limit` values for the eligible key pool, not remaining quota or historical consumption. If any eligible key has an unknown current quota, the snapshot is unavailable rather than publishing a partial total; refresh serves the last-good snapshot when available and a cold request returns `503` with `Retry-After`. An empty eligible key pool has an exact total of zero. Every published Stat's current value is non-negative.

### REQ-BLOG-RUNTIME-003

- The system MUST return chronological trends and daily activity with fixed lengths and Asia/Shanghai boundaries.
- Inputs: the current snapshot time and persisted aggregate records.
- Outputs: all day boundaries and dates use Asia/Shanghai regardless of the host's `Local` timezone. `todayRequests` and `todayCredits` use 25 hourly cumulative points from today's `00:00` through the next `00:00`; future positions are `null`, and the last non-null value equals the Stat's current value. `monthCredits` uses 12 hourly cumulative month-to-date points, `totalCredits` uses 12 hourly quota-limit snapshots, and both use `recent-hours`. `requestActivity90d` contains exactly 90 complete past days in ascending order, from today minus 90 days through yesterday.

### REQ-BLOG-RUNTIME-004

- The system MUST serve cached snapshots with single-flight refresh, a bounded refresh timeout, last-known-good fallback, HTTP cache validation, and server-side rate limiting.
- Inputs: concurrent public requests, refresh failures, and conditional requests.
- Outputs: snapshots are refreshed after 30 seconds; at most one refresh runs per service process at a time; refresh work is bounded to five seconds; a failed refresh returns the last-known-good snapshot when available; matching ETags receive `304 Not Modified`; requests are limited to 600 per minute per service process.

### REQ-BLOG-RUNTIME-005

- The system MUST apply an explicit, deployment-configurable CORS origin allowlist and require no browser credentials.
- Inputs: browser requests whose origin is allowlisted or not allowlisted.
- Outputs: the default allowlist contains `https://ivanli.cc` and `http://127.0.0.1:12620`; `BLOG_RUNTIME_CORS_ORIGINS` may replace it with a comma-separated explicit list; wildcard origins and credentials are not allowed. Cross-origin responses expose `ETag`, `Cache-Control`, and `Retry-After`.

## Verification

### VER-BLOG-RUNTIME-001

- Method: focused endpoint contract tests.
- covers: `REQ-BLOG-RUNTIME-001`, `REQ-BLOG-RUNTIME-002`
- Pass condition: response keys are exact, values match persisted aggregates and quota semantics, values are non-negative, and no operational fields appear.

### VER-BLOG-RUNTIME-002

- Method: deterministic date and trend tests using persisted rollup fixtures in a child process with a non-Shanghai `TZ`.
- covers: `REQ-BLOG-RUNTIME-003`
- Pass condition: trend lengths and timestamps are ordered, future points are null, daily activity has 90 complete past Asia/Shanghai dates starting today minus 90 days and ending yesterday independent of the host timezone, and hourly request and credit trends are cumulative with their last non-null values matching the Stats.

### VER-BLOG-RUNTIME-003

- Method: cache, conditional-request, refresh-failure, rate-limit, and CORS tests.
- covers: `REQ-BLOG-RUNTIME-004`, `REQ-BLOG-RUNTIME-005`
- Pass condition: unknown eligible quota prevents a partial total, stale last-good data survives a failed refresh, and a cold miss returns 503 with Retry-After. Refresh is single-flight and bounded, ETags produce 304 responses, limits are enforced, and allowlisted cross-origin responses expose ETag, Cache-Control, and Retry-After.

## Related ADRs

- [ADR 0005: Public Project APIs Use Domain-Specific Versioned Routes](../../adr/0005-public-project-api-route-namespaces.md)

## References

- `./IMPLEMENTATION.md`
- `./HISTORY.md`
