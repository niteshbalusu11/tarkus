import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { GraduationCap, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { api } from '../../convex/_generated/api'
import { Alert, AlertDescription } from './ui/alert'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  ONBOARDING_RETURN_TO_KEY,
  ONBOARDING_ROLE_KEY,
  defaultPathForRole,
  resolvePostOnboardingPath,
} from '../lib/auth'
import type { AccountRole } from '../lib/auth'

export function AccountOnboardingGate({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <SignedOut>{children}</SignedOut>
      <SignedIn>
        <ConvexAccountGate>{children}</ConvexAccountGate>
      </SignedIn>
    </>
  )
}

export default function AuthGate({
  children,
  title = 'Sign in to continue',
  requiredRole,
}: {
  children: React.ReactNode
  title?: string
  requiredRole?: AccountRole
}) {
  return (
    <>
      <SignedOut>
        <AuthPanel requiredRole={requiredRole} title={title} />
      </SignedOut>
      <SignedIn>
        <ConvexReady requiredRole={requiredRole}>{children}</ConvexReady>
      </SignedIn>
    </>
  )
}

function ConvexAccountGate({ children }: { children: React.ReactNode }) {
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
    return <AccountGate>{children}</AccountGate>
  }

  if (isLoading && !showDiagnostic) {
    return <LoadingState label="Connecting secure session..." />
  }

  return <ConvexDiagnostic />
}

function ConvexReady({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: AccountRole
}) {
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
    return <AccountGate requiredRole={requiredRole}>{children}</AccountGate>
  }

  if (isLoading && !showDiagnostic) {
    return <LoadingState label="Connecting secure session..." />
  }

  return <ConvexDiagnostic />
}

function AccountGate({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: AccountRole
}) {
  const currentUser = useQuery(api.users.getCurrentUser)

  if (currentUser === undefined) {
    return <LoadingState label="Loading account..." />
  }

  if (!currentUser.profile) {
    return (
      <OnboardingPanel
        suggestedDisplayName={currentUser.suggestedDisplayName || ''}
      />
    )
  }

  if (requiredRole && currentUser.profile.role !== requiredRole) {
    return (
      <RoleMismatch
        actualRole={currentUser.profile.role}
        requiredRole={requiredRole}
      />
    )
  }

  return children
}

