# 用户控制台单页合并实现状态（#2nx74）

## Current Status

- Implementation: 已实现
- Lifecycle: active

## Coverage

- `/console` 保持账户概览、可见充值卡与 Token 列表的单页结构。
- 充值可见时，桌面端复用既有 `has-rail` 双栏布局；小屏保持单列，不创建空白右栏。
- `UserConsole` Storybook 默认、关闭和隐藏充值状态覆盖完整卡片、不可用卡片与无右栏状态。

## References

- `./SPEC.md`
- `../linuxdo-credit-recharge/SPEC.md`

## 状态

- Status: 已完成（5/5）
- Created: 2026-03-12
- Last: 2026-07-12

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新建 follow-up spec 并冻结单页合并边界
- [x] M2: `/console` landing 重构为账户概览 + Token 列表单页
- [x] M3: 旧 `#/dashboard` / `#/tokens` hash 收敛为同页自动定位
- [x] M4: Storybook 与自动化测试更新到 merged landing 验收口径
- [x] M5: fast-track 验证、PR 与 review-loop 收敛
