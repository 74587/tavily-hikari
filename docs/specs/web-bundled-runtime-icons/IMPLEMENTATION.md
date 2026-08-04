# Web 前端运行时图标内置 实现状态

## 状态

- Status: 已实现（待审查）
- Created: 2026-03-15
- Last: 2026-06-25

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新建 spec 并冻结“运行时图标内置、favicon 路径不变、后端无改动”的边界
- [x] M2: 新增共享离线图标注册层并收口现有 Iconify React 导入
- [x] M3: PublicHome/UserConsole 改为本地图标映射并移除远程 Iconify URL
- [x] M4: 补齐自动化验证并确认构建产物无 `api.iconify.design`
- [x] M5: 完成浏览器验收、PR、checks 与 review-loop 收敛
