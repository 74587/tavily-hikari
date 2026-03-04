# LinuxDo 登录复用既有 Token + 强制重登录 + 历史误建自愈（#vr67d）

## 状态

- Status: 已完成（快车道）
- Created: 2026-03-04
- Last: 2026-03-04

## 背景 / 问题陈述

- 现有 LinuxDo OAuth 回调仅调用 `ensure_user_token_binding`，不会消费登录前前端已持有的完整 token，导致首次登录可能新建 token。
- 在修复上线前已建立的用户会话需要强制失效，确保所有用户重新登录并走新绑定逻辑。
- 历史误建 token 需要可自愈重绑，但旧 token 不删除不禁用（保留可用）。

## 目标 / 非目标

### Goals

- 新增 `POST /auth/linuxdo`，支持以表单传递候选 token（可选）。
- OAuth state 扩展 `bind_token_id` 字段，回调时优先尝试绑定候选 token。
- 实现历史误建场景的“自愈重绑”：当前用户若已误绑新 token，可在再次登录时切回旧 token。
- 引入一次性用户会话失效迁移（仅 `hikari_user_session`）。

### Non-goals

- 不处理管理员会话（`hikari_admin_session`）。
- 不做跨用户强制接管 token。
- 不做误建 token 的删除/禁用清理。

## 范围（Scope）

### In scope

- `src/lib.rs`
  - `oauth_login_states` 新增 `bind_token_id`。
  - OAuth state create/consume 扩展 payload。
  - `ensure_user_token_binding_with_preferred` 绑定逻辑。
  - 一次性会话失效迁移（`force_user_relogin_v1`）。
- `src/server/handlers/user.rs`
  - 新增 `POST /auth/linuxdo`。
  - 回调消费 `bind_token_id` 并走优先绑定。
- `src/server/serve.rs`
  - `/auth/linuxdo` 同时支持 GET/POST。
- `web/src/PublicHome.tsx` 与 `web/src/components/PublicHomeHeroCard.tsx`
  - LinuxDo 登录入口统一改为 POST 启动，避免 URL 暴露 token。

### Out of scope

- 管理台 `/admin` 登录/鉴权链路。
- token 生命周期治理策略改造。

## 接口契约（Interfaces & Contracts）

- [contracts/http-apis.md](./contracts/http-apis.md)

## 验收标准（Acceptance Criteria）

- Given 升级前已有 `hikari_user_session`
  When 服务升级并启动
  Then 用户会话被一次性失效，用户接口返回未登录。

- Given 登录前持有合法旧 token 且该 token 未绑定他人
  When LinuxDo OAuth 回调成功
  Then 当前用户绑定到该旧 token，不再新建 token。

- Given 用户历史误绑了新 token 且本次登录携带可绑定旧 token
  When 回调成功
  Then 自动重绑回旧 token。

- Given 候选 token 已被他人绑定或不可用
  When 回调成功
  Then 忽略候选 token，按现有保守回退逻辑处理。

- Given 历史误建新 token 被替换出绑定
  When 登录完成
  Then 该 token 保持 active 且未删除，仅变为 unbound。

## 质量门槛（Quality Gates）

- `cargo fmt`
- `cargo clippy -- -D warnings`
- `cargo test`
- `cd web && bun run build`

## 里程碑

- [x] M1: Spec/Contracts 更新
- [x] M2: 后端 OAuth state + 绑定逻辑 + 会话迁移落地
- [x] M3: 前端 POST 登录入口落地
- [x] M4: 测试与构建验证通过
- [x] M5: 快车道交付（push + PR + checks + review-loop）

## 变更记录

- 2026-03-04: 初始化规格，冻结“强制重登录 + 自愈重绑 + 误建 token 保留可用”口径。
- 2026-03-04: 已完成后端/前端实现与本地验证（fmt + clippy + test + web build）；等待快车道收敛。
- 2026-03-04: PR #89 已创建并通过 CI/Label Gate，合并状态 clean。
