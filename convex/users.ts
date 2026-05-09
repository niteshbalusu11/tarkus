import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
}

function displayNameFromIdentity(identity: {
  name?: string
  email?: string
  nickname?: string
}) {
  return identity.name || identity.nickname || identity.email || ''
}

export async function getUserProfileByTokenIdentifier(
  ctx: QueryCtx | MutationCtx,
  tokenIdentifier: string,
): Promise<Doc<'users'> | null> {
  return await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', tokenIdentifier),
    )
    .unique()
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const profile = await getUserProfileByTokenIdentifier(
      ctx,
      identity.tokenIdentifier,
    )
    return {
      profile,
      suggestedDisplayName: displayNameFromIdentity(identity),
    }
  },
})

export const completeOnboarding = mutation({
  args: {
    displayName: v.string(),
    role: v.union(v.literal('student'), v.literal('teacher')),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    const displayName = args.displayName.trim()
    if (!displayName) {
      throw new Error('Name is required')
    }

    const existing = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()
    const now = Date.now()

    if (existing) {
      await ctx.db.patch(existing._id, {
        displayName,
        updatedAt: now,
      })
      return existing._id
    }

    return await ctx.db.insert('users', {
      tokenIdentifier: identity.tokenIdentifier,
      displayName,
      role: args.role,
      createdAt: now,
      updatedAt: now,
    })
  },
})
