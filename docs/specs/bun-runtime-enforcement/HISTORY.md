# Bun Runtime 强制化与 Node 痕迹收口 演进历史

## 变更记录（Change log）

- 2026-03-09: 从 legacy plan `#9b9w5` 迁移为主题规格，将目标从“Bun 包管理迁移”收口为“Bun runtime 强制化 + repo-owned Node naming cleanup”。

- 2026-03-09: 已完成 root / web `bun --bun` 脚本收口、`bunfig.toml` 强制层、`lefthook` Bun runtime、`tsconfig.tooling.json` 重命名、`tavily_http_smoke.ts` 迁移与 README/AGENTS 文案同步。
- 2026-03-09: 已通过 `bun install --frozen-lockfile`、`cd web && bun install --frozen-lockfile`、`cd web && bun run build`、`bun run validate:no-node-runtime`；浏览器确认 `/`、`/admin`、`/console`、`/login` 与 `/api/summary`、`/health`、`/mcp` 开发代理链路可用（`/mcp` 指向本地 mock upstream）。
- 2026-03-09: PR #111 已补齐 `type:skip` + `channel:stable` 标签，CI checks 全绿；clean-room `codex review --base main` 复跑确认无阻塞缺陷，spec 与索引同步收口为已完成。
- 2026-03-09: 按“适当消除、不硬改”继续收口：`commitlint.config.mjs` 改为 ESM、`web/tailwind.config.ts` 改为 TS config、`web/components.json` 同步新路径，`web/scripts/write-version.mjs` 改成 Bun-native 版本写入脚本；`web/postcss.config.cjs`、`vite.config.ts` 与 `@types/node` 暂保留。
- 2026-03-09: `scripts/validate-no-node-runtime.sh` 改为真实执行 hook 命令路径（`dprint fmt` / `commitlint --edit`），避免仅查版本号导致的 no-node 假阳性。
- 2026-03-09: Bun pin 升级到 `1.3.10`；共享测试机上验证到 `1.3.9` 在 Linux 下执行 `bunx --bun dprint fmt` 仍会回落到 `node_modules/.bin/dprint`，升级后 no-node proof 通过。

## Legacy Identity

- Legacy compatibility identity: `#9b9w5`.

## Legacy Plan Provenance

The canonical topic was migrated from legacy plan `#9b9w5`. The legacy source was removed after its durable scope, delivery, and rationale were reconciled with this topic.
