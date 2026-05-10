import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { formatBytes, getPrepUploadLimit } from './prepLimits'
import { getUserProfileByTokenIdentifier } from './users'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'

const DEFAULT_PILLARS_PREP_BRIEF =
  'Create the curriculum for a two hour class on pillar analysis. Include classic concepts of obedience, pillar analysis, how to dissect pillars, push vs pull from Gene Sharp, Popovic and Helvey. Include two Pillars case studies to teach in the pillars module: El Salvador 1944 and Norway 1942.'

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
}

async function requireTeacherProfile(
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
  if (profile.role !== 'teacher') {
    throw new Error('Only teachers can use this')
  }
  return profile
}

async function assertTeacherOwnsWorkspace(
  ctx: QueryCtx | MutationCtx,
  workspaceId: Id<'prepWorkspaces'>,
  tokenIdentifier: string,
) {
  const workspace = await ctx.db.get(workspaceId)
  if (!workspace) {
    throw new Error('Prep workspace not found')
  }
  if (workspace.teacherTokenIdentifier !== tokenIdentifier) {
    throw new Error('Unauthorized')
  }
  if (!workspace.sessionId) {
    throw new Error('Session not found')
  }
  await assertTeacherOwnsSession(ctx, workspace.sessionId, tokenIdentifier)
  return workspace
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

function getAssetKind(args: {
  kind?: 'document' | 'image'
  mimeType: string
}) {
  return args.kind || (args.mimeType.startsWith('image/') ? 'image' : 'document')
}

async function assertStoredFileWithinLimit(
  ctx: MutationCtx,
  storageId: Id<'_storage'>,
  kind: 'document' | 'image',
  reportedSize: number,
) {
  if (!Number.isFinite(reportedSize) || reportedSize <= 0) {
    throw new Error('File size is required')
  }
  const limit = getPrepUploadLimit(kind)
  if (reportedSize > limit) {
    throw new Error(`${kind} uploads are limited to ${formatBytes(limit)}`)
  }
  const metadata = await ctx.db.system.get('_storage', storageId)
  if (!metadata) {
    throw new Error('Uploaded file not found')
  }
  if (metadata.size > limit) {
    throw new Error(`${kind} uploads are limited to ${formatBytes(limit)}`)
  }
}

export const createWorkspace = mutation({
  args: {
    sessionId: v.id('sessions'),
    audience: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    const existing = await ctx.db
      .query('prepWorkspaces')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .unique()
    if (existing) {
      return { workspaceId: existing._id }
    }
    const now = Date.now()
    const title = session.title?.trim() || 'New class curriculum'
    const workspaceId = await ctx.db.insert('prepWorkspaces', {
      sessionId: args.sessionId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      title,
      audience: args.audience?.trim() || 'In-person student class',
      durationMinutes: args.durationMinutes || 60,
      prepBrief: DEFAULT_PILLARS_PREP_BRIEF,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
    return { workspaceId }
  },
})

export const updatePrepBrief = mutation({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    prepBrief: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    await ctx.db.patch(args.workspaceId, {
      prepBrief: args.prepBrief.trim() || DEFAULT_PILLARS_PREP_BRIEF,
      updatedAt: Date.now(),
    })
  },
})

export const getWorkspaceForSession = query({
  args: { sessionId: v.id('sessions') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const session = await assertTeacherOwnsSession(
      ctx,
      args.sessionId,
      identity.tokenIdentifier,
    )
    const workspace = await ctx.db
      .query('prepWorkspaces')
      .withIndex('by_sessionId', (q) => q.eq('sessionId', args.sessionId))
      .unique()
    return { session, workspace }
  },
})

export const listMyWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const workspaces = await ctx.db
      .query('prepWorkspaces')
      .withIndex('by_teacherTokenIdentifier_and_updatedAt', (q) =>
        q.eq('teacherTokenIdentifier', identity.tokenIdentifier),
      )
      .order('desc')
      .take(50)
    const visibleWorkspaces = await Promise.all(
      workspaces.map(async (workspace) => {
        if (!workspace.sessionId) return null
        const session = await ctx.db.get(workspace.sessionId)
        if (
          !session ||
          session.status === 'deleted' ||
          session.teacherTokenIdentifier !== identity.tokenIdentifier
        ) {
          return null
        }
        return workspace
      }),
    )
    return visibleWorkspaces.filter(
      (workspace): workspace is Doc<'prepWorkspaces'> => workspace !== null,
    )
  },
})

