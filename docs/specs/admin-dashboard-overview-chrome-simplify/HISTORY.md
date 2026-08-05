# Admin Dashboard 总览去壳与对比度收口 演进历史

## 变更记录（Change log）

- 2026-03-30: 创建 spec，冻结本次 dashboard overview chrome simplification 的范围、验收口径与视觉证据目标。
- 2026-03-30: 完成 `DashboardOverview` 去壳、dashboard-local 渐变收口、delta 胶囊对比度提升，并补齐 `ZhDarkEvidence` Storybook 证据与浏览器断点复核。
- 2026-03-30: 创建 PR #197，并将该项状态收口为 merge-ready。
- 2026-03-30: review-loop follow-up 补回 summary 区在 admin shell 窄屏断点下的共享 gutter，并清理 specs index 的重复 `yc6pp` 行。
- 2026-03-30: 按快车道收口要求将最终 Storybook 证据图落盘到 spec `assets/`，移除该 spec 的 PR-only 证据块表述，并补上 `.codex-artifacts/` 忽略规则。
- 2026-03-30: 与 `main` 完成 base sync 后，移除仓库内已追踪的 `.codex-artifacts/*` 遗留文件，并确认 `DashboardOverview` 渲染输入未变，因此将已审阅的 spec 证据图重新绑定到同步后的最新 head。
- 2026-06-08: 删除 `DashboardOverview` 顶部 hero 横幅，同步清理前端翻译/类型/Storybook 残留字段，并以既有 `ZhDarkEvidence` 证据画布补充“hero 已移除”的断言与浏览器复核说明。

## Legacy Identity

- Legacy compatibility identity: `#ud3ru`.
