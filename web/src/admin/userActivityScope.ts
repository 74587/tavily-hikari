export type AdminUserActivityScope = 'all' | 'active90d'

interface AdminUserActivityScopeSettingsLike {
  adminDefaultActiveUsersOnly?: boolean | null
}

export function resolveAdminUserActivityScope(
  query: string,
  adminDefaultActiveUsersOnly: boolean | null | undefined,
): AdminUserActivityScope {
  if (query.trim().length > 0) return 'all'
  return adminDefaultActiveUsersOnly ? 'active90d' : 'all'
}

export function resolveAdminUserActivityScopeFromSettings(
  query: string,
  primarySettings: AdminUserActivityScopeSettingsLike | null | undefined,
  fallbackSettings?: AdminUserActivityScopeSettingsLike | null,
): AdminUserActivityScope {
  return resolveAdminUserActivityScope(
    query,
    primarySettings?.adminDefaultActiveUsersOnly ?? fallbackSettings?.adminDefaultActiveUsersOnly,
  )
}