export const getWorkspace = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    return await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    return await ctx.storage.generateUploadUrl()
  },
})

export const saveUploadedDocument = mutation({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    storageId: v.id('_storage'),
    kind: v.optional(v.union(v.literal('document'), v.literal('image'))),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    const now = Date.now()
    const kind = getAssetKind(args)
    await assertStoredFileWithinLimit(ctx, args.storageId, kind, args.size)
    const documentId = await ctx.db.insert('prepDocuments', {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      storageId: args.storageId,
      kind,
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      status: kind === 'image' ? 'extracted' : 'uploaded',
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.patch(args.workspaceId, { updatedAt: now })
    return { documentId }
  },
})

export const listAssets = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    const assets = await ctx.db
      .query('prepDocuments')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(50)
    return await Promise.all(
      assets.map(async (asset) => ({
        ...asset,
        url: asset.kind === 'image' ? await ctx.storage.getUrl(asset.storageId) : null,
      })),
    )
  },
})

export const listDocuments = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    return await ctx.db
      .query('prepDocuments')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .order('desc')
      .take(50)
  },
})

export const getLatestCurriculum = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    return await ctx.db
      .query('curricula')
      .withIndex('by_workspaceId_and_updatedAt', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .first()
  },
})

export const listMessages = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    return await ctx.db
      .query('curriculumMessages')
      .withIndex('by_workspaceId_and_createdAt', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('asc')
      .take(100)
  },
})

export const listPresentations = query({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      identity.tokenIdentifier,
    )
    return await ctx.db
      .query('presentations')
      .withIndex('by_workspaceId_and_createdAt', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .take(10)
  },
})

export const getPresentationDownloadUrl = query({
  args: { presentationId: v.id('presentations') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const presentation = await ctx.db.get(args.presentationId)
    if (!presentation) {
      throw new Error('Presentation not found')
    }
    await assertTeacherOwnsWorkspace(
      ctx,
      presentation.workspaceId,
      identity.tokenIdentifier,
    )
    if (!presentation.storageId) {
      return null
    }
    return await ctx.storage.getUrl(presentation.storageId)
  },
})

export const updateCurriculumContent = mutation({
  args: {
    curriculumId: v.id('curricula'),
    content: v.any(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const curriculum = await ctx.db.get(args.curriculumId)
    if (!curriculum) {
      throw new Error('Curriculum not found')
    }
    await assertTeacherOwnsWorkspace(
      ctx,
      curriculum.workspaceId,
      identity.tokenIdentifier,
    )
    const now = Date.now()
    await ctx.db.patch(args.curriculumId, {
      content: args.content,
      updatedAt: now,
    })
    await ctx.db.patch(curriculum.workspaceId, { updatedAt: now })
  },
})

export const finalizeCurriculum = mutation({
  args: { curriculumId: v.id('curricula') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherProfile(ctx, identity)
    const curriculum = await ctx.db.get(args.curriculumId)
    if (!curriculum) {
      throw new Error('Curriculum not found')
    }
    await assertTeacherOwnsWorkspace(
      ctx,
      curriculum.workspaceId,
      identity.tokenIdentifier,
    )
    const now = Date.now()
    await ctx.db.patch(args.curriculumId, {
      status: 'finalized',
      updatedAt: now,
    })
    await ctx.db.patch(curriculum.workspaceId, {
      status: 'finalized',
      updatedAt: now,
    })
  },
})

export const getDocumentForAction = internalQuery({
  args: {
    documentId: v.id('prepDocuments'),
    teacherTokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId)
    if (!document) {
      throw new Error('Document not found')
    }
    if (document.teacherTokenIdentifier !== args.teacherTokenIdentifier) {
      throw new Error('Unauthorized')
    }
    return document
  },
})

