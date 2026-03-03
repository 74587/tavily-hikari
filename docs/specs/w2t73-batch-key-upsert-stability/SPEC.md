# 批量 Key 导入稳定性修复（#w2t73）

## 状态

- Status: 部分完成（3/4）
- Created: 2026-03-04
- Last: 2026-03-04

## 背景 / 问题陈述

- 历史 CI 在 `Backend Tests` 中出现过一次 `api_keys_batch_reports_statuses_and_is_partial_success` 断言失败。
- 失败现象为 `summary.created` 期望 `2`、实际 `1`，表现为批量导入中单条失败后后续插入偶发受污染。
- 当前问题会阻断 release 流程，不符合快车道稳定交付要求。

## 目标 / 非目标

### Goals

- 加固 `add_or_undelete_key_with_status_in_group` 的事务失败路径，避免单条失败污染后续写入。
- 在 SQLite 瞬时写冲突场景下提供有限重试与短退避，提高写入稳定性。
- 保持 `/api/keys/batch` 外部接口契约与语义不变。
- 新增回归测试证明“失败后紧接成功写入”可稳定通过。

### Non-goals

- 不修改前端页面与交互。
- 不调整数据库 schema 与迁移。
- 不修改 release 策略与版本规则。

## 范围（Scope）

### In scope

- `src/lib.rs`：事务回滚、错误判定与重试加固。
- `src/lib.rs`：新增回归测试（单条失败后后续写入不受影响）。
- `src/server.rs`：仅确认契约不变，不做响应结构改动。
- `docs/specs/README.md` 与本规格文档同步。

### Out of scope

- `/api/keys/batch` 请求/响应字段或状态码变更。
- 任意非该问题直接相关的重构。

## 接口契约（Interfaces & Contracts）

### 接口清单（Inventory）

| 接口（Name）      | 类型（Kind） | 范围（Scope） | 变更（Change）         | 契约文档（Contract Doc） | 负责人（Owner） | 使用方（Consumers） | 备注（Notes）                          |
| ----------------- | ------------ | ------------- | ---------------------- | ------------------------ | --------------- | ------------------- | -------------------------------------- |
| `/api/keys/batch` | HTTP API     | external      | Modify (internal only) | None                     | backend         | admin web           | 外部输入输出保持不变，仅内部鲁棒性加固 |

## 验收标准（Acceptance Criteria）

- Given 批量导入包含 2 个新 key、1 个触发失败 key、重复项与空行\
  When 调用 `/api/keys/batch`\
  Then `summary.created=2`、`summary.failed=1`、`summary.duplicate_in_input=2`、`summary.ignored_empty=2` 且结果顺序与状态语义不变。
- Given SQLite 出现瞬时写冲突（`BUSY/LOCKED`）\
  When 执行 key upsert\
  Then 仅对瞬时错误进行最多 2 次重试并短退避，非瞬时错误立即返回。
- Given 本次修复完成\
  When 运行目标测试循环\
  Then 连续 50 次通过，不再出现 `created=1` 的回归。

## 非功能性验收 / 质量门槛

- `cargo fmt --all --check`
- `cargo clippy --all-targets --all-features -- -D warnings`
- `cargo test --locked --all-features`
- `for i in {1..50}; do cargo test --locked --all-features api_keys_batch_reports_statuses_and_is_partial_success -- --exact -q; done`

## 实现里程碑（Milestones）

- [x] M1: 在 `src/lib.rs` 增加 SQLite 瞬时错误判定与 upsert 重试包装
- [x] M2: 显式回滚失败事务，确保失败路径不污染后续操作
- [x] M3: 增加回归测试覆盖“失败后紧接成功写入”场景
- [ ] M4: 完成本地质量门禁与快车道 PR 收敛

## 变更记录（Change log）

- 2026-03-04: 创建规格，冻结目标/范围/验收口径。
- 2026-03-04: 完成 lib 层事务回滚与重试加固；新增失败后连续写入回归测试；本地 fmt/clippy/test 与目标用例 50 次循环通过。
