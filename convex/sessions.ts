import { v } from 'convex/values'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import { getUserProfileByTokenIdentifier } from './users'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const JOINABLE_SESSION_STATUSES = new Set(['not_started', 'active', 'stopped'])

const PILLARS_CONFIG = {
  scenario:
    'You are a high school student. You and your classmates want to change the mandatory uniform policy. You are not going to riot or just complain. You are going to think strategically.',
  prompts: [
    'Who has the actual power to change the uniform policy?',
    'What groups, institutions, or people help keep the current policy in place?',
    'Rate each pillar by accessibility from 1 to 5.',
    'Order your first, second, and third moves, then explain why.',
    'Reflect on how accessibility changed your strategy.',
  ],
}

const INTAKE_CONFIG = {
  title: 'Student Intake Form',
  description:
    'Complete before the session begins. This helps your trainer understand who is in the room.',
}

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
}

function makeCode() {
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

function displayNameFromIdentity(identity: {
  name?: string
  email?: string
  nickname?: string
}) {
  return identity.name || identity.nickname || identity.email || 'Participant'
}

function isJoinableSessionStatus(status: Doc<'sessions'>['status']) {
  return JOINABLE_SESSION_STATUSES.has(status)
}

function assertSessionIsActive(session: Doc<'sessions'>) {
  if (session.status !== 'active') {
    throw new Error('Class is not active')
  }
}

async function requireProfile(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity,
) {
  const profile = await getUserProfileByTokenIdentifier(
    ctx,
    identity.tokenIdentifier,
  )
  if (!profile) {
    throw new Error('Onboarding required')
  }
  return profile
}

async function requireProfileRole(
  ctx: QueryCtx | MutationCtx,
  identity: UserIdentity,
  role: 'student' | 'teacher',
) {
  const profile = await requireProfile(ctx, identity)
  if (profile.role !== role) {
    throw new Error(`Only ${role}s can use this`)
  }
  return profile
}

async function assertTeacherOwnsSession(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'sessions'>,
  tokenIdentifier: string,
) {
  const session = await ctx.db.get(sessionId)
  if (!session || session.status === 'deleted') {
    throw new Error('Session not found')
  }
  if (session.teacherTokenIdentifier !== tokenIdentifier) {
    throw new Error('Unauthorized')
  }
  return session
}

async function assertCanAccessSession(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<'sessions'>,
  tokenIdentifier: string,
) {
  const session = await ctx.db.get(sessionId)
  if (!session || session.status === 'deleted') {
    throw new Error('Session not found')
  }
  const profile = await getUserProfileByTokenIdentifier(ctx, tokenIdentifier)
  if (!profile) {
    throw new Error('Onboarding required')
  }
  if (session.teacherTokenIdentifier === tokenIdentifier) {
    if (profile.role !== 'teacher') {
      throw new Error('Unauthorized')
    }
    return { session, role: 'teacher' as const, participant: null }
  }
  if (profile.role !== 'student') {
    throw new Error('Unauthorized')
  }
  const participant = await ctx.db
    .query('sessionParticipants')
    .withIndex('by_sessionId_and_studentTokenIdentifier', (q) =>
      q
        .eq('sessionId', sessionId)
        .eq('studentTokenIdentifier', tokenIdentifier),
    )
    .unique()
  if (!participant) {
    throw new Error('Unauthorized')
  }
  return { session, role: 'student' as const, participant }
}

async function ensureIntakeActivity(
  ctx: MutationCtx,
  sessionId: Id<'sessions'>,
) {
  const existing = await ctx.db
    .query('activities')
    .withIndex('by_sessionId_and_type', (q) =>
      q.eq('sessionId', sessionId).eq('type', 'intake'),
    )
    .first()
  if (existing) {
    return existing
  }
  const activityId = await ctx.db.insert('activities', {
    sessionId,
    type: 'intake',
    title: 'Student Intake Form',
    status: 'open',
    config: INTAKE_CONFIG,
    createdAt: Date.now(),
  })
  return await ctx.db.get(activityId)
}

function displayNameFromParticipant(
  participant: Doc<'sessionParticipants'> | null,
  identity: UserIdentity,
) {
  return participant?.displayName?.trim() || displayNameFromIdentity(identity)
}

function assertShortText(value: unknown, label: string, maxLength = 2000) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} is required`)
  }
  if (value.length > maxLength) {
    throw new Error(`${label} is too long`)
  }
}

function validatePillarsPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Pillars payload is required')
  }

  const value = payload as {
    version?: unknown
    powerHolder?: unknown
    decisionMaker?: unknown
    pillars?: unknown
    moves?: unknown
    sequence?: unknown
    reflection?: unknown
  }

  if (!Array.isArray(value.pillars) || value.pillars.length === 0) {
    throw new Error('At least one pillar is required')
  }
  if (value.pillars.length > 10) {
    throw new Error('Pillars are limited to 10')
  }

  if (value.version === 2) {
    assertShortText(value.powerHolder, 'Power holder')
    if (!Array.isArray(value.moves) || value.moves.length < 3) {
      throw new Error('Three ordered moves are required')
    }
    for (const [index, rawPillar] of value.pillars.entries()) {
      const pillar = rawPillar as { name?: unknown; accessibility?: unknown }
      assertShortText(pillar.name, `Pillar ${index + 1} name`, 120)
      const accessibility = Number(pillar.accessibility)
      if (
        !Number.isFinite(accessibility) ||
        accessibility < 1 ||
        accessibility > 5
      ) {
        throw new Error('Pillar accessibility must be between 1 and 5')
      }
    }
    for (const [index, rawMove] of value.moves.entries()) {
      const move = rawMove as { pillarName?: unknown; why?: unknown }
      assertShortText(move.pillarName, `Move ${index + 1} pillar`, 120)
      assertShortText(move.why, `Move ${index + 1} reason`)
    }
    assertShortText(value.reflection, 'Reflection')
    return
  }

  assertShortText(value.decisionMaker, 'Decision maker')
  assertShortText(value.reflection, 'Reflection')
}

function assertLikert(value: unknown, label: string) {
  const rating = Number(value)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error(`${label} must be between 1 and 5`)
  }
}

function validateIntakePayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Intake payload is required')
  }

  const value = payload as {
    version?: unknown
    form?: unknown
    ageRange?: unknown
    country?: unknown
    priorTraining?: unknown
    violenceEffective?: unknown
    weaponsMoneyPower?: unknown
    peoplePower?: unknown
    nonviolenceWord?: unknown
    authoritarianChange?: unknown
  }

  if (value.version !== 1 || value.form !== 'student-intake') {
    throw new Error('Unsupported intake form')
  }
  assertShortText(value.ageRange, 'Age range', 40)
  assertShortText(value.country, 'Country', 120)
  assertShortText(value.priorTraining, 'Prior training', 120)
  assertLikert(value.violenceEffective, 'Violence rating')
  assertLikert(value.weaponsMoneyPower, 'Power rating')
  assertLikert(value.peoplePower, 'Strategy rating')

  if (
    value.nonviolenceWord !== undefined &&
    typeof value.nonviolenceWord !== 'string'
  ) {
    throw new Error('Nonviolence response must be text')
  }
  if (
    value.authoritarianChange !== undefined &&
    typeof value.authoritarianChange !== 'string'
  ) {
    throw new Error('Change response must be text')
  }
}

export const createSession = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const profile = await requireProfileRole(ctx, identity, 'teacher')
    const now = Date.now()
    let code = makeCode()
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const existing = await ctx.db
        .query('sessions')
        .withIndex('by_code', (q) => q.eq('code', code))
        .collect()
      if (
        !existing.some((session) => isJoinableSessionStatus(session.status))
      ) {
        break
      }
      code = makeCode()
    }

    const sessionId = await ctx.db.insert('sessions', {
      teacherTokenIdentifier: identity.tokenIdentifier,
      teacherName: profile.displayName,
      code,
      title: args.title || 'Pillars of Support Live Session',
      status: 'not_started',
      expiresAt: now + SESSION_DURATION_MS,
      createdAt: now,
    })

    const activityId = await ctx.db.insert('activities', {
      sessionId,
      type: 'pillars',
      title: 'Pillars of Support: School Uniforms',
      status: 'closed',
      config: PILLARS_CONFIG,
      createdAt: now,
    })

    await ctx.db.insert('activities', {
      sessionId,
      type: 'intake',
      title: 'Student Intake Form',
      status: 'open',
      config: INTAKE_CONFIG,
      createdAt: now,
    })

    return { sessionId, activityId, code }
  },
})

export const listMyTeacherSessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    const sessionsByStatus = await Promise.all(
      (['not_started', 'active', 'stopped', 'ended'] as const).map((status) =>
        ctx.db
          .query('sessions')
          .withIndex('by_teacherTokenIdentifier_and_status', (q) =>
            q
              .eq('teacherTokenIdentifier', identity.tokenIdentifier)
              .eq('status', status),
          )
          .order('desc')
          .take(10),
      ),
    )
    return sessionsByStatus
      .flat()
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 20)
  },
})

export const getTeacherSession = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    return await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
  },
})

export const joinSessionByCode = mutation({
  args: { code: v.string(), displayName: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const profile = await requireProfileRole(ctx, identity, 'student')
    const normalizedCode = args.code.trim().toUpperCase()
    const sessions = await ctx.db
      .query('sessions')
      .withIndex('by_code', (q) => q.eq('code', normalizedCode))
      .collect()
    const session = sessions.find((candidate) =>
      isJoinableSessionStatus(candidate.status),
    )

    if (!session) {
      if (sessions.some((candidate) => candidate.status === 'ended')) {
        throw new Error('This class has ended')
      }
      throw new Error('Class code not found')
    }
    if (session.expiresAt < Date.now()) {
      throw new Error('Session code has expired')
    }
    if (session.teacherTokenIdentifier === identity.tokenIdentifier) {
      throw new Error('Teachers should use the teacher dashboard')
    }

    const existing = await ctx.db
      .query('sessionParticipants')
      .withIndex('by_sessionId_and_studentTokenIdentifier', (q) =>
        q
          .eq('sessionId', session._id)
          .eq('studentTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    if (existing) {
      await ensureIntakeActivity(ctx, session._id)
      const displayName = args.displayName?.trim()
      await ctx.db.patch(existing._id, {
        lastSeenAt: Date.now(),
        ...(displayName ? { displayName } : {}),
      })
      return { sessionId: session._id, participantId: existing._id }
    }

    await ensureIntakeActivity(ctx, session._id)

    const participantId = await ctx.db.insert('sessionParticipants', {
      sessionId: session._id,
      studentTokenIdentifier: identity.tokenIdentifier,
      displayName: args.displayName?.trim() || profile.displayName || 'Student',
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
    })

    return { sessionId: session._id, participantId }
  },
})

export const getStudentSession = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'student')
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    const activity = await ctx.db
      .query('activities')
      .withIndex('by_sessionId_and_type', (q) =>
        q.eq('sessionId', args.sessionId).eq('type', 'pillars'),
      )
      .first()
    return { session: access.session, role: access.role, activity }
  },
})

export const listParticipants = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await assertCanAccessSession(ctx, args.sessionId, identity.tokenIdentifier)
    return await ctx.db
      .query('sessionParticipants')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .take(100)
  },
})

export const listMessages = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await assertCanAccessSession(ctx, args.sessionId, identity.tokenIdentifier)
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_sessionId_and_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('asc')
      .take(200)
    return messages.filter((message) => !message.deletedAt)
  },
})

export const sendMessage = mutation({
  args: {
    sessionId: v.id('sessions'),
    body: v.string(),
    isAnonymous: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    assertSessionIsActive(access.session)
    const body = args.body.trim()
    if (!body) {
      throw new Error('Message cannot be empty')
    }

    return await ctx.db.insert('chatMessages', {
      sessionId: args.sessionId,
      authorTokenIdentifier: identity.tokenIdentifier,
      authorRole: access.role,
      displayName: args.isAnonymous
        ? 'Anonymous'
        : displayNameFromParticipant(access.participant, identity),
      body,
      isAnonymous: args.isAnonymous,
      createdAt: Date.now(),
    })
  },
})

export const listActivitySubmissions = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await assertCanAccessSession(ctx, args.sessionId, identity.tokenIdentifier)
    const activity = await ctx.db
      .query('activities')
      .withIndex('by_sessionId_and_type', (q) =>
        q.eq('sessionId', args.sessionId).eq('type', 'pillars'),
      )
      .first()
    if (!activity) {
      return []
    }
    return await ctx.db
      .query('activitySubmissions')
      .withIndex('by_activityId', (q) => q.eq('activityId', activity._id))
      .order('asc')
      .take(100)
  },
})

export const getMyPillarsSubmission = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (access.role !== 'student') {
      throw new Error('Only students can view their submission')
    }
    const activity = await ctx.db
      .query('activities')
      .withIndex('by_sessionId_and_type', (q) =>
        q.eq('sessionId', args.sessionId).eq('type', 'pillars'),
      )
      .first()
    if (!activity) {
      return null
    }
    return await ctx.db
      .query('activitySubmissions')
      .withIndex('by_activityId_and_studentTokenIdentifier', (q) =>
        q
          .eq('activityId', activity._id)
          .eq('studentTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
  },
})

export const getMyIntakeSubmission = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (access.role !== 'student') {
      throw new Error('Only students can view their intake')
    }
    const activity = await ctx.db
      .query('activities')
      .withIndex('by_sessionId_and_type', (q) =>
        q.eq('sessionId', args.sessionId).eq('type', 'intake'),
      )
      .first()
    if (!activity) {
      return null
    }
    return await ctx.db
      .query('activitySubmissions')
      .withIndex('by_activityId_and_studentTokenIdentifier', (q) =>
        q
          .eq('activityId', activity._id)
          .eq('studentTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
  },
})

export const submitIntakeForm = mutation({
  args: {
    sessionId: v.id('sessions'),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (access.role !== 'student') {
      throw new Error('Only students can submit intake forms')
    }
    if (access.session.status === 'ended') {
      throw new Error('Class has ended')
    }
    validateIntakePayload(args.payload)

    const activity = await ensureIntakeActivity(ctx, args.sessionId)
    if (!activity) {
      throw new Error('Intake form unavailable')
    }

    const existing = await ctx.db
      .query('activitySubmissions')
      .withIndex('by_activityId_and_studentTokenIdentifier', (q) =>
        q
          .eq('activityId', activity._id)
          .eq('studentTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayNameFromParticipant(access.participant, identity),
        payload: args.payload,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('activitySubmissions', {
      sessionId: args.sessionId,
      activityId: activity._id,
      studentTokenIdentifier: identity.tokenIdentifier,
      displayName: displayNameFromParticipant(access.participant, identity),
      type: 'intake',
      payload: args.payload,
      submittedAt: now,
      updatedAt: now,
    })
  },
})

export const submitPillarsExercise = mutation({
  args: {
    sessionId: v.id('sessions'),
    activityId: v.id('activities'),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const access = await assertCanAccessSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (access.role !== 'student') {
      throw new Error('Only students can submit assessments')
    }
    assertSessionIsActive(access.session)
    validatePillarsPayload(args.payload)
    const existing = await ctx.db
      .query('activitySubmissions')
      .withIndex('by_activityId_and_studentTokenIdentifier', (q) =>
        q
          .eq('activityId', args.activityId)
          .eq('studentTokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName: displayNameFromParticipant(access.participant, identity),
        payload: args.payload,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('activitySubmissions', {
      sessionId: args.sessionId,
      activityId: args.activityId,
      studentTokenIdentifier: identity.tokenIdentifier,
      displayName: displayNameFromParticipant(access.participant, identity),
      type: 'pillars',
      payload: args.payload,
      submittedAt: now,
      updatedAt: now,
    })
  },
})

export const getLatestAnalysis = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await assertCanAccessSession(ctx, args.sessionId, identity.tokenIdentifier)
    return await ctx.db
      .query('aiAnalyses')
      .withIndex('by_sessionId_and_kind_and_createdAt', (q) =>
        q.eq('sessionId', args.sessionId).eq('kind', 'live_summary'),
      )
      .order('desc')
      .first()
  },
})

export const endSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (session.status === 'ended') {
      return null
    }
    const now = Date.now()
    await ctx.db.patch(args.sessionId, { status: 'ended', endedAt: now })
    const activities = await ctx.db
      .query('activities')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    await Promise.all(
      activities.map((activity) =>
        ctx.db.patch(activity._id, { status: 'closed' }),
      ),
    )
    return null
  },
})

export const startSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (session.status === 'ended') {
      throw new Error('Ended classes cannot be restarted')
    }
    if (session.status === 'active') {
      return null
    }
    const now = Date.now()
    await ctx.db.patch(args.sessionId, {
      status: 'active',
      startedAt: session.startedAt || now,
    })
    const activities = await ctx.db
      .query('activities')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    await Promise.all(
      activities.map((activity) =>
        ctx.db.patch(activity._id, { status: 'open' }),
      ),
    )
    return null
  },
})

export const stopSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (session.status === 'ended') {
      throw new Error('Ended classes cannot be stopped')
    }
    if (session.status !== 'active') {
      return null
    }
    const now = Date.now()
    await ctx.db.patch(args.sessionId, { status: 'stopped', stoppedAt: now })
    const activities = await ctx.db
      .query('activities')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .collect()
    await Promise.all(
      activities.map((activity) =>
        ctx.db.patch(activity._id, { status: 'closed' }),
      ),
    )
    return null
  },
})

export const deleteSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    const now = Date.now()
    await ctx.db.patch(args.sessionId, {
      status: 'deleted',
      deletedAt: now,
      endedAt: now,
    })
  },
})

export const seedDemoSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireProfileRole(ctx, identity, 'teacher')
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    if (session.status === 'ended') {
      throw new Error('Ended classes cannot be changed')
    }
    const activity = await ctx.db
      .query('activities')
      .withIndex('by_sessionId_and_type', (q) =>
        q.eq('sessionId', args.sessionId).eq('type', 'pillars'),
      )
      .first()
    if (!activity) {
      throw new Error('Pillars activity not found')
    }

    const now = Date.now()
    const students = [
      'Maya',
      'Omar',
      'Leila',
      'Sam',
      'Iris',
      'Niko',
      'Ana',
      'Dev',
    ]

    for (const [index, name] of students.entries()) {
      const token = `demo:${args.sessionId}:${name}`
      const existing = await ctx.db
        .query('sessionParticipants')
        .withIndex('by_sessionId_and_studentTokenIdentifier', (q) =>
          q.eq('sessionId', args.sessionId).eq('studentTokenIdentifier', token),
        )
        .unique()
      if (!existing) {
        await ctx.db.insert('sessionParticipants', {
          sessionId: args.sessionId,
          studentTokenIdentifier: token,
          displayName: name,
          joinedAt: now + index,
          lastSeenAt: now + index,
        })
      }
    }

    const messages = [
      [
        'Maya',
        'I understand the principal has formal authority, but who actually enforces uniforms day to day?',
      ],
      ['Omar', 'Are parents a pillar, or only if they are organized somehow?'],
      [
        'Leila',
        'It seems like school tradition matters, but I am not sure if tradition counts as a pillar.',
      ],
      [
        'Sam',
        'Why not start with the school board if they can change the policy directly?',
      ],
      [
        'Iris',
        'Teachers feel accessible, but they may not have the most power.',
      ],
      [
        'Niko',
        'The uniform supplier seems easy to miss because they are outside the school.',
      ],
      [
        'Ana',
        'I am confused about the difference between influence and importance.',
      ],
      [
        'Dev',
        'Students are affected most, but maybe they are not organized enough yet.',
      ],
    ]

    for (const [index, [name, body]] of messages.entries()) {
      await ctx.db.insert('chatMessages', {
        sessionId: args.sessionId,
        authorTokenIdentifier: `demo:${args.sessionId}:${name}`,
        authorRole: 'student',
        displayName: name,
        body,
        isAnonymous: false,
        createdAt: now + index * 1000,
      })
    }

    const submissions = [
      {
        name: 'Maya',
        decisionMaker:
          'The principal and the district administration together.',
        pillars: [
          ['Principal', 5, 2],
          ['Teachers', 4, 4],
          ['Parents association', 4, 3],
          ['Student council', 3, 5],
        ],
      },
      {
        name: 'Omar',
        decisionMaker: 'School board.',
        pillars: [
          ['School board', 5, 1],
          ['Parents association', 4, 4],
          ['Uniform supplier', 3, 3],
          ['Other students', 3, 5],
        ],
      },
      {
        name: 'Leila',
        decisionMaker: 'Principal.',
        pillars: [
          ['School tradition', 5, 2],
          ['Teachers', 4, 4],
          ['Parents', 4, 3],
          ['Student council', 2, 5],
        ],
      },
      {
        name: 'Sam',
        decisionMaker: 'District superintendent.',
        pillars: [
          ['District office', 5, 1],
          ['Principal', 4, 2],
          ['Teachers union', 4, 3],
          ['Student council', 3, 5],
        ],
      },
      {
        name: 'Iris',
        decisionMaker: 'Principal.',
        pillars: [
          ['Teachers', 4, 5],
          ['Parents association', 5, 4],
          ['Student council', 3, 5],
          ['Administrative staff', 3, 3],
        ],
      },
      {
        name: 'Niko',
        decisionMaker: 'School board and principal.',
        pillars: [
          ['Uniform supplier', 3, 4],
          ['Parents association', 4, 4],
          ['Teachers', 4, 4],
          ['School board', 5, 2],
        ],
      },
    ]

    for (const submission of submissions) {
      const token = `demo:${args.sessionId}:${submission.name}`
      const existing = await ctx.db
        .query('activitySubmissions')
        .withIndex('by_activityId_and_studentTokenIdentifier', (q) =>
          q.eq('activityId', activity._id).eq('studentTokenIdentifier', token),
        )
        .unique()
      const payload = {
        version: 2,
        exercise: 'school-uniform-pillars',
        scenario: PILLARS_CONFIG.scenario,
        powerHolder: submission.decisionMaker,
        pillars: submission.pillars.map(([name, , accessibility], index) => ({
          id: `${submission.name}-${index}`,
          name,
          accessibility,
          role:
            index === 0
              ? 'This is where the current policy seems most connected.'
              : '',
          notes: '',
        })),
        moves: submission.pillars.slice(0, 3).map(([name], index) => ({
          rank: index + 1,
          pillarId: `${submission.name}-${index}`,
          pillarName: name,
          why:
            index === 0
              ? 'Start where leverage and access overlap enough to learn fast.'
              : 'This follows after building support through the earlier pillar.',
        })),
        reflection:
          'I started with the formal decision-maker, but accessibility changed the order I would approach people.',
      }
      if (existing) {
        await ctx.db.patch(existing._id, { payload, updatedAt: now })
      } else {
        await ctx.db.insert('activitySubmissions', {
          sessionId: args.sessionId,
          activityId: activity._id,
          studentTokenIdentifier: token,
          displayName: submission.name,
          type: 'pillars',
          payload,
          submittedAt: now,
          updatedAt: now,
        })
      }
    }
  },
})

export const getAnalysisInput = internalQuery({
  args: { sessionId: v.id('sessions'), teacherTokenIdentifier: v.string() },
  handler: async (ctx, args) => {
    const profile = await getUserProfileByTokenIdentifier(
      ctx,
      args.teacherTokenIdentifier,
    )
    if (!profile) {
      throw new Error('Onboarding required')
    }
    if (profile.role !== 'teacher') {
      throw new Error('Only teachers can use this')
    }
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      args.teacherTokenIdentifier,
    )
    const messages = await ctx.db
      .query('chatMessages')
      .withIndex('by_sessionId_and_createdAt', (q) =>
        q.eq('sessionId', args.sessionId),
      )
      .order('asc')
      .take(200)
    const submissions = await ctx.db
      .query('activitySubmissions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .take(100)
    const participants = await ctx.db
      .query('sessionParticipants')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .take(100)
    return { session, messages, submissions, participants }
  },
})

export const saveAnalysis = internalMutation({
  args: {
    sessionId: v.id('sessions'),
    output: v.any(),
    inputCursor: v.object({
      messageCount: v.number(),
      submissionCount: v.number(),
    }),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('aiAnalyses', {
      sessionId: args.sessionId,
      kind: 'live_summary',
      inputCursor: args.inputCursor,
      output: args.output,
      error: args.error,
      createdAt: Date.now(),
    })
  },
})

type AnalysisInput = {
  session: Doc<'sessions'>
  messages: Array<Doc<'chatMessages'>>
  submissions: Array<Doc<'activitySubmissions'>>
  participants: Array<Doc<'sessionParticipants'>>
}

function fallbackAnalysis(input: AnalysisInput) {
  const messages = input.messages.filter((message) => !message.deletedAt)
  const submissions = input.submissions
  const allPillars = submissions.flatMap((submission) => {
    const payload = submission.payload as {
      pillars?: Array<{ name?: string; accessibility?: number }>
    }
    return payload.pillars || []
  })
  const normalizedSubmissions = submissions.map((submission) => {
    const payload = submission.payload as {
      version?: number
      powerHolder?: string
      decisionMaker?: string
      pillars?: Array<{ name?: string; accessibility?: number }>
      moves?: Array<{ pillarName?: string; why?: string }>
      sequence?: Array<string>
      reflection?: string
    }
    const pillars = payload.pillars || []
    const moves =
      payload.moves ||
      (payload.sequence || []).map((pillarName) => ({ pillarName, why: '' }))
    return {
      displayName: submission.displayName || 'Student',
      powerHolder: payload.powerHolder || payload.decisionMaker || '',
      pillars,
      moves,
      reflection: payload.reflection || '',
    }
  })
  const pillarNames = allPillars
    .map((pillar) => pillar.name?.trim())
    .filter((name): name is string => Boolean(name))
  const counts = new Map<string, number>()
  for (const name of pillarNames) {
    const key = name.toLowerCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  const common = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${name} (${count})`)

  const questionMessages = messages.filter((message) =>
    message.body.includes('?'),
  )
  const mentionsConfusion = messages.filter((message) =>
    /confus|not sure|unclear|difference|counts/i.test(message.body),
  )
  const rubricCounts = new Map<string, number>()
  let readyCount = 0
  for (const submission of normalizedSubmissions) {
    const names = submission.pillars
      .map((pillar) => pillar.name?.toLowerCase() || '')
      .join(' ')
    const allText = [
      submission.powerHolder,
      names,
      submission.moves
        .map((move) => `${move.pillarName} ${move.why}`)
        .join(' '),
      submission.reflection,
    ]
      .join(' ')
      .toLowerCase()
    const flags = new Set<string>()
    if (
      /\beveryone\b|\bsociety\b|\bthe system\b/.test(submission.powerHolder)
    ) {
      flags.add('RF-01')
    }
    if (/expensive|unfair|comfort|freedom|problem/.test(names)) {
      flags.add('RF-03')
    }
    if (/petition|protest|walkout|strike|social media|awareness/.test(names)) {
      flags.add('RF-04')
    }
    if (
      submission.pillars.length < 4 ||
      !/supplier|vendor|district|office|staff|alumni|media|board/.test(names)
    ) {
      flags.add('RF-06')
    }
    if (
      submission.pillars.length > 2 &&
      new Set(submission.pillars.map((pillar) => pillar.accessibility)).size ===
        1
    ) {
      flags.add('RF-08')
    }
    if (/\bawareness\b|\bspread the word\b/.test(allText)) {
      flags.add('RF-09')
    }
    if (/\bright thing\b|\bwrong\b|\bunjust\b|\bmoral\b/.test(allText)) {
      flags.add('RF-10')
    }
    if (
      submission.powerHolder.trim() &&
      submission.pillars.length >= 4 &&
      submission.moves.length >= 3 &&
      flags.size === 0
    ) {
      readyCount += 1
    }
    for (const flag of flags) {
      rubricCounts.set(flag, (rubricCounts.get(flag) || 0) + 1)
    }
  }
  const commonErrors = [...rubricCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, count]) => ({ code, count, label: rubricLabel(code) }))
  const foundationalErrorCount = commonErrors
    .filter((flag) => ['RF-01', 'RF-03', 'RF-04', 'RF-06'].includes(flag.code))
    .reduce((max, flag) => Math.max(max, flag.count), 0)
  const recommendation =
    submissions.length > 0 && foundationalErrorCount / submissions.length > 0.4
      ? 'FULL_RETEACH'
      : submissions.length > 0 && readyCount / submissions.length >= 0.7
        ? 'ADVANCE'
        : 'RETEACH_ONE_CONCEPT'

  return {
    teacherBrief: [
      `${input.participants.length} students joined; ${submissions.length} have submitted Pillars maps.`,
      common.length
        ? `Most repeated pillars: ${common.join(', ')}.`
        : 'Pillar submissions are still sparse.',
      mentionsConfusion.length
        ? 'Several students are separating importance from accessibility, but the distinction still needs reinforcement.'
        : 'No major repeated confusion has appeared yet.',
    ],
    recurringQuestions: questionMessages
      .slice(0, 3)
      .map((message) => message.body),
    unclearConcepts: mentionsConfusion.length
      ? [
          'Difference between social functions and organized institutions',
          'Importance vs. accessibility',
        ]
      : ['No strong repeated confusion yet'],
    emotionalTone: {
      label: messages.length > 6 ? 'Engaged and analytical' : 'Warming up',
      explanation:
        messages.length > 6
          ? 'Students are asking framework questions and comparing tradeoffs.'
          : 'The room has not produced enough chat to infer a strong tone.',
    },
    chatClusters: [
      {
        label: 'Formal authority vs. daily enforcement',
        count: messages.filter((message) =>
          /principal|board|enforce|authority/i.test(message.body),
        ).length,
      },
      {
        label: 'What qualifies as a pillar',
        count: messages.filter((message) =>
          /pillar|counts|organized|tradition|parents/i.test(message.body),
        ).length,
      },
    ],
    readiness: {
      readyCount,
      totalCount: submissions.length,
      recommendation,
    },
    commonErrors,
    strongestResponse: normalizedSubmissions[0]
      ? {
          studentLabel: normalizedSubmissions[0].displayName,
          step: 'Pillars map',
          reason: 'Submitted a complete map with ordered first moves.',
        }
      : undefined,
    collectiveBlindSpot:
      commonErrors[0]?.label ||
      'Waiting for enough submissions to identify a shared blind spot.',
    trainerDebriefPrompt:
      commonErrors[0]?.code === 'RF-06'
        ? 'Ask the room which hidden actors help the uniform policy stay in place even if they do not formally decide it.'
        : 'Ask why the first move is reachable enough to create leverage before approaching formal authority.',
    pillarsInsights: {
      consensus: common,
      gaps:
        pillarNames.length > 0
          ? [
              'Commercial interests and informal enforcement roles may be underrepresented.',
            ]
          : ['Waiting for Pillars submissions.'],
      sequencing:
        'Students tend to name formal authority first; use the debrief to test whether accessibility should change the first approach.',
    },
  }
}

