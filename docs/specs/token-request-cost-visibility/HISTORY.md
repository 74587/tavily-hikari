# Token Request Records 计费可视化与状态列正名 演进历史

## 变更记录（Change log）

- 2026-03-10: 初始化快车道 spec，冻结 token detail 费用列、`Tavily Status` 文案正名，以及 `business_credits` 仅透传不改计费逻辑的边界。

- 2026-03-10: 已完成后端 `business_credits` 透传、Token detail `Charged Credits` 展示、全站 `Tavily Status` 文案正名；`cargo test`、`cargo clippy -- -D warnings`、`cd web && bun run build` 通过，并以本地 seeded 数据确认 `/api/tokens/:id/logs`、`/logs/page`、`/events` 返回一致。

- 2026-03-10: 快车道收敛完成；PR 截图已同步到 `## Visual Evidence (PR)`，最新 head SHA 的 checks 与 PR-stage review-loop 均已通过。

- 2026-05-26: 扩展用户控制台 Token 详情“近期请求”积分展示；用户 token logs / SSE snapshot 透出 `businessCredits`，公开日志继续不暴露内部计费字段。

## Legacy Identity

- Legacy compatibility identity: `#jewvm`.
