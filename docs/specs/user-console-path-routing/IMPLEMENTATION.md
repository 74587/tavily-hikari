# 用户控制台 Path 路由迁移 实现状态

## 状态

- Status: 已完成（快车道）
- Created: 2026-04-12
- Last: 2026-04-13

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新建 follow-up spec 并冻结 `/console` path 路由与首页 hash 兼容边界
- [x] M2: `UserConsole` 改为 path-only 路由解析与 history 同步
- [x] M3: Vite / Rust 静态托管支持 `/console/*` 深链
- [x] M4: Storybook、单测与首页 hash 回归覆盖更新
- [ ] M5: 视觉证据、验证、PR 与 spec-sync 收口到 PR-ready
