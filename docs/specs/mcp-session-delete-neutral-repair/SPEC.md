# MCP Session DELETE 405 中性化与历史配额修复（#w6m86）

## 背景 / 问题陈述

- 当前 `DELETE /mcp` 命中上游 `405 Method Not Allowed: Session termination not supported` 时，会被 canonical 到 `mcp:unknown-payload`，并继续沿用错误与计费相关口径。
- 这类请求本质上是 MCP session teardown 不受支持的控制面事件，不应该污染真正的 unknown payload 错误视图，也不应该进入 billable usage / monthly business quota。
- 历史库里已经存在误分类样本；若只修未来写入，不修历史 `auth_token_logs`、`token_usage_stats` 与月 quota 派生，用户感知仍然错误。

## 目标 / 非目标

### Goals

- 新增专用 canonical request kind `mcp:session-delete-unsupported`，只命中精确 session-teardown 405 谓词。
- 让未来写入的日志对该事件统一归为 non-billable，并在用户可见结果中显示 `neutral`。
- 让 Admin / Key / Token / Public recent logs 的结果筛选与 facets 支持 `neutral`，且 `result=error` 不再包含这类事件。
- 交付一次性 repair binary，只修精确命中的历史记录，并重建受影响的 `token_usage_stats` 与月 quota rebase 结果。

### Non-goals

- 不改变外部线协议：`DELETE /mcp` 仍返回原始 `405` 与 `Session termination not supported` body。
- 不修改 Tavily upstream 是否支持 session termination。
- 不在本次快车道内自动对 101 线上数据库执行 repair。

## 范围（Scope）

### In scope

- `docs/specs/README.md`
- `docs/specs/mcp-session-delete-neutral-repair/**`
- `src/{analysis.rs,lib.rs,models.rs}`
- `src/store/mod.rs`
- `src/server/{dto.rs,proxy.rs}`
- `src/bin/*repair*.rs`
- `src/{tests,server/tests}.rs`
- `web/src/{api.ts,AdminDashboard.tsx,components/AdminRecentRequestsPanel.tsx,tokenLogRequestKinds.ts}`

### Out of scope

- 上游 transport 行为变更或本地伪造 `204/200` session delete 成功响应。
- 与该精确谓词无关的 `mcp:unknown-payload` 语义调整。
- 线上执行说明之外的 deploy / merge / cleanup。

## 需求（Requirements）

### MUST

- 精确谓词同时满足以下条件时，未来写入与历史 repair 都必须 canonical 到 `mcp:session-delete-unsupported`：
  - `method = DELETE`
  - `path = /mcp`
  - `status_code = 405`
  - `tavily_status_code = 405`
  - `failure_kind = mcp_method_405`
  - `response_body` 或错误文本包含 `Session termination not supported`
- 该事件必须保持 `failure_kind = mcp_method_405`、`key_effect_code = none`、`business_credits = NULL`。
- `auth_token_logs.counts_business_quota` 对该事件必须为 `false`；请求日志读取与 option catalog 也必须把它归到 `billing_group = non_billable`。
- 用户可见结果必须新增 `neutral` 桶；`result=neutral` 能筛出该事件，`result=error` 不再返回该事件。
- repair binary 必须支持 `--dry-run` 与 `--apply`，并保证幂等。

### SHOULD

- 尽量复用现有 request-kind canonicalization 与 monthly quota rebase helper，避免再造一套 repair 框架。
- repair 输出应包含受影响 rows、token 数和 touched months，便于线上人工核验。

### COULD

- 顺手统一 `mcp_method_405` 的 neutral guidance 文案，让 session delete unsupported 场景更中性。

## 功能与行为规格（Functional/Behavior Spec）

### Core flows

- 未来 `DELETE /mcp` 触发 session delete unsupported 时：
  - 外部 HTTP/Tavily 状态与原始 JSON-RPC body 保持 `405`。
  - `request_logs` / `auth_token_logs` 的 canonical request kind 写成 `mcp:session-delete-unsupported`。
  - Token log / request log 的用户可见 outcome 显示为 `neutral`，不显示为 `错误`。
  - 该事件不进入 billable usage、`token_usage_stats`、hour/day/month business quota。
- 历史 repair dry-run：
  - 只扫描精确谓词命中的行。
  - 输出候选 request log ids、auth token log ids、受影响 token、受影响 month buckets 摘要。
  - 不写库，不更新派生表。
- 历史 repair apply：
  - 更新历史 `request_kind_*` 与 `counts_business_quota` / `business_credits`。
  - 重置后重建受影响 token 的 `token_usage_stats`。
  - 对每个 touched UTC month 重跑 business quota rebase。

### Edge cases / errors

- 普通 root `/mcp` 非法 payload 仍保持 `mcp:unknown-payload`，并继续按真实 outcome 落入 error 视图。
- 只有部分谓词命中时不得误修，例如 `POST /mcp 405`、`DELETE /mcp 400`、或 body 不含 session termination 文案的其它 `405`。
- repair 第二次执行若没有新增候选，必须返回零变更且不得重复放大派生 usage/quota。

