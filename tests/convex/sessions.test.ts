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

describe('sessions auth and participant identity', () => {
  it('requires authentication before creating or joining a session', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
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

  it('requires onboarding before protected session functions', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)

    await expect(
      teacher.mutation(api.sessions.createSession, {}),
    ).rejects.toThrow('Onboarding required')
  })

  it('enforces account type on teacher and student entry points', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { code } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      student.mutation(api.sessions.createSession, {}),
    ).rejects.toThrow('Only teachers can use this')
    await expect(
      teacher.mutation(api.sessions.joinSessionByCode, {
        code,
        displayName: 'Trainer',
      }),
    ).rejects.toThrow('Only students can use this')
  })

  it('does not let onboarding change an existing account role', async () => {
    const t = newTestBackend()
    const student = t.withIdentity(studentIdentity)
    await onboard(t, studentIdentity, 'student', 'Maya')

    await student.mutation(api.users.completeOnboarding, {
      displayName: 'Maya Updated',
      role: 'teacher',
    })

    const currentUser = await student.query(api.users.getCurrentUser, {})
    expect(currentUser.profile).toMatchObject({
      displayName: 'Maya Updated',
      role: 'student',
    })
    await expect(
      student.mutation(api.sessions.createSession, {}),
    ).rejects.toThrow('Only teachers can use this')
  })

  it('keeps teacher session access scoped to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(secondTeacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, secondTeacherIdentity, 'teacher', 'Other Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      otherTeacher.query(api.sessions.getTeacherSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')

    const session = await teacher.query(api.sessions.getTeacherSession, {
      sessionId,
    })
    expect(session.teacherTokenIdentifier).toBe(teacherIdentity.tokenIdentifier)
  })

  it('blocks students from a session until they join with the class code', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      student.query(api.sessions.getStudentSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
  })

  it('creates classes waiting to start and lets students join before start', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { sessionId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    const teacherSession = await teacher.query(api.sessions.getTeacherSession, {
      sessionId,
    })
    expect(teacherSession.status).toBe('not_started')

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Maya',
    })
    const studentSession = await student.query(api.sessions.getStudentSession, {
      sessionId,
    })
    expect(studentSession.session.status).toBe('not_started')
  })

  it('only allows student writes while the class is active', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { sessionId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Maya',
    })
    await expect(
      student.mutation(api.sessions.sendMessage, {
        sessionId,
        body: 'Can we begin?',
        isAnonymous: false,
      }),
    ).rejects.toThrow('Class is not active')

    await teacher.mutation(api.sessions.startSession, { sessionId })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'Now I can participate.',
      isAnonymous: false,
    })

    await teacher.mutation(api.sessions.stopSession, { sessionId })
    await expect(
      student.mutation(api.sessions.sendMessage, {
        sessionId,
        body: 'This should wait.',
        isAnonymous: false,
      }),
    ).rejects.toThrow('Class is not active')

    await teacher.mutation(api.sessions.startSession, { sessionId })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'Restarted.',
      isAnonymous: false,
    })

    await teacher.mutation(api.sessions.endSession, { sessionId })
    const ended = await teacher.query(api.sessions.getTeacherSession, {
      sessionId,
    })
    expect(ended.status).toBe('ended')
    const teacherSessions = await teacher.query(
      api.sessions.listMyTeacherSessions,
      {},
    )
    expect(teacherSessions).toEqual(
      expect.arrayContaining([expect.objectContaining({ _id: sessionId })]),
    )
    await expect(
      student.mutation(api.sessions.sendMessage, {
        sessionId,
        body: 'After end.',
        isAnonymous: false,
      }),
    ).rejects.toThrow('Class is not active')
    await expect(
      student.mutation(api.sessions.joinSessionByCode, {
        code,
        displayName: 'Maya',
      }),
    ).rejects.toThrow('This class has ended')
  })

  it('restricts lifecycle controls to the owning teacher', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const otherTeacher = t.withIdentity(secondTeacherIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, secondTeacherIdentity, 'teacher', 'Other Trainer')
    const { sessionId } = await teacher.mutation(api.sessions.createSession, {})

    await expect(
      otherTeacher.mutation(api.sessions.startSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
    await teacher.mutation(api.sessions.startSession, { sessionId })
    await expect(
      otherTeacher.mutation(api.sessions.stopSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
    await expect(
      otherTeacher.mutation(api.sessions.endSession, { sessionId }),
    ).rejects.toThrow('Unauthorized')
  })

  it('uses the participant display name for chat and Pillars submissions', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { sessionId, activityId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Maya',
    })
    await teacher.mutation(api.sessions.startSession, { sessionId })
    await student.mutation(api.sessions.sendMessage, {
      sessionId,
      body: 'I am unsure who can actually change the uniform policy.',
      isAnonymous: false,
    })
    await student.mutation(api.sessions.submitPillarsExercise, {
      sessionId,
      activityId,
      payload: {
        version: 2,
        exercise: 'school-uniform-pillars',
        scenario: 'School uniform policy',
        powerHolder: 'School board',
        pillars: [
          {
            id: 'principal',
            name: 'Principal',
            accessibility: 3,
            role: 'Can influence the board.',
          },
          {
            id: 'parents',
            name: 'Parents association',
            accessibility: 4,
            role: 'Can pressure administrators.',
          },
          {
            id: 'teachers',
            name: 'Teachers',
            accessibility: 5,
            role: 'Enforce the policy daily.',
          },
        ],
        moves: [
          {
            rank: 1,
            pillarId: 'teachers',
            pillarName: 'Teachers',
            why: 'They are easy to reach and enforce the rule.',
          },
          {
            rank: 2,
            pillarId: 'parents',
            pillarName: 'Parents association',
            why: 'They can widen support.',
          },
          {
            rank: 3,
            pillarId: 'principal',
            pillarName: 'Principal',
            why: 'Approach with broader backing.',
          },
        ],
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

  it('validates structured Pillars v2 submissions', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
    const { sessionId, activityId, code } = await teacher.mutation(
      api.sessions.createSession,
      {},
    )

    await student.mutation(api.sessions.joinSessionByCode, {
      code,
      displayName: 'Maya',
    })
    await teacher.mutation(api.sessions.startSession, { sessionId })

    await expect(
      student.mutation(api.sessions.submitPillarsExercise, {
        sessionId,
        activityId,
        payload: {
          version: 2,
          powerHolder: 'Principal',
          pillars: [{ id: 'teachers', name: 'Teachers', accessibility: 6 }],
          moves: [],
          reflection: 'Incomplete.',
        },
      }),
    ).rejects.toThrow('Three ordered moves are required')
  })

  it('updates an existing participant name on rejoin and preserves anonymous chat', async () => {
    const t = newTestBackend()
    const teacher = t.withIdentity(teacherIdentity)
    const student = t.withIdentity(studentIdentity)
    await onboard(t, teacherIdentity, 'teacher', 'Trainer')
    await onboard(t, studentIdentity, 'student', 'Maya')
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
    await teacher.mutation(api.sessions.startSession, { sessionId })
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
