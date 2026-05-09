import { SignIn, SignedIn, SignedOut } from '@clerk/clerk-react'
import { useConvexAuth } from 'convex/react'
import * as React from 'react'

export default function AuthGate({
  children,
  title = 'Sign in to continue',
}: {
  children: React.ReactNode
  title?: string
}) {
  return (
    <>
      <SignedOut>
        <AuthPanel title={title} />
      </SignedOut>
      <SignedIn>
        <ConvexReady>{children}</ConvexReady>
      </SignedIn>
    </>
  )
}

function ConvexReady({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const [showDiagnostic, setShowDiagnostic] = React.useState(false)

  React.useEffect(() => {
    if (!isLoading) {
      setShowDiagnostic(false)
      return
    }
    const timeout = window.setTimeout(() => setShowDiagnostic(true), 2500)
    return () => window.clearTimeout(timeout)
  }, [isLoading])

  if (isAuthenticated) {
    return children
  }

  if (isLoading && !showDiagnostic) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Connecting secure session...
      </div>
    )
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">
          Convex session is still connecting
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          You are signed in with Clerk, but the backend token has not completed.
          Try a hard refresh. If this persists, sign out and sign in again.
        </p>
      </section>
    </main>
  )
}

function AuthPanel({ title }: { title: string }) {
  const redirectUrl =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use any test email while verification is disabled for the hackathon
          build.
        </p>
        <div className="mt-6">
          <SignIn
            routing="hash"
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
            signUpForceRedirectUrl={redirectUrl}
            signUpFallbackRedirectUrl={redirectUrl}
          />
        </div>
      </section>
    </main>
  )
}