## 接口契约（Interfaces & Contracts）

### 接口清单（Inventory）

| 接口（Name）                      | 类型（Kind） | 范围（Scope） | 变更（Change） | 契约文档（Contract Doc） | 负责人（Owner） | 使用方（Consumers） | 备注（Notes）                         |
| --------------------------------- | ------------ | ------------- | -------------- | ------------------------ | --------------- | ------------------- | ------------------------------------- |
| Request log result filter/facets  | http-api     | external      | Modify         | ./contracts/http-apis.md | backend         | web, admins         | 新增 `result=neutral`                 |
| Token log result filter/facets    | http-api     | external      | Modify         | ./contracts/http-apis.md | backend         | web, admins         | 新增 `result=neutral`                 |
| request log tables                | db           | internal      | Modify         | ./contracts/db.md        | backend         | store, repair       | 新 canonical kind + non-billable 语义 |
| session delete neutral repair CLI | cli          | internal      | New            | ./contracts/db.md        | backend         | operators           | 一次性 dry-run/apply                  |

### 契约文档（按 Kind 拆分）

- [contracts/http-apis.md](./contracts/http-apis.md)
- [contracts/db.md](./contracts/db.md)

## 验收标准（Acceptance Criteria）

- Given 一个新的 `DELETE /mcp` session teardown 请求命中 `405 Session termination not supported`
  When 代理写入请求日志与 token 日志
  Then `request_kind_key = mcp:session-delete-unsupported`，`failure_kind = mcp_method_405`，`counts_business_quota = false`，`business_credits = NULL`，`key_effect_code = none`。
- Given 上述新事件
  When Admin / Key / Token / Public recent logs 渲染该行
  Then 用户可见 outcome 为 `neutral`，且详情仍保留原始 `405` 与 response body。
- Given 查询参数 `result=error`
  When 请求日志分页
  Then `mcp:session-delete-unsupported` 不返回；而 `result=neutral` 单独返回该事件。
- Given 一个真正的 root `/mcp` 非法 payload
  When 请求完成
  Then request kind 仍为 `mcp:unknown-payload`，且 error 视图语义不变。
- Given 一个包含历史误分类行的数据库
  When repair binary `--dry-run`
  Then 只输出精确谓词命中的 rows / tokens / touched months 汇总，不写库。
- Given 同一数据库
  When repair binary `--apply` 连续执行两次
  Then 第一次修正历史 kind 与派生 usage/quota，第二次返回零新增变更。

## 实现前置条件（Definition of Ready / Preconditions）

- 上游 `405` 继续视为允许的 transport 行为，本次只做兼容归类。
- `neutral` 作为用户可见结果桶由读取/筛选层派生，而不是扩大底层原始 `result_status` 枚举。
- 历史 repair 的作用域只限于精确 session delete unsupported 谓词。

## 非功能性验收 / 质量门槛（Quality Gates）

### Testing

- Unit tests: request kind canonicalization、billing group、result filter normalization
- Integration tests: runtime log writes、request/token log filter/facet、repair dry-run/apply 幂等
- E2E tests (if applicable): None

### UI / Storybook (if applicable)

- None

### Quality checks

- `cargo fmt --check`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test`
- `cd web && bun run test`

## 文档更新（Docs to Update）

- `docs/specs/README.md`: 新增 `w6m86` 索引并同步状态
- `docs/specs/request-kind-canonicalization-lossless-history/SPEC.md`: 在 follow-up 中补充新 canonical kind 与 targeted repair 继承关系

## 计划资产（Plan assets）

- Directory: `docs/specs/mcp-session-delete-neutral-repair/assets/`
- Visual evidence source: maintain `## Visual Evidence` in this spec when needed.

## Visual Evidence

本次为日志语义、repair 与筛选收敛，不要求视觉证据。

## 资产晋升（Asset promotion）

None

## 方案概述（Approach, high-level）

- 把 session delete unsupported 做成稳定 canonical request kind，而不是继续塞进 `mcp:unknown-payload` 的 detail 里。
- 用户可见结果继续由读取层派生，但 `neutral` 要升级成一等 filter/facet 值，保证列表、badge 和详情 guidance 口径一致。
- 历史 repair 采用精确谓词 + 派生表定向重建，避免全库重算或误伤其它 `405` / unknown payload 行。

## 风险 / 开放问题 / 假设（Risks, Open Questions, Assumptions）

- 风险：若 token/request log 的 canonicalization 入口不统一，未来写入与历史 backfill 可能再次分叉。
- 风险：result filter 若仍部分走原始 `result_status`，会出现 facet、badge 与筛选不一致。
- 假设：受影响 month rebase 以 UTC 月窗口为准，并可接受按 touched months 定向重跑。

## 参考（References）

- `docs/specs/request-kind-canonicalization-lossless-history/SPEC.md`
- `docs/specs/token-usage-rollup-idempotency/SPEC.md`
- `docs/specs/monthly-quota-rebase-audit/SPEC.md`
