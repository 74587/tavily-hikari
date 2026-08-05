# HTTP `X-Project-ID` 项目亲和与热度避让 演进历史

## 变更记录（Change log）

- 2026-04-10: 新建 spec，锁定 owner-scoped `X-Project-ID` 项目亲和、独立 HTTP backoff scope、request-id 优先级与 request log key effects。
- 2026-04-10: PR #227 收口为 merge-ready，补齐 full-target clippy 修复、项目亲和回归覆盖与 PR release labels。
- 2026-04-10: review follow-up 补充无项目亲和 HTTP `429` 继续写入既有 `mcp_session_init` cooldown，避免默认 HTTP 路径回归。
- 2026-04-10: review follow-up 补充 research result GET `429` 继续写入既有 `mcp_session_init` cooldown 与 request-log 关联，避免轮询路径回归。

## Legacy Identity

- Legacy compatibility identity: `#m30lm`.
