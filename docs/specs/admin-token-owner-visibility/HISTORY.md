# Admin Tokens 关联用户补齐 演进历史

## 变更记录（Change log）

- 2026-03-07: 创建快车道 spec，约束 owner DTO、列表/详情展示规则与验收口径。

- 2026-03-07: 已完成 owner DTO、管理员 token 列表/详情展示、Rust 测试与 Storybook mock；通过 `cargo test`、`cd web && bun run build`，并在 `http://127.0.0.1:58097/admin/tokens` 与 `http://127.0.0.1:58097/admin/tokens/:id` 完成 dev-open-admin 验收。

## Legacy Identity

- Legacy compatibility identity: `#27ypg`.
