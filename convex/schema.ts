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
  prepWorkspaces: defineTable({
    sessionId: v.optional(v.id('sessions')),
    teacherTokenIdentifier: v.string(),
    title: v.string(),
    audience: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    prepBrief: v.optional(v.string()),
    status: v.union(
      v.literal('draft'),
      v.literal('curriculum_generated'),
      v.literal('finalized'),
      v.literal('deck_generated'),
      v.literal('failed'),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_teacherTokenIdentifier_and_updatedAt', [
      'teacherTokenIdentifier',
      'updatedAt',
    ])
    .index('by_teacherTokenIdentifier_and_status', [
      'teacherTokenIdentifier',
      'status',
    ]),
  prepDocuments: defineTable({
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    storageId: v.id('_storage'),
    kind: v.optional(v.union(v.literal('document'), v.literal('image'))),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    status: v.union(
      v.literal('uploaded'),
      v.literal('extracting'),
      v.literal('extracted'),
      v.literal('failed'),
    ),
    extractedText: v.optional(v.string()),
    error: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspaceId', ['workspaceId'])
    .index('by_workspaceId_and_status', ['workspaceId', 'status']),
  curricula: defineTable({
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    version: v.number(),
    status: v.union(v.literal('draft'), v.literal('finalized')),
    content: v.any(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspaceId_and_version', ['workspaceId', 'version'])
    .index('by_workspaceId_and_updatedAt', ['workspaceId', 'updatedAt']),
  curriculumMessages: defineTable({
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    role: v.union(v.literal('teacher'), v.literal('assistant')),
    body: v.string(),
    createdAt: v.number(),
  }).index('by_workspaceId_and_createdAt', ['workspaceId', 'createdAt']),
  presentations: defineTable({
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    curriculumId: v.id('curricula'),
    status: v.union(
      v.literal('generating'),
      v.literal('ready'),
      v.literal('failed'),
    ),
    slideSpec: v.any(),
    storageId: v.optional(v.id('_storage')),
    fileName: v.string(),
    error: v.optional(v.string()),
    editStatus: v.optional(
      v.union(v.literal('idle'), v.literal('editing'), v.literal('failed')),
    ),
    editError: v.optional(v.string()),
    downloadStatus: v.optional(
      v.union(
        v.literal('ready'),
        v.literal('regenerating'),
        v.literal('failed'),
      ),
    ),
    downloadError: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    publishedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_workspaceId_and_createdAt', ['workspaceId', 'createdAt'])
    .index('by_workspaceId_and_status', ['workspaceId', 'status'])
    .index('by_workspaceId_and_isPublished', ['workspaceId', 'isPublished']),
  presentationMessages: defineTable({
    presentationId: v.id('presentations'),
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    role: v.union(v.literal('teacher'), v.literal('assistant')),
    body: v.string(),
    createdAt: v.number(),
  }).index('by_presentationId_and_createdAt', ['presentationId', 'createdAt']),
})
