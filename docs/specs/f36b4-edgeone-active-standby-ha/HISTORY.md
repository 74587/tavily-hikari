# History

## Decision

The project originally considered a master/slave split with multiple serving slaves and centralized token quota dispatch. The accepted direction is single-active active/standby because EdgeOne free tier is suitable as a single-domain origin switching control plane, not as an application load balancer.

## Rationale

Single-active reduces quota, rebalance, conversation remapping, and upstream key ownership conflicts. Existing MCP Rebalance and API Rebalance remain single-active instance capabilities. Automatic failover intentionally stops at `provisional_master` so core API/MCP traffic recovers quickly while high-risk writes require an administrator decision.

## Accepted Semantics

- EdgeOne current origin is the active-master authority, including while nodes are already running.
- A node that was active and later observes EdgeOne pointing elsewhere must enter `recovery` and stop external business service.
- A standby that observes EdgeOne pointing at itself is not silently trusted as `full_master`; it becomes `provisional_master` until an administrator finalizes.
- Recovery import is mergeable-only. It must not import request or auth-token log rows, and it must not overwrite settings, current quota/token/key state, or rebalance authority state.
- Non-force promote is a standby operation. Active-node promote attempts are rejected so operator error cannot produce a local double-active state.

## Small-State Sync Revision

Production validation showed that full SQLite snapshot sync is unsafe for the current data shape because request logs and response bodies can make the database tens of GiB. The accepted replacement is standby-pulled, zstd-compressed NDJSON state sync over explicit whitelisted resources plus a 72-hour `ha_outbox` event stream. HA sync is now forbidden from transporting full database files or raw request/auth-token log records.

## Admin IA Revision

The full HA node inventory is an operations setting, not global business-page chrome. Admin business pages stay silent in normal `full_master` state and show only a compact attention link during abnormal HA states; promote/finalize remains confined to the System Settings high-availability subpage.
