# Lib.rs 最小风险模块化重构 演进历史

## 变更记录（Change log）

- 2026-03-19: 创建规格，冻结“公开 API 兼容、schema/路由语义不漂移、单 PR 收口到 merge-ready”的实施边界。
- 2026-03-19: 将 `src/lib.rs` 拆分为薄门面，并下沉到 `src/tavily_proxy/mod.rs`、`src/store/mod.rs`、`src/models.rs`、`src/analysis.rs` 与 `src/tests/mod.rs`；同步适配 `src/forward_proxy.rs` 的 `KeyStore` 导入路径。
- 2026-03-19: 为 `src/server/tests.rs` 中两个 research create -> result 场景补齐 `EnvVarGuard`，消除 `TOKEN_HOURLY_LIMIT` 并发污染导致的偶发 429/失败。
- 2026-03-19: 本地验证通过：`cargo fmt`、`cargo clippy --all-targets -- -D warnings`、`cargo test --lib`、`cargo test` 全部成功；库测试保持 `168` 项，server 集成测试 `153` 项，HTTP 契约测试 `8` 项。
- 2026-03-19: PR #154 已创建并收敛到 merge-ready；`type:skip` + `channel:stable` 标签就位，GitHub checks 全绿，`codex review --base origin/main` 未发现需修复问题。

## Legacy Identity

- Legacy compatibility identity: `#ffkgk`.
