export type ClerkJoinProfile = {
  fullName?: string | null
  username?: string | null
}

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
