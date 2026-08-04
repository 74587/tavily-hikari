# Rebalance MCP Gateway 演进历史

## Change log

- 2026-04-15：补平 Rebalance MCP 的 `prompts/list`、`resources/list`、`resources/templates/list` 本地空结果协议兼容，并让 control MCP 请求日志稳定落盘 `gateway_mode` / `experiment_variant` / `proxy_session_id` / `upstream_operation`。
- 2026-04-27：按官方 Remote MCP 强一致目标更新 Rebalance transport/session/error/schema 合同；官方对比证据为
  `https://mcp.tavily.com/mcp/` 返回 SSE `event: message`、`serverInfo.name=tavily-mcp`、
  `serverInfo.version=3.2.4`、无 session header 的 `tools/list` 成功、5 个 Tavily 工具字段集合如上，缺参与未知工具均为 HTTP 200 `result.isError=true`。

## Legacy Identity

- Legacy compatibility identity: `#xm3dh`.
