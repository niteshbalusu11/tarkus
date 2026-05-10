import { convexTest } from 'convex-test'
import type { UserIdentity } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { api, internal } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import {
  MAX_LLM_DOCUMENT_CONTEXT_CHARS,
  MAX_PREP_DOCUMENT_UPLOAD_BYTES,
} from '../../convex/prepLimits'
import {
  applyDeterministicPresentationEdit,
  ensureImagePlacements,
  MAX_PRESENTATION_SLIDES,
  normalizeSlideSpec,
} from '../../convex/prepNode'
import { buildCappedSourceDocuments } from '../../convex/prepPrompt'
import schema from '../../convex/schema'
import { modules } from './test.setup'

const teacherIdentity = {
  issuer: 'test',
  subject: 'prep-teacher',
  tokenIdentifier: 'test|prep-teacher',
  name: 'Prep Trainer',
} satisfies Partial<UserIdentity>

const otherTeacherIdentity = {
  issuer: 'test',
  subject: 'other-prep-teacher',
  tokenIdentifier: 'test|other-prep-teacher',
  name: 'Other Trainer',
} satisfies Partial<UserIdentity>

const studentIdentity = {
  issuer: 'test',
  subject: 'prep-student',
  tokenIdentifier: 'test|prep-student',
  name: 'Student',
} satisfies Partial<UserIdentity>

function newTestBackend() {
  return convexTest(schema, modules)
}

async function onboard(
  t: ReturnType<typeof newTestBackend>,
  identity: Partial<UserIdentity>,
  role: 'student' | 'teacher',
  displayName: string,
) {
  await t.withIdentity(identity).mutation(api.users.completeOnboarding, {
    displayName,
    role,
  })
}

async function createStoredPresentation(
  t: ReturnType<typeof newTestBackend>,
  workspaceId: Id<'prepWorkspaces'>,
  status: 'generating' | 'ready' | 'failed' = 'ready',
) {
  const now = Date.now()
  const curriculumId = await t.run(async (ctx) =>
    ctx.db.insert('curricula', {
      workspaceId,
      teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
      version: 1,
      status: 'finalized',
      content: { title: 'Preview curriculum' },
      createdAt: now,
      updatedAt: now,
    }),
  )
  return await t.run(async (ctx) =>
    ctx.db.insert('presentations', {
      workspaceId,
      teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
      curriculumId,
      status,
      slideSpec: {
        title: 'Pillars preview',
        slides: [
          {
            type: 'title',
            title: 'Pillars preview',
            bullets: ['Read power by looking at support structures.'],
            speakerNotes: 'Open by connecting the deck to the live class.',
          },
        ],
      },
      fileName: 'pillars-preview.pptx',
      ...(status === 'failed' ? { error: 'Deck generation failed' } : {}),
      createdAt: now,
      updatedAt: now,
    }),
  )
}

