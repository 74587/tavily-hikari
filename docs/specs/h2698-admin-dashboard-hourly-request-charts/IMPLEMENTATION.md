# Admin 仪表盘请求趋势图表实现状态（#h2698）

## 当前实现

- `DashboardHourlyRequestWindow` 使用服务器本地时区对齐的 5 分钟桶，同时服务滚动 25
  小时柱图与最近 6 小时面积图。
- 请求结果与请求类型继续来自 `dashboard_request_rollup_buckets`；积分扩展复用同表的本地
  估算字段以及 `api_key_quota_sync_samples` 的有界样本差分。
- 前端六个模式由 `DashboardTrendPanel` 与 `dashboardHourlyCharts` 统一维护，偏好保存在管理端
  dashboard 的版本化 localStorage key 中。

## 当前变更

- 用 `积分 / 面积图 · 积分` 替换两张较昨日图。
- 为每个 5 分钟桶增加本地估算与 nullable 上游实扣数据。
- 更新 Storybook 稳定状态、交互测试与视觉证据。

## 验证状态

- Rust：`cargo fmt --check`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。
- Web：`bun test`、`bun run build`、`bun run build-storybook`。
- 视觉：Storybook mock-only 的积分并排柱状图与重叠面积图已完成非空像素检查；PR 图片提交等待 owner 明确授权。
