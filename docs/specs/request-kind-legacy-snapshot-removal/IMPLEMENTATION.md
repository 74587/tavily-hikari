# Request Kind Legacy Snapshot 字段移除 实现状态

## 状态

- Status: 已实现（待审查）
- Created: 2026-03-28
- Last: 2026-03-28

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新增 spec 与接口契约，明确 legacy snapshot 删除范围
- [x] M2: 删除模型 / DTO / API 类型中的 `legacyRequestKind*`
- [x] M3: 完成 SQLite legacy 列删列迁移，并移除 legacy snapshot 写入
- [ ] M4: 补齐 migration/backfill/接口回归测试并完成快车道 PR 收口
