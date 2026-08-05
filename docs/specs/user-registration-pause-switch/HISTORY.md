# 用户管理注册开关与暂停注册页 演进历史

## 变更记录（Change log）

- 2026-03-13: 初版规格建立，冻结 admin 开关、公开首页提示、OAuth callback 拒绝与 `/registration-paused` 页面验收口径。
- 2026-03-13: 已完成后端/前端实现、自动化测试、mock OAuth 浏览器验收与本地 review-loop；进入快车道 PR 收口阶段。
- 2026-03-13: 补充 3 张 Storybook 视觉证据，覆盖 admin 注册开关、首页暂停注册提示条与独立暂停注册页。
- 2026-03-13: 完成 UI 收口、review 修复、checks 收敛与 PR merge-ready 验证，规格状态切换为已完成（快车道）。
- 2026-04-30: 补充公开首页认证检查态合同，要求登录/注册状态展示不被公开统计和 summary 慢接口阻塞。

## Legacy Identity

- Legacy compatibility identity: `#r835w`.
