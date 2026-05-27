# HTTP APIs

## GET /api/user/recharge/config

- Auth: `hikari_user_session`
- Response `200`:
  - `enabled`: boolean
  - `unitCredits`: `1000`
  - `unitPriceLdc`: `50`
  - `minCredits`: `1000`
  - `maxCredits`: `20000`
  - `creditsStep`: `1000`
  - `defaultCredits`: initial UI value; `1` only when the test-price offer is enabled
  - `minMonths`: `1`
  - `maxMonths`: `12`
  - `quotaDeltaBaseCredits`: quota increment calculation base, currently `1000`
  - `hourlyDeltaPerQuotaUnit`: `20`
  - `dailyDeltaPerQuotaUnit`: `100`
  - `monthlyDeltaPerQuotaUnit`: quota-month increment for one `quotaDeltaBaseCredits`
  - `testPriceEnabled`: boolean; when enabled, this only adds the extra `1 credit × 1 month`
    offer for `1 LDC`
  - `currentMonthStart`: Unix timestamp for current server-local month start in UTC
  - `currentEntitlementCredits`: current month purchased credits
  - `effectiveUntilMonthStart`: latest entitled month start, or `null`

## GET /api/user/recharge/orders

- Auth: `hikari_user_session`
- Response `200`: `{ "items": RechargeOrder[] }`

## GET /api/user/recharge/orders/:out_trade_no

- Auth: `hikari_user_session`
- Response `200`: `RechargeOrder`
- Error:
  - `404` if the order does not belong to current user.

## POST /api/user/recharge/orders

- Auth: `hikari_user_session`
- Request JSON:
  - `credits`: positive integer, multiple of `1000`
    - normal mode: `1000..=20000`, step `1000`
    - test pricing: additionally allows exactly `1` credit when `months` is exactly `1`
  - `months`: integer in `1..=12`
    - test pricing does not allow `1` credit with more than one month
- Response `200`:
  - `order`: `RechargeOrder`
  - `paymentUrl`: Linux.do Credit payment URL
- Error:
  - `400` invalid credits/months
  - `503` recharge not configured

## GET /api/linuxdo-credit/notify

- Auth: Linux.do Credit signed query.
- Query:
  - `pid`, `trade_no`, `out_trade_no`, `type`, `name`, `money`, `trade_status`, `sign`
- Response:
  - `200 text/plain` body `success` when accepted or already applied.
  - `400` when signature, order, status, or amount does not match.

## GET /api/users/:id

- Change: response adds `recharge` object.
- Shape:
  - `currentMonthEntitlementCredits`
  - `effectiveUntilMonthStart`
  - `orders`: recent `RechargeOrder[]`
  - `entitlements`: recent entitlement rows

## RechargeOrder

- `outTradeNo`
- `status`: `pending|paid|failed`
- `credits`
- `months`
- `money`
- `tradeNo`
- `paymentUrl`
- `createdAt`
- `updatedAt`
- `paidAt`
- `lastNotifyAt`
- `lastError`
