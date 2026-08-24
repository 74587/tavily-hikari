# HTTP API contracts

## System settings

`GET/PUT /api/settings/system` 增加：

- `upstreamProjectIdMode: "passthrough" | "fixed" | "accessToken"`
- `upstreamProjectIdFixedValue: string`
- `upstreamMcpUserAgent: string`
- `activeUpstreamMcpSessions: number`（只读摘要字段，用于系统设置 warning 入口）

默认值分别为 `accessToken`、空字符串、空字符串。`fixed` 模式要求固定值非空且不超过 128 字节；
固定值与 UA 均拒绝控制字符，UA 不超过 256 字节。

## System status

`GET /api/settings/system/status`（以及兼容别名 `GET /api/settings/system/privacy-status`）为 admin-only，只读返回：

- configured/effective Project ID 与 Header policy；
- UA 是否省略及脱敏后的有效值；
- eligibility gates、gate completion、phase、current period、next epoch；
- `activeUpstreamMcpSessions`；
- pending Research/usage queue 数量与最近 degraded 原因；
- `lastReconciliationRunAt`、`lastShadowAdjustmentAt`、`lastReconciliationEnqueueErrorAt`、`lastResearchSweepAt`、`lastResearchTerminalAt` reconciliation 诊断时间戳；
- `retryBuckets`：当前 `rate_limited` settlement 按 `upstream429`、`localUsageRateLimit`、`other` 分桶后的窗口数量；
- `currentPeriodBoundUsersByKey`：当前业务时段内按上游 Key 聚合的绑定用户数，元素为 `{ keyIdHint, count }`；
- `currentPeriodPendingProjectIdsByKey`：当前业务时段内按上游 Key 聚合的待查询 Project ID 数，元素为 `{ keyIdHint, count }`；
- `dailyReconciliationProgress`：当天 observed account/period、至少一个标准 settled 账期的账号、全部 terminal 账号、settled/degraded/pending period 与 terminal/pending Research 汇总；
- `dailyReconciliationByKey`：当天每 Key 的 `{ keyIdHint, terminalResearch, pendingResearch, pendingProjectIds, cooldownUntil, cooldownReason }`，仅返回稳定短 hint 与固定原因枚举；
- 最近 signed adjustments（token 只显示稳定短 id，upstream key 只显示本地短 id）。

响应保留既有字段并可附加读模型 freshness 字段：`coverage` 为 `ok|stale`，`observedAt` 是当前
immutable last-good 的观测时间，`staleReason` 只使用固定的本地分类。服务启动后异步预热该
last-good；有缓存时请求不得同步重建，refresh 或本地压力下直接返回 `200 stale`。无缓存时返回
`503 Retry-After: 1`，且不会因为 HTTP deadline 取消开放 SQLite transaction。
上述 `200 stale` 与无缓存 `503` 均须在 250ms 内完成；响应只读取 immutable last-good 或在没有
last-good 时作出有界冷启动判定，不等待完整 SQLite read-model rebuild。

响应不得包含 HMAC secret、官方 API key、完整 Hikari token 或客户端原始 `X-Project-ID`。

phase 当前为：

- `configured`: 只完成了静态配置，shadow compare 尚未进入产数状态。
- `compare`: shadow compare 已经产数，但 precise cutover 仍未启用。
- `pending`: precise 前置门禁已经满足，正在等待下一完整业务时间段。
- `active`: precise reconciliation 已启用。
- `degraded`: 至少一个窗口进入 degraded settlement。

## Admin users

`GET /api/users` 在 compare-only 模式下新增 shadow 对账语义字段：

- `shadowDailyCreditsUsed: number | null`
- `shadowDailyAvailability: "confirmed" | "projected" | null`
- `shadowDailyObservedPeriodCount: number | null`
- `shadowDailySettledPeriodCount: number | null`
- `shadowDailyDegradedPeriodCount: number | null`

compare-only 时合同固定为：

- `projected`：返回混合值 `dailyCreditsUsed + confirmed shadow delta sum`；owner-facing UI 必须明确提示“含未对账估算”。
- `confirmed` 且 `delta != 0`：返回同一混合值，并允许 UI 展示相对当前的 secondary delta。
- `confirmed` 且 `delta == 0`：仍返回新方案 `24h` 绝对值，但 secondary delta 为空。
- compare-only 激活时后端不再主动返回 `unavailable`；旧值仅作为前端兼容解析保留。
- 当天无本地计费且无 shadow usage 记录时，返回 `shadowDailyCreditsUsed = 0` 且 `shadowDailyAvailability = "confirmed"`。

非 compare-only 路径可以返回 `shadowDailyAvailability = null`，前端不展示该列。
compare-only 中三个 period count 分别表达已观测、标准 `shadow_settled`、`shadow_degraded` 数；前端显示“标准对账 settled/observed”，并在存在 degraded 时额外标记数量。

## MCP session bindings

`GET /api/settings/system/mcp-session-bindings` 为 admin-only，返回隐藏管理页所需的分页结果：

- 查询参数：
  - `status=active|revoked|all`
  - `created_from`
  - `created_to`
  - `updated_from`
  - `updated_to`
  - `page`
  - `per_page`
- 时间参数使用 RFC3339 / ISO timestamp。
- 服务端固定按 `updated_at desc` 返回。
- 返回字段：
  - `items[]`
  - `total`
  - `page`
  - `perPage`
  - `activeMatchingCount`

`items[]` 字段固定为：

- `proxySessionId`
- `authTokenId`
- `userId`
- `upstreamKeyId`
- `createdAt`
- `updatedAt`
- `expiresAt`
- `status` (`active|expired|revoked`)
- `revokedAt`
- `revokeReason`

接口与 UI 均不得暴露 raw `upstream_session_id`。

`POST /api/settings/system/mcp-session-bindings/revoke-selected`：

- 请求体：`{ "proxySessionIds": string[] }`
- 只释放命中的活跃 `upstream_mcp` session。
- 单条释放与勾选批量释放共用此接口。

`POST /api/settings/system/mcp-session-bindings/revoke-filtered`：

- 请求体沿用列表筛选字段：`status`、`createdFrom`、`createdTo`、`updatedFrom`、`updatedTo`
- 服务端忽略分页参数，只作用于当前筛选结果中的全部活跃 `upstream_mcp` session。
- 首版不支持独立 `expired` 筛选；`status=all` 时由服务端自行排除不可释放行。