export const getWorkspaceInputForAction = internalQuery({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const workspace = await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      args.teacherTokenIdentifier,
    )
    const documents = await ctx.db
      .query('prepDocuments')
      .withIndex('by_workspaceId', (q) => q.eq('workspaceId', args.workspaceId))
      .take(50)
    const latestCurriculum = await ctx.db
      .query('curricula')
      .withIndex('by_workspaceId_and_updatedAt', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .first()
    return { workspace, documents, latestCurriculum }
  },
})

export const markDocumentExtracting = internalMutation({
  args: { documentId: v.id('prepDocuments') },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      status: 'extracting',
      error: undefined,
      updatedAt: Date.now(),
    })
  },
})

export const saveDocumentExtraction = internalMutation({
  args: {
    documentId: v.id('prepDocuments'),
    extractedText: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId)
    if (!document) {
      throw new Error('Document not found')
    }
    const now = Date.now()
    await ctx.db.patch(args.documentId, {
      status: args.error ? 'failed' : 'extracted',
      extractedText: args.extractedText,
      error: args.error,
      updatedAt: now,
    })
    await ctx.db.patch(document.workspaceId, { updatedAt: now })
  },
})

export const saveGeneratedCurriculum = internalMutation({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    content: v.any(),
  },
  handler: async (ctx, args) => {
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      args.teacherTokenIdentifier,
    )
    const latest = await ctx.db
      .query('curricula')
      .withIndex('by_workspaceId_and_version', (q) =>
        q.eq('workspaceId', args.workspaceId),
      )
      .order('desc')
      .first()
    const now = Date.now()
    const curriculumId = await ctx.db.insert('curricula', {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: args.teacherTokenIdentifier,
      version: (latest?.version || 0) + 1,
      status: 'draft',
      content: args.content,
      createdAt: now,
      updatedAt: now,
    })
    const workspacePatch: Partial<Doc<'prepWorkspaces'>> = {
      status: 'curriculum_generated',
      updatedAt: now,
    }
    if (
      args.content &&
      typeof args.content === 'object' &&
      'title' in args.content &&
      typeof args.content.title === 'string' &&
      args.content.title.trim()
    ) {
      workspacePatch.title = args.content.title.trim()
    }
    await ctx.db.patch(args.workspaceId, workspacePatch)
    return curriculumId
  },
})

export const addCurriculumMessage = internalMutation({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    role: v.union(v.literal('teacher'), v.literal('assistant')),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      args.teacherTokenIdentifier,
    )
    return await ctx.db.insert('curriculumMessages', {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: args.teacherTokenIdentifier,
      role: args.role,
      body: args.body,
      createdAt: Date.now(),
    })
  },
})

export const createPresentationRecord = internalMutation({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    teacherTokenIdentifier: v.string(),
    curriculumId: v.id('curricula'),
    slideSpec: v.any(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    await assertTeacherOwnsWorkspace(
      ctx,
      args.workspaceId,
      args.teacherTokenIdentifier,
    )
    const now = Date.now()
    return await ctx.db.insert('presentations', {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: args.teacherTokenIdentifier,
      curriculumId: args.curriculumId,
      status: 'generating',
      slideSpec: args.slideSpec,
      fileName: args.fileName,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const savePresentationResult = internalMutation({
  args: {
    presentationId: v.id('presentations'),
    storageId: v.optional(v.id('_storage')),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const presentation = await ctx.db.get(args.presentationId)
    if (!presentation) {
      throw new Error('Presentation not found')
    }
    const now = Date.now()
    await ctx.db.patch(args.presentationId, {
      status: args.error ? 'failed' : 'ready',
      storageId: args.storageId,
      error: args.error,
      updatedAt: now,
    })
    if (!args.error) {
      await ctx.db.patch(presentation.workspaceId, {
        status: 'deck_generated',
        updatedAt: now,
      })
    }
  },
})
