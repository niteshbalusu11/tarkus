import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { ArrowLeft, Printer } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import AuthGate from '../components/AuthGate'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'

export const Route = createFileRoute(
  '/teacher/session/$sessionId/curriculum-export',
)({
  component: CurriculumExportRoute,
})

type CurriculumSection = {
  title: string
  durationMinutes: number
  teachingNotes: string
  activity?: string
  discussionPrompts: Array<string>
}

type CurriculumContent = {
  title: string
  audience: string
  durationMinutes: number
  learningObjectives: Array<string>
  agenda: Array<CurriculumSection>
  keyConcepts: Array<string>
  materialsNeeded: Array<string>
  assessmentIdeas: Array<string>
  teacherNotes: string
}

const emptyCurriculum: CurriculumContent = {
  title: 'Untitled curriculum',
  audience: 'In-person student class',
  durationMinutes: 60,
  learningObjectives: [],
  agenda: [],
  keyConcepts: [],
  materialsNeeded: [],
  assessmentIdeas: [],
  teacherNotes: '',
}

function CurriculumExportRoute() {
  return (
    <AuthGate requiredRole="teacher" title="Sign in as teacher">
      <CurriculumExport />
    </AuthGate>
  )
}

function CurriculumExport() {
  const { sessionId } = Route.useParams()
  const typedSessionId = sessionId as Id<'sessions'>
  const prepForSession = useQuery(api.prep.getWorkspaceForSession, {
    sessionId: typedSessionId,
  })
  const latestCurriculum = useQuery(
    api.prep.getLatestCurriculum,
    prepForSession?.workspace
      ? { workspaceId: prepForSession.workspace._id }
      : 'skip',
  )
  const curriculum = useMemo(
    () => normalizeCurriculum(latestCurriculum?.content),
    [latestCurriculum?.content],
  )

  useEffect(() => {
    if (!latestCurriculum) return
    if (typeof window === 'undefined') return
    const search = new URLSearchParams(window.location.search)
    if (search.get('print') !== '1') return
    const timeout = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timeout)
  }, [latestCurriculum])

  if (
    prepForSession === undefined ||
    (prepForSession.workspace && latestCurriculum === undefined)
  ) {
    return (
      <main className="min-h-screen bg-[#f7f2e8] px-4 py-10 text-[var(--charcoal-muted)]">
        Preparing curriculum export...
      </main>
    )
  }

  if (!prepForSession.workspace || !latestCurriculum) {
    return (
      <main className="min-h-screen bg-[#f7f2e8] px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Alert className="border-[var(--line)] bg-[var(--surface)]">
            <AlertTitle>No curriculum to export</AlertTitle>
            <AlertDescription>
              Generate a curriculum before exporting it as a PDF.
            </AlertDescription>
          </Alert>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7f2e8] px-4 py-5 text-[#1c1c1c] print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#fffdf8] p-3 shadow-[0_12px_40px_rgba(28,28,28,0.08)] print:hidden">
          <Button asChild variant="outline">
            <a href={`/teacher/session/${typedSessionId}/prep`}>
              <ArrowLeft className="h-4 w-4" />
              Back to prep
            </a>
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print or save PDF
          </Button>
        </div>

        <article className="rounded-2xl bg-[#fffdf8] p-10 shadow-[0_24px_70px_rgba(28,28,28,0.08)] print:rounded-none print:bg-white print:p-0 print:shadow-none">
          <header className="border-b border-[#d8cbb3] pb-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#93660e]">
              TARKUS Curriculum
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-tight md:text-5xl print:text-4xl">
              {curriculum.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#5f584d]">
              <span>{prepForSession.session.title}</span>
              <span>{curriculum.audience}</span>
              <span>{curriculum.durationMinutes} minutes</span>
              <span>Version {latestCurriculum.version}</span>
            </div>
          </header>

          <CurriculumExportBody curriculum={curriculum} />
        </article>
      </div>
    </main>
  )
}

function CurriculumExportBody({
  curriculum,
}: {
  curriculum: CurriculumContent
}) {
  return (
    <div className="mt-8 space-y-8">
      <ExportSection title="Learning Objectives">
        <ol className="space-y-3">
          {curriculum.learningObjectives.map((objective, index) => (
            <li
              className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 leading-7"
              key={`${objective}-${index}`}
            >
              <span className="font-mono text-xs font-bold text-[#93660e]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{objective}</span>
            </li>
          ))}
        </ol>
      </ExportSection>

      <ExportSection title="Agenda">
        <div className="divide-y divide-[#d8cbb3] border-y border-[#d8cbb3]">
          {curriculum.agenda.map((section, index) => (
            <section
              className="break-inside-avoid py-5"
              key={`${section.title}-${index}`}
            >
              <div className="grid gap-4 md:grid-cols-[90px_minmax(0,1fr)]">
                <div>
                  <p className="font-mono text-sm font-bold text-[#93660e]">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-[#756d60]">
                    {section.durationMinutes} min
                  </p>
                </div>
                <div>
                  <h3 className="text-xl font-bold">{section.title}</h3>
                  <p className="mt-2 leading-7 text-[#3d382f]">
                    {section.teachingNotes}
                  </p>
                  {section.activity ? (
                    <div className="mt-3 rounded-xl border border-[#d8cbb3] bg-[#f7f2e8] p-3 text-sm font-semibold leading-6 text-[#5f584d] print:bg-white">
                      {section.activity}
                    </div>
                  ) : null}
                  {section.discussionPrompts.length ? (
                    <ul className="mt-3 grid gap-2 md:grid-cols-2">
                      {section.discussionPrompts.map((prompt, promptIndex) => (
                        <li
                          className="flex gap-2 text-sm leading-6"
                          key={`${prompt}-${promptIndex}`}
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9921a]" />
                          {prompt}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>
          ))}
        </div>
      </ExportSection>

      <div className="grid gap-6 md:grid-cols-3">
        <ExportSection title="Key Concepts">
          <ExportList items={curriculum.keyConcepts} />
        </ExportSection>
        <ExportSection title="Materials">
          <ExportList items={curriculum.materialsNeeded} />
        </ExportSection>
        <ExportSection title="Assessment">
          <ExportList items={curriculum.assessmentIdeas} />
        </ExportSection>
      </div>

      {curriculum.teacherNotes ? (
        <ExportSection title="Teacher Notes">
          <p className="leading-7 text-[#3d382f]">{curriculum.teacherNotes}</p>
        </ExportSection>
      ) : null}
    </div>
  )
}

function ExportSection({
  children,
  title,
}: {
  children: ReactNode
  title: string
}) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#93660e]">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ExportList({ items }: { items: Array<string> }) {
  if (!items.length) {
    return <p className="text-sm text-[#756d60]">None listed.</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li className="flex gap-2 text-sm leading-6" key={`${item}-${index}`}>
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9921a]" />
          {item}
        </li>
      ))}
    </ul>
  )
}

function normalizeCurriculum(value: unknown): CurriculumContent {
  const candidate = value as Partial<CurriculumContent> | null
  if (!candidate || typeof candidate !== 'object') return emptyCurriculum
  return {
    title: stringOr(candidate.title, emptyCurriculum.title),
    audience: stringOr(candidate.audience, emptyCurriculum.audience),
    durationMinutes: numberOr(
      candidate.durationMinutes,
      emptyCurriculum.durationMinutes,
    ),
    learningObjectives: stringArray(candidate.learningObjectives),
    agenda: Array.isArray(candidate.agenda)
      ? candidate.agenda.map((section, index) => {
          const item = section as Partial<CurriculumSection>
          return {
            title: stringOr(item.title, `Section ${index + 1}`),
            durationMinutes: numberOr(item.durationMinutes, 10),
            teachingNotes: stringOr(item.teachingNotes, ''),
            activity: stringOr(item.activity, ''),
            discussionPrompts: stringArray(item.discussionPrompts),
          }
        })
      : [],
    keyConcepts: stringArray(candidate.keyConcepts),
    materialsNeeded: stringArray(candidate.materialsNeeded),
    assessmentIdeas: stringArray(candidate.assessmentIdeas),
    teacherNotes: stringOr(candidate.teacherNotes, ''),
  }
}

function stringOr(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' ? value : fallback
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
