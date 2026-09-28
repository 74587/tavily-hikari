# Tavily Hikari Public Blog Runtime API 实现状态

> 当前有效规范仍以 `./SPEC.md` 为准；这里记录实现覆盖、交付进度与 rollout 相关事实，避免这些细节散落到 PR / Git 历史里。

## Current Status

- Implementation: 已实现（backend manifest verification 与两个受影响 shards 通过）
- Lifecycle: active
- Catalog note: Public blog runtime aggregate endpoint

## Coverage / rollout summary

- `GET /api/public/blog-runtime/v1/tavily-hikari` returns the five approved fields. Daily activity and completed month days use durable daily dashboard rollups; today's and recent hourly values use minute rollups. `requestActivity90d` covers the 90 complete Asia/Shanghai days from today minus 90 days through yesterday. Today request and credit trends are cumulative by hour, with future points null and the last non-null point equal to the current Stat value.
- Current `totalCredits` is published only when every eligible key has a non-null `quota_limit` and a non-null, non-zero `quota_synced_at`; an unknown value fails refresh, preserving last-good data or returning cold `503 Retry-After`. An empty eligible pool returns an exact zero. Historical points use persisted key membership intervals, quota samples captured during that interval, and quarantine lifecycle.
- The startup migration records the lifecycle tracking start and seeds intervals for the currently active keys. Historical quota points before that timestamp are unavailable and return `null`; after reimport, points remain `null` until a quota snapshot is captured in the new interval. Deletion and reimport transitions after tracking began are recorded in the same transaction as key mutations.
- Snapshot TTL is 30 seconds. Refresh is single-flight and times out after five seconds; stale last-known-good data survives failed refreshes. Successful responses use ETags and `Cache-Control: public, max-age=15`; allowlisted cross-origin responses expose `ETag`, `Cache-Control`, and `Retry-After`.
- Public project APIs use the route grammar `/api/public/{domain}/v1/{project}`. This service keeps the `blog-runtime` domain; the domain-specific cross-project decision is recorded in [ADR 0005](../../adr/0005-public-project-api-route-namespaces.md).
- The per-process sliding-window limit is 600 requests per 60 seconds. `BLOG_RUNTIME_CORS_ORIGINS` accepts a comma-separated explicit origin list and defaults to `https://ivanli.cc` and `http://127.0.0.1:12620`; credentials and wildcard origins are disabled.
- The migration adds `api_key_membership_history_state` and `api_key_membership_intervals`; it does not rebuild or alter request rollups or quota samples.
- The backend test manifest assigns the persisted data fixture to `lib-request-rollup-reporting` and the HTTP/cache cases to `bin-public-blog-runtime`. Tests cover known and unknown current quota, the empty eligible pool, stale and cold refresh behavior, exposed CORS headers, cumulative hourly points, and the UTC instant that crosses into the next Asia/Shanghai day. Commands: `python3 scripts/ci_backend_tests.py verify`; `python3 scripts/ci_backend_tests.py run-shard --id lib-request-rollup-reporting`; `python3 scripts/ci_backend_tests.py run-shard --id bin-public-blog-runtime`; `cargo fmt --check`; `git diff --check`.

## Remaining Gaps

- Key lifecycle before interval tracking began cannot be reconstructed from `deleted_at` after a key is reimported. Those historical quota points remain `null` rather than using current membership retroactively.

## Related Changes

- `src/server/handlers/blog_runtime.rs`
- `src/store/key_store_blog_runtime.rs`
- `src/server/serve.rs`
- `src/server/tests/blog_runtime_public.rs`
- `src/tests/blog_runtime.rs`
- `docs/adr/0005-public-project-api-route-namespaces.md`

## References

- `./SPEC.md`
- `./HISTORY.md`
