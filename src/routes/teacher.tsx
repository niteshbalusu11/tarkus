import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AlertTriangle,
  Bot,
  CircleDot,
  Clock,
  Copy,
  Flag,
  LayoutDashboard,
  MessageSquareText,
  Pause,
  Play,
  RefreshCw,
  Square,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'

import AuthGate from '../components/AuthGate'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import {
  getAccessibilityPoints,
  getClassRubricSummary,
  getPillarFrequency,
  getSequenceSummary,
  normalizeAnalysisOutput,
  normalizePillarsPayload,
  pillarColors,
} from '../lib/tarkus'
import type {
  ActivitySubmission,
  AnalysisOutput,
  NormalizedAnalysisOutput,
} from '../lib/tarkus'

export const Route = createFileRoute('/teacher')({
  component: TeacherRoute,
})

type TeacherSession = Doc<'sessions'>

function TeacherRoute() {
  return (
    <AuthGate requiredRole="teacher" title="Sign in as teacher">
      <TeacherDashboard />
    </AuthGate>
  )
}

function TeacherDashboard() {
  const sessions = useQuery(api.sessions.listMyTeacherSessions)
  const createSession = useMutation(api.sessions.createSession)
  const startSession = useMutation(api.sessions.startSession)
  const stopSession = useMutation(api.sessions.stopSession)
  const endSession = useMutation(api.sessions.endSession)
  const deleteSession = useMutation(api.sessions.deleteSession)
  const seedDemo = useMutation(api.sessions.seedDemoSession)
  const analyzeSession = useAction(api.sessions.analyzeSession)
  const [selectedSessionId, setSelectedSessionId] =
    useState<Id<'sessions'> | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [endDialogOpen, setEndDialogOpen] = useState(false)

  const activeSessionId = selectedSessionId || sessions?.[0]?._id || null
  const session = useQuery(
    api.sessions.getTeacherSession,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const participants = useQuery(
    api.sessions.listParticipants,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const messages = useQuery(
    api.sessions.listMessages,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const submissions = useQuery(
    api.sessions.listActivitySubmissions,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const latestAnalysis = useQuery(
    api.sessions.getLatestAnalysis,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )

  async function handleCreateSession() {
    setBusyAction('create')
    try {
      const created = await createSession({})
      setSelectedSessionId(created.sessionId)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleSeedAndAnalyze() {
    if (!activeSessionId) return
    setBusyAction('seed')
    try {
      await seedDemo({ sessionId: activeSessionId })
      await analyzeSession({ sessionId: activeSessionId })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleStart() {
    if (!activeSessionId) return
    setBusyAction('start')
    try {
      await startSession({ sessionId: activeSessionId })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleStop() {
    if (!activeSessionId) return
    setBusyAction('stop')
    try {
      await stopSession({ sessionId: activeSessionId })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleEnd() {
    if (!activeSessionId) return
    setBusyAction('end')
    try {
      await endSession({ sessionId: activeSessionId })
      setEndDialogOpen(false)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleAnalyze() {
    if (!activeSessionId) return
    setBusyAction('analyze')
    try {
      await analyzeSession({ sessionId: activeSessionId })
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDelete() {
    if (!activeSessionId) return
    setBusyAction('delete')
    try {
      await deleteSession({ sessionId: activeSessionId })
      setSelectedSessionId(null)
    } finally {
      setBusyAction(null)
    }
  }

  if (sessions === undefined) {
    return <LoadingSurface />
  }

  if (!activeSessionId || !session) {
    return (
      <main className="min-h-[calc(100vh-8rem)] bg-[var(--background)] px-4 py-10">
        <Card className="mx-auto flex min-h-[68vh] max-w-4xl flex-col items-center justify-center border-dashed px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
            Start a live class
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Create one session code for the room. Students authenticate, join
            with the code, chat, and submit the Pillars exercise.
          </p>
          <Button
            className="mt-7"
            disabled={busyAction === 'create'}
            onClick={handleCreateSession}
          >
            <Play className="h-4 w-4" />
            New live session
          </Button>
        </Card>
      </main>
    )
  }

  const analysis = normalizeAnalysisOutput(
    latestAnalysis?.output as AnalysisOutput | undefined,
  )

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[var(--background)] px-4 py-6">
      <section className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {sessions.length > 1 ? (
            <SessionPicker
              sessions={sessions}
              selectedSessionId={activeSessionId}
              onSelect={setSelectedSessionId}
            />
          ) : null}
          <SessionHeader
            code={session.code}
            status={session.status}
            expiresAt={session.expiresAt}
            participantCount={participants?.length || 0}
            submissionCount={submissions?.length || 0}
            busyAction={busyAction}
            onStart={handleStart}
            onStop={handleStop}
            onRequestEnd={() => setEndDialogOpen(true)}
            onAnalyze={handleAnalyze}
            onSeed={handleSeedAndAnalyze}
            onDelete={handleDelete}
          />
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <AiPanel
              analysis={analysis}
              error={latestAnalysis?.error}
              analyzedSubmissionCount={
                latestAnalysis?.inputCursor.submissionCount
              }
              currentSubmissionCount={submissions?.length || 0}
            />
            <PillarsPanel submissions={submissions || []} />
          </div>
        </div>

        <aside className="space-y-4">
          <RosterPanel participants={participants || []} />
          <ChatPanel messages={messages || []} />
        </aside>
      </section>
      <Dialog open={endDialogOpen} onOpenChange={setEndDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End this class?</DialogTitle>
            <DialogDescription>
              Ending a class is final. Students will no longer be able to chat
              or submit work, but the teacher dashboard will keep the class
              available for review until you delete it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={busyAction === 'end'}
              onClick={handleEnd}
            >
              <AlertTriangle className="h-4 w-4" />
              End class
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function LoadingSurface() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--background)] text-sm text-muted-foreground">
      Loading teacher dashboard...
    </main>
  )
}

function getSessionStatusMeta(status: TeacherSession['status']) {
  switch (status) {
    case 'not_started':
      return {
        label: 'Waiting to start',
        description: 'Students can join, but class work is locked.',
        className: 'bg-amber-50 text-amber-800 hover:bg-amber-50',
      }
    case 'active':
      return {
        label: 'Live class',
        description: 'Students can chat and submit work.',
        className: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
      }
    case 'stopped':
      return {
        label: 'Stopped',
        description: 'Students remain joined, but class work is paused.',
        className: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
      }
    case 'ended':
      return {
        label: 'Ended',
        description: 'Class is read-only and available for review.',
        className: 'bg-zinc-100 text-zinc-700 hover:bg-zinc-100',
      }
    default:
      return {
        label: 'Deleted',
        description: 'Class is hidden.',
        className: 'bg-muted text-muted-foreground hover:bg-muted',
      }
  }
}

function SessionPicker({
  sessions,
  selectedSessionId,
  onSelect,
}: {
  sessions: Array<TeacherSession>
  selectedSessionId: Id<'sessions'> | null
  onSelect: (sessionId: Id<'sessions'>) => void
}) {
  return (
    <Card>
      <CardContent className="flex gap-2 overflow-x-auto p-3">
        {sessions.map((session) => {
          const meta = getSessionStatusMeta(session.status)
          const isSelected = session._id === selectedSessionId
          return (
            <button
              key={session._id}
              className={[
                'min-w-56 rounded-lg border px-3 py-2 text-left transition-colors',
                isSelected
                  ? 'border-primary bg-primary/5'
                  : 'border-[var(--line)] bg-background hover:bg-muted/60',
              ].join(' ')}
              type="button"
              onClick={() => onSelect(session._id)}
            >
              <span className="block truncate text-sm font-semibold text-foreground">
                {session.title || 'Pillars class'}
              </span>
              <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tracking-[0.12em]">
                  {session.code}
                </span>
                <span>{meta.label}</span>
              </span>
            </button>
          )
        })}
      </CardContent>
    </Card>
  )
}

function SessionHeader({
  code,
  status,
  expiresAt,
  participantCount,
  submissionCount,
  busyAction,
  onStart,
  onStop,
  onRequestEnd,
  onAnalyze,
  onSeed,
  onDelete,
}: {
  code: string
  status: TeacherSession['status']
  expiresAt: number
  participantCount: number
  submissionCount: number
  busyAction: string | null
  onStart: () => void
  onStop: () => void
  onRequestEnd: () => void
  onAnalyze: () => void
  onSeed: () => void
  onDelete: () => void
}) {
  const expires = new Date(expiresAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
  const statusMeta = getSessionStatusMeta(status)
  const canStart = status === 'not_started' || status === 'stopped'
  const canStop = status === 'active'
  const canEnd = status !== 'ended'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`gap-1.5 ${statusMeta.className}`}>
                <CircleDot className="h-3.5 w-3.5" />
                {statusMeta.label}
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Expires {expires}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Join code
                </p>
                <p className="font-mono text-4xl font-semibold tracking-[0.18em] text-foreground">
                  {code}
                </p>
              </div>
              <Button
                className="mb-1"
                size="icon"
                variant="outline"
                title="Copy join code"
                onClick={() => navigator.clipboard.writeText(code)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {statusMeta.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Stat icon={<Users />} label="joined" value={participantCount} />
            <Stat
              icon={<Sparkles />}
              label="submitted"
              value={submissionCount}
            />
            {canStart ? (
              <Button disabled={busyAction === 'start'} onClick={onStart}>
                <Play className="h-4 w-4" />
                Start
              </Button>
            ) : null}
            {canStop ? (
              <Button
                variant="outline"
                disabled={busyAction === 'stop'}
                onClick={onStop}
              >
                <Pause className="h-4 w-4" />
                Stop
              </Button>
            ) : null}
            {canEnd ? (
              <Button
                variant="destructive"
                disabled={busyAction === 'end'}
                onClick={onRequestEnd}
              >
                <Square className="h-4 w-4" />
                End class
              </Button>
            ) : null}
            <Button
              variant="outline"
              disabled={busyAction === 'seed'}
              onClick={onSeed}
            >
              <Sparkles className="h-4 w-4" />
              Seed demo
            </Button>
            <Button disabled={busyAction === 'analyze'} onClick={onAnalyze}>
              <RefreshCw className="h-4 w-4" />
              Refresh AI
            </Button>
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex min-w-24 items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

function AiPanel({
  analysis,
  error,
  analyzedSubmissionCount,
  currentSubmissionCount,
}: {
  analysis?: NormalizedAnalysisOutput
  error?: string
  analyzedSubmissionCount?: number
  currentSubmissionCount: number
}) {
  const isStale =
    analysis &&
    analyzedSubmissionCount !== undefined &&
    currentSubmissionCount > analyzedSubmissionCount

  return (
    <Card className="border-slate-800 bg-slate-950 text-white">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
            Teacher-only AI
          </p>
          <CardTitle className="mt-1 font-serif text-2xl">
            Class synthesis
          </CardTitle>
        </div>
        <Bot className="h-6 w-6 text-teal-200" />
      </CardHeader>
      <CardContent>
        {error ? (
          <Alert className="mb-4 border-amber-300/20 bg-amber-300/10 text-amber-100">
            <AlertDescription>
              Using local fallback analysis: {error}
            </AlertDescription>
          </Alert>
        ) : null}
        {isStale ? (
          <Alert className="mb-4 border-amber-300/20 bg-amber-300/10 text-amber-100">
            <AlertDescription>
              AI was last refreshed at {analyzedSubmissionCount} submissions.
              Refresh AI to include the newest maps.
            </AlertDescription>
          </Alert>
        ) : null}

        {!analysis ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
            Seed demo data or wait for student activity, then refresh AI for a
            concise class brief.
          </p>
        ) : (
          <div className="space-y-4">
            {analysis.readiness ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
                  Readiness
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <p className="font-serif text-4xl font-semibold text-white">
                    {analysis.readiness.readyCount}/
                    {analysis.readiness.totalCount}
                  </p>
                  <Badge className="mb-1 bg-teal-200 text-slate-950 hover:bg-teal-200">
                    {analysis.readiness.recommendation.replaceAll('_', ' ')}
                  </Badge>
                </div>
              </div>
            ) : null}
            <InsightList title="Teacher brief" items={analysis.teacherBrief} />
            <div className="grid gap-3 md:grid-cols-2">
              <InsightList
                title="Recurring questions"
                items={analysis.recurringQuestions}
              />
              <InsightList
                title="Unclear concepts"
                items={analysis.unclearConcepts}
              />
            </div>
            {analysis.commonErrors.length ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Rubric flags
                </p>
                <div className="mt-3 space-y-2">
                  {analysis.commonErrors.slice(0, 4).map((flag) => (
                    <div
                      key={flag.code}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-slate-200">
                        {flag.code}: {flag.label}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-teal-100">
                        {flag.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {analysis.collectiveBlindSpot ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Collective blind spot
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  {analysis.collectiveBlindSpot}
                </p>
              </div>
            ) : null}
            {analysis.trainerDebriefPrompt ? (
              <div className="rounded-xl border border-amber-200/20 bg-amber-200/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100">
                  Debrief prompt
                </p>
                <p className="mt-2 text-sm leading-6 text-amber-50">
                  {analysis.trainerDebriefPrompt}
                </p>
              </div>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Emotional tone
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {analysis.emotionalTone.label || 'No signal yet'}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {analysis.emotionalTone.explanation ||
                  'More class activity is needed.'}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Chat clusters
              </p>
              <div className="mt-3 space-y-2">
                {analysis.chatClusters.map((cluster) => (
                  <div
                    key={cluster.label}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="text-slate-200">{cluster.label}</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-teal-100">
                      {cluster.count || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InsightList({
  title,
  items,
}: {
  title: string
  items: Array<string>
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {title}
      </p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
          {items.slice(0, 5).map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Waiting for signal.</p>
      )}
    </div>
  )
}

function PillarsPanel({
  submissions,
}: {
  submissions: Array<ActivitySubmission>
}) {
  const frequency = useMemo(
    () => getPillarFrequency(submissions),
    [submissions],
  )
  const points = useMemo(
    () => getAccessibilityPoints(submissions),
    [submissions],
  )
  const sequences = useMemo(
    () => getSequenceSummary(submissions),
    [submissions],
  )
  const rubric = useMemo(
    () => getClassRubricSummary(submissions),
    [submissions],
  )
  const latestResponses = useMemo(
    () =>
      submissions.slice(-5).map((submission) => ({
        id: submission._id,
        name: submission.displayName || 'Student',
        payload: normalizePillarsPayload(submission.payload),
      })),
    [submissions],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber)]">
            Pillars exercise
          </p>
          <CardTitle className="mt-1 font-serif text-2xl">
            Accessibility and first moves
          </CardTitle>
        </div>
        <Badge variant="secondary">{submissions.length} maps</Badge>
      </CardHeader>

      <CardContent>
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--line)] bg-muted/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Ready
            </p>
            <p className="mt-2 font-serif text-3xl font-semibold">
              {rubric.readyCount}/{rubric.totalCount}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-muted/40 p-4 md:col-span-2">
            <div className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-[var(--amber-deep)]" />
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Local rubric
              </p>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {rubric.recommendation.replaceAll('_', ' ')}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {rubric.collectiveBlindSpot}
            </p>
          </div>
        </div>

        <AccessibilitySignal points={points} />

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Most named pillars
            </h3>
            <div className="mt-3 space-y-2">
              {frequency.length ? (
                frequency.slice(0, 6).map((item, index) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor:
                          pillarColors[index % pillarColors.length],
                      }}
                    />
                    <span className="flex-1 text-sm text-foreground">
                      {item.label}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {item.count}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Waiting for submissions.
                </p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Sequence signal
            </h3>
            <div className="mt-3 space-y-2">
              {sequences.length ? (
                sequences.slice(0, 5).map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground"
                  >
                    <span className="font-semibold text-foreground">
                      {item.label}
                    </span>{' '}
                    appears in {item.topThree} top-three sequences.
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No sequence data yet.
                </p>
              )}
            </div>
          </div>
        </div>

        {rubric.commonErrors.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">
              Common rubric flags
            </h3>
            <div className="mt-3 grid gap-2">
              {rubric.commonErrors.slice(0, 4).map((flag) => (
                <div
                  key={flag.code}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2"
                >
                  <span className="text-sm text-foreground">
                    {flag.code}: {flag.label}
                  </span>
                  <span className="text-sm font-semibold">{flag.count}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {latestResponses.length ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold text-foreground">
              Recent structured responses
            </h3>
            <div className="mt-3 space-y-3">
              {latestResponses.map((response) => (
                <div
                  key={response.id}
                  className="rounded-xl border border-[var(--line)] bg-muted/40 p-3"
                >
                  <p className="text-xs font-semibold text-muted-foreground">
                    {response.name}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    Power holder:{' '}
                    <span className="font-semibold">
                      {response.payload.powerHolder || 'Not answered'}
                    </span>
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    First moves
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {response.payload.moves.slice(0, 3).map((move) => (
                      <Badge
                        key={`${response.id}-${move.rank}`}
                        variant="outline"
                      >
                        {move.rank}. {move.pillarName}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AccessibilitySignal({
  points,
}: {
  points: Array<{
    pillar: string
    student: string
    accessibility: number
    rank: number | null
  }>
}) {
  const grouped = [1, 2, 3, 4, 5].map((score) => ({
    score,
    points: points.filter((point) => point.accessibility === score),
  }))

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Accessibility spread
        </h3>
        <span className="text-xs text-muted-foreground">
          1 hard to reach, 5 easy
        </span>
      </div>
      <div className="grid gap-2">
        {grouped.map((group, index) => (
          <div key={group.score} className="grid grid-cols-[24px_1fr] gap-3">
            <span className="text-sm font-semibold text-muted-foreground">
              {group.score}
            </span>
            <div className="min-h-8 rounded-lg bg-muted/50 p-1.5">
              <div className="flex flex-wrap gap-1.5">
                {group.points.length ? (
                  group.points.map((point, pointIndex) => (
                    <span
                      key={`${point.student}-${point.pillar}-${pointIndex}`}
                      title={`${point.student}: ${point.pillar}`}
                      className="rounded-full px-2 py-1 text-xs font-semibold text-white"
                      style={{
                        backgroundColor:
                          pillarColors[
                            (index + pointIndex) % pillarColors.length
                          ],
                      }}
                    >
                      {point.rank ? `${point.rank}. ` : ''}
                      {point.pillar}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RosterPanel({
  participants,
}: {
  participants: Array<{ _id: string; displayName?: string }>
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Roster</CardTitle>
        <span className="text-xs text-muted-foreground">
          {participants.length} joined
        </span>
      </CardHeader>
      <CardContent className="space-y-2">
        {participants.length ? (
          participants.map((participant) => (
            <div key={participant._id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-foreground">
                {participant.displayName || 'Student'}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Waiting for students.</p>
        )}
      </CardContent>
    </Card>
  )
}

function ChatPanel({
  messages,
}: {
  messages: Array<{
    _id: string
    authorRole: 'teacher' | 'student'
    displayName?: string
    body: string
    createdAt: number
  }>
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Live chat</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="max-h-[560px] space-y-3 overflow-y-auto pr-4">
        {messages.length ? (
          messages.slice(-80).map((message) => (
            <div key={message._id} className="rounded-lg bg-muted/60 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {message.displayName || message.authorRole}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm leading-5 text-foreground">
                {message.body}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
