# Token usage rollup 幂等修复 实现状态

## 状态

- Status: 已完成
- Created: 2026-03-02
- Last: 2026-03-02

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 引入 v2 游标 `token_usage_rollup_last_log_id_v2` 与 legacy 桥接
- [x] M2: rollup 增量边界改为 `id > last_log_id AND id <= max_log_id`
- [x] M3: 新增索引 `auth_token_logs(counts_business_quota, id)`
- [x] M4: 新增幂等与迁移回归测试并通过
- [x] M5: 本地全量测试通过并完成本地提交（不 push）
