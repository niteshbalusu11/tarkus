import { describe, expect, it } from 'vitest'

import {
  defaultPathForRole,
  requiredRoleForPath,
  resolveJoinErrorMessage,
  resolveJoinDisplayName,
  resolvePostOnboardingPath,
} from '../../src/lib/auth'

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

describe('resolveJoinErrorMessage', () => {
  it('extracts clean Convex errors from failed class joins', () => {
    expect(
      resolveJoinErrorMessage(
        new Error(
          '[CONVEX M(sessions:joinSessionByCode)] [Request ID: test] Server Error Uncaught Error: This class has ended at handler (../convex/sessions.ts:306:16) Called by client',
        ),
      ),
    ).toBe('This class has ended.')
  })

  it('maps missing class codes to a short message', () => {
    expect(resolveJoinErrorMessage(new Error('Class code not found'))).toBe(
      'Class code not found.',
    )
  })
})

describe('onboarding route helpers', () => {
  it('maps account roles to default surfaces', () => {
    expect(defaultPathForRole('teacher')).toBe('/teacher')
    expect(defaultPathForRole('student')).toBe('/join')
  })

  it('detects route-required roles', () => {
    expect(requiredRoleForPath('/teacher')).toBe('teacher')
    expect(requiredRoleForPath('/join')).toBe('student')
    expect(requiredRoleForPath('/student/abc123')).toBe('student')
    expect(requiredRoleForPath('/')).toBeNull()
  })

  it('keeps a matching attempted route after onboarding', () => {
    expect(
      resolvePostOnboardingPath({
        chosenRole: 'teacher',
        pendingPath: '/teacher',
        pendingRole: 'teacher',
      }),
    ).toBe('/teacher')
  })

  it('falls back when attempted route does not match chosen role', () => {
    expect(
      resolvePostOnboardingPath({
        chosenRole: 'student',
        pendingPath: '/teacher',
        pendingRole: 'teacher',
      }),
    ).toBe('/join')
  })
})
