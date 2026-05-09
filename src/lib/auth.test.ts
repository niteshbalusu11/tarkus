import { describe, expect, it } from 'vitest'

import { resolveJoinDisplayName } from './auth'

describe('resolveJoinDisplayName', () => {
  it('uses the student-entered display name first', () => {
    expect(
      resolveJoinDisplayName('  Maya  ', {
        fullName: 'Clerk Profile',
        username: 'clerk-user',
      }),
    ).toBe('Maya')
  })

  it('falls back to the Clerk full name when no display name is entered', () => {
    expect(
      resolveJoinDisplayName('   ', {
        fullName: 'Omar Rivera',
        username: 'omar',
      }),
    ).toBe('Omar Rivera')
  })

  it('falls back to the Clerk username when full name is missing', () => {
    expect(
      resolveJoinDisplayName('', {
        fullName: '   ',
        username: 'leila',
      }),
    ).toBe('leila')
  })

  it('returns undefined instead of inventing a name', () => {
    expect(resolveJoinDisplayName('', null)).toBeUndefined()
  })
})
