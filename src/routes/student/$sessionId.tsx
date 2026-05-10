import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, FormEvent, SetStateAction } from 'react'
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
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Download,
  GripVertical,
  Lock,
  MessageCircle,
  MonitorPlay,
  Plus,
  Radio,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { motion } from 'motion/react'

import AuthGate from '../../components/AuthGate'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Checkbox } from '../../components/ui/checkbox'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { api } from '../../../convex/_generated/api'
import type { Doc, Id } from '../../../convex/_generated/dataModel'
import {
  SCHOOL_UNIFORM_SCENARIO,
  normalizePillarsPayload,
} from '../../lib/tarkus'
import type { PillarV2, PillarsPayloadV2 } from '../../lib/tarkus'

export const Route = createFileRoute('/student/$sessionId')({
  component: StudentRoute,
})

type MoveReasons = Partial<Record<string, string>>
type SessionStatus = Doc<'sessions'>['status']
type MissionId = 'holder' | 'map' | 'moves' | 'brief'

type MissionStep = {
  id: MissionId
  label: string
  title: string
  description: string
  done: boolean
}

type IntakePayloadV1 = {
  version: 1
  form: 'student-intake'
  ageRange: string
  country: string
  priorTraining: string
  violenceEffective: number
  weaponsMoneyPower: number
  peoplePower: number
  nonviolenceWord?: string
  authoritarianChange?: string
}

type IntakeFormState = {
  ageRange: string
  country: string
  priorTraining: string
  violenceEffective: number | null
  weaponsMoneyPower: number | null
  peoplePower: number | null
  nonviolenceWord: string
  authoritarianChange: string
}

const EMPTY_INTAKE_FORM: IntakeFormState = {
  ageRange: '',
  country: '',
  priorTraining: '',
  violenceEffective: null,
  weaponsMoneyPower: null,
  peoplePower: null,
  nonviolenceWord: '',
  authoritarianChange: '',
}

const AGE_RANGE_OPTIONS = [
  'Under 18',
  '18-24',
  '25-34',
  '35-44',
  '45-54',
  '55 or older',
]

const PRIOR_TRAINING_OPTIONS = [
  'No, this is my first time',
  'Yes, once or twice (informal workshop or short course)',
  'Yes, multiple times (I have some foundation in this)',
  'Yes, extensively (I have studied or trained others in this)',
]

