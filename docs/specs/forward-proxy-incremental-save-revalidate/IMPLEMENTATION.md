# Forward Proxy 增量订阅保存与全量验证拆分 实现状态

## Current Coverage

- Incremental subscription save, source-aware node replacement, page-level full revalidation,
  progress reporting, and the related regression coverage are implemented.
- The admin UI exposes revalidation separately from ordinary settings persistence so unchanged
  subscriptions and nodes are not reprobed during routine saves.

## Remaining Gaps

- None recorded for this topic.