describe('prep workspace auth', () => {
  it('requires authentication and teacher onboarding for prep workspaces', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, studentIdentity, 'student', 'Student')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      t.mutation(api.prep.createWorkspace, {
        sessionId,
      }),
    ).rejects.toThrow('Not authenticated')

    await expect(
      student.mutation(api.prep.createWorkspace, {
        sessionId,
      }),
    ).rejects.toThrow('Only teachers can use this')
  })

  it('lets a teacher create and list prep for their classes only', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {
      title: 'Pillars source lesson',
    })
    const otherSession = await otherTeacher.mutation(
      api.sessions.createSession,
      {
        title: 'Other lesson',
      },
    )

    const created = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
      audience: 'High school classroom',
      durationMinutes: 75,
    })
    await otherTeacher.mutation(api.prep.createWorkspace, {
      sessionId: otherSession.sessionId,
      audience: 'Different room',
      durationMinutes: 45,
    })

    const mine = await teacher.query(api.prep.listMyWorkspaces, {})
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      _id: created.workspaceId,
      title: 'Pillars source lesson',
      sessionId,
      teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
    })
  })

  it('scopes prep workspace reads to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {
      title: 'Private curriculum',
    })
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })

    await expect(
      otherTeacher.query(api.prep.getWorkspaceForSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
    await expect(
      otherTeacher.query(api.prep.getWorkspace, { workspaceId }),
    ).rejects.toThrow('Unauthorized')

    const prepForSession = await teacher.query(
      api.prep.getWorkspaceForSession,
      {
        sessionId,
      },
    )
    expect(prepForSession.workspace?._id).toBe(workspaceId)

    const workspace = await teacher.query(api.prep.getWorkspace, {
      workspaceId,
    })
    expect(workspace.title).toBe('Private curriculum')
  })

  it('requires teacher role before running prep generation actions', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, studentIdentity, 'student', 'Student')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {
      title: 'Action-gated prep',
    })
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })

    await expect(
      t.action(api.prepNode.generatePresentation, { workspaceId }),
    ).rejects.toThrow('Not authenticated')
    await expect(
      student.action(api.prepNode.generateCurriculum, { workspaceId }),
    ).rejects.toThrow('Only teachers can use this')
    await expect(
      student.action(api.prepNode.generatePresentation, { workspaceId }),
    ).rejects.toThrow('Only teachers can use this')
  })

  it('stores a teacher prep brief on class-scoped prep only', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })

    await expect(
      otherTeacher.mutation(api.prep.updatePrepBrief, {
        workspaceId,
        prepBrief: 'Change another class prep.',
      }),
    ).rejects.toThrow('Unauthorized')

    await teacher.mutation(api.prep.updatePrepBrief, {
      workspaceId,
      prepBrief:
        'Focus on pillar analysis, obedience, push vs pull, El Salvador 1944, and Norway 1942.',
    })

    const workspace = await teacher.query(api.prep.getWorkspace, {
      workspaceId,
    })
    expect(workspace.prepBrief).toContain('El Salvador 1944')
  })

  it('scopes presentation previews to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    await onboard(t, studentIdentity, 'student', 'Student')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {
      title: 'Preview class',
    })
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const presentationId = await createStoredPresentation(t, workspaceId)

    await expect(
      t.query(api.prep.getPresentationPreview, { presentationId }),
    ).rejects.toThrow('Not authenticated')
    await expect(
      student.query(api.prep.getPresentationPreview, { presentationId }),
    ).rejects.toThrow('Only teachers can use this')
    await expect(
      otherTeacher.query(api.prep.getPresentationPreview, { presentationId }),
    ).rejects.toThrow('Unauthorized')

    const preview = await teacher.query(api.prep.getPresentationPreview, {
      presentationId,
    })
    expect(preview).toMatchObject({
      _id: presentationId,
      fileName: 'pillars-preview.pptx',
      status: 'ready',
      sessionTitle: 'Preview class',
    })
    expect(preview.slideSpec).toMatchObject({
      title: 'Pillars preview',
      slides: [{ title: 'Pillars preview' }],
    })
  })

  it('returns failed presentation state for preview handling', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const presentationId = await createStoredPresentation(
      t,
      workspaceId,
      'failed',
    )

    const preview = await teacher.query(api.prep.getPresentationPreview, {
      presentationId,
    })

    expect(preview.status).toBe('failed')
    expect(preview.error).toBe('Deck generation failed')
  })

  it('scopes presentation edit messages to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    await onboard(t, studentIdentity, 'student', 'Student')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const presentationId = await createStoredPresentation(t, workspaceId)
    await t.run(async (ctx) =>
      ctx.db.insert('presentationMessages', {
        presentationId,
        workspaceId,
        teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
        role: 'assistant',
        body: 'Ready to revise the deck.',
        createdAt: Date.now(),
      }),
    )

    await expect(
      t.query(api.prep.listPresentationMessages, { presentationId }),
    ).rejects.toThrow('Not authenticated')
    await expect(
      student.query(api.prep.listPresentationMessages, { presentationId }),
    ).rejects.toThrow('Only teachers can use this')
    await expect(
      otherTeacher.query(api.prep.listPresentationMessages, {
        presentationId,
      }),
    ).rejects.toThrow('Unauthorized')

    const messages = await teacher.query(api.prep.listPresentationMessages, {
      presentationId,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: 'assistant',
      body: 'Ready to revise the deck.',
    })
  })

  it('lets the owning teacher delete a generated presentation', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(otherTeacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    await onboard(t, otherTeacherIdentity, 'teacher', 'Other Trainer')
    await onboard(t, studentIdentity, 'student', 'Student')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const presentationId = await createStoredPresentation(t, workspaceId)
    await t.run(async (ctx) =>
      ctx.db.insert('presentationMessages', {
        presentationId,
        workspaceId,
        teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
        role: 'assistant',
        body: 'Ready to revise the deck.',
        createdAt: Date.now(),
      }),
    )

    await expect(
      t.mutation(api.prep.deletePresentation, { presentationId }),
    ).rejects.toThrow('Not authenticated')
    await expect(
      student.mutation(api.prep.deletePresentation, { presentationId }),
    ).rejects.toThrow('Only teachers can use this')
    await expect(
      otherTeacher.mutation(api.prep.deletePresentation, { presentationId }),
    ).rejects.toThrow('Unauthorized')

    await teacher.mutation(api.prep.deletePresentation, { presentationId })

    const presentations = await teacher.query(api.prep.listPresentations, {
      workspaceId,
    })
    expect(presentations).toHaveLength(0)
    await expect(
      teacher.query(api.prep.getPresentationPreview, { presentationId }),
    ).rejects.toThrow('Presentation not found')
    await expect(
      teacher.query(api.prep.listPresentationMessages, { presentationId }),
    ).rejects.toThrow('Presentation not found')
  })

  it('does not delete presentations while generation or edits are running', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const generatingPresentationId = await createStoredPresentation(
      t,
      workspaceId,
      'generating',
    )
    const editingPresentationId = await createStoredPresentation(t, workspaceId)
    await t.run(async (ctx) =>
      ctx.db.patch(editingPresentationId, { editStatus: 'editing' }),
    )

    await expect(
      teacher.mutation(api.prep.deletePresentation, {
        presentationId: generatingPresentationId,
      }),
    ).rejects.toThrow('still generating')
    await expect(
      teacher.mutation(api.prep.deletePresentation, {
        presentationId: editingPresentationId,
      }),
    ).rejects.toThrow('still updating')
  })

  it('locks presentation edits to one running edit at a time', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const presentationId = await createStoredPresentation(t, workspaceId)

    await t.mutation(internal.prep.beginPresentationEdit, {
      presentationId,
      teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
      instruction: 'Make slide 1 more discussion oriented.',
    })

    await expect(
      t.mutation(internal.prep.beginPresentationEdit, {
        presentationId,
        teacherTokenIdentifier: teacherIdentity.tokenIdentifier,
        instruction: 'Also add a case study slide.',
      }),
    ).rejects.toThrow('already in progress')

    const preview = await teacher.query(api.prep.getPresentationPreview, {
      presentationId,
    })
    expect(preview.editStatus).toBe('editing')
    expect(preview.downloadStatus).toBe('regenerating')
    const messages = await teacher.query(api.prep.listPresentationMessages, {
      presentationId,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: 'teacher',
      body: 'Make slide 1 more discussion oriented.',
    })
  })

  it('hides prep workspaces once their class is deleted', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })

    await teacher.mutation(api.sessions.deleteSession, { sessionId })

    await expect(
      teacher.query(api.prep.getWorkspace, { workspaceId }),
    ).rejects.toThrow('Session not found')
    await expect(
      teacher.mutation(api.prep.updatePrepBrief, {
        workspaceId,
        prepBrief: 'This should no longer be editable.',
      }),
    ).rejects.toThrow('Session not found')
    const mine = await teacher.query(api.prep.listMyWorkspaces, {})
    expect(mine).toHaveLength(0)
  })

  it('rejects stored files that exceed prep upload limits', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Prep Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})
    const { workspaceId } = await teacher.mutation(api.prep.createWorkspace, {
      sessionId,
    })
    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(
        new Blob([new Uint8Array(MAX_PREP_DOCUMENT_UPLOAD_BYTES + 1)], {
          type: 'application/pdf',
        }),
      ),
    )

    await expect(
      teacher.mutation(api.prep.saveUploadedDocument, {
        workspaceId,
        storageId,
        kind: 'document',
        fileName: 'too-large.pdf',
        mimeType: 'application/pdf',
        size: 1,
      }),
    ).rejects.toThrow('document uploads are limited')
  })

  it('caps source documents before building an LLM prompt', () => {
    const { documentText, sourceDocuments } = buildCappedSourceDocuments([
      {
        fileName: 'one.txt',
        extractedText: 'a'.repeat(MAX_LLM_DOCUMENT_CONTEXT_CHARS),
      },
      {
        fileName: 'two.txt',
        extractedText: 'b'.repeat(MAX_LLM_DOCUMENT_CONTEXT_CHARS),
      },
    ])

    expect(documentText.length).toBeLessThanOrEqual(
      MAX_LLM_DOCUMENT_CONTEXT_CHARS,
    )
    expect(sourceDocuments[0].text.length).toBeLessThan(
      MAX_LLM_DOCUMENT_CONTEXT_CHARS,
    )
    expect(sourceDocuments.at(-1)?.text.length).toBeLessThan(
      MAX_LLM_DOCUMENT_CONTEXT_CHARS,
    )
  })

  it('keeps presentation slide specs up to the product max with stable ids', () => {
    const fallback = {
      title: 'Fallback deck',
      slides: [
        {
          id: 'slide-01-fallback',
          type: 'title' as const,
          title: 'Fallback deck',
          bullets: [],
          speakerNotes: '',
        },
      ],
    }
    const result = normalizeSlideSpec(
      {
        title: 'Expanded deck',
        slides: Array.from({ length: MAX_PRESENTATION_SLIDES + 5 }, (_, i) => ({
          type: 'concept',
          title: `Expanded slide ${i + 1}`,
          bullets: [`Point ${i + 1}`],
          speakerNotes: `Notes ${i + 1}`,
        })),
      },
      fallback,
    )

    expect(result.slides).toHaveLength(MAX_PRESENTATION_SLIDES)
    expect(result.slides[0]).toMatchObject({
      id: 'slide-01-expanded-slide-1',
      title: 'Expanded slide 1',
    })
    expect(result.slides.at(-1)?.title).toBe(
      `Expanded slide ${MAX_PRESENTATION_SLIDES}`,
    )
  })

  it('preserves presentation images unless the edit explicitly removes them', () => {
    const fallback = {
      title: 'Image deck',
      slides: [
        {
          id: 'slide-01-case-study',
          type: 'concept' as const,
          title: 'Case study',
          bullets: ['Original point'],
          speakerNotes: 'Original notes',
          imageFileName: 'case-study.png',
        },
        {
          id: 'slide-02-wrap-up',
          type: 'summary' as const,
          title: 'Wrap up',
          bullets: ['Close'],
          speakerNotes: 'Close notes',
          imageFileName: 'wrap-up.png',
        },
      ],
    }
    const result = normalizeSlideSpec(
      {
        title: 'Image deck',
        slides: [
          {
            id: 'slide-01-case-study',
            type: 'concept',
            title: 'Case study',
            bullets: ['Updated point'],
            speakerNotes: 'Updated notes',
          },
          {
            id: 'slide-02-wrap-up',
            type: 'summary',
            title: 'Wrap up',
            bullets: ['Close'],
            speakerNotes: 'Close notes',
            imageFileName: 'wrapup.png',
          },
          {
            id: 'slide-03-no-image',
            type: 'summary',
            title: 'No image',
            bullets: ['Close'],
            speakerNotes: 'Close notes',
            imageFileName: '',
          },
        ],
      },
      fallback,
      ['case-study.png', 'wrap-up.png'],
    )

    expect(result.slides[0].imageFileName).toBe('case-study.png')
    expect(result.slides[1].imageFileName).toBe('wrap-up.png')
    expect(result.slides[2].imageFileName).toBeUndefined()

    const moved = normalizeSlideSpec(
      {
        title: 'Moved image deck',
        slides: [
          {
            id: 'slide-01-case-study',
            type: 'concept',
            title: 'Case study',
            bullets: ['Updated point'],
            speakerNotes: 'Updated notes',
          },
          {
            id: 'slide-02-wrap-up',
            type: 'summary',
            title: 'Wrap up',
            bullets: ['Close'],
            speakerNotes: 'Close notes',
            imageFileName: 'case-study.png',
          },
        ],
      },
      fallback,
      ['case-study.png', 'wrap-up.png'],
    )
    expect(moved.slides[0].imageFileName).toBeUndefined()
    expect(moved.slides[1].imageFileName).toBe('case-study.png')
  })

  it('falls back to placing uploaded images when the model omits them', () => {
    const slideSpec = {
      title: 'Image deck',
      slides: [
        {
          id: 'slide-01-title',
          type: 'title' as const,
          title: 'Image deck',
          bullets: [],
          speakerNotes: '',
        },
        {
          id: 'slide-02-context',
          type: 'concept' as const,
          title: 'Context',
          bullets: ['Set the frame'],
          speakerNotes: '',
        },
        {
          id: 'slide-03-case',
          type: 'activity' as const,
          title: 'Case analysis',
          bullets: ['Apply the tool'],
          speakerNotes: '',
        },
      ],
    }

    const result = ensureImagePlacements(slideSpec, [
      'el-salvador-map.png',
      'norway-1942.jpg',
    ])

    expect(result.slides[0].imageFileName).toBeUndefined()
    expect(result.slides[1].imageFileName).toBe('el-salvador-map.png')
    expect(result.slides[2].imageFileName).toBe('norway-1942.jpg')
  })

  it('matches image filenames loosely when normalizing model output', () => {
    const fallback = {
      title: 'Image deck',
      slides: [
        {
          id: 'slide-01-case',
          type: 'concept' as const,
          title: 'Case',
          bullets: [],
          speakerNotes: '',
        },
      ],
    }

    const result = normalizeSlideSpec(
      {
        title: 'Image deck',
        slides: [
          {
            id: 'slide-01-case',
            type: 'concept',
            title: 'Case',
            bullets: ['Analyze the campaign'],
            speakerNotes: '',
            imageFileName: 'El Salvador Map',
          },
        ],
      },
      fallback,
      ['el-salvador-map.png'],
    )

    expect(result.slides[0].imageFileName).toBe('el-salvador-map.png')
  })

  it('moves an image between slides without requiring an AI JSON response', () => {
    const slideSpec = {
      title: 'Image deck',
      slides: [
        {
          id: 'slide-01-title',
          type: 'title' as const,
          title: 'Image deck',
          bullets: [],
          speakerNotes: '',
        },
        {
          id: 'slide-02-context',
          type: 'concept' as const,
          title: 'Context',
          bullets: [],
          speakerNotes: '',
        },
        {
          id: 'slide-03-action',
          type: 'concept' as const,
          title: 'Action',
          bullets: [],
          speakerNotes: '',
        },
        {
          id: 'slide-04-map',
          type: 'concept' as const,
          title: 'Map',
          bullets: [],
          speakerNotes: '',
          imageFileName: 'el-salvador-map.png',
        },
        {
          id: 'slide-05-debrief',
          type: 'summary' as const,
          title: 'Debrief',
          bullets: [],
          speakerNotes: '',
        },
      ],
    }

    const result = applyDeterministicPresentationEdit(
      slideSpec,
      'move image from slide 4 to slide 5',
    )

    expect(result?.slides[3].imageFileName).toBeUndefined()
    expect(result?.slides[4].imageFileName).toBe('el-salvador-map.png')
  })
})
