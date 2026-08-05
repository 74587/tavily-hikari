# Key 影响可见化与维护记录审计 实现状态

## 状态

- Status: 已实现（待审查）
- Created: 2026-03-17
- Last: 2026-03-17

## 实现里程碑（Milestones / Delivery checklist）

- [ ] M1: 新 spec、contracts 与 README 索引落地，冻结错误分类 / Key 影响 / 维护审计边界
- [ ] M2: `request_logs` / `auth_token_logs` 新增 `failure_kind` 与 `key_effect_*` 字段并补 migration / 查询映射
- [ ] M3: `api_key_maintenance_records` 落地，系统自动 + 现有人工健康维护动作写入审计
- [ ] M4: 管理员两处日志入口显示 `Key 影响`，用户/public 日志仅增强现有错误文案
- [ ] M5: 测试、构建、review-loop 与 merge-ready 收敛完成
