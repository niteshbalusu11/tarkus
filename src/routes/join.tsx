import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useUser } from '@clerk/clerk-react'
import { useMutation } from 'convex/react'
import { ArrowRight, KeyRound } from 'lucide-react'

import AuthGate from '../components/AuthGate'
import { api } from '../../convex/_generated/api'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { resolveJoinDisplayName } from '../lib/auth'

export const Route = createFileRoute('/join')({
  component: JoinRoute,
})

function JoinRoute() {
  return (
    <AuthGate requiredRole="student" title="Sign in to join a class">
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
      setError(
        caught instanceof Error ? caught.message : 'Could not join class',
      )
    } finally {
      setIsJoining(false)
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--background)] px-4 py-10">
      <Card className="w-full max-w-lg border-[var(--line)] bg-[var(--surface-strong)] shadow-[0_18px_50px_rgba(28,28,28,0.08)]">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--amber-deep)]">
            <KeyRound className="h-5 w-5" />
          </div>
          <CardTitle className="font-serif text-3xl">
            Join a live class
          </CardTitle>
          <CardDescription className="leading-6">
            Enter the short code from your trainer. Your chat and assessment
            responses will be visible to the class and trainer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="join-display-name">Display name optional</Label>
              <Input
                id="join-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Name or alias"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="join-session-code">Session code</Label>
              <Input
                id="join-session-code"
                className="h-14 font-mono text-2xl uppercase tracking-[0.2em]"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
                autoFocus
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button
              className="w-full"
              disabled={isJoining || code.trim().length < 4}
              type="submit"
            >
              Join class
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
