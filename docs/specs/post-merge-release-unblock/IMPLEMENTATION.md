# 修复合并后漏发的 post-merge 发布阻塞 实现状态

## 状态

- Status: 已完成
- Created: 2026-04-10
- Last: 2026-04-10

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 冻结 incident 事实，并建立 spec / README 索引
- [x] M2: 把 standalone auth regression 切到 direct DB seeding，去掉不必要的 runtime token 创建依赖
- [x] M3: 完成本地验证、PR-stage review-loop、修复 PR 合并与 main CI 恢复
- [x] M4: 完成 `445a80f87b42ca1eccb60520a443d09326287f95` 的 stable release backfill，并把最终 run / URL 回填到 spec
