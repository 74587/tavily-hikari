# 1:1 上游 Credits 计费（MCP + HTTP）（#s2vd2）

## 状态

- Status: 进行中（快车道）
- Created: 2026-03-06
- Last: 2026-03-06

## 背景 / 问题陈述

- 当前下游“业务配额”（hour/day/month）按 requests 口径累计，而 Tavily 上游真实成本按 API credits 计费。
- 两套口径不一致会导致 Search / Research / Extract 等调用出现误扣、漏扣或过早阻断，最终让下游配额与上游账单难以对齐。
- Research 响应目前不直接返回 `usage.credits`，需要通过同一 upstream key 的 `/usage` `research_usage` 差分归因。

## 目标 / 非目标

### Goals

- 将 `/api/tavily/*` 与 `/mcp` 的业务配额切换为 Tavily credits 口径，并按上游真实消耗 1:1 扣减。
- Search / Research 采用“先检查再放行”；Extract / Crawl / Map 采用“先放行、回包前按实际扣费”。
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
  - Research `/usage` 差分计费
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
  - 仅在 `used >= limit` 时阻断。
  - 成功回包后仅在上游返回 `usage.credits` 时扣费。
- `/api/tavily/research`
  - `model=mini/auto` 最小成本 4；`pro` 最小成本 15。
  - 回包前按 `/usage.key.research_usage` 差分扣费；usage 失败则按最小成本扣费并记录错误信息。
- `/mcp`
  - 白名单非业务方法不计 business quota。
  - `tools/call` + `tavily-search|extract|crawl|map` 注入 `include_usage=true`。
  - `tavily-search` 按 expected cost 先验阻断；其余 tavily 工具仅在已耗尽时阻断。

## 验收标准（Acceptance Criteria）

- HTTP Search：`usage.credits=1/2` 能正确扣费；额度不足时先验 429，且阻断请求不命中 upstream。
- HTTP Extract / Crawl / Map：请求体被注入 `include_usage=true`，并按 `usage.credits` 扣费；`credits=0` 不扣费。
- MCP 非工具调用继续保持 0 成本，`counts_business_quota=0`。
- MCP `tavily-search`：支持嵌套 `usage.credits`、SSE/JSON-RPC 包装、expected cost fallback 与先验阻断。
- Research：`/usage` 差分正确计费；最小成本阻断与 usage 失败 fallback 生效。
- 绑定账户的 token 继续只写 account counters，不回退到 token counters。

## 质量门槛（Quality Gates）

- `cargo fmt --all`
- `cargo test`
- `cargo clippy -- -D warnings`

## 里程碑

- [x] M1: HTTP credits 注入与解析 helper 落地
- [x] M2: quota 子系统切换为 credits 增量扣费
- [x] M3: HTTP/MCP/Research mixed enforcement 接入
- [x] M4: 测试补齐并通过本地验证
- [ ] M5: 新 PR 创建、checks 明确、review-loop 收敛

## 风险 / 假设

- 假设 Tavily `usage.credits` 为整数；若未来返回浮点/字符串浮点，下游统一向上取整，避免漏扣。
- Research `/usage` 差分存在并发归因风险；实现需尽量锁定同一 upstream key 的 usage 探测窗口，减少串扰。
- 对 Extract / Crawl / Map 缺失 usage 时不猜测公式，避免下游与上游账单继续偏离。

## 变更记录

- 2026-03-06: 初始化规格，冻结 1:1 credits billing、mixed enforcement 与 Research `/usage` 差分方案。
- 2026-03-06: 完成本轮实现与本地验证（`cargo fmt --all`、`cargo test`、`cargo clippy -- -D warnings` 通过）。
- 2026-03-06: review fix：MCP `tools/call` 保留非对象 `arguments` 原样转发，仅在对象参数上注入 `include_usage`。
- 2026-03-06: review fix：为 billable 请求落盘 `pending` credits 日志并在下次同 quota subject 进入时补扣，避免成功响应后因本地写库失败而永久漏扣。
