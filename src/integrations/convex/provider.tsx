import { useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react'
import { useCallback, useMemo } from 'react'

const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL
if (!CONVEX_URL) {
  console.error('missing envar CONVEX_URL')
}
const convex = new ConvexReactClient(CONVEX_URL)

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { isLoaded, isSignedIn, getToken, sessionId } = useAuth()

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      try {
        return await getToken({ skipCache: forceRefreshToken })
      } catch {
        return null
      }
    },
    [getToken, sessionId],
  )

  const auth = useMemo(
    () => ({
      isLoading: !isLoaded,
      isAuthenticated: isSignedIn ?? false,
      fetchAccessToken,
    }),
    [fetchAccessToken, isLoaded, isSignedIn],
  )

  return (
    <ConvexProviderWithAuth client={convex} useAuth={() => auth}>
      {children}
    </ConvexProviderWithAuth>
  )
}
