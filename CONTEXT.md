# Tavily Hikari Context

## System Shape

Tavily Hikari is a single-product service with one owner-facing admin surface, one user-facing console, and one active business ingress. High availability is implemented as active/standby control around that single ingress, not as a distributed cluster manager.

## SQLite Workload Terms

- `foreground work`: request-path reads and writes. It may use the application pool directly, but it
  reports activity and bounded waits so background work can yield before consuming its capacity.
- `maintenance control`: short durable queue metadata work such as claim, finish, continuation, and
  stale recovery. It has a fixed short pool/writer budget enforced by `SqliteRuntime`, never
  changes the database busy-timeout pragma, and never carries scans or remote I/O. A transient
  completion failure leaves its fenced claim running for type-specific stale recovery rather than
  dropping durable work or retrying indefinitely in the background.
- `maintenance bulk`: rebuilds, rollup persistence, GC, and local reconciliation projection. It
  obtains one instance-local admission permit only when two foreground pool slots are either idle
  or immediately allocatable within the configured pool maximum, foreground activity is at most
  five requests per second, and there was no recent SQLite contention. Request-stats flush is the
  bounded recovery exception: each nominal wake owns at
  most four adaptive `25..250` logical-key transactions within one 50ms retry budget, atomically
  restoring every uncommitted delta before yielding. That budget includes pool acquisition,
  `BEGIN IMMEDIATE`, writes, and commit, not only statement retries after a transaction starts.
- `recovery debt`: retained work that is safely eligible for automatic catch-up, including expired
  HA outbox events. It progresses through bounded work slices and never receives a special writer
  bypass.
- `deferred outcome`: a typed decision made before pool acquisition when admission rejects a bulk
  operation or when its bounded transaction sees transient writer contention. The affected durable
  work returns uncommitted deltas or records a retry time; unrelated eligible work remains free to
  progress.

## Reconciliation Terms

- `reconciliation controller`: the replicated control-plane state selected exclusively by the
  existing precise-reconciliation switch. `false` selects `compare`; writing `true` selects
  `active` immediately and records the next full business period as the billing boundary. A
  durable integrity failure selects `active_paused`, clears the legacy switch, and requires a new
  `true` write before actual billing can resume.
- `reconciliation mode`: the controller-derived durable-work policy selected for a run. `compare`
  observes upstream differences without changing billing truth; `active` applies the existing
  billing settlement rules only to work at or after its activation boundary; `active_paused`
  preserves work without scheduling a representative.
- `projection slice`: one resumable, claim-fenced historical-usage page. Its bounded read happens
  outside the write transaction; work merge and the stable keyset cursor advance commit atomically.
- `terminal outcome`: a current work generation that needs no retry. Active non-zero differences
  are `settled`, zero differences are `no_adjustment`, and compare-mode non-zero differences are
  `observed`.
- `observation terminal`: the `observed` terminal outcome. It records shadow evidence while leaving
  billing truth unchanged and is never counted as a settlement.
- `retryable outcome`: `upstream_429`, `transport_failure`, `semantic_failure`, or
  `local_pressure`. It preserves the current work generation and its independent retry state until
  a later terminal outcome.

## Dashboard Read Terms

- `DashboardReadModel`: the single AppState-owned immutable last-good overview snapshot. A dirty
  generation may request one shared rebuild every ten seconds; a sixty-second bounded safety probe
  catches missed invalidations. Requests under SQLite pressure return last-good coverage rather
  than starting an independent rebuild.
- `AlertProjection`: an observability-sidecar projection with separate stable cursor/fence lanes:
  the recent tail serves Dashboard and the historical lane serves administrator Events and Groups.
  Dashboard accepts a recent summary only at `recent_coverage=ok`; otherwise the read model retains
  last-good data. Administrator reads use the sidecar only at complete history coverage; while it
  catches up or is stale, they retain the established source query so incomplete history is never
  shown as empty.

## HA Terms

- `full_master`: the only node allowed to handle full writes.
- `provisional_master`: a node that already owns ingress traffic but is still write-fenced for high-risk admin/business mutations.
- `standby`: a synced node that does not serve external traffic.
- `recovery`: an old master that lost ingress authority and must not take traffic back until recovery work completes.
- `planned cutover`: an operator-initiated maintenance cutover from the current `full_master` to one eligible standby candidate.
- `standby_candidate`: the only peer role hint that may receive a planned cutover in the current release.
- `observer`: a peer shown in the control plane for visibility only; it never becomes a cutover target in this release.

## Control Plane Boundaries

- The HA control plane is single-surface and active-led.
- The current `full_master` is the only node allowed to initiate `planned cutover`.
- Peer inventory is runtime-configured through `HA_PEER_NODES_JSON`; there is no UI editing path in this release.
- Timeline truth for operator-visible HA actions lives in `ha_control_plane_events` and retains only the last 7 days.

## Current Release Constraints

- Multi-node UI and model support are intentionally ahead of multi-standby orchestration support.
- At most one peer may be marked `standby_candidate`.
- `planned cutover` targets must be recently observed, synced, not stale, not recovering, and currently in `standby`.
- Emergency/manual failover remains available through local `promote` and `finalize`.
