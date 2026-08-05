# Tavily Hikari 正向代理等价功能对齐 演进历史

## 变更记录（Change log）

- 2026-03-12: 创建规格，冻结 forward proxy parity、subscription-only、Xray share-link 与上游 key 主备亲和口径。
- 2026-03-15: forward proxy parity 功能与 `/admin/proxy-settings` 收口完成；补齐订阅弹窗 footer 固定、成功/失败/overflow Storybook 复现、视觉证据与 PR-stage review-loop，规格状态切换为已完成（快车道）。
- 2026-03-16: 明确 share-link URL fragment 展示名要做一次性 percent-decoding，避免中文或 emoji 节点名在 validation/live stats 中退化为编码串。

## Legacy Identity

- Legacy compatibility identity: `#sqt3d`.
