# Admin 用户配额滑块稳定化与指数档位收敛 实现状态

## 状态

- Status: 已完成
- Created: 2026-03-06
- Last: 2026-03-07
- Superseded note: 用户详情已移除专门基础额度滑块编辑器；基础额度调整改为账号权益账本
  `scopeKind="base"` 记录。

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新增共享 quota slider helper，并固定 4 个字段默认基线
- [x] M2: Admin 用户详情页改为“稳定上限 + 档位 index”驱动
- [x] M3: 输入框保留任意正整数精调，超范围值不自动扩容
- [x] M4: Storybook 共用 helper，并补充非整档初值回归场景
- [x] M5: build + 浏览器验收完成
