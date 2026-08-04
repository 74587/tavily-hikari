# Server.rs 最小风险模块化重构（#8brtz）

## 背景 / 问题陈述

- `src/server.rs` 体量达到 8k+ 行，路由装配、鉴权、Tavily 代理、SSE、用户/管理员 API、测试全部混在单文件，维护成本高。
- Tavily HTTP 端点（`search/extract/crawl/map`）存在高重复实现，后续修复容易遗漏。
- 需要在最小风险前提下完成模块化，避免公开成功响应契约回归。

## 目标 / 非目标

### Goals

- 将后端服务实现从 `src/server.rs` 迁移到 `src/server/**` 多文件结构。
- 保持对外成功响应（2xx）契约稳定：路径、方法、核心 JSON 结构不变。
- 提取共享函数 `proxy_tavily_http_endpoint(...)`，统一 Tavily HTTP 端点的鉴权、配额、转发与日志流程。
- 保持现有 CLI 入参和 `serve(...)`/`ForwardAuthConfig`/`AdminAuthOptions`/`LinuxDoOAuthOptions` 可用语义。

### Non-goals

- 不新增公开 API 路径。
- 不变更数据库 schema。
- 不做前端功能改动。
- 不做全仓日志体系替换（例如全量切换 tracing）。

## 范围（Scope）

### In scope

- 服务端模块化目录：
  - `src/server/mod.rs`
  - `src/server/state.rs`
  - `src/server/schedulers.rs`
  - `src/server/spa.rs`
  - `src/server/serve.rs`
  - `src/server/dto.rs`
  - `src/server/proxy.rs`
  - `src/server/handlers/*.rs`
- 路由行为保持一致（以当前 `/api/*`、`/auth/*`、`/mcp*`、`/admin*`、`/console*`、`/login*` 为基线）。
- Tavily HTTP 端点共享转发流程抽象。

### Out of scope

- 新鉴权模式或权限模型调整。
- 业务统计口径变更。
- 非必要行为优化（仅允许错误日志与非 2xx 细节微调）。

## 成功响应契约基线

- `POST /api/tavily/search`
- `POST /api/tavily/extract`
- `POST /api/tavily/crawl`
- `POST /api/tavily/map`
- `GET /api/tavily/usage`
- `ANY /mcp` 与 `ANY /mcp/*path`
- `GET /health`

以上端点在成功路径下的状态码与核心字段必须保持兼容。

## 验收标准（Acceptance Criteria）

- Given 代码完成重构
  When 查看后端实现入口
  Then `src/server.rs` 不再承载单体实现，核心逻辑分布在 `src/server/**`。

- Given 客户端调用既有成功路径
  When 命中 2xx 响应
  Then 路径/方法/核心 JSON 字段保持兼容。

- Given 调用 Tavily HTTP 端点
  When 使用 header/body token
  Then 上游 `api_key` 与 `Authorization` 仍被正确替换为 Tavily key，计费语义保持一致。

- Given `/mcp` 请求中存在 query token
  When 进行业务配额统计
  Then non-tool call 仍不会计入业务配额，行为不回退。

## 非功能性验收 / 质量门槛（Quality Gates）

- `cargo fmt`
- `cargo clippy -- -D warnings`
- `cargo test`
