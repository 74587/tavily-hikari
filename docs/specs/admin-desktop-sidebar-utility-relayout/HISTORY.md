# Admin 桌面页头收纳到侧栏 演进历史

## 变更记录（Change log）

- 2026-03-30: 创建 spec，冻结“桌面 utility + compact intro + stacked header 保持”的范围、边界与视觉验收口径。
- 2026-03-30: 完成 `AdminShell` 桌面 utility host、通用 compact intro、模块页 / Token 榜单 / key detail / token detail 的桌面收纳改造。
- 2026-03-30: 同步 shell/page/detail Storybook stories，完成 `bun run build`、`bun run build-storybook`、`bun test`，并补齐 1440px / 1100px 视觉证据。
- 2026-03-30: 根据验收反馈补回 `user-usage` 页的桌面 compact intro 与侧栏 utility，对齐后台统一页头结构，并追加 `UsersUsage` Storybook 证据与 stacked coverage。
- 2026-03-30: 修正通用模块页 desktop intro 的标题来源，改为按当前模块读取 `logs/jobs/users/tokens/keys/proxySettings/...` 文案，避免请求日志等页面误显示为全局“总览”。
- 2026-03-30: 根据 merge-proof review follow-up，为非 `AdminShell` 上下文的 detail 页补上 desktop utility fallback，并新增请求日志 token drawer 的 Storybook 回归断言，确保桌面态 `Back` / `Regenerate secret` 等 CTA 不会丢失。
- 2026-03-30: 创建 PR #200，并在合并前完成 spec/Storybook/browser 门禁收口。
- 2026-07-07: 补充用户详情桌面证据，确认返回动作在侧栏 utility、顶层 tabs 在页头右端，且共享额度信息已改名为“权益”。

## Legacy Identity

- Legacy compatibility identity: `#frpeh`.
