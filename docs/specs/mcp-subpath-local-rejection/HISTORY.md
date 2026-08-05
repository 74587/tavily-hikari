# MCP 子路径本地拒绝与上游阻断 演进历史

## 变更记录（Change log）

- 2026-03-23: 建立 `/mcp` 与 `/mcp/*` 分流、本地 404、鉴权与非计费日志合同。
- 2026-03-24: `request-kind-canonicalization-lossless-history` 将子路径日志主分类收敛为 `mcp:unsupported-path`，原始 path 改由 detail 保留。

## Legacy Identity

- Legacy compatibility identity: `#hrs2p`.
