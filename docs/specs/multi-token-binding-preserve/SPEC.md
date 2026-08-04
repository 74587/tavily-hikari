# 多 Token 绑定保留已分配 token（不做历史回补）（#6xeyh）

## 背景 / 问题陈述

- 在 `vr67d` 版本后，LinuxDo 登录携带候选 token 时，绑定逻辑会以“替换当前绑定”的方式写入 `user_token_bindings`。
- 当用户历史上已经拿到过 token（例如本地 localStorage 还留有旧 token）时，后续登录可能把旧 token 从该用户解绑，违反“已分配 token 不得收回”的业务约束。
- 当前需求要求底层支持“同一用户绑定多枚 token”，但用户侧暂不开放创建/删除，仅做只读展示。

## 目标 / 非目标

### Goals

- 将 `user_token_bindings` 从单绑定模型升级为多绑定模型（同一用户可多行）。
- 保持 `token_id` 全局唯一（一个 token 仅归属一个用户）。
- 修复后续登录行为：候选 token 绑定应为“新增或刷新”，不得解绑该用户既有 token。
- 用户接口语义对齐：
  - `GET /api/user/tokens` 返回该用户全部绑定 token（按最近绑定优先）。
  - `GET /api/user/token` 返回该用户“最新绑定”的单个主 token。

### Non-goals

- 不做历史批量回补。
- 不做历史定向修复。
- 不新增用户侧 token 创建/删除能力。

## 范围（Scope）

### In scope

- `src/lib.rs`
  - `user_token_bindings` 表结构升级为复合主键模型。
  - 启动迁移：识别 legacy 单绑定主键并重建到新表结构。
  - `ensure_user_token_binding_with_preferred` 改为“新增/刷新绑定”，不替换用户既有绑定。
  - `list_user_tokens`、`fetch_user_token_any_status`、`get_user_token` 统一按 `updated_at DESC` 语义查询。
- `src/server/tests.rs` 与 `src/lib.rs` 测试
  - 补充并更新多绑定行为、迁移行为与回调链路测试。

### Out of scope

- 历史解绑数据的自动恢复。
- 管理端 token 生命周期策略重设计（删除/禁用策略不改）。

## 接口契约（Interfaces & Contracts）

- `GET /api/user/tokens`：返回当前用户所有绑定 token，顺序 `updated_at DESC`。
- `GET /api/user/token`：返回当前用户最新绑定 token（单条语义保持不变）。
- 用户侧继续只读，不新增 token 创建/删除接口。

## 验收标准（Acceptance Criteria）

- Given 用户已有绑定 token A
  When LinuxDo 回调携带可用候选 token B（且 B 未被他人占用）
  Then 用户同时拥有 A 与 B 两条绑定记录，A 不被解绑。

- Given 用户有多条绑定
  When 访问 `GET /api/user/tokens`
  Then 返回全部绑定 token，且按最近绑定在前。

- Given 用户有多条绑定
  When 访问 `GET /api/user/token`
  Then 返回该用户最新绑定的 token。

- Given 候选 token 已归属他人
  When LinuxDo 回调触发绑定
  Then 维持保守回退，不越权绑定。

- Given 历史数据中存在未绑定 token
  When 服务启动迁移
  Then 不触发历史回补，仅迁移既有绑定结构。

## 质量门槛（Quality Gates）

- `cargo fmt --all`
- `cargo test`
- `cargo clippy -- -D warnings`
- 共享测试机 `codex-testbox` 隔离回归（含 focused + full regression）
