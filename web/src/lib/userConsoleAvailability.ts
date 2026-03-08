import type { Profile } from '../api'

export type UserConsoleAvailability = 'unknown' | 'enabled' | 'disabled' | 'logged_out'

export function resolveUserConsoleAvailability(
  profile: Pick<Profile, 'userLoggedIn'> | null | undefined,
): UserConsoleAvailability {
  if (!profile) return 'unknown'
  if (profile.userLoggedIn === false) return 'logged_out'
  if (profile.userLoggedIn === true) return 'enabled'
  return 'disabled'
}
