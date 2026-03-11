# HTTP APIs

## GET `/api/user-tags`

- Auth: admin only
- Response `200`
  - `items: AdminUserTagView[]`

## POST `/api/user-tags`

- Auth: admin only
- Body
  - `name: string`
  - `displayName: string`
  - `icon?: string | null`
  - `effectKind: 'quota_delta' | 'block_all'`
  - `hourlyAnyDelta: number`
  - `hourlyDelta: number`
  - `dailyDelta: number`
  - `monthlyDelta: number`
- Notes
  - 仅允许创建 custom tag。

## PATCH `/api/user-tags/:tagId`

- Auth: admin only
- Body 与创建接口相同，但仅允许更新 custom tag 的展示与额度效果；system tag 仅允许更新 effect 与 delta，不允许修改 `name/displayName/icon/systemKey`。

## DELETE `/api/user-tags/:tagId`

- Auth: admin only
- Response
  - `204` when deleted
  - `400` when the tag is system-defined

## POST `/api/users/:id/tags`

- Auth: admin only
- Body
  - `tagId: string`
- Notes
  - 仅允许手工绑定 custom tag；system tag 绑定由系统同步维护。

## DELETE `/api/users/:id/tags/:tagId`

- Auth: admin only
- Response
  - `204` when unbound
  - `400` when the binding is system-managed

## GET `/api/users`

- Auth: admin only
- Existing response remains paginated.
- Supports optional `tagId` for exact tag-bound user filtering (used by the tag catalog jump-to-users action).
- When `q` and `tagId` are both present, the server applies them conjunctively: fuzzy user search stays scoped to the exact tag-bound subset.
- Each item extends with:
  - `tags: AdminUserTagCompactView[]`

## GET `/api/users/:id`

- Auth: admin only
- Response extends with:
  - `tags: AdminUserTagBindingView[]`
  - `quotaBase: AdminQuotaView`
  - `effectiveQuota: AdminQuotaView`
  - `quotaBreakdown: AdminUserQuotaBreakdownView[]`
- Notes
  - 自动同步的 LinuxDo 系统标签会像其他 tag 一样出现在 `tags` 与 `quotaBreakdown` 中，并把默认 delta 叠加到 `effectiveQuota`。
  - `quotaBreakdown` 始终包含一条最终 `effective` 行，反映经过 `max(0, value)` 钳制后的最终有效额度。

## PATCH `/api/users/:id/quota`

- Auth: admin only
- Path unchanged.
- Body shape unchanged:
  - `hourlyAnyLimit: number`
  - `hourlyLimit: number`
  - `dailyLimit: number`
  - `monthlyLimit: number`
- Semantics changed:
  - Writes user base quota only.
  - If payload equals current env defaults, server may set `inherits_defaults=1`; otherwise `inherits_defaults=0`.
