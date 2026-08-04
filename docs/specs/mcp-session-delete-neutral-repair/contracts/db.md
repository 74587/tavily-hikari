# DB

## Canonical request kind

- New canonical key: `mcp:session-delete-unsupported`
- Canonical label: `MCP | session delete unsupported`
- Protocol group: `mcp`
- Billing group: `non_billable`

## Future write rules

### request_logs

- Match only rows where all predicates hold:
  - `method = 'DELETE'`
  - `path = '/mcp'`
  - `status_code = 405`
  - `tavily_status_code = 405`
  - `failure_kind = 'mcp_method_405'`
  - response/error text contains `Session termination not supported`
- For matched rows:
  - `request_kind_key = 'mcp:session-delete-unsupported'`
  - `request_kind_label = 'MCP | session delete unsupported'`
  - `request_kind_detail = NULL`
  - `business_credits = NULL`
  - `key_effect_code = 'none'`

### auth_token_logs

- Same canonical request-kind predicate as `request_logs`.
- Additional write rules:
  - `counts_business_quota = 0`
  - `business_credits = NULL`
  - `billing_state` must not become `pending` or `charged` for this event.

## Historical repair rules

- The one-shot repair binary must only mutate rows that satisfy the exact predicate above.
- `--dry-run` reports counts only.
- `--apply` must:
  - update matched `request_logs` and `auth_token_logs`
  - rebuild affected `token_usage_stats`
  - rerun business quota rebase for each touched UTC month
- Re-running `--apply` after a successful run must produce zero additional mutations.
