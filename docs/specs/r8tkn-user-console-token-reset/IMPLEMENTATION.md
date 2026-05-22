# 用户控制台 Token 重置实现状态（#r8tkn）

> 当前有效规范仍以 `./SPEC.md` 为准；这里记录实现覆盖、交付进度与 rollout 相关事实，避免这些细节散落到 PR / Git 历史里。

## Current Status

- Implementation: 已实现（PR #284 收敛中）
- Lifecycle: active
- Catalog note: 用户控制台首页 Token 列表新增用户侧 secret rotate 操作。

## Coverage / rollout summary

- 后端新增用户侧 `POST /api/user/tokens/:id/secret/rotate`，复用既有 Token secret rotate 存储能力，并校验 OAuth 配置、用户 session 与 Token 归属。
- 前端在 Token 列表桌面/移动操作区加入重置按钮、确认对话框与新 Token 结果对话框。
- Storybook mock 覆盖用户侧 reset 成功响应，视觉证据已写入 `SPEC.md`。

## Remaining Gaps

- None

## Related Changes

- PR #284: 用户控制台 Token 重置功能。

## References

- `./SPEC.md`
- `./HISTORY.md`
