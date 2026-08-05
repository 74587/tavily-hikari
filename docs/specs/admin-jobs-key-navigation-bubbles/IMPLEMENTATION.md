# Admin Jobs Key 跳转与分组气泡 实现状态

## 状态

- Status: 部分完成（3/4）
- Created: 2026-03-13
- Last: 2026-03-13

## 当前验证记录

- `2026-03-13`：`cargo test` 通过。
- `2026-03-13`：`cd web && bun test` 通过。
- `2026-03-13`：`cd web && bun run build` 通过。
- `2026-03-13`：`cd web && bun run build-storybook` 通过；新增 Storybook 证据故事后，可从 SB 直接截图展示桌面端气泡、移动端无气泡与空 key 占位三种状态。
- `2026-03-13`：本地启动当前 worktree 的后端 `http://127.0.0.1:58089`（`DB_PATH=tavily_proxy_jobs_key_link.db`、`--dev-open-admin`），通过 `POST /api/keys` + `POST /api/keys/:id/sync-usage` 生成 jobs 记录，`GET /api/jobs?page=1&per_page=3` 返回 `keyGroup` 字段并可观察到 `quota_sync/manual` 任务带有 `keyId` + `keyGroup`。
- `2026-03-13`：由于标准端口 `127.0.0.1:58087` / `127.0.0.1:55173` 已被另一 worktree 占用，当前回合未能用浏览器 MCP 打开当前 worktree 的 UI 做最终可视化复核；需在释放标准端口或切换代理后补做。

## 里程碑

- [x] M1: 规格冻结与 jobs API 合同补齐
- [x] M2: 后端 jobs 查询返回 `key_group`
- [x] M3: 前端 jobs Key 跳转与桌面气泡落地
- [ ] M4: 测试、浏览器验证与 review-loop 收敛
