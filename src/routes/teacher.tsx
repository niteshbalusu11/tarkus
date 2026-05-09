import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  Bot,
  CircleDot,
  Clock,
  Copy,
  LayoutDashboard,
  MessageSquareText,
  Play,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'

import AuthGate from '../components/AuthGate'
import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  getMatrixPoints,
  getPillarFrequency,
  getSequenceSummary,
  normalizeAnalysisOutput,
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

function TeacherRoute() {
  return (
    <AuthGate title="Sign in as teacher">
      <TeacherDashboard />
    </AuthGate>
  )
}

function TeacherDashboard() {
  const sessions = useQuery(api.sessions.listMyTeacherSessions)
  const createSession = useMutation(api.sessions.createSession)
  const deleteSession = useMutation(api.sessions.deleteSession)
  const seedDemo = useMutation(api.sessions.seedDemoSession)
  const analyzeSession = useAction(api.sessions.analyzeSession)
  const [selectedSessionId, setSelectedSessionId] =
    useState<Id<'sessions'> | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

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
      <main className="min-h-[calc(100vh-8rem)] bg-slate-50 px-4 py-10">
        <section className="mx-auto flex min-h-[68vh] max-w-4xl flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white px-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
            Start a live class
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
            Create one session code for the room. Students authenticate, join
            with the code, chat, and submit the Pillars exercise.
          </p>
          <button
            className="primary-action mt-7"
            disabled={busyAction === 'create'}
            onClick={handleCreateSession}
          >
            <Play className="h-4 w-4" />
            New live session
          </button>
        </section>
      </main>
    )
  }

  const analysis = normalizeAnalysisOutput(
    latestAnalysis?.output as AnalysisOutput | undefined,
  )

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-slate-50 px-4 py-6">
      <section className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <SessionHeader
            code={session.code}
            expiresAt={session.expiresAt}
            participantCount={participants?.length || 0}
            submissionCount={submissions?.length || 0}
            busyAction={busyAction}
            onAnalyze={handleAnalyze}
            onSeed={handleSeedAndAnalyze}
            onDelete={handleDelete}
          />
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <AiPanel analysis={analysis} error={latestAnalysis?.error} />
            <PillarsPanel submissions={submissions || []} />
          </div>
        </div>

        <aside className="space-y-4">
          <RosterPanel participants={participants || []} />
          <ChatPanel messages={messages || []} />
        </aside>
      </section>
    </main>
  )
}

function LoadingSurface() {
  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading teacher dashboard...
    </main>
  )
}

function SessionHeader({
  code,
  expiresAt,
  participantCount,
  submissionCount,
  busyAction,
  onAnalyze,
  onSeed,
  onDelete,
}: {
  code: string
  expiresAt: number
  participantCount: number
  submissionCount: number
  busyAction: string | null
  onAnalyze: () => void
  onSeed: () => void
  onDelete: () => void
}) {
  const expires = new Date(expiresAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="status-chip bg-emerald-50 text-emerald-700">
              <CircleDot className="h-3.5 w-3.5" />
              Live session
            </span>
            <span className="status-chip bg-slate-100 text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              Expires {expires}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Join code
              </p>
              <p className="font-mono text-4xl font-semibold tracking-[0.18em] text-slate-950">
                {code}
              </p>
            </div>
            <button
              className="icon-button mb-1"
              title="Copy join code"
              onClick={() => navigator.clipboard.writeText(code)}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Stat icon={<Users />} label="joined" value={participantCount} />
          <Stat icon={<Sparkles />} label="submitted" value={submissionCount} />
          <button
            className="secondary-action"
            disabled={busyAction === 'seed'}
            onClick={onSeed}
          >
            <Sparkles className="h-4 w-4" />
            Seed demo
          </button>
          <button
            className="primary-action"
            disabled={busyAction === 'analyze'}
            onClick={onAnalyze}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh AI
          </button>
          <button className="danger-action" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
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
    <div className="flex min-w-24 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-slate-700">
      <span className="[&_svg]:h-4 [&_svg]:w-4">{icon}</span>
      <span className="text-lg font-semibold text-slate-950">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  )
}

