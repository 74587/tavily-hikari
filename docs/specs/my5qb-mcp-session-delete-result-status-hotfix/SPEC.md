# MCP Session DELETE `resultStatus` 热修（#my5qb）

## 状态

- Status: 已完成
- Created: 2026-04-03
- Last: 2026-04-03

## 背景 / 问题陈述

- `tavily-hikari v0.32.1` 已经把 `DELETE /mcp` 的 session teardown `405` 样本 canonical 到 `mcp:session-delete-unsupported`，并在筛选/计费语义上视为 `neutral`、`non_billable`。
- 线上实际 API 仍把 item 级别的 `resultStatus` 原样返回为 `error`，导致 `vibe-code.ivanli.cc` 等 UI 继续显示红色“错误”。
- 这个偏差已经在 101 复现：`/api/logs`、`/api/tokens/:id/logs/page`、`/api/keys/:id/logs/page` 对同类记录都会同时出现 `operationalClass=neutral` 与 `resultStatus=error` 的割裂状态。

## 目标 / 非目标

### Goals

- 对 `request_kind_key = mcp:session-delete-unsupported` 的所有用户可见日志 payload，统一把 `resultStatus` 映射为 `neutral`。
- 保持存储层原始 `result_status`、request kind、billing group、quota 与 `operationalClass` 语义不变。
- 补齐回归测试，覆盖 admin logs、key logs page、token logs page / snapshot，以及 public token log serializer。
- 记录 101 compose / 部署卡与实际运行镜像 digest 漂移，作为后续发布收口的 follow-up 证据。

### Non-goals

- 不做 schema 变更，不做历史 repair，不重建 usage/quota 派生表。
- 不修改 101 线上文件，不执行 release、deploy 或容器切换。
- 不改 `DELETE /mcp -> 405` 线协议、原始上游 body 或 `failure_kind`。

## 范围（Scope）

### In scope

- `docs/specs/README.md`
- `docs/specs/my5qb-mcp-session-delete-result-status-hotfix/**`
- `src/analysis.rs`
- `src/server/{dto.rs,proxy.rs,handlers/public.rs}`
- `src/{tests,server/tests}.rs`

### Out of scope

- `request_logs` / `auth_token_logs` 落盘逻辑
- `token_usage_stats`、月 quota rebase、repair binary
- 101 compose / deployment card 内容改写

## 需求（Requirements）

### MUST

- `mcp:session-delete-unsupported` 的 display `resultStatus` 必须为 `neutral`。
- 其它 request kind 不得被误改，尤其是 `mcp:unknown-payload`、`mcp:unknown-method`、普通 upstream error 与 `quota_exhausted`。
- `/api/logs`、`/api/keys/:id/logs/page`、`/api/tokens/:id/logs/page`、token snapshot / public token logs 的 item 返回值必须一致。
- 现有 `result=neutral` / `result=error` filter 与 facets 行为保持不变，只修 item 序列化输出。

### SHOULD

- 复用现有 analysis display helper，避免在每个 serializer 重复写 session-delete 特判。
- 测试同时覆盖 unfiltered、`result=neutral` 和 snapshot 场景，防止回归成“筛选是 neutral，item 还是 error”。

## 功能与行为规格（Functional/Behavior Spec）

### Core flows

- 请求日志与 token 日志从数据库读取到原始 `result_status = error` 的 session-delete unsupported 记录时：
  - 对外 `resultStatus` 显示为 `neutral`。
  - `operationalClass` 继续为 `neutral`。
  - `requestKindBillingGroup` 继续为 `non_billable`。
- 普通错误记录继续原样显示 `error` 或 `quota_exhausted`，不复用本热修逻辑。

### Edge cases / errors

- `request_kind_key` 不匹配时，不允许因为 `failure_kind = mcp_method_405` 就误改 display status。
- 只要 API item 仍返回 `resultStatus=error`，前端就会继续显示红 badge；因此本次必须以 serializer 为唯一修复点，而不是改前端映射。

## 验收标准（Acceptance Criteria）

- Given 一条 `request_kind_key = mcp:session-delete-unsupported` 且原始 `result_status = error` 的记录
  When 通过 admin logs、key logs page、token logs page、token snapshot 或 public token log 输出
  Then 对外 `resultStatus = neutral`。
- Given 同一条记录
  When 用 `result=neutral` 过滤
  Then 返回 item 中的 `resultStatus` 也必须是 `neutral`。
- Given 真正的 `mcp:unknown-payload` 或普通 upstream failure
  When 序列化输出
  Then `resultStatus` 保持原语义，不被中性化。

## 非功能性验收 / 质量门槛（Quality Gates）

### Testing

- Unit tests: `display_result_status_for_request_kind` 的 session-delete 与非 session-delete 分支
- Integration tests: admin logs、key logs page、token logs page、token snapshot
- Serializer tests: admin/public token log view

### Quality checks

- `cargo fmt --all`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --locked --all-features`

## 线上证据（101）

- 2026-04-03：`ai-tavily-hikari` 运行容器返回 `/api/version = 0.32.1`，并在真实 API 响应中暴露 `request_kind_key = mcp:session-delete-unsupported`、`operationalClass = neutral`、`requestKindBillingGroup = non_billable`、`resultStatus = error` 的不一致状态。
- 2026-04-03：`/home/ivan/srv/ai/docker-compose.yml` 与 `/home/ivan/srv/ai/tavily-hikari.md` 仍指向旧 digest `sha256:181b401...`，但正在运行的 `ai-tavily-hikari` 容器 digest 为 `sha256:daa906...`。
- 该 drift 本次只记录，不在热修范围内实施同步。

## 实现里程碑（Milestones / Delivery checklist）

- [x] M1: 新增统一 display helper，并接入 request/token/public serializer
- [x] M2: 补齐 admin/key/token/snapshot/public 回归测试
- [x] M3: 记录 hotfix spec 与 101 drift follow-up
- [x] M4: 完成 fast-track PR、merge 与 cleanup

## 风险 / 假设（Risks, Assumptions）

- 风险：如果仍有遗漏的 serializer 继续直传原始 `result_status`，线上会出现局部页面修好、局部页面仍报错的碎片化状态。
- 假设：现有 filter/facet SQL 已正确按 `neutral` 工作，因此本次只需修 view 层输出即可恢复一致性。

## 参考（References）

- `docs/specs/w6m86-mcp-session-delete-neutral-repair/SPEC.md`

## 变更记录（Change log）

- 2026-04-03: PR #203 修正 session-delete unsupported 的 display `resultStatus` 输出，补齐 serializer/admin/key/token/snapshot 回归，并记录 101 digest drift 证据。
