# MCP 会话头透传热修直达 101 验收 演进历史

## 变更记录（Change log）

- 2026-03-27: 新建 hotfix spec，锁定 MCP 会话头透传、stable release 与 101 验收范围。
- 2026-03-27: 完成共享 allowlist 修改、单元/集成回归与本地质量门验证，等待 PR、release 与 101 收口。
- 2026-03-27: PR #184 合并后发布 stable `v0.29.5`，Release workflow `23640976259` 产出 GHCR digest `sha256:1b641d816609e432e012ce9ad8d1d090cbc95d8ee107f923c4646a35bfc7e162`。
- 2026-03-27: 101 `ai-tavily-hikari` 已更新到 `v0.29.5`；部署后 `initialize -> notifications/initialized -> tools/list -> prompts/list` 成功链路确认透传 `mcp-session-id` / `mcp-protocol-version`，残留 `Missing mcp-session-id header` 400 样本均为客户端未携带 session header，而非代理继续丢头。

## Legacy Identity

- Legacy compatibility identity: `#uuhup`.
