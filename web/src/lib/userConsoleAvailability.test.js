import { describe, expect, it } from 'bun:test'

import { resolveUserConsoleAvailability } from './userConsoleAvailability'

describe('resolveUserConsoleAvailability', () => {
  it('stays unknown before the profile loads', () => {
    expect(resolveUserConsoleAvailability(undefined)).toBe('unknown')
    expect(resolveUserConsoleAvailability(null)).toBe('unknown')
  })

  it('marks logged-out sessions separately from disabled console access', () => {
    expect(resolveUserConsoleAvailability({ userLoggedIn: false })).toBe('logged_out')
    expect(resolveUserConsoleAvailability({})).toBe('disabled')
  })

  it('treats logged-in sessions as enabled', () => {
    expect(resolveUserConsoleAvailability({ userLoggedIn: true })).toBe('enabled')
  })
})