function AiPanel({
  analysis,
  error,
}: {
  analysis?: NormalizedAnalysisOutput
  error?: string
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
            Teacher-only AI
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            Class synthesis
          </h2>
        </div>
        <Bot className="h-6 w-6 text-teal-200" />
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 text-xs text-amber-100">
          Using local fallback analysis: {error}
        </p>
      ) : null}

      {!analysis ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
          Seed demo data or wait for student activity, then refresh AI for a
          concise class brief.
        </p>
      ) : (
        <div className="space-y-4">
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
    </section>
  )
}

function InsightList({ title, items }: { title: string; items: Array<string> }) {
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
  const frequency = useMemo(() => getPillarFrequency(submissions), [submissions])
  const points = useMemo(() => getMatrixPoints(submissions), [submissions])
  const sequences = useMemo(() => getSequenceSummary(submissions), [submissions])

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
            Pillars exercise
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
            Importance x Accessibility
          </h2>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {submissions.length} maps
        </span>
      </div>

      <Matrix points={points} />

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Most named pillars
          </h3>
          <div className="mt-3 space-y-2">
            {frequency.length ? (
              frequency.slice(0, 6).map((item, index) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: pillarColors[index % pillarColors.length] }}
                  />
                  <span className="flex-1 text-sm text-slate-700">
                    {item.label}
                  </span>
                  <span className="text-sm font-semibold text-slate-950">
                    {item.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Waiting for submissions.</p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Sequence signal
          </h3>
          <div className="mt-3 space-y-2">
            {sequences.length ? (
              sequences.slice(0, 5).map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span className="font-semibold text-slate-950">
                    {item.label}
                  </span>{' '}
                  appears in {item.topThree} top-three sequences.
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">No sequence data yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function Matrix({
  points,
}: {
  points: Array<{
    pillar: string
    student: string
    importance: number
    accessibility: number
  }>
}) {
  return (
    <div className="relative aspect-square min-h-72 rounded-2xl border border-slate-200 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:20%_20%] p-4">
      <span className="absolute left-3 top-3 text-xs font-semibold text-slate-500">
        High importance
      </span>
      <span className="absolute bottom-3 right-3 text-xs font-semibold text-slate-500">
        High accessibility
      </span>
      <span className="absolute bottom-3 left-3 text-xs font-semibold text-slate-400">
        Low / Low
      </span>
      <div className="absolute inset-8 border-l-2 border-b-2 border-slate-400" />
      {points.map((point, index) => {
        const left = `${((point.accessibility - 1) / 4) * 78 + 11}%`
        const bottom = `${((point.importance - 1) / 4) * 78 + 11}%`
        return (
          <div
            key={`${point.student}-${point.pillar}-${index}`}
            title={`${point.student}: ${point.pillar}`}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full ring-2 ring-white"
            style={{
              left,
              bottom,
              backgroundColor: pillarColors[index % pillarColors.length],
            }}
          />
        )
      })}
    </div>
  )
}

function RosterPanel({ participants }: { participants: Array<{ _id: string; displayName?: string }> }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-950">Roster</h2>
        <span className="text-xs text-slate-500">{participants.length} joined</span>
      </div>
      <div className="space-y-2">
        {participants.length ? (
          participants.map((participant) => (
            <div key={participant._id} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-slate-700">
                {participant.displayName || 'Student'}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Waiting for students.</p>
        )}
      </div>
    </section>
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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-950">Live chat</h2>
      </div>
      <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
        {messages.length ? (
          messages.slice(-80).map((message) => (
            <div key={message._id} className="rounded-xl bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">
                  {message.displayName || message.authorRole}
                </span>
                <span className="text-[11px] text-slate-400">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-sm leading-5 text-slate-700">{message.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No messages yet.</p>
        )}
      </div>
    </section>
  )
}
