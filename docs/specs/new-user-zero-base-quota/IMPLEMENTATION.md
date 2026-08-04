# 新用户基础额度归零，仅靠标签发放额度 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-13
- Last: 2026-03-13

## 实现里程碑（Milestones / Delivery checklist）

- [ ] M1: 账户默认基线 helper 与 token 默认额度 helper 解耦
- [ ] M2: 新用户首次落库与缺失行 fallback 改为零基线
- [ ] M3: 历史 `inherits_defaults=1` 保持旧默认跟随语义
- [ ] M4: Rust 测试与 README / spec 同步完成
