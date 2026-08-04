# UserConsole Storybook 验收参数重构 演进历史

## 变更记录（Change log）

- 2026-03-07: 创建 spec，冻结 Storybook 验收参数重构范围；明确移除 `scenario` 公开暴露，并排除管理员差异项。

- 2026-03-07: 将 UserConsole Storybook 公开 args 收敛为 `consoleView`、`tokenListState`、`tokenDetailPreview`，并把 preset stories 改为业务语义命名。
- 2026-03-07: 已完成 `cd web && bun run build` 与 `cd web && bun run build-storybook`；静态产物确认 UserConsole stories 不再暴露 `scenario`。
- 2026-03-07: 新增 `web/src/UserConsole.stories.test.ts`，回归锁定 acceptance-facing args、条件 controls 与旧导出名移除。
- 2026-03-08: 完成 PR #102 与最新 `main` 的冲突收敛，补跑 Label Gate / CI Pipeline 全部成功，PR 恢复为 `mergeable_state=clean`。
- 2026-03-18: 跟进 45squ probe 展示收口；整页 `UserConsole` stories 仅保留页面级态，新增独立 `Connectivity Checks` fragment gallery 聚合 probe 多状态，并把 MCP `tools/list` 后的全部工具调用展示纳入同一验收面板，同时同步更新测试与文档口径。

## Legacy Identity

- Legacy compatibility identity: `#7hs2d`.
