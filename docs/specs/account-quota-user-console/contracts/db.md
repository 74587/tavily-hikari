# DB Contract

## New tables

### account_quota_limits

- `user_id TEXT PRIMARY KEY`
- `business_calls_1h_limit INTEGER NOT NULL`
- `daily_credits_limit INTEGER NOT NULL`
- `monthly_credits_limit INTEGER NOT NULL`
- `inherits_defaults INTEGER NOT NULL DEFAULT 1`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`

### account_usage_buckets

- `user_id TEXT NOT NULL`
- `bucket_start INTEGER NOT NULL`
- `granularity TEXT NOT NULL` (`request_minute` / `minute` / `hour`)
- `count INTEGER NOT NULL`
- `PRIMARY KEY(user_id, bucket_start, granularity)`

### account_monthly_quota

- `user_id TEXT PRIMARY KEY`
- `month_start INTEGER NOT NULL`
- `month_count INTEGER NOT NULL`

## Indexes

- `idx_account_usage_lookup(user_id, granularity, bucket_start)`

## Meta key

- `account_quota_backfill_v1`
  - 用于控制一次性回填执行状态。

## Backfill strategy

1. 为 `user_token_bindings` 中的用户写入默认账户限额（不覆盖已存在行）。
2. 将 `token_usage_buckets` 聚合复制到 `account_usage_buckets`。
3. 将 `auth_token_quota` 聚合复制到 `account_monthly_quota`。
4. 使用 `account_quota_backfill_v1` 标记回填完成。
5. 对旧库启动时，`account_quota_limits` 会自动从 `hourly_limit/daily_limit/monthly_limit` 迁到语义列，并物理删除 `hourly_any_limit`。
