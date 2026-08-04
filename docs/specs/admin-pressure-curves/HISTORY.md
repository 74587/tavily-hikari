# History

- 2026-06-26: 创建 focused spec，冻结 `/admin/analysis/pressure` 的 24h 平均线、7d 双 SMA 与活跃用户 pressure 分布曲线语义，并将 `3zky1` / `4q9xk` 作为关联引用而非回写主题边界。
- 2026-06-26: 后端新增 `server7d.movingAverages` 契约，使用 23 小时 hidden warmup 生成 `sma6h` / `sma24h` 可见窗口；同时补齐 Rust 模型、测试与 admin pressure handler contract 断言。
- 2026-06-26: 前端 pressure 页面切换为平滑曲线表达，24h 图新增“最近 24 小时平均压力”水平虚线，7d 图新增 `SMA 6h / 24h` 虚线，用户分布图替换为活跃用户 pressure 分布曲线，并同步更新 i18n、Storybook runtime 与视觉证据。
- 2026-06-27: 修正第二张图的语义漂移；实现从 rank 曲线改为精确 pressure 值到用户数的分布曲线，补齐轴标题、聚合 tooltip、Storybook 断言与 spec 合同。
- 2026-06-26: Storybook runtime 与 demo API 改为共用一致性的 pressure mock 生成器，确保活跃用户曲线、当前 1h 服务器压力、昨日差值与 success/failure 总量彼此对齐。

## Legacy Identity

- Legacy compatibility identity: `#qwwgt`.
