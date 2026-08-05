# Admin Dashboard Overview History

## 2026-08-02

- Kept the existing ten-second rebuild budget and sixty-second unchanged probe; dashboard visual
  assets are excluded from this round's PR evidence because the dashboard UI is unchanged.

## 2026-07-31

- Bounded expensive freshness probes and rebuilds to a 10-second minimum interval and added the
  post-ready partial alert index maintenance path.

- Confirmed the current 10-second rebuild and 60-second unchanged freshness contract remains the
  boundary while the new HA and reconciliation status fields are surfaced through existing admin modules.
- Confirmed the final HA/reconciliation diagnostics remain inside the existing snapshot path and do
  not add a dashboard query or shorten either freshness interval.

## 2026-07-17

- Corrected recent-alert grouped window wording so rolling `60m` business-call cap alerts no longer
  inherit a stale `5m window` badge from legacy grouped metadata.

## 2026-06-29

- Corrected the dashboard traffic trend default window from a fixed "today" frame to a rolling 24-hour hourly window.
- Aligned the dashboard overview story copy and tests with the new hourly trend semantics.

## Change log

- 2026-04-06: 初始化 spec，冻结 dashboard overview 轻量聚合接口、SSE payload 复用、`summary_windows` TTL 缓存与前端 dashboard bootstrap 去重的执行合同。
- 2026-04-06: 完成 dashboard overview 聚合接口、SSE snapshot 复用、轻量风险区查询与前端 dashboard route 去重；随后将 SSE 签名轮询进一步收敛为最小触发查询，并补齐 Storybook 静态预览证据。
- 2026-04-17: 将 `summary_windows` 与 dashboard 小时图切到 `dashboard_request_rollup_buckets`，移除 2 秒 freshness 缓存依赖，确保当前小时与本地估算额度可近实时出现在 overview / snapshot。
- 2026-04-30: 将 forward proxy 窗口统计收敛为单次 bounded scan，并补充 admin heavy-read 并发保护，避免线上 SQLite worker 饱和时 dashboard overview 被重读拖慢。
- 2026-05-01: 为 forward proxy 窗口集合查询增加 manager-scoped 短 TTL 缓存，减少同一管理端刷新周期内的重复 7d scan。
- 2026-06-20: 将 dashboard rollup freshness 合同扩展到公共 metrics / public SSE 首条
  `metrics` 读取，并将 alerts 事件/分组/summary 改为 SQL 侧有界读取，避免管理端和公共首页分别
  重新引入宽时间窗扫描。
- 2026-06-21: 将 dashboard overview / SSE 收敛到 freshness-aware shared snapshot，显式把 `recentLogs / jobs / alerts / disabledTokens / exhaustedKeys / quota-sync sample` 纳入失效条件，并为本月 comparison 修复补齐 shared-path 回归测试。
- 2026-06-23: 为 `/api/dashboard/overview` 与 shared snapshot cache-hit/rebuild 补齐默认
  structured perf events，稳定输出 `elapsed_ms`、runtime memory headroom 与 snapshot 结果范围，作为
  低内存回归与线上定位的默认证据面。
- 2026-06-24: 将 dashboard freshness probe 从 flush-on-read `summary_windows` 路径拆出，改为
  no-flush summary/rollup contract + pending coalescer signature，并让 SSE `snapshot` 使用 rebuild
  后的 freshness 作为已发送签名；同时将 dashboard snapshot/SSE 回归测试拆分到独立模块以满足
  Rust 行数预算门禁。
- 2026-06-26: 将 shared snapshot freshness 进一步收敛为 cheap quota charge token + recent-alerts token，新增独立 `DashboardQuotaChargeCache` / `DashboardRecentAlertsCache`，让 cache-hit 不再触发 quota sample baseline/window CTE 与 alerts grouped CTE；同时将 alerts events/groups/dashboard recent alerts 改为 `auth_token_logs` 优先、`request_logs` 按需回退，并补齐 quota/alerts/serialize phase-level perf 事件。
- 2026-06-29: 修正流量趋势图默认小时窗为滚动 24 小时，确保图表前段不再固定落在自然日今日起点。
- 2026-07-17: 修正 recent alerts 分组徽标的窗口文案优先级；当最新事件属于 rolling `60m` business-call cap 时，dashboard 现在会显示真实 `60m window`，而不是沿用旧的 `5m` 分组元数据。
- 2026-07-07: 修正默认流量趋势绝对柱状图窗口为 24 个完整小时加当前未满小时，共 25 个小时槽，并用灰底与竖向虚线标识当前未满小时。
- 2026-08-02: 确认本轮不扩大 dashboard 重建范围；现有 10 秒最短刷新与 60 秒无变化 freshness probe
  保持不变，旧 dashboard 截图不作为本轮 PR 视觉证据。

## Legacy Identity

- Legacy compatibility identity: `#66t8u`.
