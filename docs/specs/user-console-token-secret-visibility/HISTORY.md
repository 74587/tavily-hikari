# 用户控制台 Token 明文切换按钮 演进历史

## 变更记录（Change log）

- 2026-03-12: 创建 follow-up spec，冻结用户控制台 Token Detail 的明文切换范围、验收标准与 Storybook 验收态。
- 2026-03-12: 已完成 TokenSecretField 复用扩展与 UserConsole 接入；隐藏态保留 `th-<id>-********` 字面占位值，显示态按需拉取完整 secret，并在再次隐藏或路由切换时清空前端明文状态。
- 2026-03-12: 已通过 `cd web && bun test src/UserConsole.stories.test.ts`、`cd web && bun run build`、`cd web && bun run build-storybook`；并在 Chrome DevTools 中以页面级 fetch mock 验证 `/console#/tokens/a1b2` 的桌面/移动端显隐切换布局。
- 2026-03-12: 同步 `origin/main` 后补充 Storybook `Token Detail Overview` 与 `Token Revealed` 两张视觉验收截图，作为本 spec 当前收口依据。
- 2026-03-12: 根据 PR-stage review follow-up 修复跨 token 详情切换时的 secret 缓存归属问题；明文、loading 与局部错误提示现在都显式绑定当前 `tokenId`，避免旧 secret 被短暂渲染或复制到新详情页。
- 2026-03-12: PR #120 已创建并补齐 `type:patch` + `channel:stable` 标签；最新 CI checks 全绿，`codex review --base origin/main` 无阻塞发现，本 spec 收口为已完成（快车道）。

## Legacy Identity

- Legacy compatibility identity: `#2m7yv`.
