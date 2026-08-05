# Caddy 作为网关的 ForwardAuth + Docker Compose 示例与 CI 验证 实现状态

## 状态

- Status: 已完成
- Created: 2026-01-30
- Last: 2026-01-30

## 实现里程碑（Milestones）

- [x] M1: 新增 `examples/forwardauth-caddy/`（compose + Caddyfile + README）并可本地启动验证
- [x] M2: CI 增加 compose-smoke job，覆盖 health + admin 鉴权边界
- [x] M3: 更新 `README.md` / `README.zh-CN.md` 链接到示例并明确安全约束
