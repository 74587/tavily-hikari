# Caddy 作为网关的 ForwardAuth + Docker Compose 示例与 CI 验证 演进历史

## 变更记录（Change log）

- 2026-01-30: 创建计划（待设计）
- 2026-01-30: 冻结口径：`/health` 公开；鉴权不区分 admin/user；CI smoke 只测鉴权边界与 health
- 2026-01-30: 实现完成：示例目录 + CI compose smoke + README 入口
- 2026-01-31: 修复 CI smoke：改用 `/api/debug/is-admin` 断言，并在 CI 中构建 PR checkout 的 Docker image

## Legacy Identity

- Legacy compatibility identity: `#wsx8t`.