function rubricLabel(code: string) {
  switch (code) {
    case 'RF-01':
      return 'Treating power as one monolithic actor'
    case 'RF-03':
      return 'Confusing a grievance with a power holder'
    case 'RF-04':
      return 'Confusing tactics with pillars'
    case 'RF-06':
      return 'Missing non-obvious pillars'
    case 'RF-08':
      return 'Treating all pillars as equally reachable'
    case 'RF-09':
      return 'Using awareness as the whole strategy'
    case 'RF-10':
      return 'Leaning on moral framing instead of leverage'
    default:
      return code
  }
}

async function openRouterAnalysis(input: AnalysisInput) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      output: fallbackAnalysis(input),
      error: 'OPENROUTER_API_KEY is not set',
    }
  }

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tarkus.local',
        'X-Title': 'TARKUS',
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are TARKUS, a teacher-only AI synthesis layer for an in-person strategic nonviolence class. Students never see your output. Do not grade students. Do not give advice to students. Help the trainer understand class-level patterns only. Analyze the Pillars of Support school-uniform exercise using these trainer rubric flags: RF-01 monolithic model, RF-03 confusing power with grievance, RF-04 confusing pillars with tactics, RF-06 missing non-obvious pillars, RF-07 push vs pull, RF-08 all pillars equal, RF-09 awareness campaign as strategy, RF-10 moral framing, SK-08 prior experience or repression concern rather than conceptual confusion. Return JSON only. Required shape: {"teacherBrief":["string"],"recurringQuestions":["string"],"unclearConcepts":["string"],"emotionalTone":{"label":"string","explanation":"string"},"chatClusters":[{"label":"string","count":number}],"readiness":{"readyCount":number,"totalCount":number,"recommendation":"ADVANCE|RETEACH_ONE_CONCEPT|FULL_RETEACH"},"commonErrors":[{"code":"string","label":"string","count":number}],"strongestResponse":{"studentLabel":"string","step":"string","reason":"string"},"collectiveBlindSpot":"string","trainerDebriefPrompt":"string","pillarsInsights":{"consensus":["string"],"gaps":["string"],"sequencing":"string"}}. If more than 40 percent of submissions show the same foundational error RF-01 through RF-04, recommend FULL_RETEACH. Do not return markdown, prose outside JSON, or strings where arrays are required.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              session: {
                title: input.session.title,
                code: input.session.code,
              },
              chatMessages: input.messages.map((message) => ({
                authorRole: message.authorRole,
                displayName: message.isAnonymous
                  ? 'Anonymous'
                  : message.displayName,
                body: message.body,
              })),
              pillarsSubmissions: input.submissions.map((submission) => ({
                displayName: submission.displayName,
                payload: submission.payload,
              })),
            }),
          },
        ],
      }),
    },
  )

  if (!response.ok) {
    return {
      output: fallbackAnalysis(input),
      error: `OpenRouter returned ${response.status}`,
    }
  }
  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    return {
      output: fallbackAnalysis(input),
      error: 'OpenRouter returned no content',
    }
  }
  try {
    return { output: JSON.parse(content) }
  } catch {
    return {
      output: fallbackAnalysis(input),
      error: 'OpenRouter returned invalid JSON',
    }
  }
}

export const analyzeSession = action({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const input: AnalysisInput = await ctx.runQuery(
      internal.sessions.getAnalysisInput,
      {
        sessionId: args.sessionId,
        teacherTokenIdentifier: identity.tokenIdentifier,
      },
    )
    const { output, error } = await openRouterAnalysis(input)
    const analysisId: Id<'aiAnalyses'> = await ctx.runMutation(
      internal.sessions.saveAnalysis,
      {
        sessionId: args.sessionId,
        output,
        error,
        inputCursor: {
          messageCount: input.messages.length,
          submissionCount: input.submissions.length,
        },
      },
    )
    return analysisId
  },
})
