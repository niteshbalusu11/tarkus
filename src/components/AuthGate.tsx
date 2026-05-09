import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { GraduationCap, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { api } from '../../convex/_generated/api'
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
      <section className="w-full max-w-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--amber)]">
          Account setup
        </p>
        <h1 className="mt-3 font-serif text-3xl font-semibold tracking-tight text-[var(--charcoal)]">
          Choose how you will use TARKUS
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          This is part of sign up. Your choice is saved on the backend and
          controls which class tools your account can access.
        </p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="form-label">Display name</span>
            <input
              className="text-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Name or alias"
            />
          </label>

          <fieldset>
            <legend className="form-label">Account type</legend>
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
            <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="primary-action w-full justify-center"
            disabled={isSaving || !displayName.trim()}
            type="submit"
          >
            {isSaving ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </section>
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
          : 'border-[var(--line)] bg-[var(--surface-strong)] text-[var(--charcoal-soft)] hover:border-[var(--line-strong)]'
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
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">
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
      <section className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-[var(--charcoal)]">
          This page is for {requiredRole}s
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Your account is set up as a {actualRole}. TARKUS enforces this in
          Convex, so changing the URL will not bypass it.
        </p>
        <Link className="primary-action mt-5 inline-flex" to={destination}>
          Go to your workspace
        </Link>
      </section>
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
      <section className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-[var(--charcoal)]">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
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
      <section className="w-full max-w-md border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <h1 className="font-serif text-xl font-semibold tracking-tight text-[var(--charcoal)]">
          Convex session is still connecting
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          You are signed in with Clerk, but the backend token has not completed.
          Try a hard refresh. If this persists, sign out and sign in again.
        </p>
      </section>
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
