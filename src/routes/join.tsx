import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation } from 'convex/react'
import { ArrowRight, KeyRound } from 'lucide-react'

import AuthGate from '../components/AuthGate'
import { api } from '../../convex/_generated/api'
import { resolveJoinDisplayName } from '../lib/auth'

export const Route = createFileRoute('/join')({
  component: JoinRoute,
})

function JoinRoute() {
  return (
    <AuthGate title="Sign in to join a class">
      <JoinClass />
    </AuthGate>
  )
}

function JoinClass() {
  const navigate = useNavigate()
  const { user } = useUser()
  const joinSession = useMutation(api.sessions.joinSessionByCode)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isJoining, setIsJoining] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsJoining(true)
    try {
      const result = await joinSession({
        code,
        displayName: resolveJoinDisplayName(displayName, user),
      })
      await navigate({
        to: '/student/$sessionId',
        params: { sessionId: result.sessionId },
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not join class')
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <KeyRound className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
          Join a live class
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Enter the short code from your trainer. Your chat and assessment
          responses will be visible to the class and trainer.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="form-label">Display name optional</span>
            <input
              className="text-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Name or alias"
            />
          </label>

          <label className="block">
            <span className="form-label">Session code</span>
            <input
              className="text-input font-mono text-2xl uppercase tracking-[0.2em]"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoFocus
            />
          </label>

          {error ? (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="primary-action w-full justify-center"
            disabled={isJoining || code.trim().length < 4}
            type="submit"
          >
            Join class
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </section>
    </main>
  )
}
