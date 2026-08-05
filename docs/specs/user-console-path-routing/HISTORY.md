# 用户控制台 Path 路由迁移 演进历史

## 变更记录（Change log）

- 2026-04-12: 创建 follow-up spec，冻结 `/console` path 路由合同、首页 `#token` 保留兼容、以及 legacy `/console#/...` 明确不兼容的边界。
- 2026-04-12: 完成 `UserConsole` path route helper、`popstate` history sync、Vite/Rust `/console/*` fallback，以及首页 `#token` / `#token-id` 兼容回归测试。
- 2026-04-12: 完成 `cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook`、`cargo test` 本地验证；按当前任务口径不提交截图资产，PR 以路由契约、测试与构建验证为主。
- 2026-04-13: 补齐 `type:patch` + `channel:stable` release labels，并将 spec / 索引同步到可合并完成态，准备进入 merge + cleanup。

## Legacy Identity

- Legacy compatibility identity: `#8yzmy`.
