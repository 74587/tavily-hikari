# MCP 隐私收敛与 User/Token/Session 强亲和重构 演进历史

## 变更记录（Change log）

- 2026-03-27: 新建 spec，锁定 user/token/session 强亲和、opaque session 与 `/mcp` strict privacy header 范围。
- 2026-03-27: 完成 user/token 持久 primary affinity、MCP opaque session registry、`/mcp` strict header sanitizer、dev-open-admin 显式 token 约束，以及 disabled/quarantined/exhausted 场景的 session/rebind 回归覆盖。
- 2026-03-27: 创建 PR #189，进入快车道 PR 收敛 / stable patch / 101 rollout 阶段。
- 2026-03-27: PR #189 合并到 `main`，stable release `v0.29.8` 成功发布，GHCR immutable digest 为 `sha256:11bbafd8d51e9d5836c0c9fe984146ed27decf36f42c71b110d2493b5862d5ed`。
- 2026-03-28: 101 完成 `/home/ivan/srv/ai/docker-compose.yml` 与 `/home/ivan/srv/ai/tavily-hikari.md` 的 digest / 部署卡同步，并记录维护说明 `/home/ivan/srv/maintenance/2026-03-28-ops-ai-tavily-hikari-v0.29.8-affinity-privacy-sync.md`；容器、内网与外网版本检查均通过。
- 2026-04-06: 为 MCP 新建 session 的池内排序补上 429 cooldown、最近 60 秒共享压力、同 subject 活跃 session 数与 LRU 组合选路，并新增真实二进制 E2E 覆盖“旧 session 继续 pin，新 session 规避热 key”。

## Legacy Identity

- Legacy compatibility identity: `#34pgu`.
