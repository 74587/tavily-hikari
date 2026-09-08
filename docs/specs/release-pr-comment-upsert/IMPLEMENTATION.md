# Release：源 PR 完成评论废止边界实现状态

## Status

- Status: 已完成

## Implementation coverage

- Removed the release-completion comment helper and all source-PR comment API calls from `.github/workflows/release.yml`.
- Reduced `github-release` permissions to `contents: write`, which is sufficient for GitHub Release and asset publication.
- Preserved release intent resolution, PR context in the prepare summary, tag creation, GHCR publication, GitHub Release publication, binary/CLI assets, and failure notifications.
- Added `tests/test_release_workflow.py` to enforce the negative comment boundary and preserved release contracts.
- Updated current README and release topic references so they describe workflow-result/summary completion reporting.

## Verification coverage

- Workflow contract unit test covers absence of the comment helper/API calls and the retained publication steps.
- Workflow syntax and documentation formatting checks are listed in `SPEC.md`.
