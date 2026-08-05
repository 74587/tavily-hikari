# Rust 源码行数预算与模块拆分 演进历史

## 变更记录（Change log）

- 2026-04-18: 创建规格，冻结“只收口 Rust 工程源码行数预算，不扩到 `web/**`”的本轮边界。
- 2026-04-18: 将 `src/server/tests.rs`、`src/tests/mod.rs`、`src/store/mod.rs`、`src/tavily_proxy/mod.rs`、`src/forward_proxy.rs`、`src/server/proxy.rs` 与 `src/server/handlers/admin_resources.rs` 拆为薄入口 + 多个子文件。
- 2026-04-18: 新增 `tests/rust_source_line_budgets.rs`，对 `src/**/*.rs` 与 `tests/**/*.rs` 建立 3000 行预算门禁。
- 2026-04-18: 本地验证通过：`cargo fmt`、`cargo test --workspace --no-run`、`cargo test --test rust_source_line_budgets`。
- 2026-04-18: 在 review 收敛中修正 rebalance 本地 MCP 校验错误的 `failure_kind` 记录，保持 canonical failure kind 与 `fallback_reason` 同时可用，并补充对应回归测试。
- 2026-06-18: 将 `src/tests/**` 与 `src/server/tests/**` 从预算驱动的 `include!(\"chunk_*.rs\")` 机械切片重组为真实语义测试模块，并新增显式 `support` helper 层，删除 `src/tests/chunk_04_tail.rs` 这类无业务语义的尾巴文件，同时保持源码行数预算门禁与 shard coverage verifier 生效。

## Legacy Identity

- Legacy compatibility identity: `#6ib2x`.
