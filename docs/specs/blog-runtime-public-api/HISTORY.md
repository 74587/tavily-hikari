# Tavily Hikari Public Blog Runtime API 主题历史

> 这里记录主题局部生命周期、替换、兼容性与必要背景；完整 ADR 取舍保留在 `docs/adr/`。单次任务流水账不放这里，规范正文仍以 `./SPEC.md` 为准。

## Lifecycle / Compatibility

- None

## Replacements / Background

- Added as a dedicated public interface for the IvanLi blog runtime panel. It does not reuse or proxy another public API.

## Related Changes

- 2026-09-28: PR [#629](https://github.com/IvanLi-CN/tavily-hikari/pull/629) adds the endpoint through commits `fb375dfb`, `ca08acbc`, and `99a3b8c9`. Tier 4 review against base `541ab04b` completed with clear contract, state-concurrency, failure-data-safety, test-platform, and database-migration lanes. The API is additive; historical quota before membership tracking remains unknown, and reimported keys use only quota captured during the new membership interval. See `./SPEC.md` for the response and compatibility contract.
- 2026-09-29: PR [#629](https://github.com/IvanLi-CN/tavily-hikari/pull/629) clarifies that daily activity covers the 90 complete prior Asia/Shanghai days, makes today's hourly request and credit trends cumulative, and leaves current total quota unavailable while any eligible key has an unfinished quota sync. Cross-origin responses expose the cache and retry headers. Public route-domain conventions are recorded in [ADR 0005](../../adr/0005-public-project-api-route-namespaces.md).

## References

- `./SPEC.md`
- `./IMPLEMENTATION.md`
