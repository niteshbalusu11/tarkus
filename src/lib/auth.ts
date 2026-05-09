export type ClerkJoinProfile = {
  fullName?: string | null
  username?: string | null
}

export type AccountRole = 'student' | 'teacher'

export const ONBOARDING_RETURN_TO_KEY = 'tarkus:onboarding:returnTo'
export const ONBOARDING_ROLE_KEY = 'tarkus:onboarding:role'

export function resolveJoinDisplayName(
  enteredDisplayName: string,
  profile?: ClerkJoinProfile | null,
) {
  const entered = enteredDisplayName.trim()
  if (entered) return entered

  const fullName = profile?.fullName?.trim()
  if (fullName) return fullName

  const username = profile?.username?.trim()
  if (username) return username

  return undefined
}

export function defaultPathForRole(role: AccountRole) {
  return role === 'teacher' ? '/teacher' : '/join'
}

export function requiredRoleForPath(path: string): AccountRole | null {
  if (path === '/teacher' || path.startsWith('/teacher?')) {
    return 'teacher'
  }
  if (
    path === '/join' ||
    path.startsWith('/join?') ||
    path.startsWith('/student/')
  ) {
    return 'student'
  }
  return null
}

export function resolvePostOnboardingPath({
  chosenRole,
  pendingPath,
  pendingRole,
}: {
  chosenRole: AccountRole
  pendingPath?: string | null
  pendingRole?: AccountRole | string | null
}) {
  if (pendingPath && (!pendingRole || pendingRole === chosenRole)) {
    return pendingPath
  }

  return defaultPathForRole(chosenRole)
}
