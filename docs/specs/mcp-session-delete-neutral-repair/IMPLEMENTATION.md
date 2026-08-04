# MCP Session DELETE 405 中性化与历史配额修复 实现状态

## 状态

- Status: 待实现
- Created: 2026-03-30
- Last: 2026-03-30

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新增 session-delete unsupported canonical kind，并修正未来写入的 non-billable / neutral 语义
- [x] M2: 让 request/token logs 的结果筛选、facets、catalog 与 UI 同步支持 `neutral`
- [x] M3: 交付一次性 repair binary，并重建受影响的 `token_usage_stats` 与月 quota rebase
- [x] M4: 补齐后端/前端/repair 回归测试并完成快车道 merge-ready 收口
