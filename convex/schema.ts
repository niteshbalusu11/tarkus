import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  users: defineTable({
    tokenIdentifier: v.string(),
    displayName: v.string(),
    role: v.union(v.literal('student'), v.literal('teacher')),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_tokenIdentifier', ['tokenIdentifier']),
  sessions: defineTable({
    teacherTokenIdentifier: v.string(),
    teacherName: v.optional(v.string()),
    code: v.string(),
    title: v.optional(v.string()),
    status: v.union(
      v.literal('not_started'),
      v.literal('active'),
      v.literal('stopped'),
      v.literal('ended'),
      v.literal('deleted'),
    ),
    expiresAt: v.number(),
    createdAt: v.number(),
    startedAt: v.optional(v.number()),
    stoppedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    deletedAt: v.optional(v.number()),
  })
    .index('by_code', ['code'])
    .index('by_teacherTokenIdentifier_and_status', [
      'teacherTokenIdentifier',
      'status',
    ]),
  sessionParticipants: defineTable({
    sessionId: v.id('sessions'),
    studentTokenIdentifier: v.string(),
    displayName: v.optional(v.string()),
    joinedAt: v.number(),
    lastSeenAt: v.optional(v.number()),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_studentTokenIdentifier', ['studentTokenIdentifier'])
    .index('by_sessionId_and_studentTokenIdentifier', [
      'sessionId',
      'studentTokenIdentifier',
    ]),
  chatMessages: defineTable({
    sessionId: v.id('sessions'),
    authorTokenIdentifier: v.string(),
    authorRole: v.union(v.literal('teacher'), v.literal('student')),
    displayName: v.optional(v.string()),
    body: v.string(),
    isAnonymous: v.boolean(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index('by_sessionId_and_createdAt', ['sessionId', 'createdAt']),
  activities: defineTable({
    sessionId: v.id('sessions'),
    type: v.union(v.literal('pillars')),
    title: v.string(),
    status: v.union(v.literal('open'), v.literal('closed')),
    config: v.any(),
    createdAt: v.number(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_sessionId_and_type', ['sessionId', 'type']),
  activitySubmissions: defineTable({
    sessionId: v.id('sessions'),
    activityId: v.id('activities'),
    studentTokenIdentifier: v.string(),
    displayName: v.optional(v.string()),
    type: v.union(v.literal('pillars')),
    payload: v.any(),
    submittedAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_activityId', ['activityId'])
    .index('by_activityId_and_studentTokenIdentifier', [
      'activityId',
      'studentTokenIdentifier',
    ]),
  aiAnalyses: defineTable({
    sessionId: v.id('sessions'),
    kind: v.union(v.literal('live_summary'), v.literal('pillars_summary')),
    inputCursor: v.object({
      messageCount: v.number(),
      submissionCount: v.number(),
    }),
    output: v.any(),
    createdAt: v.number(),
    error: v.optional(v.string()),
  })
    .index('by_sessionId_and_createdAt', ['sessionId', 'createdAt'])
    .index('by_sessionId_and_kind_and_createdAt', [
      'sessionId',
      'kind',
      'createdAt',
    ]),
})
