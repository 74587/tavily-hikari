import { afterEach, describe, expect, it, mock } from 'bun:test'

import { bindAdminUserTag, fetchAdminUserTags, updateAdminUserQuota } from './api'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('admin user tag api helpers', () => {
  it('unwraps tag catalog list responses', async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [
              {
                id: 'linuxdo_l2',
                name: 'linuxdo_l2',
                displayName: 'L2',
                icon: 'linuxdo',
                systemKey: 'linuxdo_l2',
                effectKind: 'quota_delta',
                hourlyAnyDelta: 0,
                hourlyDelta: 0,
                dailyDelta: 0,
                monthlyDelta: 0,
                userCount: 4,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const tags = await fetchAdminUserTags()

    expect(tags).toHaveLength(1)
    expect(tags[0]).toMatchObject({
      id: 'linuxdo_l2',
      displayName: 'L2',
      systemKey: 'linuxdo_l2',
      effectKind: 'quota_delta',
    })
  })

  it('sends user tag binding requests to the user-scoped endpoint', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 204 })))
    globalThis.fetch = fetchMock as typeof fetch

    await bindAdminUserTag('usr_alice', 'team_lead')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(input).toBe('/api/users/usr_alice/tags')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ tagId: 'team_lead' }))
  })

  it('patches base quota through the existing user quota endpoint', async () => {
    const fetchMock = mock(() => Promise.resolve(new Response(null, { status: 204 })))
    globalThis.fetch = fetchMock as typeof fetch

    await updateAdminUserQuota('usr_alice', {
      hourlyAnyLimit: 1200,
      hourlyLimit: 1000,
      dailyLimit: 24000,
      monthlyLimit: 600000,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [input, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(input).toBe('/api/users/usr_alice/quota')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(
      JSON.stringify({
        hourlyAnyLimit: 1200,
        hourlyLimit: 1000,
        dailyLimit: 24000,
        monthlyLimit: 600000,
      }),
    )
  })
})