const COUNTRY_OPTIONS = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bangladesh',
  'Belarus',
  'Belgium',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Brazil',
  'Bulgaria',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Chile',
  'China',
  'Colombia',
  'Costa Rica',
  "Cote d'Ivoire",
  'Croatia',
  'Cuba',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Ethiopia',
  'France',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Guatemala',
  'Haiti',
  'Honduras',
  'Hong Kong',
  'Hungary',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kosovo',
  'Kyrgyzstan',
  'Lebanon',
  'Malaysia',
  'Mexico',
  'Morocco',
  'Myanmar',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Nigeria',
  'Norway',
  'Pakistan',
  'Palestine',
  'Panama',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Romania',
  'Russia',
  'Rwanda',
  'Senegal',
  'Serbia',
  'Singapore',
  'Slovakia',
  'Somalia',
  'South Africa',
  'South Korea',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tanzania',
  'Thailand',
  'Tunisia',
  'Turkey',
  'Uganda',
  'Ukraine',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zimbabwe',
]

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
          'You are in the room. Chat opens when class starts; Pillars opens when your teacher begins it.',
      }
    case 'active':
      return {
        icon: CheckCircle2,
        title: 'Class is live',
        description:
          'Chat is open. Your teacher will unlock Pillars when the room is ready.',
      }
    case 'stopped':
      return {
        icon: Lock,
        title: 'Teacher has paused the class',
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
  const existingPillarsSubmission = useQuery(
    api.sessions.getMyPillarsSubmission,
    {
      sessionId: typedSessionId,
    },
  )
  const existingIntakeSubmission = useQuery(
    api.sessions.getMyIntakeSubmission,
    {
      sessionId: typedSessionId,
    },
  )
  const publishedPresentation = useQuery(
    api.prep.getPublishedPresentationForStudentSession,
    { sessionId: typedSessionId },
  )
  const sendMessage = useMutation(api.sessions.sendMessage)
  const submitIntake = useMutation(api.sessions.submitIntakeForm)
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
  const [intakeForm, setIntakeForm] =
    useState<IntakeFormState>(EMPTY_INTAKE_FORM)
  const [intakeSubmitted, setIntakeSubmitted] = useState(false)
  const [intakeError, setIntakeError] = useState<string | null>(null)
  const [hydratedIntakeSubmissionId, setHydratedIntakeSubmissionId] =
    useState<Id<'activitySubmissions'> | null>(null)
  const [isIntakeMinimized, setIsIntakeMinimized] = useState(false)
  const [activeMission, setActiveMission] = useState<MissionId>('holder')
  const [hydratedSubmissionId, setHydratedSubmissionId] =
    useState<Id<'activitySubmissions'> | null>(null)
  const [isPillarsMinimized, setIsPillarsMinimized] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const activity = sessionData?.activity
  const isClassActive = sessionData?.session.status === 'active'
  const isPillarsOpen = isClassActive && activity?.status === 'open'
  const canUseIntake = Boolean(
    sessionData?.session.status &&
    sessionData.session.status !== 'ended' &&
    sessionData.session.status !== 'deleted',
  )
  const firstMoves = pillars.slice(0, 3)
  const canSubmitIntake = Boolean(
    canUseIntake &&
    intakeForm.ageRange &&
    intakeForm.country.trim() &&
    intakeForm.priorTraining &&
    intakeForm.violenceEffective &&
    intakeForm.weaponsMoneyPower &&
    intakeForm.peoplePower,
  )
  const canSubmit = Boolean(
    isClassActive &&
    isPillarsOpen &&
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

  function updateIntakeForm(patch: Partial<IntakeFormState>) {
    setIntakeForm((current) => ({ ...current, ...patch }))
  }

  async function handleSubmitIntake() {
    if (!canSubmitIntake) return
    setIntakeError(null)
    const payload: IntakePayloadV1 = {
      version: 1,
      form: 'student-intake',
      ageRange: intakeForm.ageRange,
      country: intakeForm.country.trim(),
      priorTraining: intakeForm.priorTraining,
      violenceEffective: intakeForm.violenceEffective || 3,
      weaponsMoneyPower: intakeForm.weaponsMoneyPower || 3,
      peoplePower: intakeForm.peoplePower || 3,
      nonviolenceWord: intakeForm.nonviolenceWord.trim(),
      authoritarianChange: intakeForm.authoritarianChange.trim(),
    }
    try {
      await submitIntake({
        sessionId: typedSessionId,
        payload,
      })
      setIntakeSubmitted(true)
      setIsIntakeMinimized(true)
    } catch (caught) {
      setIntakeError(
        caught instanceof Error ? caught.message : 'Could not submit intake',
      )
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
    if (!isClassActive || !canSubmit) return
    if (activity?.status !== 'open') return
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
      setIsPillarsMinimized(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not submit')
    }
  }

  const scenario = useMemo(() => {
    const config = activity?.config as { scenario?: string } | undefined
    return config?.scenario || SCHOOL_UNIFORM_SCENARIO
  }, [activity])

  useEffect(() => {
    if (
      !existingIntakeSubmission ||
      existingIntakeSubmission._id === hydratedIntakeSubmissionId
    ) {
      return
    }

    const payload = existingIntakeSubmission.payload as Partial<IntakePayloadV1>
    setIntakeForm({
      ageRange: payload.ageRange || '',
      country: payload.country || '',
      priorTraining: payload.priorTraining || '',
      violenceEffective:
        typeof payload.violenceEffective === 'number'
          ? payload.violenceEffective
          : null,
      weaponsMoneyPower:
        typeof payload.weaponsMoneyPower === 'number'
          ? payload.weaponsMoneyPower
          : null,
      peoplePower:
        typeof payload.peoplePower === 'number' ? payload.peoplePower : null,
      nonviolenceWord: payload.nonviolenceWord || '',
      authoritarianChange: payload.authoritarianChange || '',
    })
    setIntakeSubmitted(true)
    setIsIntakeMinimized(true)
    setHydratedIntakeSubmissionId(existingIntakeSubmission._id)
  }, [existingIntakeSubmission, hydratedIntakeSubmissionId])

  useEffect(() => {
    if (
      !existingPillarsSubmission ||
      existingPillarsSubmission._id === hydratedSubmissionId
    ) {
      return
    }

    const normalized = normalizePillarsPayload(
      existingPillarsSubmission.payload,
    )
    const hydratedPillars = normalized.pillars.map((pillar) => ({
      id: pillar.id,
      name: pillar.name,
      accessibility: pillar.accessibility,
      role: pillar.role,
      notes: pillar.notes,
    }))
    const hydratedReasons: MoveReasons = {}
    for (const move of normalized.moves) {
      const pillarId =
        move.pillarId ||
        hydratedPillars.find((pillar) => pillar.name === move.pillarName)?.id
      if (pillarId) {
        hydratedReasons[pillarId] = move.why
      }
    }

    setPowerHolder(normalized.powerHolder)
    setPillars(hydratedPillars)
    setMoveReasons(hydratedReasons)
    setReflection(normalized.reflection)
    setSubmitted(true)
    setActiveMission('brief')
    setIsPillarsMinimized(true)
    setHydratedSubmissionId(existingPillarsSubmission._id)
  }, [existingPillarsSubmission, hydratedSubmissionId])

  const missionSteps: Array<MissionStep> = [
    {
      id: 'holder',
      label: 'Power',
      title: 'Name the power holder',
      description: 'Identify who can actually change the policy.',
      done: Boolean(powerHolder.trim()),
    },
    {
      id: 'map',
      label: 'Map',
      title: 'Build the support map',
      description: 'Add the groups and institutions keeping policy in place.',
      done: pillars.length >= 3,
    },
    {
      id: 'moves',
      label: 'Moves',
      title: 'Rank first moves',
      description: 'Choose where you would begin and explain why.',
      done:
        firstMoves.length >= 3 &&
        firstMoves.every((pillar) => moveReasons[pillar.id]?.trim()),
    },
    {
      id: 'brief',
      label: 'Brief',
      title: 'Send the briefing',
      description: 'Summarize what changed in your analysis.',
      done: Boolean(reflection.trim()),
    },
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
    <main className="min-h-[calc(100vh-8rem)] bg-[var(--background)] px-3 py-4 md:px-5">
      <section className="mx-auto w-full max-w-6xl space-y-4">
        <header className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.86)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <Radio className="h-3.5 w-3.5" />
                  Live class
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {intakeSubmitted ? 'Intake submitted' : 'Intake open'}
                </Badge>
              </div>
              <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                {sessionData.session.title || 'Pillars of Support'}
              </h1>
            </div>
            <div className="flex max-w-md items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3">
              <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber-deep)]" />
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
        </header>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_430px]">
          <LiveClassThread
            messages={messages}
            message={message}
            setMessage={setMessage}
            isAnonymous={isAnonymous}
            setIsAnonymous={setIsAnonymous}
            isSending={isSending}
            isClassActive={isClassActive}
            handleSend={handleSend}
          />

          <aside className="space-y-3 lg:sticky lg:top-4">
            <IntakeWidget
              form={intakeForm}
              updateForm={updateIntakeForm}
              submitted={intakeSubmitted}
              canSubmit={canSubmitIntake}
              canUse={canUseIntake}
              error={intakeError}
              onSubmit={handleSubmitIntake}
              isMinimized={isIntakeMinimized}
              setIsMinimized={setIsIntakeMinimized}
            />
            {isPillarsOpen ? (
              <PillarsActivityWidget
                missionSteps={missionSteps}
                activeMission={activeMission}
                setActiveMission={setActiveMission}
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
                isMinimized={isPillarsMinimized}
                setIsMinimized={setIsPillarsMinimized}
              />
            ) : (
              <PillarsLockedWidget isClassActive={isClassActive} />
            )}
            <StudentSlidesCard presentation={publishedPresentation} />
          </aside>
        </div>
      </section>
    </main>
  )
}

