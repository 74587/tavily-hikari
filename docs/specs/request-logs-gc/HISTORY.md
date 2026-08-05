# request_logs 定时清理与统计口径保持 演进历史

## 变更记录（Change log）

- 2026-01-19: 创建计划。
- 2026-01-19: 完成实现：新增 `api_key_usage_buckets` 作为统计 rollup 桶；写入 `request_logs` 时同事务更新桶；新增 `request_logs_gc` 每日任务（`REQUEST_LOGS_GC_AT`，默认 07:00）按本地自然日边界清理 `request_logs`；统计接口改从桶聚合以保持全历史累计语义。

## Legacy Identity

- Legacy compatibility identity: `#0001`.
