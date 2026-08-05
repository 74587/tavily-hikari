# Implementation

## Status

- [x] M1: 新 focused spec、README 索引与 visual evidence 约束落盘
- [x] M2: 后端 `server7d.movingAverages` 契约与 warmup 计算完成
- [x] M3: Pressure 页面三张图统一为平滑曲线并完成 i18n / Storybook mock 同步
- [x] M4: 测试、build、Storybook build 与视觉证据完成

## Notes

- 后端在 `src/tavily_proxy/proxy_request_limits.rs` 中为 `server7d` 增加 `sma6h` / `sma24h` 两条 trailing SMA，使用 23 小时 hidden warmup 计算首个可见点。
- `server24h` 的平均压力继续由前端对 288 个 rolling 1h 点直接求算术平均，不新增额外 API 字段。
- `web/src/admin/PressureAnalysisScreen.tsx` 现统一使用 Chart.js `Line` 曲线，并通过 `cubicInterpolationMode='monotone'` 与适中 `tension` 避免折角和过冲。
- “当前 1 小时用户压力分布” 现使用活跃用户 pressure 分布曲线：前端按精确 `pressure` 值聚合 `rows` 中的 active users，`x=pressure`、`y=用户数`，并继续过滤 `pressure > 0`。
- Storybook runtime 与 demo API 现共用 `web/src/api/pressureDemoFixture.ts`；mock 用户汇总会和当前 1h 服务器压力、昨日同期差值以及 success/failure 总量保持一致。
- Storybook runtime 与截图脚本改为固定产出 focused spec 目录下的 desktop/mobile 证据图。

## Validation

- `cargo test`
- `cd web && bun test`
- `cd web && bun run build`
- `cd web && bun run build-storybook`

## Visual Evidence

- `docs/specs/admin-pressure-curves/assets/pressure-desktop.png`
- `docs/specs/admin-pressure-curves/assets/pressure-mobile.png`

## 状态

- Status: 已完成
- Created: 2026-06-26
- Last: 2026-06-27
