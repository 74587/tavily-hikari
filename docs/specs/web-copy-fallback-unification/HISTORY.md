# Web 全站复制兼容统一收口 演进历史

## 变更记录（Change log）

- 2026-03-12: 初始化规格，冻结复制兼容统一 helper、手动复制气泡与一次性 secret 恢复口径。
- 2026-03-12: 落地 `copyText()` / `selectAllReadonlyText()` / `ManualCopyBubble`，统一接入 PublicHome、UserConsole、AdminDashboard、TokenDetail，并补齐 Bun 测试、build 与浏览器冒烟。
- 2026-03-12: 修复 `ManualCopyBubble` 首次打开时因定位前短路渲染而不显示的问题，改为先挂载再定位，未完成定位前仅隐藏且禁用指针事件。
- 2026-03-12: 为 `execCommand` fallback 补充 iOS / iPadOS 选区兼容分支，并在 PublicHome 复制失败时自动 reveal 当前 token，确保“原文可见入口”仍可手动复制。
- 2026-03-12: 补齐复制 review 收口：同步优先的 legacy fallback 选项、UserConsole/Admin secret cache 预热、复制成功时自动关闭旧气泡，以及 PublicHome / rotated token 失败后的自动重新选中。
- 2026-03-12: 收紧 secret 生命周期：移除 UserConsole/Admin 列表初载时的全量 secret 预取，仅保留 hover/focus 按需 warm-up；同时在 admin rotate token 后回写父级 secret cache，避免后续复制/分享读到旧 token。
- 2026-03-12: 修正 UserConsole detail 失败恢复策略：由于复制按钮旁已有 Token 字段，失败时改为直接 reveal + select 现有字段，不再额外弹手动复制气泡。
- 2026-03-12: 补入 Storybook 桌面端 Visual Evidence，并将规格状态切换为已完成，等待 PR 合并与分支回收。

## Legacy Identity

- Legacy compatibility identity: `#swe8k`.
