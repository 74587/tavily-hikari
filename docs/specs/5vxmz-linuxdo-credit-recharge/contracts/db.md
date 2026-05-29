# DB Contract

## `linuxdo_credit_recharge_orders`

- `out_trade_no TEXT PRIMARY KEY`
- `user_id TEXT NOT NULL`
- `status TEXT NOT NULL`
- `credits INTEGER NOT NULL`
- `months INTEGER NOT NULL`
- `money_cents INTEGER NOT NULL`
- `trade_no TEXT`
- `payment_url TEXT`
- `order_name TEXT NOT NULL`
- `notify_payload TEXT`
- `created_at INTEGER NOT NULL`
- `updated_at INTEGER NOT NULL`
- `paid_at INTEGER`
- `last_notify_at INTEGER`
- `last_error TEXT`

## `linuxdo_credit_recharge_entitlements`

- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `out_trade_no TEXT NOT NULL`
- `user_id TEXT NOT NULL`
- `month_start INTEGER NOT NULL`
- `credits INTEGER NOT NULL`
- `created_at INTEGER NOT NULL`
- Unique: `(out_trade_no, month_start)`
- Indexed by `(user_id, month_start)`

## Semantics

- `month_start` is the UTC timestamp for server-local month start.
- Entitlements are append-only after successful payment.
- Repeated notifications update order metadata but must not duplicate entitlement rows.
