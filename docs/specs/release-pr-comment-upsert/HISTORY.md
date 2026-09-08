# Release：源 PR 完成评论废止边界演进历史

## Legacy Identity

- Legacy compatibility identity: `#kmmtg`.

## Compatibility

- The former marker-based source-PR completion comment behavior is retired. Existing historical comments are not modified by the release workflow.
- Release callers must use workflow terminal state and summaries as the completion signal, then report the observed result to the owner.
