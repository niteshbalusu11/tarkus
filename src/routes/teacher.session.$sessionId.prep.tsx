import { createFileRoute } from '@tanstack/react-router'
import { useAction, useMutation, useQuery } from 'convex/react'
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Download,
  FileCheck2,
  FileImage,
  FileText,
  Loader2,
  MessageSquareText,
  Monitor,
  PenLine,
  Presentation,
  Sparkles,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import { api } from '../../convex/_generated/api'
import type { Doc, Id } from '../../convex/_generated/dataModel'
import AuthGate from '../components/AuthGate'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Textarea } from '../components/ui/textarea'

export const Route = createFileRoute('/teacher/session/$sessionId/prep')({
  component: PrepWorkspaceRoute,
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

function PrepWorkspaceRoute() {
  return (
    <AuthGate requiredRole="teacher" title="Sign in as teacher">
      <PrepWorkspace />
    </AuthGate>
  )
}

function PrepWorkspace() {
  const { sessionId } = Route.useParams()
  const typedSessionId = sessionId as Id<'sessions'>
  const prepForSession = useQuery(api.prep.getWorkspaceForSession, {
    sessionId: typedSessionId,
  })
  const workspace = prepForSession?.workspace
  const typedWorkspaceId = workspace?._id
  const documents = useQuery(
    api.prep.listAssets,
    typedWorkspaceId ? { workspaceId: typedWorkspaceId } : 'skip',
  )
  const latestCurriculum = useQuery(
    api.prep.getLatestCurriculum,
    typedWorkspaceId ? { workspaceId: typedWorkspaceId } : 'skip',
  )
  const messages = useQuery(
    api.prep.listMessages,
    typedWorkspaceId ? { workspaceId: typedWorkspaceId } : 'skip',
  )
  const presentations = useQuery(
    api.prep.listPresentations,
    typedWorkspaceId ? { workspaceId: typedWorkspaceId } : 'skip',
  )
  const createWorkspace = useMutation(api.prep.createWorkspace)
  const generateUploadUrl = useMutation(api.prep.generateUploadUrl)
  const saveUploadedDocument = useMutation(api.prep.saveUploadedDocument)
  const updatePrepBrief = useMutation(api.prep.updatePrepBrief)
  const updateCurriculumContent = useMutation(api.prep.updateCurriculumContent)
  const finalizeCurriculum = useMutation(api.prep.finalizeCurriculum)
  const extractDocumentText = useAction(api.prepNode.extractDocumentText)
  const generateCurriculum = useAction(api.prepNode.generateCurriculum)
  const refineCurriculum = useAction(api.prepNode.refineCurriculum)
  const generatePresentation = useAction(api.prepNode.generatePresentation)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const ensuredWorkspaceRef = useRef(false)
  const [draft, setDraft] = useState<CurriculumContent>(emptyCurriculum)
  const [prepBrief, setPrepBrief] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')

  useEffect(() => {
    if (
      prepForSession === undefined ||
      prepForSession.workspace ||
      ensuredWorkspaceRef.current
    ) {
      return
    }
    ensuredWorkspaceRef.current = true
    setBusy('setup')
    void createWorkspace({ sessionId: typedSessionId })
      .catch((setupError) => {
        setError(
          setupError instanceof Error
            ? setupError.message
            : 'Could not prepare this class',
        )
      })
      .finally(() => setBusy(null))
  }, [createWorkspace, prepForSession, typedSessionId])

  useEffect(() => {
    if (latestCurriculum?.content) {
      setDraft(normalizeCurriculum(latestCurriculum.content))
    }
  }, [latestCurriculum?._id, latestCurriculum?.content])

  useEffect(() => {
    if (workspace?.prepBrief) {
      setPrepBrief(workspace.prepBrief)
    }
  }, [workspace?.prepBrief])

  const extractedCount = useMemo(
    () =>
      documents?.filter(
        (document) =>
          (document.kind || 'document') === 'document' &&
          document.status === 'extracted' &&
          document.extractedText,
      ).length || 0,
    [documents],
  )
  const imageCount = useMemo(
    () =>
      documents?.filter(
        (document) =>
          document.kind === 'image' || document.mimeType.startsWith('image/'),
      ).length || 0,
    [documents],
  )

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !typedWorkspaceId) return
    setError(null)
    setBusy('upload')
    try {
      for (const file of Array.from(files)) {
        const uploadUrl = await generateUploadUrl()
        const uploadResponse = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        })
        if (!uploadResponse.ok) {
          throw new Error(`Could not upload ${file.name}`)
        }
        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<'_storage'>
        }
        const saved = await saveUploadedDocument({
          workspaceId: typedWorkspaceId,
          storageId,
          kind: file.type.startsWith('image/') ? 'image' : 'document',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        })
        if (!file.type.startsWith('image/')) {
          await extractDocumentText({ documentId: saved.documentId })
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : 'Could not upload document',
      )
    } finally {
      setBusy(null)
    }
  }

  async function runAction(actionName: string, action: () => Promise<unknown>) {
    setError(null)
    setBusy(actionName)
    try {
      await action()
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Action failed',
      )
    } finally {
      setBusy(null)
    }
  }

  async function saveDraft() {
    if (!latestCurriculum) return
    await runAction('save', () =>
      updateCurriculumContent({
        curriculumId: latestCurriculum._id,
        content: draft,
      }),
    )
  }

  async function savePrepBrief() {
    if (!typedWorkspaceId) return
    await runAction('brief', () =>
      updatePrepBrief({
        workspaceId: typedWorkspaceId,
        prepBrief,
      }),
    )
  }

  if (prepForSession === undefined || busy === 'setup' || !workspace) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 text-[var(--charcoal-muted)]">
        Preparing class prep...
      </main>
    )
  }

  return (
    <main className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
      <section className="rounded-[1.75rem] border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-[0_24px_70px_rgba(28,28,28,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge
              variant="outline"
              className="border-[rgba(201,146,26,0.36)] bg-[rgba(242,223,173,0.35)] text-[var(--amber-deep)]"
            >
              <Sparkles className="h-3 w-3" />
              AI curriculum builder
            </Badge>
            <h1 className="mt-4 font-serif text-4xl leading-tight text-[var(--charcoal)] md:text-6xl">
              {workspace.title}
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--charcoal-soft)]">
              Upload source material, generate a teacher-editable curriculum,
              refine the plan with the agent, then export slides for class.
            </p>
          </div>
          <div className="space-y-3 lg:w-[560px]">
            <div className="grid gap-2 sm:grid-cols-3">
              <StatusTile label="Documents" value={`${documents?.length || 0}`} />
              <StatusTile label="Extracted" value={`${extractedCount}`} />
              <StatusTile label="Images" value={`${imageCount}`} />
            </div>
            <Button
              asChild
              variant="outline"
              className="h-11 w-full rounded-xl bg-[#fffefa]"
            >
              <a href={`/teacher?sessionId=${typedSessionId}`}>
                <ArrowLeft className="h-4 w-4" />
                <Monitor className="h-4 w-4" />
                Live dashboard
              </a>
            </Button>
          </div>
        </div>
      </section>

      {error ? (
        <Alert
          variant="destructive"
          className="border-red-200 bg-red-50 text-red-950"
        >
          <AlertTitle>Something needs attention</AlertTitle>
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="space-y-4">
          <Card className="border-[var(--line)] bg-[#fffefa]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--amber-deep)]" />
                Class focus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="min-h-40"
                value={prepBrief}
                onChange={(event) => setPrepBrief(event.target.value)}
              />
              <Button
                variant="outline"
                className="h-10 w-full rounded-xl"
                disabled={busy === 'brief'}
                onClick={() => void savePrepBrief()}
              >
                {busy === 'brief' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PenLine className="h-4 w-4" />
                )}
                Save focus
              </Button>
            </CardContent>
          </Card>
          <Card className="border-[var(--line)] bg-[#fffefa]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-[var(--amber-deep)]" />
                Source documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg,image/webp"
                onChange={(event) => void handleUpload(event.target.files)}
              />
              <Button
                className="h-10 w-full rounded-xl"
                disabled={busy === 'upload'}
                onClick={() => fileInputRef.current?.click()}
              >
                {busy === 'upload' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload docs or images
              </Button>
              <DocumentList
                busy={busy}
                documents={documents || []}
                onRetry={(documentId) =>
                  void runAction('retry-extract', () =>
                    extractDocumentText({ documentId }),
                  )
                }
              />
              <Button
                className="h-10 w-full rounded-xl"
                disabled={!extractedCount || busy === 'curriculum'}
                onClick={() =>
                  void runAction('curriculum', () =>
                    generateCurriculum({ workspaceId: typedWorkspaceId }),
                  )
                }
              >
                {busy === 'curriculum' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Generate curriculum
              </Button>
            </CardContent>
          </Card>

          <PresentationPanel
            busy={busy}
            latestCurriculum={latestCurriculum}
            presentations={presentations || []}
            onGenerate={() =>
              runAction('presentation', () =>
                generatePresentation({ workspaceId: typedWorkspaceId }),
              )
            }
          />
        </aside>

        <CurriculumWorkspace
          busy={busy}
          curriculum={latestCurriculum}
          draft={draft}
          setDraft={setDraft}
          onSave={saveDraft}
          onFinalize={() =>
            latestCurriculum
              ? runAction('finalize', () =>
                  finalizeCurriculum({ curriculumId: latestCurriculum._id }),
                )
              : Promise.resolve()
          }
        />

        <aside className="space-y-4">
          <Card className="border-[var(--line)] bg-[#171614] text-white shadow-[0_24px_70px_rgba(28,28,28,0.12)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Bot className="h-5 w-5 text-[var(--amber-pale)]" />
                Revision chat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[330px] space-y-3 overflow-auto pr-1">
                {(messages || []).length ? (
                  messages?.map((message) => (
                    <div
                      key={message._id}
                      className={
                        message.role === 'teacher'
                          ? 'ml-6 rounded-2xl bg-[#2b2924] p-3 text-sm leading-6 text-[#fff8e7]'
                          : 'mr-6 rounded-2xl border border-[rgba(242,223,173,0.22)] bg-[#201f1c] p-3 text-sm leading-6 text-[#f5ead0]'
                      }
                    >
                      <p className="mb-1 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-[var(--amber-pale)]">
                        {message.role === 'teacher' ? 'You' : 'TARKUS'}
                      </p>
                      {message.body}
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-[rgba(242,223,173,0.18)] bg-[#201f1c] p-4 text-sm leading-6 text-[#d8cbb3]">
                    After a curriculum exists, ask for changes like “make it
                    more interactive,” “shorten this to 45 minutes,” or “add a
                    stronger debrief.”
                  </p>
                )}
              </div>
              <Textarea
                className="min-h-28 border-[rgba(242,223,173,0.24)] bg-[#fff8e7] text-[var(--charcoal)] placeholder:text-[var(--charcoal-muted)]"
                disabled={!latestCurriculum || busy === 'refine'}
                value={instruction}
                placeholder="Tell the agent what to change..."
                onChange={(event) => setInstruction(event.target.value)}
              />
              <Button
                className="h-10 w-full rounded-xl bg-[var(--amber)] text-[var(--charcoal)] hover:bg-[var(--amber-pale)]"
                disabled={!latestCurriculum || !instruction.trim() || busy === 'refine'}
                onClick={() => {
                  const nextInstruction = instruction
                  setInstruction('')
                  void runAction('refine', () =>
                    refineCurriculum({
                      workspaceId: typedWorkspaceId,
                      instruction: nextInstruction,
                    }),
                  )
                }}
              >
                {busy === 'refine' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquareText className="h-4 w-4" />
                )}
                Revise curriculum
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[rgba(255,253,248,0.72)] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber-deep)]">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-bold capitalize text-[var(--charcoal)]">
        {value}
      </p>
    </div>
  )
}

type PrepAsset = Doc<'prepDocuments'> & { url?: string | null }

function DocumentList({
  documents,
  busy,
  onRetry,
}: {
  documents: Array<PrepAsset>
  busy: string | null
  onRetry: (documentId: Id<'prepDocuments'>) => void
}) {
  if (!documents.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--charcoal-muted)]">
        Upload source files for the curriculum agent or images for the slide deck.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <div
          key={document._id}
          className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3"
        >
          <div className="flex items-start gap-3">
            {document.kind === 'image' || document.mimeType.startsWith('image/') ? (
              document.url ? (
                <img
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-[var(--line)] object-cover"
                  src={document.url}
                />
              ) : (
                <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber-deep)]" />
              )
            ) : (
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber-deep)]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-[var(--charcoal)]">
                {document.fileName}
              </p>
              <p className="mt-1 text-xs capitalize text-[var(--charcoal-muted)]">
                {document.kind === 'image' ? 'slide image' : document.status}
                {document.error ? `: ${document.error}` : ''}
              </p>
              {document.status === 'failed' &&
              (document.kind || 'document') === 'document' ? (
                <Button
                  className="mt-3 h-8 rounded-lg"
                  disabled={busy === 'retry-extract'}
                  size="sm"
                  variant="outline"
                  onClick={() => onRetry(document._id)}
                >
                  {busy === 'retry-extract' ? 'Retrying...' : 'Retry extraction'}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function CurriculumWorkspace({
  busy,
  curriculum,
  draft,
  setDraft,
  onSave,
  onFinalize,
}: {
  busy: string | null
  curriculum: Doc<'curricula'> | null | undefined
  draft: CurriculumContent
  setDraft: Dispatch<SetStateAction<CurriculumContent>>
  onSave: () => Promise<void>
  onFinalize: () => Promise<void>
}) {
  if (curriculum === undefined) {
    return (
      <div className="rounded-[1.75rem] border border-[var(--line)] bg-[#fffefa] p-6 text-[var(--charcoal-muted)]">
        Loading curriculum...
      </div>
    )
  }
  if (!curriculum) {
    return (
      <div className="flex min-h-[620px] items-center justify-center rounded-[1.75rem] border border-dashed border-[var(--line-strong)] bg-[#fffefa] p-8 text-center">
        <div className="max-w-md">
          <BookOpenPlaceholder />
          <h2 className="mt-6 font-serif text-4xl text-[var(--charcoal)]">
            No curriculum yet.
          </h2>
          <p className="mt-3 leading-7 text-[var(--charcoal-soft)]">
            Upload at least one document, wait for extraction to finish, then
            generate the first draft.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Card className="overflow-hidden border-[var(--line)] bg-[#fffefa] shadow-[0_24px_70px_rgba(28,28,28,0.08)]">
      <div className="border-b border-[var(--line)] bg-[linear-gradient(135deg,#fffdf8_0%,#f4efe4_100%)] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Badge
              variant="outline"
              className="border-[rgba(201,146,26,0.36)] bg-[rgba(242,223,173,0.35)] text-[var(--amber-deep)]"
            >
              Version {curriculum.version}
            </Badge>
            <h2 className="mt-4 font-serif text-4xl leading-tight text-[var(--charcoal)] md:text-5xl">
              {draft.title}
            </h2>
            <p className="mt-3 text-base leading-7 text-[var(--charcoal-soft)]">
              {draft.audience} · {draft.durationMinutes} minutes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy === 'save'} onClick={() => void onSave()}>
              {busy === 'save' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PenLine className="h-4 w-4" />
              )}
              Save edits
            </Button>
            <Button
              disabled={curriculum.status === 'finalized' || busy === 'finalize'}
              onClick={() => void onFinalize()}
            >
              {busy === 'finalize' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {curriculum.status === 'finalized' ? 'Finalized' : 'Finalize'}
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <Tabs defaultValue="read" className="gap-0">
          <div className="border-b border-[var(--line)] px-6 py-3">
            <TabsList className="bg-[var(--paper-warm)]">
              <TabsTrigger value="read">Read</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="read" className="m-0">
            <CurriculumReadView curriculum={draft} />
          </TabsContent>
          <TabsContent value="edit" className="m-0">
            <CurriculumEditor draft={draft} setDraft={setDraft} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function CurriculumReadView({
  curriculum,
}: {
  curriculum: CurriculumContent
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="p-6">
        <section>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--amber-deep)]">
            Learning objectives
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {curriculum.learningObjectives.map((objective, index) => (
              <div
                key={`${objective}-${index}`}
                className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4 text-sm font-semibold leading-6 text-[var(--charcoal)]"
              >
                <span className="mb-3 block text-xs font-bold text-[var(--amber-deep)]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {objective}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--amber-deep)]">
            Agenda
          </p>
          <div className="mt-4 space-y-4">
            {curriculum.agenda.map((section, index) => (
              <div
                key={`${section.title}-${index}`}
                className="rounded-3xl border border-[var(--line)] bg-[#fffdf8] p-5 shadow-[0_10px_26px_rgba(28,28,28,0.04)]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber-deep)]">
                      {String(index + 1).padStart(2, '0')} ·{' '}
                      {section.durationMinutes} min
                    </p>
                    <h3 className="mt-2 text-2xl font-bold text-[var(--charcoal)]">
                      {section.title}
                    </h3>
                  </div>
                  {section.activity ? (
                    <Badge className="bg-[var(--charcoal)] text-white">
                      Activity
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-4 leading-7 text-[var(--charcoal-soft)]">
                  {section.teachingNotes}
                </p>
                {section.activity ? (
                  <div className="mt-4 rounded-2xl border border-[rgba(201,146,26,0.28)] bg-[rgba(242,223,173,0.25)] p-4 text-sm font-semibold leading-6 text-[var(--sepia)]">
                    {section.activity}
                  </div>
                ) : null}
                {section.discussionPrompts.length ? (
                  <ul className="mt-4 space-y-2">
                    {section.discussionPrompts.map((prompt, promptIndex) => (
                      <li
                        key={`${prompt}-${promptIndex}`}
                        className="flex gap-2 text-sm leading-6 text-[var(--charcoal)]"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]" />
                        {prompt}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <aside className="border-t border-[var(--line)] bg-[var(--paper)] p-6 lg:border-l lg:border-t-0">
        <SideList title="Key concepts" items={curriculum.keyConcepts} />
        <SideList title="Materials" items={curriculum.materialsNeeded} />
        <SideList title="Assessment" items={curriculum.assessmentIdeas} />
        {curriculum.teacherNotes ? (
          <div className="mt-6 rounded-2xl bg-[var(--charcoal)] p-4 text-sm leading-6 text-[#fff8e7]">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber-pale)]">
              Teacher notes
            </p>
            {curriculum.teacherNotes}
          </div>
        ) : null}
      </aside>
    </div>
  )
}

function SideList({ title, items }: { title: string; items: Array<string> }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--amber-deep)]">
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.length ? (
          items.map((item, index) => (
            <Badge
              key={`${item}-${index}`}
              variant="outline"
              className="h-auto whitespace-normal rounded-full border-[var(--line)] bg-[#fffdf8] px-3 py-1.5 text-left text-[var(--charcoal)]"
            >
              {item}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-[var(--charcoal-muted)]">None yet.</p>
        )}
      </div>
    </div>
  )
}

function CurriculumEditor({
  draft,
  setDraft,
}: {
  draft: CurriculumContent
  setDraft: Dispatch<SetStateAction<CurriculumContent>>
}) {
  return (
    <div className="space-y-6 p-6">
      <div className="grid gap-4 md:grid-cols-[1fr_160px]">
        <div className="space-y-2">
          <Label htmlFor="curriculum-title">Title</Label>
          <Input
            id="curriculum-title"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="curriculum-duration">Minutes</Label>
          <Input
            id="curriculum-duration"
            inputMode="numeric"
            value={draft.durationMinutes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                durationMinutes: Number(event.target.value) || 0,
              }))
            }
          />
        </div>
      </div>
      <TextAreaField
        label="Audience"
        value={draft.audience}
        onChange={(value) =>
          setDraft((current) => ({ ...current, audience: value }))
        }
      />
      <TextAreaField
        label="Learning objectives"
        hint="One per line"
        value={draft.learningObjectives.join('\n')}
        onChange={(value) =>
          setDraft((current) => ({
            ...current,
            learningObjectives: linesToArray(value),
          }))
        }
      />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--charcoal)]">Agenda</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                agenda: [
                  ...current.agenda,
                  {
                    title: 'New section',
                    durationMinutes: 10,
                    teachingNotes: '',
                    activity: '',
                    discussionPrompts: [],
                  },
                ],
              }))
            }
          >
            Add section
          </Button>
        </div>
        {draft.agenda.map((section, index) => (
          <div
            key={`${section.title}-${index}`}
            className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-4"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_110px]">
              <Input
                value={section.title}
                onChange={(event) =>
                  updateSection(setDraft, index, {
                    title: event.target.value,
                  })
                }
              />
              <Input
                inputMode="numeric"
                value={section.durationMinutes}
                onChange={(event) =>
                  updateSection(setDraft, index, {
                    durationMinutes: Number(event.target.value) || 0,
                  })
                }
              />
            </div>
            <Textarea
              className="mt-3 min-h-24"
              value={section.teachingNotes}
              placeholder="Teaching notes"
              onChange={(event) =>
                updateSection(setDraft, index, {
                  teachingNotes: event.target.value,
                })
              }
            />
            <Textarea
              className="mt-3 min-h-20"
              value={section.activity || ''}
              placeholder="Activity, if any"
              onChange={(event) =>
                updateSection(setDraft, index, { activity: event.target.value })
              }
            />
            <Textarea
              className="mt-3 min-h-20"
              value={section.discussionPrompts.join('\n')}
              placeholder="Discussion prompts, one per line"
              onChange={(event) =>
                updateSection(setDraft, index, {
                  discussionPrompts: linesToArray(event.target.value),
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <TextAreaField
          label="Key concepts"
          hint="One per line"
          value={draft.keyConcepts.join('\n')}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              keyConcepts: linesToArray(value),
            }))
          }
        />
        <TextAreaField
          label="Materials"
          hint="One per line"
          value={draft.materialsNeeded.join('\n')}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              materialsNeeded: linesToArray(value),
            }))
          }
        />
        <TextAreaField
          label="Assessment"
          hint="One per line"
          value={draft.assessmentIdeas.join('\n')}
          onChange={(value) =>
            setDraft((current) => ({
              ...current,
              assessmentIdeas: linesToArray(value),
            }))
          }
        />
      </div>
      <TextAreaField
        label="Teacher notes"
        value={draft.teacherNotes}
        onChange={(value) =>
          setDraft((current) => ({ ...current, teacherNotes: value }))
        }
      />
    </div>
  )
}

