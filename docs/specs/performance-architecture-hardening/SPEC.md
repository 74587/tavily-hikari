# Tavily Hikari 性能架构渐进加固

> 当前有效规范以本文为准；实现覆盖与当前状态见 `./IMPLEMENTATION.md`，关键演进原因见
> `./HISTORY.md`。

## 背景 / 问题陈述

当前单体服务中的后台生命周期、SQLite 连接所有权、维护任务、HA 排债、对账和管理员读取路径通过
`KeyStore`、`TavilyProxy` 及若干全局 gate 交叉耦合。局部性能修复能够缓解症状，却无法稳定约束
角色切换、任务 claim、写入预算和读模型成本。本规范定义渐进式内部边界，保留单体与 SQLite，避免
以重平台迁移替代架构治理。

## 目标 / 非目标

### Goals

- 建立 revisioned writable authority 和唯一后台生命周期所有者。
- 让 SQLite pools、admission、事务与预算通过 `SqliteRuntime` 统一治理。
- 将 HA GC、reconciliation、alerts、dashboard、peer observation 与 request stats 收敛为有界接口。
- 通过 expand-contract 保持滚动升级期间的存储与 wire 兼容。
- 以依赖门禁防止生产热路径重新访问 raw pool、coalescer 或旧全局 gate。

### Non-goals

- 不拆分微服务或迁移到 PostgreSQL。
- 不修改 SQLite pool、WAL、cache 或 mmap PRAGMA。
- 不改变 HA retention、ACK、账务真值或 `410 -> baseline` 语义。
- 不全量拆解 `KeyStore` / `TavilyProxy`，只迁移确认的生产热路径。
- 不改变公开或管理员响应 shape，也不重设计前端视觉结构。

## 范围（Scope）

### In scope

- `HaRuntime`、`MaintenanceRuntime`、`SqliteRuntime` 的所有权边界。
- per-channel HA GC work、reconciliation work projection 和 typed outcomes。
- `AlertProjection`、`DashboardReadModel`、`HaPeerObservationStore`、`RequestStatsPipeline`。
- maintenance、HA、reconciliation、dashboard、alerts、peer 和 request-stats 热路径迁移。

### Out of scope

- 101 部署、生产数据清理、VACUUM、baseline、TLS 或 HA 配置操作。
- keyed journal、ACK 内 compaction 或 HA v2 wire 协议。
- 与上述热路径无关的业务 facade 重构。

## 需求（Requirements）

### MUST

- `HaRuntime` 发布单调递增 revision 的 writable authority；旧 revision 不得继续 claim、远端调用或写入。
- `MaintenanceRuntime` 独占 worker、reaper、`JoinSet`、lease 和 remote-I/O slot 的生命周期。
- `SqliteRuntime` 唯一持有生产 pools、事务 guard、admission 和操作预算。
- `ha_outbox_gc_work` 按 control、billing、runtime 独立持久化 eligibility、claim 与 continuation。
- HA GC 与 scheduled work 使用 typed outcome 在同一原子边界完成 claim 和 continuation。
- 相同 wire payload 的 UPDATE 不产生 HA outbox 事件；有效变化恰好产生一条兼容事件。
- reconciliation 使用持久 work projection、公平 cursor 和原子 runtime state，并区分本地压力、429、
  transport、semantic failure 与 budget exhaustion。
- 告警读取全部来自可重建 `AlertProjection`；Dashboard HTTP/SSE 只消费共享 read model。
- 普通管理员 HA GET 只读取 peer observation cache；危险 HA 操作继续 live probe。
- 混跑期间禁止 HA 角色切换，直到所有节点均具备 writable-tenure supervisor。

### SHOULD

- 每个新边界提供窄接口和稳定错误分类，调用方不依赖 SQLite 实现细节。
- read model 在刷新失败时返回 last-good 与显式 stale coverage；冷启动失败返回 degraded/503。
- 迁移使用 shadow comparison、指标和状态跃迁日志证明等价后再删除旧路径。

### COULD

- 内部 observation 可增加估算字段，但必须明确 coverage 与 observed-at，不能以零伪装 unknown。

## 功能与行为规格（Functional/Behavior Spec）

### Core flows

1. Promotion 创建新 writable revision，并恰好启动一套 `MaintenanceRuntime`。
2. Demotion 撤销 authority；旧 revision 的本地与远端工作在 250ms 内停止获得新执行权。
3. 每个 HA channel 独立 claim GC work，完成后原子记录 typed outcome 和 continuation。
4. reconciliation projection 选择有界 work page，engine 在 2 秒内开始首次远端尝试并在 20 秒内结束。
5. observability sidecar 持久化 alert projection；Dashboard builder 生成共享 `Arc` snapshot，HTTP/SSE
   仅 snapshot/subscribe。

### Edge cases / errors

