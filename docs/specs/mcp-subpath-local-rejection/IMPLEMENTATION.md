# MCP 子路径本地拒绝与上游阻断 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-23
- Last: 2026-03-23

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 冻结 `/mcp` 根路径与 `/mcp/*` 子路径的运行时契约和日志契约
- [x] M2: 路由拆分完成，子路径改为本地拒绝且不触发上游
- [x] M3: request log / token log 能记录无 key 的本地 `mcp_path_404` 拒绝
- [x] M4: 测试、review-loop、PR、merge 与 cleanup 收口完成
