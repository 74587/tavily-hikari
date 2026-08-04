# request_logs 定时清理与统计口径保持 实现状态

## 状态

- Status: 部分完成（5/5）
- Created: 2026-01-19
- Last: 2026-01-19

## 实现里程碑（Milestones）

- [x] M1: 定义并落地按 API key 的 rollup 桶（按日）与回填/校验策略
- [x] M2: 增加每日定时任务（支持 `HH:mm` 配置）并记录 `scheduled_jobs`
- [x] M3: 实现 `request_logs` retention（默认 7 天、可配置且强制下限）并确保幂等/可恢复
- [x] M4: 切换统计实现，保证对外字段与“全历史累计”语义不变
- [x] M5: 增加测试与运行手册/说明（含失败处理与排障路径）