function TextAreaField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {hint ? (
          <span className="text-xs font-medium text-[var(--charcoal-muted)]">
            {hint}
          </span>
        ) : null}
      </div>
      <Textarea
        className="min-h-28"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function PresentationPanel({
  busy,
  latestCurriculum,
  presentations,
  onGenerate,
}: {
  busy: string | null
  latestCurriculum: Doc<'curricula'> | null | undefined
  presentations: Array<Doc<'presentations'>>
  onGenerate: () => Promise<unknown>
}) {
  return (
    <Card className="border-[var(--line)] bg-[#fffefa]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Presentation className="h-5 w-5 text-[var(--amber-deep)]" />
          Presentation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="h-10 w-full rounded-xl"
          disabled={!latestCurriculum || busy === 'presentation'}
          onClick={() => void onGenerate()}
        >
          {busy === 'presentation' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Presentation className="h-4 w-4" />
          )}
          Generate PowerPoint
        </Button>
        {presentations.length ? (
          <div className="space-y-2">
            {presentations.map((presentation) => (
              <PresentationDownload
                key={presentation._id}
                presentation={presentation}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--paper)] p-4 text-sm leading-6 text-[var(--charcoal-muted)]">
            Finalize the curriculum, then generate a PPTX deck.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PresentationDownload({
  presentation,
}: {
  presentation: Doc<'presentations'>
}) {
  const downloadUrl = useQuery(
    api.prep.getPresentationDownloadUrl,
    presentation.status === 'ready'
      ? { presentationId: presentation._id }
      : 'skip',
  )
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-3">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--amber-deep)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[var(--charcoal)]">
            {presentation.fileName}
          </p>
          <p className="mt-1 text-xs capitalize text-[var(--charcoal-muted)]">
            {presentation.status}
            {presentation.error ? `: ${presentation.error}` : ''}
          </p>
        </div>
      </div>
      {downloadUrl ? (
        <Button asChild className="mt-3 h-9 w-full rounded-xl" size="sm">
          <a href={downloadUrl} download={presentation.fileName}>
            <Download className="h-4 w-4" />
            Download PPTX
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function BookOpenPlaceholder() {
  return (
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--charcoal)] text-[var(--amber-pale)]">
      <FileText className="h-8 w-8" />
    </div>
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

function linesToArray(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function updateSection(
  setDraft: Dispatch<SetStateAction<CurriculumContent>>,
  index: number,
  patch: Partial<CurriculumSection>,
) {
  setDraft((current) => ({
    ...current,
    agenda: current.agenda.map((section, sectionIndex) =>
      sectionIndex === index ? { ...section, ...patch } : section,
    ),
  }))
}
