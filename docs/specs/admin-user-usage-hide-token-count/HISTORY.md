# Admin 用户用量页隐藏令牌数列 演进历史

## 变更记录（Change log）

- 2026-03-22: 创建 spec，冻结“仅移除管理端用户用量页令牌数展示”的范围与验收口径。
- 2026-03-22: 生产页与 Users Usage Storybook 画布已移除令牌数列；`bun run build` 与 `bun test src/admin/routes.test.ts src/api.test.ts` 通过。
- 2026-03-22: PR #175 已创建，release labels 已补齐，`codex review --base origin/main` 未发现需修复回归。

## Legacy Identity

- Legacy compatibility identity: `#hwrpf`.
