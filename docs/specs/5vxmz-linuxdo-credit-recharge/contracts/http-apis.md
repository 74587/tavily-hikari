# HTTP APIs

## GET /api/user/recharge/config

- Auth: `hikari_user_session`
- Response `200`:
  - `enabled`: boolean
  - `unitCredits`: `1000`
  - `unitPriceLdc`: `100`
  - `minMonths`: `1`
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
  - `months`: positive integer, minimum `1`
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
