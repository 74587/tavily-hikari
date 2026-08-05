# Admin：仪表盘实时总览升级 演进历史

## Change log

- 2026-03-14: 初始化 spec，定义 dashboard 实时总览、month lifecycle 指标、代理节点摘要与大数展示收口目标。
- 2026-03-14: 完成 `api_keys.created_at` 迁移与最佳努力回填、month `new_keys/new_quarantines` 聚合、admin SSE `summaryWindows/siteStatus/forwardProxy` 扩容，以及 dashboard 总览布局/大数字展示改造。
- 2026-03-14: 根据 review 收敛修正 `created_at` 历史回填口径、月新增 key 对软删除 key 的统计语义，以及 forward proxy SSE 失败时的空值降级表达。
- 2026-03-14: 根据后续 review 收敛补齐 dashboard SSE 对额度汇总变化的签名检测，改为轻量 forward proxy 节点摘要采样，并新增额度变化触发 snapshot 的回归测试。
- 2026-03-14: 再次收敛 review，移除 `quota_synced_at` 参与历史创建时间回填，阻止初始 HTTP overview 结果覆盖更新的 SSE 快照，同时保留 tokens / recent jobs 的首屏补拉。
- 2026-03-14: 继续收敛 review，恢复 admin SSE 在瞬时 overview 查询失败时的保活重试策略，避免单次查询抖动直接打断 Dashboard 长连接。
- 2026-03-14: 新增 `/api/stats/forward-proxy/summary` 轻量接口，并将 dashboard overview 的初始/兜底代理节点加载切到该摘要接口。
- 2026-03-14: 将历史 `api_keys.created_at` 回填改为仅接受 request logs / quarantines 的不可变证据，同时在 SSE 正常时继续轻量刷新 dashboard 的 tokens / recent jobs 风险区。
- 2026-03-14: 为 dashboard signals 补拉加入独立代次保护与 last-good 保留，并让 admin SSE 在 snapshot 构建失败时发送 degraded 事件，促使前端恢复 fallback polling。
- 2026-03-14: 为 `api_key_quarantines.created_at` 增加前导索引，避免 month lifecycle 统计在 admin SSE 周期查询里退化成全表扫描。
- 2026-03-14: degraded 进入时立即执行 HTTP fallback，并主动重建 SSE 连接，避免恢复后无新数据变化时长期停留在 polling 模式。
- 2026-03-14: 将 `api_keys.created_at` 回填改为 meta-gated 的一次性迁移，并补上“后续重启不能重新改写旧 key 创建时间”的回归测试。
- 2026-03-14: 将 degraded 恢复范围限制在 dashboard 页面，并把 proxy summary 查询失败升级为 snapshot 降级信号，确保共享 `/api/events` 不误伤其它管理页且代理摘要故障能触发 fallback。
- 2026-03-16: 将“本月”总览改为两列布局，并把“剩余可用”卡片从“剩余值 / 总额度”收敛为仅显示剩余值，避免主指标出现不必要的分隔与换行。
- 2026-03-16: 为 token usage rollup 增加瞬时 SQLite 写锁重试，收敛 dashboard 相关改动引出的 CI 并发抖动。
- 2026-03-16: 补齐浏览器 MCP 复核、同步 spec 完成态，并准备随 PR #131 一起并入 `main`。
- 2026-03-30: 同步今日/本月耗尽卡的生命周期口径，新增 `upstream_exhausted_key_count` 窗口字段并保持 `quota_exhausted_count` 兼容，同时补齐最新 Storybook 视觉证据与浏览器验收。

## Legacy Identity

- Legacy compatibility identity: `#97m7a`.
