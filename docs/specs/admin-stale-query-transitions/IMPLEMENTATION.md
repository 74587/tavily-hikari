# Admin 查询切换防旧数据误导 实现状态

## 状态

- Status: 已完成（5/5）
- Created: 2026-03-12
- Last: 2026-03-12

## 当前验证记录

- `2026-03-12`：`cd web && bun test` 通过。
- `2026-03-12`：`cd web && bun run build` 通过。
- `2026-03-12`：`cd web && bun run build-storybook` 通过。
- `2026-03-12`：在本地 dev server 上通过浏览器注入 4s `fetch` 延迟，验证 requests / jobs / users / leaderboard / token detail / key detail 的 query-switch 期间均进入局部 blocking loading，并禁用相关控件；tokens 列表与其余列表共享同一 loading primitive 与分页禁用合同。

## 里程碑

- [x] M1: 规格冻结与受影响界面盘点
- [x] M2: 共享 query load state 与 loading region primitive 落地
- [x] M3: admin 列表 / 排行页接入 `switch_loading` / `refreshing`
- [x] M4: token detail / key detail 接入 stale-safe 过渡 + Storybook / tests 更新
- [x] M5: fast-track 远端交付（browser 回归、PR、checks、review-loop）
