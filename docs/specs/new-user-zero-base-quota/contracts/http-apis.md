## GET `/api/users/:id`

- `quotaBase` 对“新创建且尚无标签、且此前没有额度行的用户”返回：
  - `businessCalls1hLimit = 0`
  - `dailyCreditsLimit = 0`
  - `monthlyCreditsLimit = 0`
  - `inheritsDefaults = false`
- `effectiveQuota` 继续返回“基线 + 标签增量”的结果。

## GET `/api/user/tokens` / GET `/api/user/tokens/:id`

- 对已绑定账户 token：
  - `businessCalls1h.limit`、`dailyCreditsLimit`、`monthlyCreditsLimit` 继续从账户有效额度派生。
  - 若用户无标签且基线为 0，则 limit 也为 0。
- 对未绑定 token：
  - 非账户绑定 token 继续沿用现有 token 默认额度，不受本轮账户零基线影响。

## Removed PATCH `/api/users/:id/quota`

- The dedicated base quota patch route is no longer available.
- Admin base quota adjustments are append-only `scopeKind="base"` rows in
  `POST /api/users/:id/entitlements`.
