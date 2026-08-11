# Admin Dashboard Overview Implementation

## Status

- Status: Rolling 24-hour trend window implemented
- Last: 2026-07-17

## Coverage

- Dashboard overview now uses a rolling 24-hour hourly window for the default traffic trend chart.
- The window ends at the current visible hour bucket and leaves missing buckets blank.
- Storybook copy and hourly chart tests were updated to match the chart behavior.
- Recent alerts now derive grouped rate-limit window badges from the latest alert event's semantic
  window before falling back to legacy group metadata, so the dashboard no longer renders a stale
  `5m window` label for rolling `60m` business-call cap alerts.
- Dashboard freshness probes and rebuilds are throttled to a 10-second minimum interval while the
  2-second SSE loop reuses the in-memory generation and shared singleflight last-good snapshot.
- Warm HTTP and SSE reads never wait for freshness SQL or payload reconstruction. The first reader
  after expiry claims one background refresh and immediately serves the immutable last-good
  snapshot; concurrent readers reuse it, and only a cold start without last-good waits for a build.
- SSE signature polling consumes the same shared snapshot loader and no longer runs an independent
  freshness probe, preventing subscriber count from multiplying SQLite reads.
- Alert candidate indexing is installed by an idempotent post-ready maintenance job rather than the
  startup schema path.
- The existing dashboard contract remains a bounded 10-second rebuild budget with a 60-second
  unchanged freshness probe. This round changes HA/reconciliation status surfaces only and does not
  reuse older dashboard screenshots as PR evidence.

- The dashboard's 2-second SSE generation check and shared last-good snapshot remain the only warm
  read path; HA/reconciliation diagnostics do not add freshness SQL or rebuild triggers.
- The final reconciliation/HA review kept the dashboard read contract unchanged: new diagnostic
  state is served through the existing snapshot payload and does not add a freshness probe or rebuild.

## Notes

- The dashboard overview payload shape and SSE snapshot contract are unchanged.
- The recent-alert wording fix keeps the payload shape unchanged and only corrects grouped alert
  metadata precedence plus the corresponding presentation copy.

## 状态

- Status: 已实现（待审查）
- Created: 2026-04-06
- Last: 2026-08-02

## 当前验证记录

- `2026-04-06`：`cargo test --quiet dashboard_overview_` 通过。
- `2026-04-06`：`cargo test --quiet admin_dashboard_sse_snapshot_includes_overview_segments` 通过。
- `2026-04-06`：`cargo test --quiet compute_signatures_tracks_quarantined_key_count` 通过。
- `2026-04-06`：`cargo test admin_dashboard_sse_snapshot_refreshes_when_quota_totals_change -- --nocapture` 通过；期间将 SSE 签名查询进一步瘦身为最小触发集，避免仅为签名轮询拉取完整 logs/token quota。
- `2026-04-06`：`cargo test` 全量通过。
- `2026-04-06`：`cargo clippy -- -D warnings` 通过。
- `2026-04-06`：`cargo fmt` 通过。
- `2026-04-06`：`cd web && bun test src/api.test.ts` 通过。
- `2026-04-06`：`cd web && bun run build` 通过。
- `2026-04-06`：`cd web && bun run build-storybook` 通过。
- `2026-04-06`：使用当前 worktree 的 Storybook 静态预览端口 `127.0.0.1:30020` 打开 `Admin/Components/DashboardOverview/ZhDarkEvidence` iframe，确认 dashboard 总览结构、风险观察与快捷入口在轻量 overview 收敛后保持稳定。
- `2026-04-30`：`cargo test admin_forward_proxy_settings_and_stats_endpoints_work -- --nocapture` 通过，覆盖 forward proxy stats 单次窗口集合查询后的响应结构。
- `2026-05-01`：`cargo test admin_forward_proxy_settings_and_stats_endpoints_work -- --nocapture` 通过，覆盖 forward proxy stats 短 TTL 缓存后的响应结构不变。
- `2026-06-20`：在 101 生产快照的共享测试机回放上，`/api/public/metrics` 与 `/api/public/events`
  首条 `metrics` 事件复用了同一套 rollup freshness 判定，`/api/public/metrics` 首包约
  `1.44s`，SSE 首条 `metrics` 事件立即可见；同时 `/api/alerts/events` 在 SQL 侧分页/聚合改造后
  约 `0.14s` 返回。
- `2026-06-21`：`cargo test` 全量通过，覆盖 `dashboard_overview_snapshot_is_reused_within_the_same_freshness_wave`、`dashboard_overview_returns_lightweight_segments` 与 `admin_dashboard_sse_snapshot_includes_overview_segments`；确认 HTTP overview 与 SSE snapshot 在同一 freshness wave 内复用 shared snapshot。
- `2026-06-21`：`cargo clippy -- -D warnings` 通过。
- `2026-06-21`：101 只读复核确认当前线上唯一数据源链路为 `/home/ivan/srv/ai/docker-compose.yml` -> 容器 `tavily-hikari` -> volume `ai-tavily-hikari-data` -> `/srv/app/data/tavily_proxy.db` + `/srv/app/data/tavily_proxy-observability.db`。容器内受控 `overview` 请求在 `2026-06-21 13:47 +08:00` 约 `4.70s` 返回，且近期 slow log 仍可见 `observability.request_logs` 相关慢语句，说明这次优化仍需经部署后才能在 101 消除热路径宽扫。
- `2026-06-24`：`cargo test dashboard_overview_snapshot -- --nocapture`、`cargo test log_catalog_and_dashboard_sse -- --nocapture`、`cargo test` 全量、`cargo clippy -- -D warnings`、`cd web && bun run build` 通过；确认 SSE freshness probe 已切到 no-flush summary/rollup 合同 + pending rollup signature，且 `snapshot` 事件会回写 rebuild 后的 freshness，避免 2 秒轮询紧接着重复重建 shared snapshot。
- `2026-06-26`：`cargo test dashboard_overview_snapshot -- --nocapture`、`cargo test alerts_and_ha -- --nocapture`、`cargo test log_catalog_and_dashboard_sse -- --nocapture`、`cargo clippy -- -D warnings`、`cd web && bun run build` 通过；确认 shared snapshot freshness 已改为 cheap quota token + recent-alert token 合同，baseline-only quota backfill 不再触发 shared snapshot rebuild，同时 alerts events/groups 与 dashboard recent alerts 改为 `auth_token_logs` 优先的轻量读路径。

## 实现里程碑

- [x] M1: 新增 dashboard 专用 overview 接口并抽出共享 payload 组装逻辑
- [x] M2: 新增 dashboard 专用 rollup 表，并将 `summary_windows` / 小时图切到 rollup 读路径
- [x] M3: dashboard 风险区改走轻量子集查询与 SSE snapshot 复用
- [x] M4: 前端 dashboard 首屏加载去重，移除旧的 signals polling
- [x] M5: Storybook/mock 视觉证据补齐
- [x] M6: shared snapshot 重型 quota/alerts 依赖拆分、phase-level perf 事件补齐与 alerts hot path 收敛
- [ ] M7: PR 收口与 merge-ready 状态同步
