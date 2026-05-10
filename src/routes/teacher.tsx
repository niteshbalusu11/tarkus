import { useMemo, useState } from 'react'
import {
  Outlet,
  createFileRoute,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  AlertTriangle,
  BookOpenText,
  Bot,
  CircleDot,
  Clock,
  Copy,
  GraduationCap,
  Flag,
  LayoutDashboard,
  MessageSquareText,
  MonitorPlay,
  Pause,
  PanelRightOpen,
  Play,
  RefreshCw,
  Square,
  Sparkles,
  TrendingUp,
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
type IntakePayload = {
  ageRange?: string
  country?: string
  priorTraining?: string
  violenceEffective?: number
  weaponsMoneyPower?: number
  peoplePower?: number
}

function TeacherRoute() {
  const location = useLocation()
  return (
    <AuthGate requiredRole="teacher" title="Sign in as teacher">
      {location.pathname === '/teacher' ? <TeacherDashboard /> : <Outlet />}
    </AuthGate>
  )
}

function TeacherDashboard() {
  const sessions = useQuery(api.sessions.listMyTeacherSessions)
  const navigate = useNavigate()
  const createSession = useMutation(api.sessions.createSession)
  const createPrepWorkspace = useMutation(api.prep.createWorkspace)
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
  const [aiInsightsOpen, setAiInsightsOpen] = useState(false)

  const sessionIdFromUrl =
    typeof window === 'undefined'
      ? null
      : (new URLSearchParams(window.location.search).get(
          'sessionId',
        ) as Id<'sessions'> | null)
  const urlSessionId =
    sessionIdFromUrl && sessions?.some((item) => item._id === sessionIdFromUrl)
      ? sessionIdFromUrl
      : null
  const activeSessionId =
    selectedSessionId || urlSessionId || sessions?.[0]?._id || null
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
  const intakeSubmissions = useQuery(
    api.sessions.listIntakeSubmissions,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const latestAnalysis = useQuery(
    api.sessions.getLatestAnalysis,
    activeSessionId ? { sessionId: activeSessionId } : 'skip',
  )
  const publishedPresentation = useQuery(
    api.prep.getPublishedPresentationForTeacherSession,
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
    setAiInsightsOpen(true)
    try {
      await seedDemo({ sessionId: activeSessionId })
      await analyzeSession({ sessionId: activeSessionId })
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePrepClass() {
    if (!activeSessionId) return
    setBusyAction('prep')
    try {
      await createPrepWorkspace({ sessionId: activeSessionId })
      await navigate({
        to: '/teacher/session/$sessionId/prep',
        params: { sessionId: activeSessionId },
      })
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
    setAiInsightsOpen(true)
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
        <section className="mx-auto w-full max-w-7xl space-y-5">
          <TeacherHubHeader
            busyAction={busyAction}
            sessionCount={sessions.length}
            onCreate={handleCreateSession}
          />
          <Card className="flex min-h-[58vh] flex-col items-center justify-center border-dashed px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <h1 className="mt-6 font-serif text-3xl font-semibold tracking-tight text-foreground">
              Create a class
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
              One class holds both prep and live mode. Build the curriculum
              first, then start the room when students are ready to join.
            </p>
            <Button
              className="mt-7"
              disabled={busyAction === 'create'}
              onClick={handleCreateSession}
            >
              <Play className="h-4 w-4" />
              New class
            </Button>
          </Card>
        </section>
      </main>
    )
  }

  const analysis = normalizeAnalysisOutput(
    latestAnalysis?.output as AnalysisOutput | undefined,
  )

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[var(--background)] px-4 py-5 md:px-6">
      <section className="mx-auto w-full max-w-[1540px] space-y-5">
        <TeacherHubHeader
          busyAction={busyAction}
          sessionCount={sessions.length}
          onCreate={handleCreateSession}
        />
        <div className="grid items-start gap-5 xl:grid-cols-[270px_minmax(0,1fr)]">
          <SessionPicker
            sessions={sessions}
            selectedSessionId={activeSessionId}
            onSelect={setSelectedSessionId}
          />
          <div className="min-w-0 space-y-5">
            <SessionHeader
              title={session.title || 'Pillars of Support Live Session'}
              code={session.code}
              status={session.status}
              expiresAt={session.expiresAt}
              participantCount={participants?.length || 0}
              submissionCount={submissions?.length || 0}
              busyAction={busyAction}
              onStart={handleStart}
              onStop={handleStop}
              onRequestEnd={() => setEndDialogOpen(true)}
              onSeed={handleSeedAndAnalyze}
              onDelete={handleDelete}
              onPrep={handlePrepClass}
              viewSlidesHref={
                publishedPresentation
                  ? `/presentation/${publishedPresentation._id}/view`
                  : undefined
              }
            />
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-5">
                <AiSummaryBar
                  analysis={analysis}
                  error={latestAnalysis?.error}
                  analyzedSubmissionCount={
                    latestAnalysis?.inputCursor.submissionCount
                  }
                  currentSubmissionCount={submissions?.length || 0}
                  isRefreshing={
                    busyAction === 'analyze' || busyAction === 'seed'
                  }
                  onOpenInsights={() => setAiInsightsOpen(true)}
                  onRefresh={handleAnalyze}
                />
                <IntakeSummaryWidget submissions={intakeSubmissions || []} />
                <PillarsPanel submissions={submissions || []} />
              </div>
              <LiveSidePanel
                participants={participants || []}
                messages={messages || []}
              />
            </div>
          </div>
        </div>
      </section>
      <AiInsightsDrawer
        analysis={analysis}
        error={latestAnalysis?.error}
        analyzedSubmissionCount={latestAnalysis?.inputCursor.submissionCount}
        currentSubmissionCount={submissions?.length || 0}
        isOpen={aiInsightsOpen}
        isRefreshing={busyAction === 'analyze' || busyAction === 'seed'}
        onOpenChange={setAiInsightsOpen}
        onRefresh={handleAnalyze}
      />
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

function TeacherHubHeader({
  busyAction,
  sessionCount,
  onCreate,
}: {
  busyAction: string | null
  sessionCount: number
  onCreate: () => void
}) {
  return (
    <div className="border-b border-[var(--line)] pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--charcoal)] text-white shadow-[0_12px_30px_rgba(28,28,28,0.16)]">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber-deep)]">
              Teacher dashboard
            </p>
            <h1 className="font-serif text-3xl leading-tight text-[var(--charcoal)]">
              Classes
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--charcoal-soft)]">
              Create a class once, prep it, then start live mode from the same
              selected class.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="h-9 px-3">
            {sessionCount} {sessionCount === 1 ? 'class' : 'classes'}
          </Badge>
          <Button disabled={busyAction === 'create'} onClick={onCreate}>
            <Play className="h-4 w-4" />
            New class
          </Button>
        </div>
      </div>
    </div>
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
    <aside className="sticky top-24 h-fit rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.72)] p-3">
      <div className="mb-3 flex items-center gap-2 px-1">
        <LayoutDashboard className="h-4 w-4 text-[var(--amber-deep)]" />
        <h2 className="text-sm font-bold text-[var(--charcoal)]">Class list</h2>
      </div>
      <div className="space-y-2">
        {sessions.map((session) => {
          const meta = getSessionStatusMeta(session.status)
          const isSelected = session._id === selectedSessionId
          return (
            <button
              key={session._id}
              className={[
                'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                isSelected
                  ? 'border-[var(--charcoal)] bg-[#fffdf8] shadow-[0_10px_24px_rgba(28,28,28,0.06)]'
                  : 'border-transparent bg-transparent hover:border-[var(--line)] hover:bg-[#fffdf8]',
              ].join(' ')}
              type="button"
              onClick={() => onSelect(session._id)}
            >
              <span className="block truncate text-sm font-semibold text-foreground">
                {session.title || 'Pillars class'}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tracking-[0.12em]">
                  {session.code}
                </span>
                <span>{meta.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function SessionHeader({
  title,
  code,
  status,
  expiresAt,
  participantCount,
  submissionCount,
  busyAction,
  onStart,
  onStop,
  onRequestEnd,
  onSeed,
  onDelete,
  onPrep,
  viewSlidesHref,
}: {
  title: string
  code: string
  status: TeacherSession['status']
  expiresAt: number
  participantCount: number
  submissionCount: number
  busyAction: string | null
  onStart: () => void
  onStop: () => void
  onRequestEnd: () => void
  onSeed: () => void
  onDelete: () => void
  onPrep: () => void
  viewSlidesHref?: string
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
    <section className="overflow-hidden rounded-3xl border border-[var(--line)] bg-[#fffdf8] shadow-[0_20px_60px_rgba(28,28,28,0.06)]">
      <div className="grid lg:grid-cols-[minmax(320px,0.92fr)_minmax(420px,1fr)]">
        <div className="border-b border-[var(--line)] p-5 lg:border-b-0 lg:border-r">
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
            <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight text-[var(--charcoal)]">
              {title}
            </h2>
            <div className="mt-5 rounded-2xl bg-[var(--charcoal)] p-4 text-white">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-pale)]">
                    Join code
                  </p>
                  <p className="font-mono text-4xl font-semibold tracking-[0.18em] text-white">
                    {code}
                  </p>
                </div>
                <Button
                  className="mb-1 border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  size="icon"
                  variant="outline"
                  title="Copy join code"
                  onClick={() => navigator.clipboard.writeText(code)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {statusMeta.description} Use prep for curriculum and slides, then
              run the live room here.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat icon={<Users />} label="joined" value={participantCount} />
            <Stat
              icon={<Sparkles />}
              label="submitted"
              value={submissionCount}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={busyAction === 'prep'}
              onClick={onPrep}
            >
              <BookOpenText className="h-4 w-4" />
              Open prep
            </Button>
            {viewSlidesHref ? (
              <Button asChild variant="outline">
                <a href={viewSlidesHref} rel="noreferrer" target="_blank">
                  <MonitorPlay className="h-4 w-4" />
                  View slides
                </a>
              </Button>
            ) : null}
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
            <Button variant="destructive" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
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
    <div className="flex min-w-24 items-center gap-2 rounded-2xl bg-[var(--paper-warm)] px-4 py-3 text-muted-foreground">
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="text-lg font-semibold text-foreground">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

function AiSummaryBar({
  analysis,
  error,
  analyzedSubmissionCount,
  currentSubmissionCount,
  isRefreshing,
  onOpenInsights,
  onRefresh,
}: {
  analysis?: NormalizedAnalysisOutput
  error?: string
  analyzedSubmissionCount?: number
  currentSubmissionCount: number
  isRefreshing: boolean
  onOpenInsights: () => void
  onRefresh: () => void
}) {
  const isStale =
    analysis &&
    analyzedSubmissionCount !== undefined &&
    currentSubmissionCount > analyzedSubmissionCount
  const readiness = analysis?.readiness
  const topSignal =
    analysis?.collectiveBlindSpot ||
    analysis?.unclearConcepts[0] ||
    analysis?.teacherBrief[0] ||
    'Refresh AI when students submit maps to generate a teacher-only synthesis.'
  const debriefPrompt =
    analysis?.trainerDebriefPrompt ||
    'The next debrief prompt will appear after AI reads student maps.'

  return (
    <section className="rounded-2xl border border-[#151927] bg-[#080b16] p-4 text-white shadow-[0_24px_70px_rgba(4,7,18,0.22)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-200 text-slate-950">
            {isRefreshing ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Bot className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
              Teacher-only AI
            </p>
            <h2 className="mt-1 truncate font-serif text-2xl leading-tight text-white">
              {readiness
                ? `${readiness.readyCount}/${readiness.totalCount} ready · ${readiness.recommendation.replaceAll('_', ' ')}`
                : 'No synthesis yet'}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">
            {currentSubmissionCount} submissions
          </Badge>
          {analyzedSubmissionCount !== undefined ? (
            <Badge className="border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">
              AI read {analyzedSubmissionCount}
            </Badge>
          ) : null}
          {error ? (
            <Badge
              variant="outline"
              className="border-amber-200/30 bg-amber-200/10 text-amber-100"
            >
              Fallback
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Top signal
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-200">
            {topSignal}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200/20 bg-amber-200/10 p-3">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-100">
            Ask next
          </p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-amber-50">
            {debriefPrompt}
          </p>
        </div>
      </div>

      {isStale ? (
        <p className="mt-3 text-sm font-medium text-amber-100">
          AI has not read the newest submissions yet.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          className="bg-teal-200 text-slate-950 hover:bg-teal-100"
          disabled={isRefreshing}
          onClick={onRefresh}
        >
          <RefreshCw
            className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
          />
          {isRefreshing ? 'Refreshing AI' : 'Refresh AI'}
        </Button>
        <Button
          className="border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
          variant="outline"
          onClick={onOpenInsights}
        >
          <PanelRightOpen className="h-4 w-4" />
          View insights
        </Button>
      </div>
    </section>
  )
}

function AiInsightsDrawer({
  analysis,
  error,
  analyzedSubmissionCount,
  currentSubmissionCount,
  isOpen,
  isRefreshing,
  onOpenChange,
  onRefresh,
}: {
  analysis?: NormalizedAnalysisOutput
  error?: string
  analyzedSubmissionCount?: number
  currentSubmissionCount: number
  isOpen: boolean
  isRefreshing: boolean
  onOpenChange: (open: boolean) => void
  onRefresh: () => void
}) {
  const isStale =
    analysis &&
    analyzedSubmissionCount !== undefined &&
    currentSubmissionCount > analyzedSubmissionCount
  const readiness = analysis?.readiness

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="left-auto right-0 top-0 flex h-dvh max-h-dvh w-full max-w-[min(520px,100vw)] translate-x-0 translate-y-0 grid-rows-none flex-col gap-0 rounded-none border-l border-[#151927] bg-[#080b16] p-0 text-white sm:max-w-[520px]"
        showCloseButton
      >
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <div className="flex items-start gap-3 pr-10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-200 text-slate-950">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-200">
                Teacher-only AI
              </p>
              <DialogTitle className="font-serif text-2xl text-white">
                Class insights
              </DialogTitle>
              <DialogDescription className="text-slate-300">
                Concise class-level patterns for the teacher.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge className="border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">
              {currentSubmissionCount} submissions
            </Badge>
            {analyzedSubmissionCount !== undefined ? (
              <Badge className="border-white/10 bg-white/[0.06] text-slate-200 hover:bg-white/[0.06]">
                AI read {analyzedSubmissionCount}
              </Badge>
            ) : null}
            {readiness ? (
              <Badge className="bg-teal-200 text-slate-950 hover:bg-teal-200">
                {readiness.readyCount}/{readiness.totalCount} ready
              </Badge>
            ) : null}
          </div>

          {isRefreshing ? (
            <Alert className="mb-4 border-amber-200/20 bg-amber-200/10 text-amber-50">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Refreshing class insights from the latest submissions.
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert className="mb-4 border-amber-200/20 bg-amber-200/10 text-amber-50">
              <AlertDescription>
                Using local fallback analysis: {error}
              </AlertDescription>
            </Alert>
          ) : null}
          {isStale ? (
            <Alert className="mb-4 border-amber-200/20 bg-amber-200/10 text-amber-50">
              <AlertDescription>
                AI was last refreshed at {analyzedSubmissionCount} submissions.
                Refresh AI to include the newest maps.
              </AlertDescription>
            </Alert>
          ) : null}

          {!analysis ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.035] p-5 text-center">
              <p className="font-serif text-2xl text-white">
                Waiting for class signal.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Seed demo data or wait for student activity, then refresh AI.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <InsightBlock title="Now">
                <BulletList items={analysis.teacherBrief} />
              </InsightBlock>

              {analysis.trainerDebriefPrompt ? (
                <InsightBlock title="Ask next" tone="warm">
                  <p className="text-sm leading-6">
                    {analysis.trainerDebriefPrompt}
                  </p>
                </InsightBlock>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <InsightBlock title="Readiness">
                  {readiness ? (
                    <div>
                      <p className="font-serif text-4xl font-semibold">
                        {readiness.readyCount}/{readiness.totalCount}
                      </p>
                      <p className="mt-1 text-sm font-semibold">
                        {readiness.recommendation.replaceAll('_', ' ')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">
                      Waiting for signal.
                    </p>
                  )}
                </InsightBlock>
                <InsightBlock title="Tone">
                  <p className="text-sm font-semibold">
                    {analysis.emotionalTone.label || 'No signal yet'}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-300">
                    {analysis.emotionalTone.explanation ||
                      'More class activity is needed.'}
                  </p>
                </InsightBlock>
              </div>

              <InsightBlock title="Watch for">
                <BulletList
                  items={[
                    ...analysis.unclearConcepts.slice(0, 3),
                    ...analysis.recurringQuestions.slice(0, 2),
                  ]}
                />
              </InsightBlock>

              {analysis.collectiveBlindSpot ? (
                <InsightBlock title="Collective blind spot">
                  <p className="text-sm leading-6">
                    {analysis.collectiveBlindSpot}
                  </p>
                </InsightBlock>
              ) : null}

              <InsightBlock title="Evidence">
                <div className="space-y-3">
                  {analysis.commonErrors.length ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Rubric flags
                      </p>
                      <div className="mt-2 space-y-2">
                        {analysis.commonErrors.slice(0, 4).map((flag) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
                            key={flag.code}
                          >
                            <span>
                              {flag.code}: {flag.label}
                            </span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-teal-100">
                              {flag.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {analysis.chatClusters.length ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                        Chat clusters
                      </p>
                      <div className="mt-2 space-y-2">
                        {analysis.chatClusters.map((cluster) => (
                          <div
                            className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-slate-200"
                            key={cluster.label}
                          >
                            <span>{cluster.label}</span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-teal-100">
                              {cluster.count || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </InsightBlock>
            </div>
          )}
        </div>

        <div className="border-t border-white/10 bg-[#080b16] p-4">
          <Button
            className="w-full bg-teal-200 text-slate-950 hover:bg-teal-100"
            disabled={isRefreshing}
            onClick={onRefresh}
          >
            <RefreshCw
              className={isRefreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
            />
            {isRefreshing ? 'Refreshing AI' : 'Refresh AI'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function InsightBlock({
  children,
  title,
  tone = 'default',
}: {
  children: React.ReactNode
  title: string
  tone?: 'default' | 'warm'
}) {
  return (
    <section
      className={[
        'rounded-2xl border p-4',
        tone === 'warm'
          ? 'border-amber-200/20 bg-amber-200/10 text-amber-50'
          : 'border-white/10 bg-white/[0.04] text-slate-200',
      ].join(' ')}
    >
      <p
        className={[
          'mb-3 text-xs font-bold uppercase tracking-[0.16em]',
          tone === 'warm' ? 'text-amber-100' : 'text-slate-400',
        ].join(' ')}
      >
        {title}
      </p>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: Array<string> }) {
  if (!items.length) {
    return <p className="text-sm text-slate-400">Waiting for signal.</p>
  }
  return (
    <ul className="space-y-2 text-sm leading-6">
      {items.slice(0, 5).map((item) => (
        <li className="flex gap-2" key={item}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function IntakeSummaryWidget({
  submissions,
}: {
  submissions: Array<ActivitySubmission>
}) {
  const summary = useMemo(() => summarizeIntake(submissions), [submissions])

  return (
    <Card className="h-fit border-[var(--line)] bg-[#fffdf8]">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber)]">
            Intake
          </p>
          <CardTitle className="mt-1 font-serif text-2xl">
            Room baseline
          </CardTitle>
        </div>
        <Badge variant="secondary">{submissions.length} responses</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-4">
          <IntakeMetric
            label="Violence belief"
            value={summary.violenceAverage}
          />
          <IntakeMetric label="Weapons view" value={summary.powerAverage} />
          <IntakeMetric
            label="People power"
            value={summary.peoplePowerAverage}
          />
          <IntakeMetric label="First timers" value={summary.firstTimers} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <IntakeList title="Countries" items={summary.countries} />
          <IntakeList title="Age bands" items={summary.ageRanges} />
          <IntakeList title="Training" items={summary.training} />
        </div>

        {!submissions.length ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--line-strong)] bg-muted/30 p-4 text-sm text-muted-foreground">
            Waiting for students to submit intake forms.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function IntakeMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-muted/40 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-[var(--amber-deep)]" />
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 font-serif text-2xl font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}

function IntakeList({
  title,
  items,
}: {
  title: string
  items: Array<{ label: string; count: number }>
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.slice(0, 4).map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="flex-1 truncate text-sm text-foreground">
                {item.label}
              </span>
              <span className="text-sm font-semibold text-foreground">
                {item.count}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        )}
      </div>
    </div>
  )
}

function summarizeIntake(submissions: Array<ActivitySubmission>) {
  const payloads = submissions.map(
    (submission) => submission.payload as IntakePayload,
  )
  const average = (key: keyof IntakePayload) => {
    const values = payloads
      .map((payload) => payload[key])
      .filter((value): value is number => typeof value === 'number')
    if (!values.length) return '-'
    return (
      values.reduce((sum, value) => sum + value, 0) / values.length
    ).toFixed(1)
  }

  return {
    violenceAverage: average('violenceEffective'),
    powerAverage: average('weaponsMoneyPower'),
    peoplePowerAverage: average('peoplePower'),
    firstTimers: String(
      payloads.filter(
        (payload) => payload.priorTraining === 'No, this is my first time',
      ).length,
    ),
    countries: countLabels(payloads.map((payload) => payload.country)),
    ageRanges: countLabels(payloads.map((payload) => payload.ageRange)),
    training: countLabels(payloads.map((payload) => payload.priorTraining)),
  }
}

function countLabels(values: Array<string | undefined>) {
  const counts = new Map<string, number>()
  for (const value of values) {
    const label = value?.trim()
    if (!label) continue
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
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
    <Card className="h-fit border-[var(--line)] bg-[#fffdf8]">
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

function LiveSidePanel({
  participants,
  messages,
}: {
  participants: Array<{ _id: string; displayName?: string }>
  messages: Array<{
    _id: string
    authorRole: 'teacher' | 'student'
    displayName?: string
    body: string
    createdAt: number
  }>
}) {
  return (
    <aside className="h-fit rounded-3xl border border-[var(--line)] bg-[rgba(255,253,248,0.7)] p-4">
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-[var(--charcoal)]">Roster</h2>
          <span className="rounded-full bg-[var(--paper-warm)] px-2.5 py-1 text-xs font-semibold text-[var(--charcoal-muted)]">
            {participants.length} joined
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {participants.length ? (
            participants.slice(0, 12).map((participant) => (
              <div
                key={participant._id}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="truncate">
                  {participant.displayName || 'Student'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Waiting for students.
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 border-t border-[var(--line)] pt-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-4 w-4 text-[var(--amber-deep)]" />
          <h2 className="text-sm font-bold text-[var(--charcoal)]">
            Live chat
          </h2>
        </div>
        <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {messages.length ? (
            messages.slice(-80).map((message) => (
              <div
                key={message._id}
                className="border-l-2 border-[var(--line-strong)] py-1 pl-3"
              >
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
        </div>
      </section>
    </aside>
  )
}
