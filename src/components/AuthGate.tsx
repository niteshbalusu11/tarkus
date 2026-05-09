import { SignIn, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { Link } from '@tanstack/react-router'
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import * as React from 'react'
import { GraduationCap, ShieldCheck } from 'lucide-react'

import { api } from '../../convex/_generated/api'

export default function AuthGate({
  children,
  title = 'Sign in to continue',
  requiredRole,
}: {
  children: React.ReactNode
  title?: string
  requiredRole?: 'student' | 'teacher'
}) {
  return (
    <>
      <SignedOut>
        <AuthPanel title={title} />
      </SignedOut>
      <SignedIn>
        <ConvexReady requiredRole={requiredRole}>{children}</ConvexReady>
      </SignedIn>
    </>
  )
}

function ConvexReady({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: 'student' | 'teacher'
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

function AccountGate({
  children,
  requiredRole,
}: {
  children: React.ReactNode
  requiredRole?: 'student' | 'teacher'
}) {
  const currentUser = useQuery(api.users.getCurrentUser)

  if (currentUser === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading account...
      </div>
    )
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
  const [role, setRole] = React.useState<'student' | 'teacher'>('student')
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
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Could not save account',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Account setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Set up your TARKUS account
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your role controls what the backend allows. Students can join classes;
          teachers can create and manage live sessions.
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
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="primary-action w-full justify-center"
            disabled={isSaving || !displayName.trim()}
            type="submit"
          >
            Save account
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
      className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition ${
        checked
          ? 'border-teal-500 bg-teal-50 text-slate-950'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
      }`}
    >
      <input
        checked={checked}
        className="sr-only"
        name="role"
        onChange={onChange}
        type="radio"
      />
      <span className="mt-0.5 text-teal-700">{icon}</span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-slate-500">
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
  actualRole: 'student' | 'teacher'
  requiredRole: 'student' | 'teacher'
}) {
  const destination = actualRole === 'teacher' ? '/teacher' : '/join'
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <h1 className="text-xl font-semibold tracking-tight text-slate-950">
          This page is for {requiredRole}s
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
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
