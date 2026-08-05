# 多 Token 绑定保留已分配 token（不做历史回补） 演进历史

## 变更记录

- 2026-03-06: 初始化规格，冻结“不收回已分配 token + 不做历史回补”的边界。
- 2026-03-06: 完成实现与本地验证（fmt/test/clippy 全通过）。
- 2026-03-06: 共享测试机 `codex-testbox` 完成隔离 E2E 回归（run id: `20260306_012307_8cf4e4a_multi_token_e2e`）。
- 2026-03-06: 快车道 PR #95 已创建并通过 CI/Label Gate；review-loop 收敛，保留“`/api/user/token` 返回最新绑定”既定契约。

## Legacy Identity

- Legacy compatibility identity: `#6xeyh`.
