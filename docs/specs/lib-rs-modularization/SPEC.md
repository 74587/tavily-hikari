# Lib.rs 最小风险模块化重构（#ffkgk）

## 背景 / 问题陈述

- `src/lib.rs` 在重构前接近 30k 行，crate root 同时承载公开门面、数据库 schema/migration、`KeyStore`、`TavilyProxy`、计费与大段内联测试，维护风险过高。
- 过大的 root 文件让内部实现边界模糊，后续修复容易把存储、配额、代理编排与纯解析逻辑继续堆回同一处。
- 这次重构必须以“功能不回退”为硬约束，避免影响 CLI、HTTP/MCP 行为与 SQLite schema 语义。

## 目标 / 非目标

### Goals

- 将 `src/lib.rs` 收敛成薄门面，保留现有 `tavily_hikari::...` crate-root 公开入口与调用语义。
- 把实现按职责拆到 `src/tavily_proxy/**`、`src/store/**`、`src/models.rs`、`src/analysis.rs` 与 `src/tests/**`。
- 保持 `TavilyProxy`、`TavilyProxyOptions`、`DEFAULT_UPSTREAM` 及既有公开类型/函数签名兼容。
- 保持 SQLite schema、迁移顺序、错误映射与 Tavily research/key affinity、quota/billing 行为不回退。

### Non-goals

- 不新增或清理公开 API。
- 不改动前端 `web/**`。
- 不变更 CLI 参数、HTTP/MCP 路由契约或数据库 schema。
- 不顺手拆 `src/server/tests.rs`，仅允许为兼容/稳健性做最小测试修补。

## 范围（Scope）

### In scope

- `src/lib.rs`
  - root 改为模块声明、共享常量/辅助函数、`pub use` 门面与少量跨模块公共逻辑。
- `src/tavily_proxy/mod.rs`
  - 承载 `TavilyProxy` 结构体、构造器、research/key affinity、upstream routing、auth/admin/jobs 与配额编排实现。
- `src/store/mod.rs`
  - 承载 `KeyStore`、schema 初始化、migration/backfill、token/user/tag/account/quota CRUD 与 query helper。
- `src/models.rs`
  - 承载公开 DTO、共享 record、结果对象与跨模块基础数据类型。
- `src/analysis.rs`
  - 承载 request-kind、usage/error 解析与 header/path 纯逻辑。
- `src/tests/mod.rs`
  - 承载从 root 下沉的库内联测试，保留既有测试名与覆盖意图。
- `src/forward_proxy.rs`
  - 仅做最小导入适配，继续复用现有低层 forward proxy 实现。
- `src/server/tests.rs`
  - 仅做最小测试隔离修补，避免全局环境变量并发污染导致 research integration case 偶发失败。

### Out of scope

- `src/server/**` 进一步模块化。
- 运行时配置语义变更。
- 数据库历史数据回填策略调整。

## 模块边界与公开门面

- crate root 继续对外 `pub use`：
  - `analysis::{...}`
  - `forward_proxy::{...}`
  - `models::*`
  - `tavily_proxy::*`
- 存储层与 Tavily proxy 编排之间只通过 `pub(crate)` 边界暴露实现细节，避免调用方改路径。
- 研究请求 `request_id -> key/token affinity`、quota/billing 锁与 schema/migration 语义必须保持一致。

## 验收标准（Acceptance Criteria）

- Given 查看 crate root
  When 打开 `src/lib.rs`
  Then 文件应收敛为薄门面，不再承载 `impl KeyStore`、大段 schema/migration SQL 或巨型 `#[cfg(test)] mod tests`。

- Given 既有调用方继续使用 `tavily_hikari::...`
  When 编译 `src/main.rs`、`src/server/**` 与 `src/bin/**`
  Then 不需要因为公开路径变化而修改业务调用语义。

- Given 运行本地质量门
  When 执行 `cargo fmt`、`cargo clippy --all-targets -- -D warnings`、`cargo test --lib`、`cargo test`
  Then 全部通过，且库测试基线保持 `168` 项。

- Given 并发运行 server 集成测试
  When 涉及 research create 的用例与其他会修改 `TOKEN_HOURLY_LIMIT` 的测试并行执行
  Then 研究结果 key affinity 用例不应再因全局 env 污染而偶发失败。

## 非功能性验收 / 质量门槛（Quality Gates）

- `cargo fmt`
- `cargo clippy --all-targets -- -D warnings`
- `cargo test --lib`
- `cargo test`