function PillarsLockedWidget({ isClassActive }: { isClassActive: boolean }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.92)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--paper-warm)] text-[var(--amber-deep)]">
          <Lock className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
            Pillars widget
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Pillars locked
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {isClassActive
              ? 'Your teacher will open this exercise when the room is ready.'
              : 'This exercise opens after class starts and your teacher begins it.'}
          </p>
        </div>
      </div>
    </section>
  )
}

function StudentSlidesCard({
  presentation,
}: {
  presentation:
    | {
        _id: Id<'presentations'>
        fileName: string
        sessionTitle: string
        downloadUrl: string | null
      }
    | null
    | undefined
}) {
  if (presentation === undefined) {
    return null
  }
  if (!presentation) {
    return null
  }

  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.72)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--amber-deep)]">
            Slides
          </p>
          <p className="truncate text-sm font-semibold text-foreground">
            Shared deck
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="icon-sm" variant="outline">
            <a href={`/presentation/${presentation._id}/view`} target="_blank">
              <MonitorPlay className="h-4 w-4" />
            </a>
          </Button>
          {presentation.downloadUrl ? (
            <Button asChild size="icon-sm" variant="outline">
              <a
                href={presentation.downloadUrl}
                download={presentation.fileName}
              >
                <Download className="h-4 w-4" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function LiveClassThread({
  messages,
  message,
  setMessage,
  isAnonymous,
  setIsAnonymous,
  isSending,
  isClassActive,
  handleSend,
}: {
  messages: Array<Doc<'chatMessages'>> | undefined
  message: string
  setMessage: (value: string) => void
  isAnonymous: boolean
  setIsAnonymous: (value: boolean) => void
  isSending: boolean
  isClassActive: boolean
  handleSend: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.86)] p-3 shadow-[0_18px_60px_rgba(28,28,28,0.06)] md:p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[var(--amber-deep)]" />
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Class thread
        </h2>
      </div>

      <div className="mt-4 h-[min(58vh,560px)] min-h-[360px] space-y-3 overflow-y-auto rounded-xl border border-[var(--line)] bg-[#fffdf8] p-3">
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
          <div className="flex h-full min-h-[230px] items-center justify-center text-center">
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Ask questions as the class runs. Use the Pillars widget beside the
              thread when your teacher opens the exercise.
            </p>
          </div>
        )}
      </div>

      <form className="mt-4 space-y-3" onSubmit={handleSend}>
        <Textarea
          className="min-h-20 resize-none"
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
              onCheckedChange={(checked) => setIsAnonymous(checked === true)}
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
  )
}

