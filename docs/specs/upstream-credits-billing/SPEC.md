# 1:1 上游 Credits 计费（MCP + HTTP）（#s2vd2）

## 背景 / 问题陈述

- 当前下游“业务配额”（hour/day/month）按 requests 口径累计，而 Tavily 上游真实成本按 API credits 计费。
- 两套口径不一致会导致 Search / Research / Extract 等调用出现误扣、漏扣或过早阻断，最终让下游配额与上游账单难以对齐。
- Research 响应目前不直接返回 `usage.credits`；共享 upstream key 下 `/usage.research_usage` 差分不可安全归因到单个用户，因此本地用户计费改为按请求模型固定估算。

## 目标 / 非目标

### Goals

- 将 `/api/tavily/*` 与 `/mcp` 的业务配额切换为 Tavily credits 口径；Search / Extract / Crawl / Map 按上游可观测 `usage.credits` 扣减，Research 按本地模型估算价扣减。
- Search / Research 采用“先检查再放行”；Extract / Crawl / Map 采用“按保守预估 credits 先检查再放行，回包前仍以上游实际 `usage.credits` 扣费”。
- 保持 `counts_business_quota` 语义不变，只调整 business quota 的计数单位。
- 所有验证必须走本地 mock upstream，避免触达 Tavily 生产端点。

### Non-goals

- 不修改 Tavily 官方定价模型；除本地 fallback 外，最终仍以上游返回 usage 为准。
- 不改动非 Tavily 业务的 MCP 白名单语义（如 `tools/list`、`resources/*`、`prompts/*`、`notifications/*`）。

## 范围（Scope）

### In scope

- `src/lib.rs`
  - `/search` `/extract` `/crawl` `/map` 自动注入 `include_usage=true`
  - 解析 `usage.credits`
  - quota 子系统支持按 credits 增量扣费
  - Research 按模型估算价计费
- `src/server/handlers/tavily.rs`
  - HTTP Tavily endpoints 的 mixed enforcement 与回包前扣费
- `src/server/proxy.rs`
  - MCP `tools/call` 的 `include_usage` 注入、Search 先验阻断与回包前扣费
- `src/server/tests.rs` 与 `src/lib.rs` 单测
  - HTTP/MCP/Research credits billing 全链路回归

### Out of scope

- 非 Tavily 业务 MCP 方法计费。
- 基于历史日志回补既有 quota 计数。

## 接口契约（Interfaces & Contracts）

- `/api/tavily/search`
  - `search_depth=advanced` 视为 expected cost 2；其它低成本档按 1 处理。
  - 若 `used + expected > limit`，直接 429 且不上游。
- `/api/tavily/extract|crawl|map`
  - 先按保守预估 credits 做前置阻断；成功回包后仍仅按上游返回的 `usage.credits` 扣费。
  - 若上游未返回 `usage.credits`，只记 warning，不猜测补扣。
- `/api/tavily/research`
  - 成功发起 Research 后按请求模型固定估算扣费：`mini=40`、`auto=50`、`pro=100`。
  - 缺省 `model` 按 Tavily `auto` 处理，扣 `50`。
  - 前置 quota 检查使用同一估算价；若 `used + estimated > limit`，直接 429 且不上游；若刚好等于 `limit`，请求必须放行并扣减到窗口上限。
  - 不再用共享 upstream key 的 `/usage.research_usage` 差分反填本地用户账单；上游实扣只作为池级运营对账指标。
- `/mcp`
  - 白名单非业务方法不计 business quota。
  - `tools/call` + `tavily-search|extract|crawl|map` 注入 `include_usage=true`。
  - `tavily-search|extract|crawl|map` 均按 reserved credits 先验阻断；回包前再按可观测到的实际 credits 扣费。
  - 未知的 `tavily-*` 工具默认按 billable safe-default 处理（reserved credits 至少按 1 预留），避免新上游工具绕过 quota。

## 验收标准（Acceptance Criteria）

- HTTP Search：`usage.credits=1/2` 能正确扣费；额度不足时先验 429，且阻断请求不命中 upstream。
- HTTP Extract / Crawl / Map：请求体被注入 `include_usage=true`；reserved credits 超额时会先验 429，成功回包后按 `usage.credits` 扣费，`credits=0` 不扣费。
- MCP 非工具调用继续保持 0 成本，`counts_business_quota=0`。
- MCP `tavily-search`：支持嵌套 `usage.credits`、SSE/JSON-RPC 包装、expected cost fallback 与先验阻断。
- Research：HTTP 与 MCP 成功发起时按模型估算价扣费（`mini=40`、缺省或 `auto=50`、`pro=100`）；前置 quota 检查使用同一估算值，剩余额度刚好等于估算值时放行，低于估算值时 429；上游失败、quota 拦截、validation error 与 invalid model error 不扣 business credits。
- 绑定账户的 token 继续只写 account counters，不回退到 token counters。

## 质量门槛（Quality Gates）

- `cargo fmt --all`
- `cargo test`
- `cargo clippy -- -D warnings`

## 风险 / 假设

- 假设 Tavily `usage.credits` 为整数；若未来返回浮点/字符串浮点，下游统一向上取整，避免漏扣。
- Research 使用共享 upstream key 时不能把 `/usage.research_usage` 差分安全归因到单个用户；本地账单使用模型估算价，上游实际消耗保留为池级对账指标。
- 对 Extract / Crawl / Map 缺失 usage 时不猜测公式，避免下游与上游账单继续偏离。
