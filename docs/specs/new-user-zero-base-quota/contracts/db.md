## account_quota_limits

- 不新增额度语义表，但列名已与产品语义对齐。
- 新用户首次通过 `ensure_account_quota_limits*` 落库时，写入：
  - `business_calls_1h_limit = 0`
  - `daily_credits_limit = 0`
  - `monthly_credits_limit = 0`
  - `inherits_defaults = 0`
- 已存在的旧 schema 行会在服务启动时自动迁移到语义列名，并删除 `hourly_any_limit`。
- 启动期 `sync_account_quota_limits_with_defaults()` 仍只同步历史 `inherits_defaults = 1` 行；零基线用户不跟随默认 tuple。

## user_tags / user_tag_bindings

- `user_tags` 额度列已对齐为：
  - `business_calls_1h_delta`
  - `daily_credits_delta`
  - `monthly_credits_delta`
- 旧 `hourly_any_delta/hourly_delta/daily_delta/monthly_delta` 会在启动时自动迁移并删除。
- `linuxdo_l*` 系统标签的默认 delta 继续沿用旧 token/env 默认额度映射。

## auth_tokens / token quota

- 无 schema 变化。
- token 级默认额度与相关 env 变量语义保持不变。
