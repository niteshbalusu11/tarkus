import { convexTest } from 'convex-test'
import type { UserIdentity } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import { modules } from './test.setup'

const teacherIdentity = {
  issuer: 'test',
  subject: 'teacher',
  tokenIdentifier: 'test|teacher',
  name: 'Trainer',
} satisfies Partial<UserIdentity>

const studentIdentity = {
  issuer: 'test',
  subject: 'student',
  tokenIdentifier: 'test|student',
  name: 'Token Student',
} satisfies Partial<UserIdentity>

const secondTeacherIdentity = {
  issuer: 'test',
  subject: 'second-teacher',
  tokenIdentifier: 'test|second-teacher',
  name: 'Other Trainer',
} satisfies Partial<UserIdentity>

function newTestBackend() {
  return convexTest(schema, modules)
}

describe('sessions auth and participant identity', () => {
  it('requires authentication before creating or joining a session', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const { code } = await teacher.mutation(api.sessions.createSession, {})

    await expect(t.mutation(api.sessions.createSession, {})).rejects.toThrow(
      'Not authenticated',
    )
    await expect(
      t.mutation(api.sessions.joinSessionByCode, {
        code,
        displayName: 'Maya',
      }),
    ).rejects.toThrow('Not authenticated')
  })

  it('keeps teacher session access scoped to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(secondTeacherIdentity)
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      otherTeacher.query(api.sessions.getTeacherSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')

    const session = await teacher.query(api.sessions.getTeacherSession, {
      sessionId,
    })
    expect(session.teacherTokenIdentifier).toBe(
      teacherIdentity.tokenIdentifier,
    )
  })

  it('blocks students from a session until they join with the class code', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      student.query(api.sessions.getStudentSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
  })

  it('uses the participant display name for chat and Pillars submissions', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    const { sessionId, activityId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Maya',
    })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'I am unsure who can actually change the uniform policy.',
      isAnonymous: false,
    })
    await student.mutation(api.sessions.submitPillarsExercise, {
      sessionId,
      activityId,
      payload: {
        decisionMaker: 'School board',
        pillars: [
          {
            id: 'principal',
            name: 'Principal',
            importance: 4,
            accessibility: 3,
            rationale: 'Can influence the board.',
          },
        ],
        sequence: ['Principal'],
        reflection: 'Start with the principal before escalating.',
      },
    })

    const messages = await teacher.query(api.sessions.listMessages, {
      sessionId,
    })
    const submissions = await teacher.query(
      api.sessions.listActivitySubmissions,
      { sessionId },
    )

    expect(messages).toMatchObject([
      {
        authorRole: 'student',
        displayName: 'Maya',
        isAnonymous: false,
      },
    ])
    expect(submissions).toMatchObject([
      {
        displayName: 'Maya',
        type: 'pillars',
      },
    ])
  })

  it('updates an existing participant name on rejoin and preserves anonymous chat', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    const { sessionId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'First Name',
    })
    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Updated Name',
    })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'Use my updated name.',
      isAnonymous: false,
    })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'Keep this one anonymous.',
      isAnonymous: true,
    })

    const participants = await teacher.query(api.sessions.listParticipants, {
      sessionId,
    })
    const messages = await teacher.query(api.sessions.listMessages, {
      sessionId,
    })

    expect(participants).toMatchObject([{ displayName: 'Updated Name' }])
    expect(messages).toMatchObject([
      { displayName: 'Updated Name', isAnonymous: false },
      { displayName: 'Anonymous', isAnonymous: true },
    ])
  })
})
