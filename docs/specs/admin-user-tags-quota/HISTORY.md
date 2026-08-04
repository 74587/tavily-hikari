# Admin 用户标签与额度叠加 演进历史

## 变更记录（Change log）

- 2026-03-09: 冻结快车道 spec、DB / HTTP contracts，并落地 `user_tags` / `user_tag_bindings`、LinuxDo 系统标签 seed / 回填、基线额度 + 标签叠加、`block_all` 限流语义，以及 admin 列表/详情标签与额度拆解 UI。
- 2026-03-09: 通过 `cargo clippy -- -D warnings`、`cargo test`、`cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook`，并在 `http://127.0.0.1:55173/admin/users` 与 `http://127.0.0.1:55173/admin/users/demo-user` 完成真实浏览器验收。
- 2026-03-10: 根据主人确认补齐 5 张管理端视觉证据，统一归档到 `docs/specs/admin-user-tags-quota/assets/`，并修正标签目录编辑卡片与非编辑卡片的基线对齐。
- 2026-06-26: 管理端标签/额度相关 UI 与合同同步切换到“每小时业务请求次数限额 / 每日积分限额 / 每月积分限额”；用户详情与用量页补充指标解释交互，business 1h 成为唯一小时业务额度入口。

## Legacy Identity

- Legacy compatibility identity: `#2mt2u`.
