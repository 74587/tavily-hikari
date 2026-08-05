# Admin Token Request Type 列与多选精确筛选 演进历史

## 变更记录（Change log）

- 2026-03-12: 初始化 spec，冻结 `Request Type` 列、多选精确筛选、legacy raw fallback 与 mixed MCP batch 展示规则。
- 2026-03-12: 实现后端 request kind 持久化与多选过滤、TokenDetail 多选下拉筛选、Storybook mock 与本地回归验证。
- 2026-03-12: 根据 review-loop 修复 `/mcp/*path` raw fallback 折叠与旧错误落库值回补，legacy request kind backfill 收敛为单次集合式更新，并补齐多选筛选在时间窗切换 / 非第一页 SSE 下的 request type 可见性。
- 2026-03-12: RequestKindBadge 组件、Storybook 主题切换、Dense Request Records 故事与合并前视觉证据已同步，进入 PR #119 合并收尾。

## Legacy Identity

- Legacy compatibility identity: `#2p965`.
