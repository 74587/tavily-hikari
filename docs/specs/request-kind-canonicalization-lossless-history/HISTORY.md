# Request Kind 白名单 Canonical 化与无损历史整理 演进历史

## 变更记录

- 2026-03-24: 落地 canonical request kind catalog、legacy 快照列、兼容过滤、独立 backfill binary，并补齐后端/前端回归测试与本地验证。
- 2026-03-24: 补齐 `request_logs` legacy 快照列的启动迁移自愈与 backfill 缺列自检，覆盖共享测试机复制的生产历史库形态。
- 2026-03-28: 兼容窗口收尾改由 follow-up spec `request-kind-legacy-snapshot-removal` 承接；legacy snapshot 列与对外字段已经删除，本主题继续持有 canonical catalog、detail 与 alias 查询兼容合同。

## Legacy Identity

- Legacy compatibility identity: `#msmcp`.
