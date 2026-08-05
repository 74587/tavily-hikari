# Upstream/Base URL 路径前缀兼容增强 实现状态

## 状态

- Status: 已完成（merge-ready）
- Created: 2026-04-04
- Last: 2026-04-04

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 冻结 `TAVILY_UPSTREAM` / `TAVILY_USAGE_BASE` 的 path-prefix 兼容契约与文档口径
- [x] M2: 落共享 URL helper，并替换 MCP / HTTP façade / research result / usage probe 的 path 构造逻辑
- [x] M3: 补齐 prefixed path、trailing slash、encoded request id、无 path 不回归等测试
- [x] M4: 完成 README / docs-site / 设计文档同步、review-loop 收敛与 merge-ready 收口
