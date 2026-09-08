# Release：源 PR 完成评论废止边界

## Context and Scope

Release workflow 需要解析合并提交对应的 PR，以读取发布 intent/channel labels 并在摘要中保留发布上下文；这不意味着发布完成后应继续写入源 PR。源 PR 完成评论会增加额外权限、评论幂等与失败分支，当前 release policy 明确要求由 workflow 结果/摘要提供完成信号，并由调用方等待 release 终态后向 owner 报告。

## Goals

- 禁止 release workflow 在发布完成后向源 PR 创建、更新或查询完成评论。
- 保留 release preparation、labels、版本/tag、GitHub Release、镜像、release assets 与失败通知语义。
- 让 owner-facing release flow 以 workflow 终态和摘要作为完成结果来源。

## Non-goals

- 不修改 release intent/channel label taxonomy、版本计算、tag 生成或 rerun 幂等性。
- 不修改 GitHub Release 正文、GHCR manifest、binary/CLI asset 发布或失败通知。
- 不删除历史 PR 中已经存在的评论，也不补发新的历史评论。

## Scope

### In scope

- `.github/workflows/release.yml`
- `tests/test_release_workflow.py`
- `README.md`
- `README.zh-CN.md`
- 直接引用源 PR 完成评论语义的 release 文档

### Out of scope

- Rust/Web 业务代码
- 数据库、部署脚本与 101 rollout 流程
- 与 release completion comment 无关的 workflow、评论或运营通知

## Requirements

- `REQ-001`: `.github/workflows/release.yml` MUST NOT contain a release-completion comment helper, marker, or GitHub comment list/update/create call for the source PR.
- `REQ-002`: The `github-release` job MUST request only the permissions required to publish the GitHub Release and assets; it MUST NOT request `issues: write` or `pull-requests: write` for completion reporting.
- `REQ-003`: The `prepare` job MUST continue resolving the source PR and its intent/channel labels, and MUST preserve the PR context in the release summary.
- `REQ-004`: The workflow MUST preserve tag preparation, GitHub Release publication, GHCR image publication, native/portable binary assets, CLI assets, and release failure notification behavior.
- `REQ-005`: Release completion MUST be observable through the workflow result and step summary so an owner-side flow can wait for the release terminal state and report it to the owner.
- `REQ-006`: The workflow contract test MUST cover both the absence of source-PR completion comment behavior and the preserved publication/preparation boundaries.

## Acceptance Criteria

- Given a stable or rc release reaches `github-release`
  When the job completes
  Then the workflow MUST NOT query, create, or update comments on the source PR.
- Given a release intent resolves to exactly one PR
  When `prepare` runs
  Then label-based release preparation and the PR context in the step summary MUST remain available.
- Given release publication runs
  When GitHub Release, image, or binary/CLI assets are produced
  Then their existing publication steps MUST remain present and usable.
- Given release execution fails
  When the notifier workflow receives the failed run
  Then the existing failure notification path MUST remain unchanged.

## Verification

- `VER-001` covers: `REQ-001`, `REQ-002`, and `REQ-006`: run
  `python3 -m unittest tests/test_release_workflow.py` to verify the source-PR comment boundary,
  reduced permissions, and preserved publication steps.
- `VER-002` covers: `REQ-003`, `REQ-004`, and `REQ-005`: run `actionlint .github/workflows/release.yml` and inspect the prepare summary, publication jobs, and failure
  notification trigger.
- `VER-003` covers: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, and `REQ-005`: run `git diff --check` and the documentation formatter check listed below.
- `VER-004` covers: `REQ-006`: run the Spec contract check and Spec drift check against the current
  base and the frozen ADR relationship.

Formatting check:

`bunx --bun dprint check README.md README.zh-CN.md docs/specs/README.md docs/specs/release-pr-comment-upsert/SPEC.md docs/specs/release-pr-comment-upsert/IMPLEMENTATION.md docs/specs/release-pr-comment-upsert/HISTORY.md docs/specs/release-amd64-smoke-hardening/SPEC.md docs/specs/post-merge-release-unblock/SPEC.md docs/specs/post-merge-release-unblock/HISTORY.md docs/specs/release-binary-assets/IMPLEMENTATION.md`

## Related ADRs

None
