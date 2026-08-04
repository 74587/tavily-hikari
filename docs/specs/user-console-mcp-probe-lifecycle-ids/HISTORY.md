# UserConsole Token Detail MCP 完整握手与高仿真标识 演进历史

## 变更记录（Change log）

- 2026-03-27: 创建 follow-up spec，冻结 token detail MCP probe 的完整握手、动态标识与视觉证据范围。
- 2026-03-27: 完成前端 MCP 完整握手、动态 identifier 合成、Storybook 画廊更新、前端请求级测试与 Rust proxy 合同测试，并通过 `cd web && bun test src/lib/mcpProbe.test.js src/UserConsole.test.ts src/components/ConnectivityChecksPanel.test.tsx src/components/ConnectivityChecksPanel.stories.test.ts`、`cd web && bun run build`、`cd web && bun run build-storybook`、`cargo test mcp_`。

## Legacy Identity

- Legacy compatibility identity: `#yc6pp`.