function IntakeWidget({
  form,
  updateForm,
  submitted,
  canSubmit,
  canUse,
  error,
  onSubmit,
  isMinimized,
  setIsMinimized,
}: {
  form: IntakeFormState
  updateForm: (patch: Partial<IntakeFormState>) => void
  submitted: boolean
  canSubmit: boolean
  canUse: boolean
  error: string | null
  onSubmit: () => void
  isMinimized: boolean
  setIsMinimized: (value: boolean) => void
}) {
  if (isMinimized) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.92)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
              Intake widget
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {submitted ? 'Intake submitted' : 'Intake minimized'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {submitted
                ? 'Your trainer has your intake responses.'
                : 'Reopen before class starts.'}
            </p>
          </div>
          {submitted ? (
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--amber-deep)]" />
          ) : (
            <Circle className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          )}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setIsMinimized(false)}
        >
          {submitted ? 'Edit' : 'Reopen'}
        </Button>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.92)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
            Intake widget
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            Student intake
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Complete before the session begins.
          </p>
        </div>
        <Badge
          variant={submitted ? 'default' : 'secondary'}
          className="gap-1.5"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {submitted ? 'Saved' : 'Open'}
        </Badge>
      </div>

      {submitted ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setIsMinimized(true)}
        >
          Minimize completed widget
        </Button>
      ) : null}

      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>Age</Label>
          <div className="grid grid-cols-2 gap-2">
            {AGE_RANGE_OPTIONS.map((option) => (
              <ChoiceButton
                key={option}
                disabled={!canUse}
                selected={form.ageRange === option}
                onClick={() => updateForm({ ageRange: option })}
              >
                {option}
              </ChoiceButton>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="intake-country">
            Nationality / country of origin
          </Label>
          <Input
            id="intake-country"
            list="intake-country-options"
            value={form.country}
            onChange={(event) => updateForm({ country: event.target.value })}
            placeholder="Search country..."
            disabled={!canUse}
          />
          <datalist id="intake-country-options">
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>
        </div>

        <div className="space-y-2">
          <Label>Prior strategic nonviolence training</Label>
          <div className="space-y-2">
            {PRIOR_TRAINING_OPTIONS.map((option) => (
              <ChoiceButton
                key={option}
                disabled={!canUse}
                selected={form.priorTraining === option}
                onClick={() => updateForm({ priorTraining: option })}
              >
                {option}
              </ChoiceButton>
            ))}
          </div>
        </div>

        <LikertQuestion
          disabled={!canUse}
          label="Violence is usually the most effective tool for fundamental political change."
          value={form.violenceEffective}
          onChange={(violenceEffective) => updateForm({ violenceEffective })}
        />
        <div className="space-y-2">
          <Label htmlFor="nonviolence-word">
            Optional: what comes to mind when you hear "nonviolence"?
          </Label>
          <Input
            id="nonviolence-word"
            value={form.nonviolenceWord}
            onChange={(event) =>
              updateForm({ nonviolenceWord: event.target.value })
            }
            disabled={!canUse}
          />
        </div>
        <LikertQuestion
          disabled={!canUse}
          label="Political power ultimately comes from those who control weapons and money."
          value={form.weaponsMoneyPower}
          onChange={(weaponsMoneyPower) => updateForm({ weaponsMoneyPower })}
        />
        <LikertQuestion
          disabled={!canUse}
          label="Sustained organized pressure by ordinary people can force powerful rulers to change or step down."
          value={form.peoplePower}
          onChange={(peoplePower) => updateForm({ peoplePower })}
        />
        <div className="space-y-2">
          <Label htmlFor="authoritarian-change">
            Optional: how do you think change happens in authoritarian contexts?
          </Label>
          <Textarea
            id="authoritarian-change"
            className="min-h-20 resize-none"
            value={form.authoritarianChange}
            onChange={(event) =>
              updateForm({ authoritarianChange: event.target.value })
            }
            disabled={!canUse}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          className="h-10 w-full"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitted ? 'Update intake' : 'Submit intake'}
        </Button>
      </div>
    </section>
  )
}

