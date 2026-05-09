import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { MessageCircle, Plus, Send, Trash2 } from 'lucide-react'

import AuthGate from '../../components/AuthGate'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Pillar, PillarsPayload } from '../../lib/tarkus'

export const Route = createFileRoute('/student/$sessionId')({
  component: StudentRoute,
})

function StudentRoute() {
  return (
    <AuthGate requiredRole="student" title="Sign in to continue class">
      <StudentSession />
    </AuthGate>
  )
}

function StudentSession() {
  const { sessionId } = Route.useParams()
  const typedSessionId = sessionId as Id<'sessions'>
  const sessionData = useQuery(api.sessions.getStudentSession, {
    sessionId: typedSessionId,
  })
  const messages = useQuery(api.sessions.listMessages, {
    sessionId: typedSessionId,
  })
  const sendMessage = useMutation(api.sessions.sendMessage)
  const submitPillars = useMutation(api.sessions.submitPillarsExercise)
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [decisionMaker, setDecisionMaker] = useState('')
  const [pillarName, setPillarName] = useState('')
  const [pillars, setPillars] = useState<Array<Pillar>>([])
  const [sequence, setSequence] = useState<Array<string>>([])
  const [reflection, setReflection] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activity = sessionData?.activity
  const canSubmit = Boolean(
    activity && decisionMaker.trim() && pillars.length && reflection.trim(),
  )

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim()) return
    setIsSending(true)
    try {
      await sendMessage({
        sessionId: typedSessionId,
        body: message,
        isAnonymous,
      })
      setMessage('')
    } finally {
      setIsSending(false)
    }
  }

  function addPillar() {
    const name = pillarName.trim()
    if (!name) return
    const pillar = {
      id: crypto.randomUUID(),
      name,
      importance: 3,
      accessibility: 3,
      rationale: '',
    }
    setPillars((current) => [...current, pillar])
    setSequence((current) => [...current, name])
    setPillarName('')
  }

  function updatePillar(id: string, patch: Partial<Pillar>) {
    setPillars((current) =>
      current.map((pillar) =>
        pillar.id === id ? { ...pillar, ...patch } : pillar,
      ),
    )
  }

  function removePillar(id: string) {
    const target = pillars.find((pillar) => pillar.id === id)
    setPillars((current) => current.filter((pillar) => pillar.id !== id))
    if (target) {
      setSequence((current) => current.filter((name) => name !== target.name))
    }
  }

  function moveSequence(name: string, direction: -1 | 1) {
    setSequence((current) => {
      const index = current.indexOf(name)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current
      }
      const copy = [...current]
      const [item] = copy.splice(index, 1)
      copy.splice(nextIndex, 0, item)
      return copy
    })
  }

  async function handleSubmit() {
    if (!activity || !canSubmit) return
    setError(null)
    const payload: PillarsPayload = {
      decisionMaker,
      pillars,
      sequence,
      reflection,
    }
    try {
      await submitPillars({
        sessionId: typedSessionId,
        activityId: activity._id,
        payload,
      })
      setSubmitted(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit')
    }
  }

  const scenario = useMemo(() => {
    const config = activity?.config as { scenario?: string } | undefined
    return (
      config?.scenario ||
      'You are a high school student. You and your classmates want to change the mandatory uniform policy.'
    )
  }, [activity])

  if (!sessionData) {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading class...
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-slate-50 px-3 py-4">
      <section className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[0.78fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              Live class
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              {sessionData.session.title || 'Pillars of Support'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{scenario}</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-teal-700" />
              <h2 className="text-sm font-semibold text-slate-950">
                Class chat
              </h2>
            </div>
            <div className="mb-3 max-h-80 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
              {messages?.length ? (
                messages.slice(-60).map((chat) => (
                  <div key={chat._id} className="rounded-lg bg-white p-3">
                    <p className="text-xs font-semibold text-slate-500">
                      {chat.displayName || chat.authorRole}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-700">
                      {chat.body}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No messages yet.</p>
              )}
            </div>
            <form className="space-y-3" onSubmit={handleSend}>
              <textarea
                className="text-input min-h-20 resize-none"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Ask a question or share what is unclear..."
              />
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(event) => setIsAnonymous(event.target.checked)}
                  />
                  Anonymous
                </label>
                <button
                  className="primary-action"
                  disabled={isSending || !message.trim()}
                  type="submit"
                >
                  <Send className="h-4 w-4" />
                  Send
                </button>
              </div>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">
              Structured assessment
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
              Pillars map
            </h2>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="form-label">
                Who has actual power to change the policy?
              </span>
              <textarea
                className="text-input min-h-20 resize-none"
                value={decisionMaker}
                onChange={(event) => setDecisionMaker(event.target.value)}
                placeholder="Example: principal, school board, district office..."
              />
            </label>

            <div>
              <span className="form-label">Add pillars</span>
              <div className="flex gap-2">
                <input
                  className="text-input"
                  value={pillarName}
                  onChange={(event) => setPillarName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      addPillar()
                    }
                  }}
                  placeholder="Teachers, PTA, school board..."
                />
                <button className="icon-button" type="button" onClick={addPillar}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {pillars.map((pillar) => (
                <div
                  key={pillar.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <input
                      className="w-full bg-transparent text-sm font-semibold text-slate-950 outline-none"
                      value={pillar.name}
                      onChange={(event) =>
                        updatePillar(pillar.id, { name: event.target.value })
                      }
                    />
                    <button
                      className="text-slate-400 hover:text-red-600"
                      type="button"
                      onClick={() => removePillar(pillar.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <Rating
                    label="Importance"
                    value={pillar.importance}
                    onChange={(importance) =>
                      updatePillar(pillar.id, { importance })
                    }
                  />
                  <Rating
                    label="Accessibility"
                    value={pillar.accessibility}
                    onChange={(accessibility) =>
                      updatePillar(pillar.id, { accessibility })
                    }
                  />
                </div>
              ))}
            </div>

            {sequence.length ? (
              <div>
                <span className="form-label">Approach order</span>
                <div className="space-y-2">
                  {sequence.map((name, index) => (
                    <div
                      key={`${name}-${index}`}
                      className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm text-slate-700">{name}</span>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white"
                        onClick={() => moveSequence(name, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-white"
                        onClick={() => moveSequence(name, 1)}
                      >
                        Down
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="block">
              <span className="form-label">Reflection</span>
              <textarea
                className="text-input min-h-24 resize-none"
                value={reflection}
                onChange={(event) => setReflection(event.target.value)}
                placeholder="Was there a pillar you initially thought was most important but deprioritized?"
              />
            </label>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
            {submitted ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Submitted. You can update and submit again if your thinking
                changes.
              </p>
            ) : null}

            <button
              className="primary-action w-full justify-center"
              disabled={!canSubmit}
              type="button"
              onClick={handleSubmit}
            >
              Submit pillars map
            </button>
          </div>
        </section>
      </section>
    </main>
  )
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="mb-2 grid grid-cols-[96px_1fr_24px] items-center gap-2">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="text-sm font-semibold text-slate-950">{value}</span>
    </div>
  )
}
