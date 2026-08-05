# 1:1 上游 Credits 计费（MCP + HTTP） 演进历史

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
- 2026-04-29: Research 本地用户计费从共享 key `/usage.research_usage` 差分归因改为模型估算价（`mini=40`、`auto=50`、`pro=100`）；`/usage` 实扣仅保留为池级运营对账指标。
- 2026-05-17: 明确 Research 前置 quota 边界按剩余额度判断；剩余额度等于本次估算扣减时放行并扣到窗口上限。

## Legacy Identity

- Legacy compatibility identity: `#s2vd2`.
