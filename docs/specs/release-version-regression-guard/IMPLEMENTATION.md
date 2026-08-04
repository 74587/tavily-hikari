# Release：版本回退防护与 `latest` 稳定修复 实现状态

## 状态

- Status: 已完成
- Created: 2026-02-28
- Last: 2026-02-28

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 修复 semver tag 正则，恢复正确基线检测
- [x] M2: 增加 stable 单调递增 guard（仅新 tag 计算路径生效）
- [x] M3: 完成本地脚本验证与语法检查
- [x] M4: 快车道交付（PR + checks + review-loop + merge + release 验证）
