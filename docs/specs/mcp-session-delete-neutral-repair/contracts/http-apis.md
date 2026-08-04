# HTTP APIs

## GET /api/logs

- Query:
  - `result`: `success | error | neutral | quota_exhausted`
  - `request_kind`: repeatable exact-match canonical key filter
- Response item contract:
  - `requestKindKey` may be `mcp:session-delete-unsupported`
  - `requestKindBillingGroup` must be `non_billable` for this key
  - `operationalClass` must be `neutral` for this key, even when raw `resultStatus` remains `error`
- Facets:
  - `facets.results` must expose the same user-visible buckets used by `result`
  - `neutral` count must include `mcp:session-delete-unsupported`
  - `error` count must exclude `mcp:session-delete-unsupported`

## GET /api/keys/:id/logs

- Inherits the same `result` filter and `facets.results` semantics as `GET /api/logs`.

## GET /api/tokens/:id/logs/page

- Query:
  - `result`: `success | error | neutral | quota_exhausted`
  - `operational_class`: unchanged
  - `request_kind`: repeatable exact-match canonical key filter
- Response:
  - `request_kind_options` must include `mcp:session-delete-unsupported` when present in the time window.
  - `requestKindBillingGroup` must be `non_billable` for this key.
  - `operationalClass` must be `neutral` for this key.
  - `facets.results` must expose `neutral` as a first-class bucket.

## Compatibility rules

- Raw HTTP/Tavily status and request/response bodies remain unchanged.
- Existing clients that still query `result=error` must simply stop receiving this one neutralized event; no other result buckets change semantics.