function ChoiceButton({
  children,
  disabled,
  selected,
  onClick,
}: {
  children: string
  disabled: boolean
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'rounded-lg border px-2.5 py-2 text-left text-xs font-semibold leading-5 transition disabled:opacity-60',
        selected
          ? 'border-[var(--charcoal)] bg-[var(--charcoal)] text-white'
          : 'border-[var(--line)] bg-[#fffdf8] text-foreground hover:border-[var(--line-strong)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function LikertQuestion({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number | null
  onChange: (value: number) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            disabled={disabled}
            onClick={() => onChange(rating)}
            className={[
              'h-8 rounded-md border text-xs font-semibold transition disabled:opacity-60',
              value === rating
                ? 'border-[var(--charcoal)] bg-[var(--charcoal)] text-white'
                : 'border-[var(--line)] bg-[var(--paper)] text-foreground hover:border-[var(--line-strong)]',
            ].join(' ')}
          >
            {rating}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Strongly disagree</span>
        <span>Strongly agree</span>
      </div>
    </div>
  )
}

function PillarsActivityWidget({
  missionSteps,
  activeMission,
  setActiveMission,
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
  isMinimized,
  setIsMinimized,
}: {
  missionSteps: Array<MissionStep>
  activeMission: MissionId
  setActiveMission: (mission: MissionId) => void
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
  isMinimized: boolean
  setIsMinimized: (value: boolean) => void
}) {
  const activeIndex = Math.max(
    0,
    missionSteps.findIndex((step) => step.id === activeMission),
  )
  const activeStep = missionSteps[activeIndex]
  const previousStep = activeIndex > 0 ? missionSteps[activeIndex - 1] : null
  const nextStep =
    activeIndex < missionSteps.length - 1 ? missionSteps[activeIndex + 1] : null
  const completedCount = missionSteps.filter((step) => step.done).length

  if (isMinimized) {
    return (
      <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.92)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
              Pillars widget
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {submitted ? 'Pillars submitted' : 'Pillars minimized'}
            </h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">
              {submitted
                ? `${pillars.length} pillars saved. You can reopen to revise.`
                : 'Reopen when you are ready to continue.'}
            </p>
          </div>
          {submitted ? (
            <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--amber-deep)]" />
          ) : (
            <Circle className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsMinimized(false)}
          >
            {submitted ? 'Edit' : 'Reopen'}
          </Button>
          {submitted ? (
            <Badge variant="secondary" className="h-7 gap-1.5 px-2.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Saved
            </Badge>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.92)] p-4 shadow-[0_18px_60px_rgba(28,28,28,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--amber-deep)]">
            Pillars widget
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {activeStep.title}
          </h2>
        </div>
        <Badge
          variant={submitted ? 'default' : 'secondary'}
          className="gap-1.5"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          {completedCount}/4
        </Badge>
      </div>
      {submitted ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setIsMinimized(true)}
        >
          Minimize completed widget
        </Button>
      ) : null}

      <p className="mt-3 line-clamp-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-sm leading-6 text-muted-foreground">
        {scenario}
      </p>

      <div className="mt-4 grid grid-cols-4 gap-1.5">
        {missionSteps.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setActiveMission(step.id)}
            className={[
              'h-10 rounded-lg border text-xs font-semibold transition',
              activeMission === step.id
                ? 'border-[var(--amber)] bg-[var(--amber-pale)]/55 text-foreground'
                : step.done
                  ? 'border-[var(--line)] bg-[#fffdf8] text-foreground'
                  : 'border-[var(--line)] bg-[#fffdf8] text-muted-foreground hover:border-[var(--line-strong)]',
            ].join(' ')}
          >
            {index + 1}. {step.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeMission}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="mt-4"
      >
        {activeMission === 'holder' ? (
          <div className="space-y-3">
            <Label htmlFor="power-holder">
              Who can actually change the policy?
            </Label>
            <Textarea
              id="power-holder"
              className="min-h-24 resize-none"
              value={powerHolder}
              onChange={(event) => setPowerHolder(event.target.value)}
              placeholder="Principal, district office, school board..."
              disabled={!isClassActive}
            />
          </div>
        ) : null}

        {activeMission === 'map' ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={pillarName}
                onChange={(event) => setPillarName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addPillar()
                  }
                }}
                placeholder="Add a pillar..."
                disabled={!isClassActive}
              />
              <Button
                type="button"
                size="icon"
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
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {pillars.map((pillar, index) => (
                    <CompactPillarRow
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
              <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[#fffdf8] p-4 text-center text-sm text-muted-foreground">
                Add at least three pillars.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeMission === 'moves' ? (
          <div className="space-y-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pillars.map((pillar) => pillar.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {pillars.map((pillar, index) => (
                    <SortableMoveRow
                      key={pillar.id}
                      pillar={pillar}
                      rank={index + 1}
                      moveReason={moveReasons[pillar.id] || ''}
                      setMoveReasons={setMoveReasons}
                      disabled={!isClassActive}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            {pillars.length < 3 ? (
              <div className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[#fffdf8] p-4 text-sm text-muted-foreground">
                Add three pillars before ranking first moves.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeMission === 'brief' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <MiniFact label="Power" value={powerHolder || 'Missing'} />
              <MiniFact label="Pillars" value={String(pillars.length)} />
              <MiniFact label="First" value={pillars[0]?.name || 'Missing'} />
            </div>
            <Label htmlFor="reflection">
              What changed when you ranked accessibility?
            </Label>
            <Textarea
              id="reflection"
              className="min-h-28 resize-none"
              value={reflection}
              onChange={(event) => setReflection(event.target.value)}
              placeholder="I first thought..., but..."
              disabled={!isClassActive}
            />
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {submitted ? (
              <Alert>
                <AlertDescription>
                  Submitted. You can edit and resubmit.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button
              className="h-10 w-full"
              disabled={!isClassActive || !canSubmit}
              onClick={handleSubmit}
            >
              Submit
            </Button>
          </div>
        ) : null}
      </motion.div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--line)] pt-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!previousStep}
          onClick={() => previousStep && setActiveMission(previousStep.id)}
        >
          Back
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!nextStep}
          onClick={() => nextStep && setActiveMission(nextStep.id)}
        >
          Next
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </section>
  )
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--line)] bg-[#fffdf8] p-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  )
}

function CompactPillarRow({
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
        'rounded-xl border bg-[#fffdf8] p-2 shadow-sm',
        isDragging ? 'border-[var(--amber)] shadow-lg' : 'border-[var(--line)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--paper-deep)] text-xs font-semibold text-foreground">
          {rank}
        </span>
        <Input
          value={pillar.name}
          onChange={(event) =>
            updatePillar(pillar.id, { name: event.target.value })
          }
          className="h-8 font-semibold"
          disabled={disabled}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
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
      <div className="mt-2 grid gap-2">
        <ReachControl
          value={pillar.accessibility}
          onChange={(accessibility) =>
            updatePillar(pillar.id, { accessibility })
          }
          disabled={disabled}
          compact
        />
        <Input
          value={pillar.role || ''}
          onChange={(event) =>
            updatePillar(pillar.id, { role: event.target.value })
          }
          className="h-8"
          placeholder="What support do they provide?"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

function SortableMoveRow({
  pillar,
  rank,
  moveReason,
  setMoveReasons,
  disabled,
}: {
  pillar: PillarV2
  rank: number
  moveReason: string
  setMoveReasons: Dispatch<SetStateAction<MoveReasons>>
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
  const isFirstMove = rank <= 3

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'rounded-xl border bg-[#fffdf8] p-3 shadow-sm',
        isDragging ? 'border-[var(--amber)] shadow-xl' : 'border-[var(--line)]',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span
          className={[
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            isFirstMove
              ? 'bg-[var(--charcoal)] text-white'
              : 'bg-[var(--paper-deep)] text-foreground',
          ].join(' ')}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {pillar.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Accessibility {pillar.accessibility}/5
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
      </div>
      {isFirstMove ? (
        <Textarea
          className="mt-3 min-h-20 resize-none"
          value={moveReason}
          onChange={(event) =>
            setMoveReasons((current) => ({
              ...current,
              [pillar.id]: event.target.value,
            }))
          }
          placeholder="Why approach this pillar at this point?"
          disabled={disabled}
        />
      ) : null}
    </div>
  )
}

function ReachControl({
  value,
  onChange,
  disabled,
  compact = false,
}: {
  value: number
  onChange: (value: number) => void
  disabled: boolean
  compact?: boolean
}) {
  return (
    <div>
      <div
        className={
          compact
            ? 'mb-1 flex items-center justify-between'
            : 'mb-2 flex items-center justify-between'
        }
      >
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Accessibility
        </span>
        <span className="text-sm font-semibold text-foreground">{value}/5</span>
      </div>
      <div
        className={
          compact ? 'grid grid-cols-5 gap-1' : 'grid grid-cols-5 gap-1.5'
        }
      >
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            disabled={disabled}
            onClick={() => onChange(score)}
            className={[
              compact
                ? 'h-7 rounded-md border text-xs font-semibold transition disabled:opacity-60'
                : 'h-9 rounded-lg border text-xs font-semibold transition disabled:opacity-60',
              value === score
                ? 'border-[var(--charcoal)] bg-[var(--charcoal)] text-white'
                : 'border-[var(--line)] bg-[var(--paper)] text-foreground hover:border-[var(--line-strong)]',
            ].join(' ')}
          >
            {score}
          </button>
        ))}
      </div>
      {!compact ? (
        <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
          <span>Hard</span>
          <span>Reachable</span>
        </div>
      ) : null}
    </div>
  )
}
