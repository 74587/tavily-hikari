# Implementation

- Backend:
  - `SystemSettings` 新增 `admin_default_active_users_only` 持久化字段。
  - `/api/settings` 聚合响应新增只读 `admin_user_list_stats`。
  - `/api/users` 新增 `activity_scope` 查询参数，并在默认分页、排序分页、排序回退查询路径统一接入活跃过滤。
  - 活跃统计与过滤统一使用 `auth_token_logs.request_user_id + result_status='success' + created_at >= now - 90 days`。
- Frontend:
  - 系统设置页新增活跃用户默认展示开关、活跃/总用户统计与说明文案。
  - 用户列表与用户用量页空搜索时遵守系统设置；非空搜索时强制切回全量集合。
  - 状态提示、i18n、Storybook 状态、渲染测试与交互测试已补齐。
  - 用户用量页进一步压缩为页面级标题左侧、搜索右置的紧凑头部，移除返回按钮，并在窄视口下将搜索下移到标题说明下方整行，同时保留默认活跃过滤提示。
- Storybook:
  - `Admin/SystemSettingsModule` 增加活跃过滤开启状态。
  - `Admin/Pages` 增加 Users / UsersUsage 的默认活跃过滤与搜索扩全量证明故事。

## Status

- 当前实现与视觉证据已完成，处于 fast-track `PR ready` 收口阶段。
- 仍待完成：
  - 整理本地提交并在获得主人批准后推送包含视觉证据的分支 / PR。

## Validation

- `cargo test --no-run`
- `cd web && bun run build`
- `cd web && bun test src/admin/userActivityScope.test.ts src/admin/SystemSettingsModule.render.test.ts src/admin/SystemSettingsModule.interaction.test.tsx src/admin/AdminPages.stories.test.ts src/api.test.ts`
- `cargo test -- --list | rg "admin_system_settings_put_preserves_request_rate_limit_when_legacy_payload_omits_it|admin_user_management_lists_details_and_updates_quota"`
