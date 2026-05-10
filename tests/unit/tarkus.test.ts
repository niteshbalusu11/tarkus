import { describe, expect, it } from 'vitest'

import {
  getClassRubricSummary,
  normalizePillarsPayload,
} from '../../src/lib/tarkus'
import type { ActivitySubmission } from '../../src/lib/tarkus'

const baseSubmission = {
  _id: 'submission-id',
  displayName: 'Maya',
} as ActivitySubmission

describe('Pillars payload normalization', () => {
  it('normalizes v2 school-uniform exercise payloads', () => {
    const normalized = normalizePillarsPayload({
      version: 2,
      powerHolder: 'Principal and district office',
      pillars: [
        { id: 'teachers', name: 'Teachers', accessibility: 4 },
        { id: 'parents', name: 'Parents association', accessibility: 3 },
      ],
      moves: [
        {
          rank: 1,
          pillarId: 'teachers',
          pillarName: 'Teachers',
          why: 'They enforce the policy daily.',
        },
      ],
      reflection: 'Accessibility changed the order.',
    })

    expect(normalized).toMatchObject({
      version: 2,
      powerHolder: 'Principal and district office',
      sequence: ['Teachers'],
      reflection: 'Accessibility changed the order.',
    })
    expect(normalized.pillars).toHaveLength(2)
  })

  it('keeps legacy submissions readable', () => {
    const normalized = normalizePillarsPayload({
      decisionMaker: 'School board',
      pillars: [
        {
          id: 'board',
          name: 'School board',
          importance: 5,
          accessibility: 1,
        },
      ],
      sequence: ['School board'],
      reflection: 'Start formal.',
    })

    expect(normalized).toMatchObject({
      version: 1,
      powerHolder: 'School board',
      sequence: ['School board'],
    })
    expect(normalized.moves[0]).toMatchObject({
      rank: 1,
      pillarName: 'School board',
    })
  })
})

describe('Pillars rubric helpers', () => {
  it('recommends reteaching when many students confuse tactics with pillars', () => {
    const submissions: Array<ActivitySubmission> = [0, 1, 2].map((index) => ({
      ...baseSubmission,
      _id: `submission-${index}` as ActivitySubmission['_id'],
      payload: {
        version: 2,
        powerHolder: 'Society',
        pillars: [
          { id: 'petition', name: 'Petition', accessibility: 5 },
          { id: 'protest', name: 'Protest', accessibility: 5 },
          { id: 'awareness', name: 'Awareness campaign', accessibility: 5 },
        ],
        moves: [
          {
            rank: 1,
            pillarId: 'petition',
            pillarName: 'Petition',
            why: 'Raise awareness.',
          },
          {
            rank: 2,
            pillarId: 'protest',
            pillarName: 'Protest',
            why: 'Show it is wrong.',
          },
          {
            rank: 3,
            pillarId: 'awareness',
            pillarName: 'Awareness campaign',
            why: 'Spread the word.',
          },
        ],
        reflection: 'The policy is unjust.',
      },
    }))

    const summary = getClassRubricSummary(submissions)

    expect(summary.recommendation).toBe('FULL_RETEACH')
    expect(summary.commonErrors.map((flag) => flag.code)).toContain('RF-04')
  })
})
