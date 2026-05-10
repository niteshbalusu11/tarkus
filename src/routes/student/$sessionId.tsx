import { useMemo, useState } from 'react'
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  GripVertical,
  Landmark,
  Lock,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { motion } from 'motion/react'

import AuthGate from '../../components/AuthGate'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import { SCHOOL_UNIFORM_SCENARIO } from '../../lib/tarkus'
import type { PillarV2, PillarsPayloadV2 } from '../../lib/tarkus'

export const Route = createFileRoute('/student/$sessionId')({
  component: StudentRoute,
})

type MoveReasons = Partial<Record<string, string>>
type SessionStatus = Doc<'sessions'>['status']

function StudentRoute() {
  return (
    <AuthGate requiredRole="student" title="Sign in to continue class">
      <StudentSession />
    </AuthGate>
  )
}

function getStudentStatusMeta(status: SessionStatus) {
  switch (status) {
    case 'not_started':
      return {
        icon: Clock,
        title: 'Waiting for teacher to start class',
        description:
          'You are in the room. Chat and the exercise will unlock when class starts.',
      }
    case 'active':
      return {
        icon: CheckCircle2,
        title: 'Class is live',
        description: 'Chat and the Pillars exercise are open.',
      }
    case 'stopped':
      return {
        icon: Lock,
        title: 'Teacher has stopped the class',
        description:
          'Stay on this page. Work is paused until the teacher starts again.',
      }
    case 'ended':
      return {
        icon: AlertCircle,
        title: 'Class has ended',
        description:
          'This class is now read-only. Your teacher can still review what happened.',
      }
    default:
      return {
        icon: AlertCircle,
        title: 'Class unavailable',
        description: 'This class is no longer available.',
      }
  }
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
  const [powerHolder, setPowerHolder] = useState('')
  const [pillarName, setPillarName] = useState('')
  const [pillars, setPillars] = useState<Array<PillarV2>>([])
  const [moveReasons, setMoveReasons] = useState<MoveReasons>({})
  const [reflection, setReflection] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const activity = sessionData?.activity
  const isClassActive = sessionData?.session.status === 'active'
  const firstMoves = pillars.slice(0, 3)
  const canSubmit = Boolean(
    isClassActive &&
    activity &&
    powerHolder.trim() &&
    pillars.length >= 3 &&
    firstMoves.every((pillar) => moveReasons[pillar.id]?.trim()) &&
    reflection.trim(),
  )

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isClassActive || !message.trim()) return
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
    if (!isClassActive) return
    const name = pillarName.trim()
    if (!name || pillars.length >= 10) return
    setPillars((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name,
        accessibility: 3,
        role: '',
        notes: '',
      },
    ])
    setPillarName('')
  }

  function updatePillar(id: string, patch: Partial<PillarV2>) {
    if (!isClassActive) return
    setPillars((current) =>
      current.map((pillar) =>
        pillar.id === id ? { ...pillar, ...patch } : pillar,
      ),
    )
  }

  function removePillar(id: string) {
    if (!isClassActive) return
    setPillars((current) => current.filter((pillar) => pillar.id !== id))
    setMoveReasons((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!isClassActive) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    setPillars((current) => {
      const oldIndex = current.findIndex((pillar) => pillar.id === active.id)
      const newIndex = current.findIndex((pillar) => pillar.id === over.id)
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  async function handleSubmit() {
    if (!isClassActive || !activity || !canSubmit) return
    setError(null)
    const payload: PillarsPayloadV2 = {
      version: 2,
      exercise: 'school-uniform-pillars',
      scenario,
      powerHolder,
      pillars,
      moves: firstMoves.map((pillar, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        pillarId: pillar.id,
        pillarName: pillar.name,
        why: moveReasons[pillar.id] || '',
      })),
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
    return config?.scenario || SCHOOL_UNIFORM_SCENARIO
  }, [activity])

  const checklist = [
    { label: 'Name the real power holder', done: Boolean(powerHolder.trim()) },
    { label: 'Map at least three pillars', done: pillars.length >= 3 },
    {
      label: 'Order your first three moves',
      done: firstMoves.length >= 3,
    },
    {
      label: 'Explain why each move comes first',
      done:
        firstMoves.length >= 3 &&
        firstMoves.every((pillar) => moveReasons[pillar.id]?.trim()),
    },
    { label: 'Submit a reflection', done: Boolean(reflection.trim()) },
  ]

  if (!sessionData) {
    return (
      <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center bg-[var(--background)] text-sm text-muted-foreground">
        Loading class...
      </main>
    )
  }

  const statusMeta = getStudentStatusMeta(sessionData.session.status)
  const StatusIcon = statusMeta.icon

  return (
    <main className="min-h-[calc(100vh-8rem)] bg-[var(--background)] px-3 py-4">
      <section className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.82)] shadow-[0_24px_80px_rgba(28,28,28,0.08)]">
          <div className="border-b border-[var(--line)] px-4 py-4 md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--amber-deep)]">
                  Live exercise
                </p>
                <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-foreground">
                  {sessionData.session.title || 'Pillars of Support'}
                </h1>
              </div>
              <Badge variant="secondary" className="w-fit gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Structured checkpoint
              </Badge>
            </div>
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <StatusIcon className="mt-0.5 h-4 w-4 text-[var(--amber-deep)]" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {statusMeta.title}
                </p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {statusMeta.description}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,1.05fr)]">
            <section className="border-b border-[var(--line)] p-4 lg:border-b-0 lg:border-r md:p-6">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[var(--amber-deep)]" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Class chat
                </h2>
              </div>
              <div className="mt-4 max-h-[52vh] min-h-[300px] space-y-3 overflow-y-auto rounded-xl border border-[var(--line)] bg-[#fffdf8] p-3">
                {messages?.length ? (
                  messages.slice(-80).map((chat, index) => (
                    <motion.div
                      key={chat._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.015, 0.12) }}
                      className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3"
                    >
                      <p className="text-xs font-semibold text-muted-foreground">
                        {chat.displayName || chat.authorRole}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-foreground">
                        {chat.body}
                      </p>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex h-full min-h-[260px] items-center justify-center text-center">
                    <p className="max-w-xs text-sm leading-6 text-muted-foreground">
                      Ask questions as the class runs. Your teacher sees the
                      discussion and the structured exercise results.
                    </p>
                  </div>
                )}
              </div>
              <form className="mt-4 space-y-3" onSubmit={handleSend}>
                <Textarea
                  className="min-h-24 resize-none"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Ask a question or say what is unclear..."
                  disabled={!isClassActive}
                />
                <div className="flex items-center justify-between gap-3">
                  <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={isAnonymous}
                      disabled={!isClassActive}
                      onCheckedChange={(checked) =>
                        setIsAnonymous(checked === true)
                      }
                    />
                    Anonymous
                  </Label>
                  <Button
                    disabled={isSending || !isClassActive || !message.trim()}
                    type="submit"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </form>
            </section>

            <section className="p-4 md:p-6">
              <ExerciseTimeline
                checklist={checklist}
                scenario={scenario}
                powerHolder={powerHolder}
                setPowerHolder={setPowerHolder}
                pillarName={pillarName}
                setPillarName={setPillarName}
                pillars={pillars}
                moveReasons={moveReasons}
                setMoveReasons={setMoveReasons}
                updatePillar={updatePillar}
                removePillar={removePillar}
                addPillar={addPillar}
                handleDragEnd={handleDragEnd}
                sensors={sensors}
                isClassActive={isClassActive}
                reflection={reflection}
                setReflection={setReflection}
                error={error}
                submitted={submitted}
                canSubmit={canSubmit}
                handleSubmit={handleSubmit}
              />
            </section>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
                Progress
              </p>
              <CardTitle className="font-serif text-2xl">
                Exercise checklist
              </CardTitle>
              <CardDescription>
                Complete each checkpoint before submitting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-start gap-3">
                  {item.done ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[var(--amber-deep)]" />
                  ) : (
                    <Circle className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  )}
                  <span className="text-sm leading-6 text-foreground">
                    {item.label}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  )
}

