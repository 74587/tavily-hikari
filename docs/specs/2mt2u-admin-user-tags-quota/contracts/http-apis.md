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
- Each item extends with:
  - `tags: AdminUserTagCompactView[]`

## GET `/api/users/:id`

- Auth: admin only
- Response extends with:
  - `tags: AdminUserTagBindingView[]`
  - `quotaBase: AdminQuotaView`
  - `effectiveQuota: AdminQuotaView`
  - `quotaBreakdown: AdminUserQuotaBreakdownView[]`

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
