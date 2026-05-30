# History

## Decision

The project originally considered a master/slave split with multiple serving slaves and centralized token quota dispatch. The accepted direction is single-active active/standby because EdgeOne free tier is suitable as a single-domain origin switching control plane, not as an application load balancer.

## Rationale

Single-active reduces quota, rebalance, conversation remapping, and upstream key ownership conflicts. Existing MCP Rebalance and API Rebalance remain single-active instance capabilities. Automatic failover intentionally stops at `provisional_master` so core API/MCP traffic recovers quickly while high-risk writes require an administrator decision.
