# Admin 仪表盘请求价值分类卡改版 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-31
- Last: 2026-04-02

## 当前验证记录

- 2026-03-31：`cargo check` 通过，后端分类字段、summary windows 查询与 admin snapshot 签名已接上。
- 2026-03-31：`cargo test request_value_bucket_classifies_known_kinds_and_batch_precedence -- --nocapture` 通过。
- 2026-03-31：`cargo test summary_windows -- --nocapture` 通过，覆盖窗口拆分与上游 Key 生命周期窗口。
- 2026-03-31：`cargo test admin_dashboard_sse_snapshot_includes_overview_segments -- --nocapture` 通过，确认 snapshot 暴露新分类字段。
- 2026-03-31：`cd web && bun install --frozen-lockfile` 完成。
- 2026-03-31：`cd web && bun test src/admin/dashboardTodayMetrics.test.ts` 通过。
- 2026-03-31：`cd web && bun run build` 通过。
- 2026-03-31：`cd web && bun test` 通过。
- 2026-03-31：`cd web && bun run build-storybook` 通过。
- 2026-03-31：通过 Storybook 静态页 `admin-components-dashboardoverview--zh-dark-evidence` 复核桌面与窄屏布局，确认 `今日` 为 7 卡、`本月` 为 9 卡，且 comparison tray 已移除。
- 2026-04-01：重新拉起后端 `127.0.0.1:58087` 与前端 `127.0.0.1:55173` 后，用 Chrome 复核真实 `/admin` 页面窄屏布局；`documentElement.scrollWidth == clientWidth == 485`，确认无横向滚动。
- 2026-04-01：按主人要求撤回未授权的摘要卡布局调整后，重新执行 `cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook`，并重拍 Storybook 证据图确认保留原有摘要卡布局。
- 2026-04-01：按主人最新要求补回 `总请求数` 独占首行，并为两组 `成功 / 失败` 添加 `主要 / 次要` 标记；随后重新执行 `cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook`，并完成 Storybook + 真实 `/admin` 浏览器复核。
- 2026-04-01：将 `今日占比` 从副标题移到今日卡片数值行右侧，重新执行 `cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook`，并用 Storybook 中文暗色验收图确认卡片高度收紧且窄屏仍无横向滚动。
- 2026-04-02：补充 `startup_preserves_existing_usage_buckets_when_request_value_columns_are_added` 回归测试，并修正启动迁移逻辑：旧库仅补齐 request-value 分类字段，不再因为 schema 自愈而重建整月 `api_key_usage_buckets`，避免在 `request_logs` 已按保留策略裁剪时丢失既有月度累计数据。
- 2026-04-02：补充 `startup_request_value_backfill_preserves_existing_breakdown_for_pruned_buckets` 回归测试，并收紧 v2 回填条件：仅在桶行尚无 request-value 数据或仍可由保留日志完整重建时才覆盖分类计数，避免重跑迁移时抹掉已保留的历史分类统计。
