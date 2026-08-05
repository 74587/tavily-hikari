# 管理员控制台返回用户控制台入口 演进历史

## 变更记录（Change log）

- 2026-03-09: 创建 spec，冻结“页头全局、始终显示、固定跳转 `/console`、不改后端接口”的实现边界。
- 2026-03-09: 已完成共享 return CTA、admin header/detail 接入、i18n 与 responsive 调整；通过 `cd web && bun test`、`cd web && bun run build`，并在本地浏览器验证 `/admin`、`/admin/tokens/leaderboard`、`/admin/tokens/demo-token`、`/admin/keys/demo-key`、`/admin/users/demo-user` 的入口与 `/console` 跳转。
- 2026-03-09: PR `#108` 已创建；`codex review --base origin/main` 已完成且无高优先级阻塞项，本地 `bun test` / `bun run build` 与浏览器验收通过。
- 2026-03-09: 补充管理界面与用户控制台落地页截图到 spec 资产，作为 PR 视觉验收证据；GitHub 自动 pull_request checks 未为该 docs 提交生成新 run，已补跑 `CI Pipeline` workflow_dispatch（run `#372`）并通过。

## Legacy Identity

- Legacy compatibility identity: `#mx657`.
