import { requestJson, type Paginated, type TokenOwnerSummary } from './runtime'

export interface AuthToken {
  id: string
  enabled: boolean
  note: string | null
  group: string | null
  owner?: TokenOwnerSummary | null
  total_requests: number
  created_at: number
  last_used_at: number | null
  quota_state: 'normal' | 'hour' | 'day' | 'month'
  quota_hourly_used: number
  quota_hourly_limit: number
  quota_daily_used: number
  quota_daily_limit: number
  quota_monthly_used: number
  quota_monthly_limit: number
  quota_hourly_reset_at: number | null
  quota_daily_reset_at: number | null
  quota_monthly_reset_at: number | null
}

export type AdminTokenOwnerFilter = 'all' | 'bound' | 'unbound'
export type AdminTokenEnabledFilter = 'all' | 'active' | 'frozen'
export type AdminTokenQuotaStateFilter = 'all' | 'normal' | 'hour' | 'day' | 'month'

export interface AdminTokenListQuery {
  group?: string | null
  noGroup?: boolean
  q?: string | null
  owner?: AdminTokenOwnerFilter
  enabled?: AdminTokenEnabledFilter
  quotaState?: AdminTokenQuotaStateFilter
}

export interface AuthTokenSecret {
  token: string
}

export interface TokenGroup {
  name: string
  tokenCount: number
  latestCreatedAt: number
}

interface BatchTokenMutationResponse {
  updated: number
  missing: string[]
}

async function requestBatchTokenMutation(input: RequestInfo, init: RequestInit): Promise<BatchTokenMutationResponse> {
  const response = await fetch(input, init)
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText)
    throw new Error(message || `Token batch request failed: ${response.status}`)
  }
  return (await response.json()) as BatchTokenMutationResponse
}

export function fetchTokens(
  page = 1,
  perPage = 10,
  options?: AdminTokenListQuery,
  signal?: AbortSignal,
): Promise<Paginated<AuthToken>> {
  const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })
  const group = options?.group?.trim()
  const query = options?.q?.trim()
  if (group) params.set('group', group)
  if (options?.noGroup) params.set('no_group', 'true')
  if (query) params.set('q', query)
  if (options?.owner && options.owner !== 'all') params.set('owner', options.owner)
  if (options?.enabled && options.enabled !== 'all') params.set('enabled', options.enabled)
  if (options?.quotaState && options.quotaState !== 'all') params.set('quota_state', options.quotaState)
  return requestJson(`/api/tokens?${params.toString()}`, { signal })
}

export function createToken(note?: string): Promise<AuthTokenSecret> {
  return requestJson('/api/tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  })
}

export async function deleteToken(id: string): Promise<void> {
  const response = await fetch(`/api/tokens/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(`Failed to delete token: ${response.status}`)
}

export async function setTokenEnabled(id: string, enabled: boolean): Promise<void> {
  const response = await fetch(`/api/tokens/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!response.ok) throw new Error(`Failed to update token status: ${response.status}`)
}

export function setTokensEnabled(ids: string[], enabled: boolean): Promise<BatchTokenMutationResponse> {
  return requestBatchTokenMutation('/api/tokens/batch/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, enabled }),
  })
}

export function fetchTokenSecret(id: string, signal?: AbortSignal): Promise<AuthTokenSecret> {
  return requestJson(`/api/tokens/${encodeURIComponent(id)}/secret`, { signal })
}

export function createTokensBatch(group: string, count: number, note?: string): Promise<{ tokens: string[] }> {
  return requestJson('/api/tokens/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ group, count, note }),
  })
}

export function deleteTokensBatch(ids: string[]): Promise<BatchTokenMutationResponse> {
  return requestBatchTokenMutation('/api/tokens/batch', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
}

export function fetchTokenGroups(signal?: AbortSignal): Promise<TokenGroup[]> {
  return requestJson('/api/tokens/groups', { signal })
}
