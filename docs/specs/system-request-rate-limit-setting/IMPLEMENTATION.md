# 系统设置页增加全局请求频率阈值 实现状态

## 状态

- Status: 待实现
- Created: 2026-04-19
- Last: 2026-04-19

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新增 spec 与 `SystemSettings.requestRateLimit` 契约、README 索引
- [x] M2: 后端持久化 / 热更新 request-rate 阈值并打通 `GET/PUT /api/settings`
- [x] M3: Admin System Settings UI、i18n 与 Storybook 覆盖完成
- [x] M4: Rust / Web / Browser E2E 回归通过
- [ ] M5: 视觉证据、PR、合并与 cleanup 完成
