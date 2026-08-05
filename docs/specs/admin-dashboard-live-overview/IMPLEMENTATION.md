# Admin：仪表盘实时总览升级 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-14
- Last: 2026-03-30

## 当前验证记录

- `2026-03-14`：`cargo test` 通过，覆盖 `api_keys.created_at` 迁移回填、`/api/summary/windows` 月度 lifecycle 字段与 admin SSE snapshot 扩容断言。
- `2026-03-14`：`cargo clippy -- -D warnings` 通过。
- `2026-03-14`：`cd web && bun run build` 通过。
- `2026-03-14`：`cd web && bun run build-storybook` 通过。
- `2026-03-14`：本地 `curl` + Python SSE 验证通过；在 `/api/events` 首个 `snapshot` 后新增 key，确认 `summary.active_keys` 与 `summaryWindows.month.new_keys` 在后续 SSE `snapshot` 中直接递增，无需 overview 补拉。
- `2026-03-14`：review 修复后再次执行 `cargo test` / `cargo clippy -- -D warnings`，新增“仅额度变化也会触发 dashboard SSE snapshot 刷新”的回归测试并通过。
- `2026-03-14`：继续收敛 review：移除 `quota_synced_at` 对历史 `created_at` 回填的污染来源，修正 overview 的 HTTP/SSE 并发写入以避免新快照被旧总览覆盖，同时保留 tokens / recent jobs 的首屏补拉；`cargo test` / `cargo clippy -- -D warnings` 复跑通过。
- `2026-03-14`：继续收敛 review：恢复 admin SSE 在瞬时查询失败时的保活重试策略，避免单次 overview 查询失败直接打断长连接；`cargo test` / `cargo clippy -- -D warnings`、`cd web && bun run build`、`cd web && bun run build-storybook` 复跑通过。
- `2026-03-14`：继续收敛 review：新增 `/api/stats/forward-proxy/summary` 轻量摘要接口，dashboard overview 初始/兜底加载不再请求完整 forward proxy live stats；`cargo test` / `cargo clippy -- -D warnings`、`cd web && bun run build`、`cd web && bun run build-storybook` 复跑通过。
- `2026-03-14`：继续收敛 review：历史 `api_keys.created_at` 回填只接受 request log / quarantine 等不可变证据，且在 SSE 正常时继续轻量补拉 dashboard tokens / recent jobs，避免风险区静止；`cargo test` / `cargo clippy -- -D warnings` 复跑通过。
- `2026-03-14`：继续收敛 review：dashboard signals 补拉加入独立代次保护与 last-good 保留语义；admin SSE 在 snapshot 降级时发送 degraded 事件以重新启用 fallback polling；`cargo test` / `cargo clippy -- -D warnings`、`cd web && bun run build`、`cd web && bun run build-storybook` 复跑通过。
- `2026-03-14`：继续收敛 review：为 `api_key_quarantines.created_at` 增加前导索引，避免 admin SSE 的月度隔离计数触发周期性全表扫描；同时 degraded 进入后立即执行 HTTP fallback 并主动重建 SSE；`cargo test` / `cargo clippy -- -D warnings`、`cd web && bun run build` 复跑通过。
- `2026-03-14`：继续收敛 review：将 `api_keys.created_at` 回填改为 meta-gated 的一次性迁移，避免旧 key 在迁移后首次产生日志/隔离记录时被未来时间重新分类；补充“只回填一次”的回归测试并通过。
- `2026-03-14`：继续收敛 review：将 degraded 恢复逻辑限制在 dashboard 路由，避免共享 admin SSE 通道误把其它管理页拉回 overview fallback；同时把 proxy summary 查询故障提升为 dashboard snapshot 的显式 degraded 信号；`cargo test` / `cargo clippy -- -D warnings`、`cd web && bun run build`、`cd web && bun run build-storybook` 复跑通过。
- `2026-03-14`：`chrome-devtools` 本轮调用超时，浏览器 MCP 复核待在后续 PR 收敛轮次补齐。
- `2026-03-16`：根据验收反馈将“本月”卡片区固定为 2 列，并将“剩余可用”主值改为仅显示剩余额度、把百分比保留在副标题中；`cd web && bun run build`、`cd web && bun run build-storybook` 复跑通过，Storybook 已用更接近真实运营量级的数据复核。
- `2026-03-16`：针对 PR #131 在 GitHub Actions 上暴露的 `database is locked` 抖动，为 token usage rollup 增加瞬时 SQLite 写锁重试；`cargo test tavily_http_usage_returns_daily_and_monthly_counts -- --nocapture`、`cargo test`、`cargo clippy -- -D warnings` 复跑通过。
- `2026-03-16`：使用浏览器 MCP 复核当前 worktree 的 Storybook 与真实 `/admin` 页面，确认“本月”总览为 2 列、`剩余可用` 仅显示单值、桌面/移动端均无横向滚动，且 `/api/events`、`/api/summary/windows`、`/api/stats/forward-proxy/summary` 请求全部返回 `200`。
- `2026-03-30`：继续同步 dashboard 耗尽卡口径：`/api/summary/windows` 与 admin SSE `summaryWindows` 新增 `upstream_exhausted_key_count`，并保留请求级 `quota_exhausted_count`；`cargo test`、`cargo clippy -- -D warnings`、`cd web && bun test src/admin/dashboardTodayMetrics.test.ts`、`cd web && bun run build`、`cd web && bun run build-storybook` 通过，浏览器 MCP 已复核 Storybook 与真实 `/admin` 的桌面/移动端均无横向滚动。

## 实现里程碑

- [x] M1: 新 spec 与索引建立，冻结 lifecycle/代理节点/SSE 契约
- [x] M2: 后端 schema 与月度 lifecycle 聚合落地
- [x] M3: admin SSE snapshot 扩容并补齐签名检测
- [x] M4: dashboard 总览布局与视觉升级落地
- [x] M5: 大数字展示、Storybook/mock 与自动化回归补齐
- [x] M6: 浏览器验收、spec sync、PR/checks/review-loop 收敛
