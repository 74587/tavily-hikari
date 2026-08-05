# Admin / API Keys 分组录入与筛选 实现状态

## 实现里程碑

- [x] DB schema 升级：`api_keys.group_name`（含 ensure_api_keys_primary_key 重建表不丢列）
- [x] API：`GET /api/keys` 返回 `group`；batch/single create 支持 `group`
- [x] 前端：批量导入浮层新增分组输入 + 自动完成；修复 onPointerDown 聚焦策略
- [x] 前端：API Keys 分组筛选 chips（对齐 tokens）
- [x] 增补/调整 Rust 测试用例并通过 `cargo test`
- [x] 通过 `web npm run build` 并在 PR Test Plan 记录结果
