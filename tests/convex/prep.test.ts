import { convexTest } from 'convex-test'
import type { UserIdentity } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import {
  MAX_LLM_DOCUMENT_CONTEXT_CHARS,
  MAX_PREP_DOCUMENT_UPLOAD_BYTES,
} from '../../convex/prepLimits'
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

    const prepForSession = await teacher.query(api.prep.getWorkspaceForSession, {
      sessionId,
    })
    expect(prepForSession.workspace?._id).toBe(workspaceId)

    const workspace = await teacher.query(api.prep.getWorkspace, {
      workspaceId,
    })
    expect(workspace.title).toBe('Private curriculum')
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
})
