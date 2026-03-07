# 1:1 上游 Credits 计费（MCP + HTTP）（#s2vd2）

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-06
- Last: 2026-03-07

## 背景 / 问题陈述

- 当前下游“业务配额”（hour/day/month）按 requests 口径累计，而 Tavily 上游真实成本按 API credits 计费。
- 两套口径不一致会导致 Search / Research / Extract 等调用出现误扣、漏扣或过早阻断，最终让下游配额与上游账单难以对齐。
- Research 响应目前不直接返回 `usage.credits`，需要通过同一 upstream key 的 `/usage` `research_usage` 差分归因。

## 目标 / 非目标

### Goals

- 将 `/api/tavily/*` 与 `/mcp` 的业务配额切换为 Tavily credits 口径，并按上游真实消耗 1:1 扣减。
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
  - 先按保守预估 credits 做前置阻断；成功回包后仍仅按上游返回的 `usage.credits` 扣费。
  - 若上游未返回 `usage.credits`，只记 warning，不猜测补扣。
- `/api/tavily/research`
  - `model=mini/auto` 最小成本 4；`pro` 最小成本 15。
  - 初始 `/usage` 探针失败时直接阻断，不触发上游 `/research`。
  - 上游 `/research` 已成功返回后，若后续 `/usage` 差分不可得或计数回退，则继续把成功响应返回给客户端，记录 billing warning，并按 reserved minimum cost 兜底扣费（mini/auto=4，pro=15），避免静默漏扣。
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
- Research：初始 `/usage` 探针失败会在打上游前阻断；若上游成功但 follow-up `/usage` 差分不可得或计数回退，则继续返回成功响应、记录 billing warning，并按 reserved minimum cost 兜底扣费。
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
- [x] M5: 新 PR 创建、checks 明确、review-loop 收敛

## 风险 / 假设

- 假设 Tavily `usage.credits` 为整数；若未来返回浮点/字符串浮点，下游统一向上取整，避免漏扣。
- Research `/usage` 差分存在并发归因风险；实现需尽量锁定同一 upstream key 的 usage 探测窗口，减少串扰。
- 对 Extract / Crawl / Map 缺失 usage 时不猜测公式，避免下游与上游账单继续偏离。

## 变更记录

- 2026-03-06: 初始化规格，冻结 1:1 credits billing、mixed enforcement 与 Research `/usage` 差分方案。
- 2026-03-06: 完成本轮实现与本地验证（`cargo fmt --all`、`cargo test`、`cargo clippy -- -D warnings` 通过）。
- 2026-03-06: review fix：MCP `tools/call` 保留非对象 `arguments` 原样转发，仅在对象参数上注入 `include_usage`。
- 2026-03-06: review fix：为 billable 请求落盘 `pending` credits 日志并在下次同 quota subject 进入时补扣，避免成功响应后因本地写库失败而永久漏扣。
- 2026-03-06: review fix：恢复 `user_token_bindings` 多绑定迁移与稳定排序；Research `/usage` 差分改为跨实例串行化；pending billing replay 兼容 `token:* -> account:*` subject 变化；MCP mixed batch 维持错误状态但继续按成功项实际 credits 计费。
- 2026-03-06: review fix：credits cutover 改为仅写入迁移标记、不再清空既有业务 quota 计数，避免升级时给现有主体意外重置额度。
- 2026-03-06: review fix：锁定后的 billing subject 贯穿 precheck 与 pending billing 落账，billing-critical subject lookup 改为跨实例 fresh DB 读取，且 SQLite quota subject lease 在 replay 前即启动续租；pending settle 改为原子 claim，跨月 replay 的旧 log 也不再回灌到当前月 quota，避免并发或 crash recovery 下的误扣/重扣。
- 2026-03-06: review fix：`/mcp` 使用 query 参数鉴权时，日志与 pending billing 落盘统一改写为脱敏后的 query，避免 `tavilyApiKey=<access token>` 被持久化；新增回归测试覆盖。
- 2026-03-06: review fix：pending billing 的 `claim miss` 区分“回包后 settle”与“precheck 前 replay”两条路径：前者返回 `RetryLater` 并留下可观测告警，后者在 `lock_token_billing()` 内做重试并在仍未结算时 fail-closed，避免静默漏扣或绕过 quota；新增故障注入回归测试覆盖。
- 2026-03-06: review fix：Extract / Crawl / Map 与 MCP billable Tavily 工具统一改为 reserved credits 先验阻断；token 发生绑定/解绑后会按历史 pending subject 的稳定顺序逐个加锁回放，既避免跨 subject 并发误扣，也不丢失旧 subject 上的挂账。
- 2026-03-06: review fix：Research 初始 `/usage` 探针继续 fail-closed，但上游成功后的 follow-up `/usage` 不可用时改为返回成功响应并记录 billing warning，避免把已创建的 research 任务翻译成 5xx 重试。
- 2026-03-06: review fix：SQLite quota subject lease 刷新改为更早调度并在过期前重试；若续租耗尽则后续计费改为 deferred pending settle。
- 2026-03-06: review fix：未知 `tavily-*` MCP 工具改为默认 billable safe-default，避免未来上游新增工具时绕过 quota；reserved precheck 的 429 也会回传投影后的 `window`。

- 2026-03-07: fast-flow 复跑后补齐规格同步：Research follow-up `/usage` 失败/回退改为成功回包 + warning + reserved minimum cost 兜底扣费；PR #100 checks 绿灯，可直接合并。
