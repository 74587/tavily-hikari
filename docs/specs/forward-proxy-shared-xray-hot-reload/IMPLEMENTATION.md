# Forward Proxy 共享 Xray 单实例热更新 实现状态

## Current Coverage

- The runtime uses one shared Xray process with per-node relay handles, generation switching,
  lease-based draining, startup restoration, and readiness-aware health behavior.
- Save, refresh, revalidate, validate, probe, trace, and request paths reuse the shared runtime;
  shared-testbox hot-reload verification is recorded in the topic history and catalog.

## Remaining Gaps

- None recorded for this topic.
