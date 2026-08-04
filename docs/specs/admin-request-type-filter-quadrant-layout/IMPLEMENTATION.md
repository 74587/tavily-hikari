# Implementation

## Current Coverage

- `AdminRecentRequestsPanel` 的共享 request type trigger 现已按 viewport 在桌面 dropdown 与小屏 `Drawer` 间切换，不需要调用方新增 props。
- 桌面端 request type 浮层已重排为 2x2 结构：标题行右侧提供低强调 `Clear`，第一行是 `Billing` / `Protocol` quick filters，第二行拆成 `API` / `MCP` 两列。
- 小屏 drawer 保持与桌面同一套筛选状态机和 handler，但 `Billing` / `Protocol` quick filters 明确使用按钮单选，不再降级成 select。
- request kind 仍继续复用既有 helper、count 展示、manual override 回退和 empty-match 处理；缺失 `protocol_group` 的 retained selections 会按 key 前缀回落到 `API` 或 `MCP` 列。
- 共享 Storybook 已补齐稳定证据面：`RequestKindDesktopExpanded` 与 `RequestKindMobileDrawer`，并新增 `SegmentedTabs` 的 mobile buttons proof。
- 桌面端 API 列的栅格拉伸缺口已通过 request-kind columns/group 对齐样式修正，避免两列高度绑定后出现空洞。

## Validation

- `cd web && bun test src/tokenLogRequestKinds.test.ts src/components/AdminRecentRequestsPanel.stories.test.ts src/admin/AdminPages.stories.test.ts`
- `cd web && bun run build`
- `cd web && bun run build-storybook`

## References

- `./SPEC.md`
- `./HISTORY.md`

## 状态

- Status: 已实现（待审查）
- Created: 2026-06-21
- Last: 2026-06-21
