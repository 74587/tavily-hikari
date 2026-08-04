# Server.rs 最小风险模块化重构 演进历史

## 变更记录（Change log）

- 2026-03-04: 创建规格，冻结“最小风险模块化 + 成功响应契约稳定”实施边界。
- 2026-03-04: 完成 `src/server.rs` 拆分到 `src/server/**`；新增 `tests/server_http_contract.rs` 黑盒契约测试；本地 `cargo fmt`、`cargo clippy -- -D warnings`、`cargo test` 通过。
- 2026-03-04: review-loop 第 1 轮补齐测试健壮性：`BackendGuard` 统一清理子进程；新增 `max_results < 0` 与 map hourly-any 分支回归测试。
- 2026-03-04: review-loop 第 2 轮修复环境变量污染风险：引入 `EnvVarGuard`，确保测试 panic 路径也恢复 `TOKEN_HOURLY_*`。
- 2026-03-04: PR #88 的 `CI Pipeline` 重跑后通过（attempt 2），`PR Label Gate` 为 success；M5 收敛完成并同步规格索引。
- 2026-03-04: review-loop 第 3 轮完成 TOCTOU/并发稳健性收敛：`tests/server_http_contract.rs` 增加启动重试闭环，`src/server/tests.rs` 为 `EnvVarGuard` 增加全局锁；PR #88 的 `CI Pipeline`（run #289）与 `PR Label Gate`（run #134）均为 success。

## Legacy Identity

- Legacy compatibility identity: `#8brtz`.
