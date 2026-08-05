# Web 前端运行时图标内置 演进历史

## 变更记录（Change log）

- 2026-03-15: 创建 spec，冻结运行时图标内置目标与按需注册策略。
- 2026-03-15: 完成共享图标注册层、导入路径收口与 PublicHome/UserConsole 外链图标替换。
- 2026-03-15: 通过 `cd web && bun test`、`cd web && bun run build` 与浏览器网络面板复核，确认构建产物和运行时页面均无 Iconify 外链请求。
- 2026-03-15: PR #135 全部 checks 通过，补齐 `mdi:tray-arrow-down` 离线清单与覆盖测试后，review-loop 收敛完成。
- 2026-04-08: follow-up 修复 `mdi:cog-outline` 漏登记，并补齐 `mdi:alert-circle`、`mdi:check-circle`、`mdi:circle-outline`、`mdi:lock-outline`、`mdi:map-marker-radius-outline`、`mdi:minus-circle-outline` 的本地 bundle。
- 2026-04-08: 将 Forward Proxy 相关模块残留的 `@iconify/react` 入口切回共享离线 `Icon`，重新确认 `cd web && bun run build` 与 `cd web && bun run build-storybook` 产物均不包含 `api.iconify.design`。
- 2026-04-08: 为 `Admin/Pages` 的 `System Settings` Storybook 页面补充侧栏图标显式断言，并新增本地视觉证据资产 `system-settings-nav-icon.png`。
- 2026-06-25: 边界澄清：本 spec 只冻结运行时图标的离线 bundle 与 `/favicon.svg` 的静态路径，不再把 favicon 的品牌视觉内容视为不可变资产。

## Legacy Identity

- Legacy compatibility identity: `#kjdm5`.
