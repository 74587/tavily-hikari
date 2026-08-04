# Admin 告警中心与 24h 仪表盘告警摘要 演进历史

## Change log

- 2026-04-18: 初始化 spec，冻结 Admin 告警中心、告警读模型、24h 仪表盘摘要、共享 URL 语义与验证门禁。
- 2026-04-22: 热修复补充 `upstream_usage_limit_432`，明确 Tavily 432 通过查询层重分类，不再误报为 `user_quota_exhausted`；同时要求 affinity 仅粘 active key，成功请求需回写 primary affinity。
- 2026-06-24: 修复 101 生产 `/api/alerts/groups` 的旧版 SQLite parser 兼容性；batch request-kind canonicalization 不再生成 `COALESCE((CASE ...))`、`COUNT(DISTINCT (CASE ...))`、`MIN((CASE ...))` 形式的聚合 SQL，并补充回归断言。

## Legacy Identity

- Legacy compatibility identity: `#9tbyq`.
