# 用户控制台单页合并演进历史（#2nx74）

## Decision Trace

- 2026-03-12: `/console` 收敛为账户概览与 Token 列表的单页，保留旧 hash 的定位兼容。
- 2026-07-07: landing 降低嵌套卡片边界，保留充值区域作为同页可见内容。
- 2026-07-12: 恢复因独立 billing 页引入而移除的概览右侧完整充值卡；billing 页继续负责完整权益和自然月明细。

## References

- `./SPEC.md`
- `./IMPLEMENTATION.md`

## 变更记录（Change log）

- 2026-03-12: 创建 follow-up spec，冻结 `/console` landing 由双页面切换收敛为单页定位的实现边界。
- 2026-03-12: 完成 `/console` merged landing 改造、legacy hash route helper、Storybook story/test 收口，以及 `cd web && bun test`、`cd web && bun run build`、`cd web && bun run build-storybook` 本地验证。
- 2026-03-12: 完成快车道验证、浏览器复核与 review-loop 收敛，spec 收口为完成态。
- 2026-03-15: 补齐 `/console` merged landing 缺失的共享 footer，并让 landing / token detail 统一显示控制台标题、GitHub 与版本信息。
- 2026-07-07: 完成 `/console` landing 去重卡片化优化，overview 指标、充值订单与 Token 表格降为轻边界层级，并补齐桌面暗/亮与移动 token focus 视觉证据。

## Legacy Identity

- Legacy compatibility identity: `#2nx74`.
