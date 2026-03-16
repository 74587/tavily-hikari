# DB Contract

## New tables

### user_api_key_bindings

- `user_id TEXT NOT NULL`
- `api_key_id TEXT NOT NULL`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `last_success_at INTEGER NOT NULL`
- `PRIMARY KEY (user_id, api_key_id)`

## Indexes

- `idx_user_api_key_bindings_user_recent(user_id, last_success_at DESC, api_key_id)`
- `idx_user_api_key_bindings_key_recent(api_key_id, last_success_at DESC, user_id)`

### api_key_user_usage_buckets

- `api_key_id TEXT NOT NULL`
- `user_id TEXT NOT NULL`
- `bucket_start INTEGER NOT NULL`
- `bucket_secs INTEGER NOT NULL` (`86400` only in v1)
- `success_credits INTEGER NOT NULL`
- `failure_credits INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `PRIMARY KEY (api_key_id, user_id, bucket_start, bucket_secs)`

## Indexes

- `idx_api_key_user_usage_buckets_key_bucket(api_key_id, bucket_secs, bucket_start DESC)`
- `idx_api_key_user_usage_buckets_user_bucket(user_id, bucket_secs, bucket_start DESC)`

## Existing table changes

### auth_token_logs

- Add nullable column: `api_key_id TEXT`
- Purpose: persist the exact selected key for pending-billing rows so settlement can write precise `key + user + charged credits` rollups.

## Write rules

1. Every successful charged request upserts `(user_id, api_key_id)` into `user_api_key_bindings` and sets `last_success_at` to the request time.
2. After refresh, prune rows for that `user_id` so only the latest 3 bindings remain.
3. Every charged request with `billing_subject = account:<user_id>` and non-null `api_key_id` increments the matching `api_key_user_usage_buckets` local-day bucket.
4. `result_status = success` increments `success_credits`; every other charged outcome increments `failure_credits`.
5. Historical rows are not backfilled; `api_key_user_usage_buckets` starts empty on existing databases and only accumulates post-launch writes.
