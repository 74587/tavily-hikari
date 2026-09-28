# Tavily Hikari Public Blog Runtime API 实现状态

> 当前有效规范仍以 `./SPEC.md` 为准；这里记录实现覆盖、交付进度与 rollout 相关事实，避免这些细节散落到 PR / Git 历史里。

## Current Status

- Implementation: 已实现（本地 focused validation 通过）
- Lifecycle: active
- Catalog note: Public blog runtime aggregate endpoint

## Coverage / rollout summary

- `GET /api/public/blog-runtime/v1/tavily-hikari` returns the five approved fields. Daily activity and completed month days use durable daily dashboard rollups; today's and recent hourly values use minute rollups. Current and historical `totalCredits` use API-key quota limits with deletion and quarantine lifecycle eligibility.
- Snapshot TTL is 30 seconds. Refresh is single-flight and times out after five seconds; stale last-known-good data survives failed refreshes. Successful responses use ETags and `Cache-Control: public, max-age=15`.
- The per-process sliding-window limit is 600 requests per 60 seconds. `BLOG_RUNTIME_CORS_ORIGINS` accepts a comma-separated explicit origin list and defaults to `https://ivanli.cc` and `http://127.0.0.1:12620`; credentials and wildcard origins are disabled.
- No database migration is required.
- The backend test manifest assigns the persisted data fixture to `lib-request-rollup-reporting` and the HTTP/cache cases to `bin-public-blog-runtime`. Focused tests include a fixed-time projection for daily, monthly, historical quota, and future-point behavior. Commands: `python3 scripts/ci_backend_tests.py verify`; `python3 scripts/ci_backend_tests.py run-shard --id lib-request-rollup-reporting`; `python3 scripts/ci_backend_tests.py run-shard --id bin-public-blog-runtime`; `cargo fmt --check`; `git diff --check`.

## Remaining Gaps

- None known. Formal review and PR convergence remain in progress.

## Related Changes

- `src/server/handlers/blog_runtime.rs`
- `src/store/key_store_blog_runtime.rs`
- `src/server/serve.rs`

## References

- `./SPEC.md`
- `./HISTORY.md`
