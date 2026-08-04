# Request Logs 外键安全迁移与稳定版恢复发布 实现状态

## 状态

- Status: 进行中（快车道）
- Created: 2026-03-23
- Last: 2026-03-23

## 实现里程碑（Milestones / Delivery checklist）

- [ ] M1: 以规格锁定 request-log 外键安全迁移策略与 101 升级收工条件
- [ ] M2: 抽出同连接 table-swap helper，完成外键安全的 `request_logs` 重建
- [ ] M3: 补齐生产形态迁移测试并通过本地质量门
- [ ] M4: 完成 PR、合并、stable release、101 部署与线上验收