function ExerciseTimeline({
  checklist,
  scenario,
  powerHolder,
  setPowerHolder,
  pillarName,
  setPillarName,
  pillars,
  moveReasons,
  setMoveReasons,
  updatePillar,
  removePillar,
  addPillar,
  handleDragEnd,
  sensors,
  isClassActive,
  reflection,
  setReflection,
  error,
  submitted,
  canSubmit,
  handleSubmit,
}: {
  checklist: Array<{ label: string; done: boolean }>
  scenario: string
  powerHolder: string
  setPowerHolder: (value: string) => void
  pillarName: string
  setPillarName: (value: string) => void
  pillars: Array<PillarV2>
  moveReasons: MoveReasons
  setMoveReasons: Dispatch<SetStateAction<MoveReasons>>
  updatePillar: (id: string, patch: Partial<PillarV2>) => void
  removePillar: (id: string) => void
  addPillar: () => void
  handleDragEnd: (event: DragEndEvent) => void
  sensors: ReturnType<typeof useSensors>
  isClassActive: boolean
  reflection: string
  setReflection: (value: string) => void
  error: string | null
  submitted: boolean
  canSubmit: boolean
  handleSubmit: () => void
}) {
  const stepsDone = checklist.filter((item) => item.done).length

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
          Scenario
        </p>
        <p className="mt-2 text-sm leading-6 text-foreground">{scenario}</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--paper-deep)]">
          <motion.div
            className="h-full bg-[var(--amber)]"
            initial={{ width: 0 }}
            animate={{ width: `${(stepsDone / checklist.length) * 100}%` }}
          />
        </div>
      </div>

      <Checkpoint index="01" title="Who holds the power?">
        <Label htmlFor="power-holder">
          Name the person or institution that can actually change the policy.
        </Label>
        <Textarea
          id="power-holder"
          className="mt-2 min-h-20 resize-none"
          value={powerHolder}
          onChange={(event) => setPowerHolder(event.target.value)}
          placeholder="Example: the principal, district office, or school board..."
          disabled={!isClassActive}
        />
      </Checkpoint>

      <Checkpoint index="02" title="Build your pillars">
        <p className="mb-3 text-sm leading-6 text-muted-foreground">
          Add groups, institutions, or people keeping the policy in place. Drag
          the pillars so the most strategic first move is at the top.
        </p>
        <div className="mb-4 flex gap-2">
          <Input
            value={pillarName}
            onChange={(event) => setPillarName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addPillar()
              }
            }}
            placeholder="Teachers, PTA, district office..."
            disabled={!isClassActive}
          />
          <Button
            size="icon"
            type="button"
            variant="outline"
            disabled={
              !isClassActive || !pillarName.trim() || pillars.length >= 10
            }
            onClick={addPillar}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pillars.map((pillar) => pillar.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {pillars.map((pillar, index) => (
                <SortablePillarCard
                  key={pillar.id}
                  pillar={pillar}
                  rank={index + 1}
                  updatePillar={updatePillar}
                  removePillar={removePillar}
                  disabled={!isClassActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {!pillars.length ? (
          <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[#fffdf8] p-5 text-center text-sm text-muted-foreground">
            Add your first pillar to start mapping the support structure.
          </div>
        ) : null}
      </Checkpoint>

      <Checkpoint index="03" title="First, second, third moves">
        <div className="grid gap-3">
          {pillars.slice(0, 3).map((pillar, index) => (
            <div
              key={pillar.id}
              className="rounded-xl border border-[var(--line)] bg-[#fffdf8] p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--charcoal)] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {pillar.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accessibility {pillar.accessibility}/5
                  </p>
                </div>
              </div>
              <Textarea
                className="mt-3 min-h-20 resize-none"
                value={moveReasons[pillar.id] || ''}
                onChange={(event) =>
                  setMoveReasons((current) => ({
                    ...current,
                    [pillar.id]: event.target.value,
                  }))
                }
                placeholder="Why approach this pillar at this point?"
                disabled={!isClassActive}
              />
            </div>
          ))}
          {pillars.length < 3 ? (
            <p className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[#fffdf8] p-4 text-sm text-muted-foreground">
              Add at least three pillars above, then drag them into the order
              you would approach them.
            </p>
          ) : null}
        </div>
      </Checkpoint>

      <Checkpoint index="04" title="Reflection">
        <Label htmlFor="reflection">
          What changed when you ranked accessibility instead of only formal
          power?
        </Label>
        <Textarea
          id="reflection"
          className="mt-2 min-h-24 resize-none"
          value={reflection}
          onChange={(event) => setReflection(event.target.value)}
          placeholder="Example: I first thought the school board mattered most, but teachers are easier to reach..."
          disabled={!isClassActive}
        />
      </Checkpoint>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {submitted ? (
        <Alert>
          <AlertDescription>
            Submitted. You can keep editing and submit again if your thinking
            changes.
          </AlertDescription>
        </Alert>
      ) : null}

      <Button
        className="h-11 w-full"
        disabled={!isClassActive || !canSubmit}
        onClick={handleSubmit}
      >
        Submit pillars exercise
      </Button>
    </div>
  )
}

function Checkpoint({
  index,
  title,
  children,
}: {
  index: string
  title: string
  children: ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-[var(--line)] bg-[rgba(255,253,248,0.9)] p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="font-serif text-lg font-semibold text-[var(--amber-deep)]">
          {index}
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

function SortablePillarCard({
  pillar,
  rank,
  updatePillar,
  removePillar,
  disabled,
}: {
  pillar: PillarV2
  rank: number
  updatePillar: (id: string, patch: Partial<PillarV2>) => void
  removePillar: (id: string) => void
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pillar.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'grid gap-3 rounded-xl border bg-[#fffdf8] p-3 shadow-sm md:grid-cols-[88px_1fr]',
        isDragging ? 'border-[var(--amber)] shadow-xl' : 'border-[var(--line)]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2 md:block">
        <PillarIllustration rank={rank} />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="md:mt-2"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <Input
            value={pillar.name}
            onChange={(event) =>
              updatePillar(pillar.id, { name: event.target.value })
            }
            className="font-semibold"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => removePillar(pillar.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <Rating
          value={pillar.accessibility}
          onChange={(accessibility) =>
            updatePillar(pillar.id, { accessibility })
          }
          disabled={disabled}
        />
        <Input
          value={pillar.role || ''}
          onChange={(event) =>
            updatePillar(pillar.id, { role: event.target.value })
          }
          placeholder="What role does this pillar play?"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function PillarIllustration({ rank }: { rank: number }) {
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-end justify-center rounded-xl bg-[var(--paper-deep)]">
      <Landmark className="absolute top-2 h-5 w-5 text-[var(--sepia)]" />
      <div className="mb-2 h-10 w-10 rounded-t-lg border-x-4 border-t-4 border-[var(--sepia)] bg-[linear-gradient(90deg,#d9bd78_0_18%,#f1ddaa_18%_36%,#d9bd78_36%_54%,#f1ddaa_54%_72%,#d9bd78_72%_100%)]" />
      <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--charcoal)] text-[10px] font-semibold text-white">
        {rank}
      </span>
    </div>
  )
}

function Rating({
  value,
  onChange,
  disabled,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Accessibility
        </span>
        <span className="text-sm font-semibold text-foreground">{value}/5</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-[var(--amber)]"
        disabled={disabled}
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Hard</span>
        <span>Easy</span>
      </div>
    </div>
  )
}
