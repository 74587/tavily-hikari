# Release：原生 ARM 镜像发布与双架构 manifest 实现状态

## 状态

- Status: 已完成
- Created: 2026-04-04
- Last: 2026-04-04

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新建 spec，锁定 native ARM runner、manifest 聚合与 release 契约
- [x] M2: 将 release workflow 重构为 `amd64` / `arm64` 原生构建与独立 smoke
- [x] M3: 新增 manifest 聚合与最终 tag 校验，阻断半发布
- [x] M4: 完成本地验证、PR、checks 与 review-loop 收敛到 merge-ready