function OnboardingPanel({
  suggestedDisplayName,
}: {
  suggestedDisplayName: string
}) {
  const { user } = useUser()
  const completeOnboarding = useMutation(api.users.completeOnboarding)
  const [displayName, setDisplayName] = React.useState(
    user?.fullName || user?.username || suggestedDisplayName,
  )
  const [role, setRole] = React.useState<AccountRole>(
    () => getStoredOnboardingRole() || 'student',
  )
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  React.useEffect(() => {
    const suggested = user?.fullName || user?.username || suggestedDisplayName
    if (suggested) {
      setDisplayName((current) => current || suggested)
    }
  }, [suggestedDisplayName, user?.fullName, user?.username])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSaving(true)

    try {
      await completeOnboarding({ displayName, role })
      const nextPath = resolvePostOnboardingPath({
        chosenRole: role,
        pendingPath: getStoredOnboardingReturnTo(),
        pendingRole: getStoredOnboardingRole(),
      })
      clearStoredOnboardingIntent()
      window.location.assign(nextPath)
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not save account',
      )
      setIsSaving(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--warm-paper)] px-4 py-10">
      <Card className="w-full max-w-xl border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--amber)]">
            Account setup
          </p>
          <CardTitle className="font-serif text-3xl">
            Choose how you will use TARKUS
          </CardTitle>
          <CardDescription className="leading-6">
            This is part of sign up. Your choice is saved on the backend and
            controls which class tools your account can access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="onboarding-display-name">Display name</Label>
              <Input
                id="onboarding-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Name or alias"
              />
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-[var(--foreground)]">
                Account type
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <RoleOption
                  checked={role === 'student'}
                  description="Join a class with a short code."
                  icon={<GraduationCap className="h-5 w-5" />}
                  label="Student"
                  onChange={() => setRole('student')}
                />
                <RoleOption
                  checked={role === 'teacher'}
                  description="Create sessions and view AI synthesis."
                  icon={<ShieldCheck className="h-5 w-5" />}
                  label="Teacher"
                  onChange={() => setRole('teacher')}
                />
              </div>
            </fieldset>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              className="w-full"
              disabled={isSaving || !displayName.trim()}
              type="submit"
            >
              {isSaving ? 'Saving...' : 'Continue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

function RoleOption({
  checked,
  description,
  icon,
  label,
  onChange,
}: {
  checked: boolean
  description: string
  icon: React.ReactNode
  label: string
  onChange: () => void
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 border p-4 transition ${
        checked
          ? 'border-[var(--amber)] bg-[#f8efd8] text-[var(--charcoal)]'
          : 'border-[var(--line-strong)] bg-[var(--surface-strong)] text-[var(--charcoal)] hover:border-[var(--amber)]'
      }`}
    >
      <input
        checked={checked}
        className="sr-only"
        name="role"
        onChange={onChange}
        type="radio"
      />
      <span className="mt-0.5 text-[var(--amber)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span
          className={`mt-1 block text-xs leading-5 ${
            checked ? 'text-[var(--sepia)]' : 'text-[var(--charcoal-muted)]'
          }`}
        >
          {description}
        </span>
      </span>
    </label>
  )
}

function RoleMismatch({
  actualRole,
  requiredRole,
}: {
  actualRole: AccountRole
  requiredRole: AccountRole
}) {
  const destination = defaultPathForRole(actualRole)
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--warm-paper)] px-4 py-10">
      <Card className="w-full max-w-md border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <CardHeader>
          <CardTitle className="font-serif">
            This page is for {requiredRole}s
          </CardTitle>
          <CardDescription className="leading-6">
            Your account is set up as a {actualRole}. TARKUS enforces this in
            Convex, so changing the URL will not bypass it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={destination}>Go to your workspace</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

function AuthPanel({
  requiredRole,
  title,
}: {
  requiredRole?: AccountRole
  title: string
}) {
  const redirectUrl =
    typeof window === 'undefined'
      ? undefined
      : `${window.location.pathname}${window.location.search}`

  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const returnTo = `${window.location.pathname}${window.location.search}`
    if (returnTo !== '/') {
      window.localStorage.setItem(ONBOARDING_RETURN_TO_KEY, returnTo)
    }
    if (requiredRole) {
      window.localStorage.setItem(ONBOARDING_ROLE_KEY, requiredRole)
    }
  }, [requiredRole])

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--warm-paper)] px-4 py-10">
      <Card className="w-full max-w-md border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <CardHeader>
          <CardTitle className="font-serif">{title}</CardTitle>
          <CardDescription className="leading-6">
            Use any test email while verification is disabled for the hackathon
            build.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignIn
            routing="hash"
            forceRedirectUrl={redirectUrl}
            fallbackRedirectUrl={redirectUrl}
            signUpForceRedirectUrl={redirectUrl}
            signUpFallbackRedirectUrl={redirectUrl}
          />
        </CardContent>
      </Card>
    </main>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-[var(--muted)]">
      {label}
    </div>
  )
}

function ConvexDiagnostic() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--warm-paper)] px-4 py-10">
      <Card className="w-full max-w-md border-[var(--line)] bg-[var(--surface)] shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <CardHeader>
          <CardTitle className="font-serif">
            Convex session is still connecting
          </CardTitle>
          <CardDescription className="leading-6">
            You are signed in with Clerk, but the backend token has not
            completed. Try a hard refresh. If this persists, sign out and sign
            in again.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  )
}

function getStoredOnboardingReturnTo() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(ONBOARDING_RETURN_TO_KEY)
}

function getStoredOnboardingRole(): AccountRole | null {
  if (typeof window === 'undefined') return null

  const role = window.localStorage.getItem(ONBOARDING_ROLE_KEY)
  if (role === 'student' || role === 'teacher') {
    return role
  }
  return null
}

function clearStoredOnboardingIntent() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ONBOARDING_RETURN_TO_KEY)
  window.localStorage.removeItem(ONBOARDING_ROLE_KEY)
}
