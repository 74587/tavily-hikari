# 修复合并后漏发的 post-merge 发布阻塞 演进历史

## 变更记录（Change log）

- 2026-04-10: 创建 spec，冻结“先修 standalone auth regression，再回填 `v0.38.0`”的快车道执行合同。
- 2026-04-10: standalone auth regression 改为最小 schema + direct DB seeding，`mcp_session_delete_neutral_repair` 50 次循环与 `cargo test --locked --all-features` 已在本地通过。
- 2026-04-10: follow-up PR `#230` 追加单连接 SQLite 测试 harness 与 standalone/joined auth candidate 显式分支，`main` 的 `CI Pipeline` run `#24227470494` 恢复为 success。
- 2026-04-10: `Release` workflow_dispatch run `#24227733663` 为 `445a80f87b42ca1eccb60520a443d09326287f95` 回填稳定版 `v0.38.0`，GitHub Release、GHCR `latest` / `v0.38.0` 标签与 PR `#227` release comment 已全部落地。

## Legacy Identity

- Legacy compatibility identity: `#9rdxm`.
