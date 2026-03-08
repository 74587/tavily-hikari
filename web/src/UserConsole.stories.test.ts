import { describe, expect, it } from 'bun:test'

import meta, * as userConsoleStories from './UserConsole.stories'

describe('UserConsole Storybook acceptance controls', () => {
  it('exposes only acceptance-facing controls', () => {
    expect(meta.args).toEqual({
      consoleView: 'Dashboard',
      tokenListState: 'Default List',
      tokenDetailPreview: 'Overview',
    })

    expect(meta.argTypes).not.toHaveProperty('scenario')

    expect(meta.argTypes?.consoleView).toMatchObject({
      name: 'Console view',
      options: ['Dashboard', 'Tokens', 'Token Detail'],
      control: { type: 'inline-radio' },
    })

    expect(meta.argTypes?.tokenListState).toMatchObject({
      name: 'Token list state',
      options: ['Default List', 'Empty'],
      control: { type: 'inline-radio' },
      if: { arg: 'consoleView', eq: 'Tokens' },
    })

    expect(meta.argTypes?.tokenDetailPreview).toMatchObject({
      name: 'Token detail preview',
      options: [
        'Overview',
        'API Check Running',
        'All Checks Pass',
        'Partial Availability',
        'Authentication Failed',
        'Quota Blocked',
      ],
      control: { type: 'select' },
      if: { arg: 'consoleView', eq: 'Token Detail' },
    })
  })

  it('keeps business-readable preset stories and drops legacy scenario exports', () => {
    expect(userConsoleStories.Dashboard.args).toMatchObject({ consoleView: 'Dashboard' })
    expect(userConsoleStories.Tokens.args).toMatchObject({
      consoleView: 'Tokens',
      tokenListState: 'Default List',
    })
    expect(userConsoleStories.TokensEmpty).toMatchObject({
      name: 'Tokens Empty',
      args: { consoleView: 'Tokens', tokenListState: 'Empty' },
    })
    expect(userConsoleStories.TokenDetailOverview).toMatchObject({
      name: 'Token Detail Overview',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'Overview' },
    })
    expect(userConsoleStories.ApiCheckRunning).toMatchObject({
      name: 'API Check Running',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'API Check Running' },
    })
    expect(userConsoleStories.AllChecksPass).toMatchObject({
      name: 'All Checks Pass',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'All Checks Pass' },
    })
    expect(userConsoleStories.PartialAvailability).toMatchObject({
      name: 'Partial Availability',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'Partial Availability' },
    })
    expect(userConsoleStories.AuthenticationFailed).toMatchObject({
      name: 'Authentication Failed',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'Authentication Failed' },
    })
    expect(userConsoleStories.QuotaBlocked).toMatchObject({
      name: 'Quota Blocked',
      args: { consoleView: 'Token Detail', tokenDetailPreview: 'Quota Blocked' },
    })

    expect(userConsoleStories).not.toHaveProperty('Scenario')
    expect(userConsoleStories).not.toHaveProperty('TokenDetailProbeSuccess')
    expect(userConsoleStories).not.toHaveProperty('TokenDetailProbeRunning')
    expect(userConsoleStories).not.toHaveProperty('TokenDetailProbePartialFail')
    expect(userConsoleStories).not.toHaveProperty('TokenDetailProbeAuthFail')
    expect(userConsoleStories).not.toHaveProperty('TokenDetailProbeQuotaBlocked')
  })
})