- Stale generation 的完成、失败或 continuation 均被拒绝，不能覆盖新 claim。
- SQLite busy 在 250ms 内返回 typed deferred，不形成后台无限 retry loop。
- 单一 HA channel 的 eligibility 延迟不得阻塞其他 channel。
- read model cold start 无可用 last-good 时显式 degraded，不在请求线程执行重聚合。
- 滚动升级中的旧节点继续消费现有 wire payload；新字段或表仅以向后兼容方式扩展。

## 接口契约（Interfaces & Contracts）

### 接口清单（Inventory）

| 接口（Name）             | 类型（Kind）    | 范围（Scope） | 变更（Change） | 契约文档（Contract Doc） | 负责人（Owner） | 使用方（Consumers） | 备注（Notes）            |
| ------------------------ | --------------- | ------------- | -------------- | ------------------------ | --------------- | ------------------- | ------------------------ |
| `HaRuntime`              | Rust API        | internal      | New            | 本文                     | HA runtime      | server lifecycle    | revisioned authority     |
| `MaintenanceRuntime`     | Rust API        | internal      | New            | 本文                     | maintenance     | workers/reaper      | sole lifecycle owner     |
| `SqliteRuntime`          | Rust API        | internal      | New            | 本文                     | storage         | hot paths           | pools/admission/budgets  |
| `RequestStatsPipeline`   | Rust API        | internal      | New            | 本文                     | observability   | dashboard           | bounded ingestion/rollup |
| `HaPeerObservationStore` | Rust API        | internal      | New            | 本文                     | HA              | admin reads         | cached observation only  |
| `ReconciliationEngine`   | Rust API        | internal      | New            | 本文                     | billing         | maintenance         | typed outcomes           |
| `AlertProjection`        | Rust API/schema | internal      | New            | 本文                     | observability   | alerts/dashboard    | rebuildable projection   |
| `DashboardReadModel`     | Rust API        | internal      | New            | 本文                     | admin reads     | HTTP/SSE            | snapshot/subscribe       |

## 验收标准（Acceptance Criteria）

- Demotion 后 250ms 内停止 claim、远端请求和新写入；promotion 只启动一套 runtime。
- control 延迟 300 秒时 billing/runtime 仍持续推进；stale generation 无法完成新 claim。
- 相同 wire payload UPDATE 不产生事件，有效变化恰好一条，旧版本仍可消费。
- reconciliation 首次远端尝试小于 2 秒、单轮不超过 20 秒，查询成本受 page limit 约束。
- 20 个 SSE 加并发 HTTP 下每 10 秒最多一次 Dashboard build；warm Dashboard 和缓存 HA GET
  p95 小于 100ms，读路径不执行写 SQL。
- AlertProjection 与旧结果在时间窗、过滤、分页、分组和状态跃迁上等价。
- 30 分钟生产形状基准中进程组 RSS P95 不超过 256MiB。
- architecture checker 证明目标热路径不存在 raw pool、coalescer、全局 pointer-map gate 或旧 cache。

## 验收清单（Acceptance checklist）

- [ ] 运行时与 SQLite 所有权边界已落地。
- [ ] HA GC 与 reconciliation work 已独立持久化并通过并发回归。
- [ ] AlertProjection 与 DashboardReadModel 已完成 shadow 和 cutover。
- [ ] 所有目标热路径已通过依赖门禁。
- [ ] 全量质量门禁与生产形状基准已通过。

## 非功能性验收 / 质量门槛（Quality Gates）

### Testing

- Rust: `cargo fmt --all -- --check`、`cargo test`、
  `cargo clippy --all-targets --all-features -- -D warnings`。
- Web: `bun --cwd web test`、`bun --cwd web run test:source-budgets`、
  `bun --cwd web run build`。
- 并发与 SQLite 场景使用隔离测试环境和 stub/sandbox upstream。

### UI / Storybook

- 本 initiative 不改变视觉结构；若管理员状态实现改变可见状态，更新既有 stories 与交互覆盖。
- 视觉证据仅来自 aggregate 最终 SHA，且遵守 owner approval gate。

### Quality checks

- 每个 child PR 的 checks、review 与 integration CI 必须绑定同一 head SHA。
- aggregate 不得存在未解决 P0/P1/P2 finding。

## Visual Evidence

PR: none

## Related PRs

- None

## 风险 / 开放问题 / 假设（Risks, Open Questions, Assumptions）

- 风险：expand-contract 混跑阶段若发生角色切换，旧 runtime 可能违反新 authority 合同，因此明确禁止。
- 风险：持久 projection 的 shadow 等价性不足会误导管理员读取，cutover 前必须证明覆盖一致。
- 假设：单体 + SQLite 能在有界 admission 和 projection 架构下满足既定 SLO。

## 参考（References）

- `../../adr/0001-ha-planned-cutover-control-plane.md`
- `../../../CONTEXT.md`
