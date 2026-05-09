import { v } from 'convex/values'
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'

const SESSION_DURATION_MS = 6 * 60 * 60 * 1000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const PILLARS_CONFIG = {
  scenario:
    'You are a high school student. You and your classmates want to change the mandatory uniform policy. You are not going to riot or just complain. You are going to think strategically.',
  prompts: [
    'Who has the actual power to change the uniform policy?',
    'What groups, institutions, or people help keep the current policy in place?',
    'Rate each pillar by importance and accessibility.',
    'Which pillars would you approach first, and why?',
  ],
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
  if (session.teacherTokenIdentifier === tokenIdentifier) {
    return { session, role: 'teacher' as const, participant: null }
  }
  const participant = await ctx.db
    .query('sessionParticipants')
    .withIndex('by_sessionId_and_studentTokenIdentifier', (q) =>
      q.eq('sessionId', sessionId).eq('studentTokenIdentifier', tokenIdentifier),
    )
    .unique()
  if (!participant) {
    throw new Error('Unauthorized')
  }
  return { session, role: 'student' as const, participant }
}

function displayNameFromParticipant(
  participant: Doc<'sessionParticipants'> | null,
  identity: UserIdentity,
) {
  return participant?.displayName?.trim() || displayNameFromIdentity(identity)
}

export const createSession = mutation({
  args: { title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const now = Date.now()
    let code = makeCode()
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const existing = await ctx.db
        .query('sessions')
        .withIndex('by_code', (q) => q.eq('code', code))
        .first()
      if (!existing || existing.status !== 'active') break
      code = makeCode()
    }

    const sessionId = await ctx.db.insert('sessions', {
      teacherTokenIdentifier: identity.tokenIdentifier,
      teacherName: displayNameFromIdentity(identity),
      code,
      title: args.title || 'Pillars of Support Live Session',
      status: 'active',
      expiresAt: now + SESSION_DURATION_MS,
      createdAt: now,
    })

    const activityId = await ctx.db.insert('activities', {
      sessionId,
      type: 'pillars',
      title: 'Pillars of Support: School Uniforms',
      status: 'open',
      config: PILLARS_CONFIG,
      createdAt: now,
    })

    return { sessionId, activityId, code }
  },
})

export const listMyTeacherSessions = query({
  args: {},
  handler: async (ctx) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    return await ctx.db
      .query('sessions')
      .withIndex('by_teacherTokenIdentifier_and_status', (q) =>
        q
          .eq('teacherTokenIdentifier', identity.tokenIdentifier)
          .eq('status', 'active'),
      )
      .order('desc')
      .take(10)
  },
})

export const getTeacherSession = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
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
    const normalizedCode = args.code.trim().toUpperCase()
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_code', (q) => q.eq('code', normalizedCode))
      .first()

    if (!session || session.status !== 'active') {
      throw new Error('Session code is not active')
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
      const displayName = args.displayName?.trim()
      await ctx.db.patch(existing._id, {
        lastSeenAt: Date.now(),
        ...(displayName ? { displayName } : {}),
      })
      return { sessionId: session._id, participantId: existing._id }
    }

    const participantId = await ctx.db.insert('sessionParticipants', {
      sessionId: session._id,
      studentTokenIdentifier: identity.tokenIdentifier,
      displayName:
        args.displayName?.trim() || displayNameFromIdentity(identity) || 'Student',
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
    return await ctx.db
      .query('activitySubmissions')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .order('asc')
      .take(100)
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
    await assertTeacherOwnsSession(ctx, args.sessionId, identity.tokenIdentifier)
    await ctx.db.patch(args.sessionId, { status: 'ended', endedAt: Date.now() })
  },
})

export const deleteSession = mutation({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await assertTeacherOwnsSession(ctx, args.sessionId, identity.tokenIdentifier)
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
    await assertTeacherOwnsSession(ctx, args.sessionId, identity.tokenIdentifier)
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
      ['Maya', 'I understand the principal has formal authority, but who actually enforces uniforms day to day?'],
      ['Omar', 'Are parents a pillar, or only if they are organized somehow?'],
      ['Leila', 'It seems like school tradition matters, but I am not sure if tradition counts as a pillar.'],
      ['Sam', 'Why not start with the school board if they can change the policy directly?'],
      ['Iris', 'Teachers feel accessible, but they may not have the most power.'],
      ['Niko', 'The uniform supplier seems easy to miss because they are outside the school.'],
      ['Ana', 'I am confused about the difference between influence and importance.'],
      ['Dev', 'Students are affected most, but maybe they are not organized enough yet.'],
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
        decisionMaker: 'The principal and the district administration together.',
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
        decisionMaker: submission.decisionMaker,
        pillars: submission.pillars.map(([name, importance, accessibility], index) => ({
          id: `${submission.name}-${index}`,
          name,
          importance,
          accessibility,
          rationale: index === 0 ? 'This is where the current policy seems most connected.' : '',
        })),
        sequence: submission.pillars.slice(0, 3).map(([name]) => name),
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
      pillars?: Array<{ name?: string; importance?: number; accessibility?: number }>
    }
    return payload.pillars || []
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
    recurringQuestions: questionMessages.slice(0, 3).map((message) => message.body),
    unclearConcepts: mentionsConfusion.length
      ? ['Difference between social functions and organized institutions', 'Importance vs. accessibility']
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
    pillarsInsights: {
      consensus: common,
      gaps:
        pillarNames.length > 0
          ? ['Commercial interests and informal enforcement roles may be underrepresented.']
          : ['Waiting for Pillars submissions.'],
      sequencing:
        'Students tend to name formal authority first; use the debrief to test whether accessibility should change the first approach.',
    },
  }
}

async function openRouterAnalysis(input: AnalysisInput) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { output: fallbackAnalysis(input), error: 'OPENROUTER_API_KEY is not set' }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            'You are TARKUS, a teacher-only AI synthesis layer for an in-person strategic nonviolence class. Students never see your output. Do not grade students. Do not give tactical advice. Summarize class-level patterns, unclear concepts, recurring questions, emotional tone, and Pillars of Support exercise results. Be concise. Return JSON only. Required shape: {"teacherBrief":["string"],"recurringQuestions":["string"],"unclearConcepts":["string"],"emotionalTone":{"label":"string","explanation":"string"},"chatClusters":[{"label":"string","count":number}],"pillarsInsights":{"consensus":["string"],"gaps":["string"],"sequencing":"string"}}. Do not return markdown, prose outside JSON, or strings where arrays are required.',
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
              displayName: message.isAnonymous ? 'Anonymous' : message.displayName,
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
  })

  if (!response.ok) {
    return {
      output: fallbackAnalysis(input),
      error: `OpenRouter returned ${response.status}`,
    }
  }
  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    return { output: fallbackAnalysis(input), error: 'OpenRouter returned no content' }
  }
  try {
    return { output: JSON.parse(content) }
  } catch {
    return { output: fallbackAnalysis(input), error: 'OpenRouter returned invalid JSON' }
  }
}

export const analyzeSession = action({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const input: AnalysisInput = await ctx.runQuery(internal.sessions.getAnalysisInput, {
      sessionId: args.sessionId,
      teacherTokenIdentifier: identity.tokenIdentifier,
    })
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
