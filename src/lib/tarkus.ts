import type { Id } from '../../convex/_generated/dataModel'

export const SCHOOL_UNIFORM_SCENARIO =
  'You are a high school student. You and your classmates want to change the mandatory uniform policy. You are not going to riot or just complain. You are going to think strategically.'

export type Pillar = {
  id: string
  name: string
  importance: number
  accessibility: number
  rationale?: string
}

export type PillarsMove = {
  rank: 1 | 2 | 3
  pillarId: string
  pillarName: string
  why: string
}

export type PillarV2 = {
  id: string
  name: string
  accessibility: number
  role?: string
  notes?: string
}

export type PillarsPayloadV1 = {
  decisionMaker: string
  pillars: Array<Pillar>
  sequence: Array<string>
  reflection: string
}

export type PillarsPayloadV2 = {
  version: 2
  exercise: 'school-uniform-pillars'
  scenario: string
  powerHolder: string
  pillars: Array<PillarV2>
  moves: Array<PillarsMove>
  reflection: string
}

export type PillarsPayload = PillarsPayloadV1 | PillarsPayloadV2

export type NormalizedPillarsPayload = {
  version: 1 | 2
  powerHolder: string
  pillars: Array<PillarV2 & { importance: number }>
  sequence: Array<string>
  moves: Array<PillarsMove>
  reflection: string
}

export type ActivitySubmission = {
  _id: Id<'activitySubmissions'>
  displayName?: string
  payload: unknown
}

export type RubricRecommendation =
  | 'ADVANCE'
  | 'RETEACH_ONE_CONCEPT'
  | 'FULL_RETEACH'

export type RubricErrorCode =
  | 'RF-01'
  | 'RF-03'
  | 'RF-04'
  | 'RF-06'
  | 'RF-07'
  | 'RF-08'
  | 'RF-09'
  | 'RF-10'
  | 'SK-08'

export type RubricFlag = {
  code: RubricErrorCode
  label: string
  count: number
}

export type ClassRubricSummary = {
  readyCount: number
  totalCount: number
  recommendation: RubricRecommendation
  commonErrors: Array<RubricFlag>
  collectiveBlindSpot: string
}

export type AnalysisOutput = {
  teacherBrief?: unknown
  recurringQuestions?: unknown
  unclearConcepts?: unknown
  emotionalTone?: {
    label?: string
    explanation?: string
  }
  chatClusters?: unknown
  pillarsInsights?: {
    consensus?: unknown
    gaps?: unknown
    sequencing?: string
  }
  readiness?: {
    readyCount?: number
    totalCount?: number
    recommendation?: RubricRecommendation
  }
  commonErrors?: unknown
  strongestResponse?: {
    studentLabel?: string
    step?: string
    reason?: string
  }
  collectiveBlindSpot?: unknown
  trainerDebriefPrompt?: unknown
  studentVerdicts?: unknown
}

export type ChatCluster = {
  label?: string
  count?: number
}

export function toTextList(value: unknown): Array<string> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [item]
      if (typeof item === 'number') return [String(item)]
      if (item && typeof item === 'object') {
        const candidate = item as {
          text?: unknown
          question?: unknown
          concept?: unknown
          label?: unknown
          summary?: unknown
          insight?: unknown
          description?: unknown
          reason?: unknown
        }
        const text =
          candidate.text ||
          candidate.question ||
          candidate.concept ||
          candidate.label ||
          candidate.summary ||
          candidate.insight ||
          candidate.description ||
          candidate.reason
        return typeof text === 'string' ? [text] : [JSON.stringify(item)]
      }
      return []
    })
  }

  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((item) => item.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean)
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        if (typeof item === 'string') return `${key}: ${item}`
        if (typeof item === 'number') return `${key}: ${item}`
        return `${key}: ${JSON.stringify(item)}`
      })
      .filter(Boolean)
  }

  return []
}

export function toChatClusters(value: unknown): Array<ChatCluster> {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [{ label: item, count: 1 }]
      if (item && typeof item === 'object') {
        const cluster = item as {
          label?: unknown
          theme?: unknown
          count?: unknown
        }
        const label = cluster.label || cluster.theme
        return typeof label === 'string'
          ? [
              {
                label,
                count:
                  typeof cluster.count === 'number'
                    ? cluster.count
                    : Number(cluster.count || 1),
              },
            ]
          : []
      }
      return []
    })
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(
      ([key, item]) => ({
        label: key,
        count: typeof item === 'number' ? item : 1,
      }),
    )
  }

  if (typeof value === 'string') {
    return toTextList(value).map((label) => ({ label, count: 1 }))
  }

  return []
}

export function toEmotionalTone(value: unknown) {
  if (typeof value === 'string') {
    return { label: value, explanation: '' }
  }

  if (value && typeof value === 'object') {
    const tone = value as {
      label?: unknown
      tone?: unknown
      explanation?: unknown
    }
    return {
      label:
        typeof tone.label === 'string'
          ? tone.label
          : typeof tone.tone === 'string'
            ? tone.tone
            : 'No signal yet',
      explanation:
        typeof tone.explanation === 'string' ? tone.explanation : '',
    }
  }

  return {
    label: 'No signal yet',
    explanation: 'More class activity is needed.',
  }
}

function toRubricErrors(value: unknown): Array<RubricFlag> {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const flag = item as {
      code?: unknown
      label?: unknown
      description?: unknown
      count?: unknown
    }
    if (typeof flag.code !== 'string') return []
    return [
      {
        code: flag.code as RubricErrorCode,
        label:
          typeof flag.label === 'string'
            ? flag.label
            : typeof flag.description === 'string'
              ? flag.description
              : flag.code,
        count:
          typeof flag.count === 'number'
            ? flag.count
            : Number(flag.count || 1),
      },
    ]
  })
}

export type NormalizedAnalysisOutput = {
  teacherBrief: Array<string>
  recurringQuestions: Array<string>
  unclearConcepts: Array<string>
  emotionalTone: {
    label?: string
    explanation?: string
  }
  chatClusters: Array<ChatCluster>
  readiness?: {
    readyCount: number
    totalCount: number
    recommendation: RubricRecommendation
  }
  commonErrors: Array<RubricFlag>
  strongestResponse?: {
    studentLabel?: string
    step?: string
    reason?: string
  }
  collectiveBlindSpot?: string
  trainerDebriefPrompt?: string
}

export function normalizeAnalysisOutput(
  analysis: AnalysisOutput | undefined,
): NormalizedAnalysisOutput | undefined {
  if (!analysis) return undefined

  const recommendation =
    analysis.readiness?.recommendation === 'FULL_RETEACH' ||
    analysis.readiness?.recommendation === 'RETEACH_ONE_CONCEPT' ||
    analysis.readiness?.recommendation === 'ADVANCE'
      ? analysis.readiness.recommendation
      : 'RETEACH_ONE_CONCEPT'

  return {
    teacherBrief: toTextList(analysis.teacherBrief),
    recurringQuestions: toTextList(analysis.recurringQuestions),
    unclearConcepts: toTextList(analysis.unclearConcepts),
    emotionalTone: toEmotionalTone(analysis.emotionalTone),
    chatClusters: toChatClusters(analysis.chatClusters),
    readiness: analysis.readiness
      ? {
          readyCount: Number(analysis.readiness.readyCount || 0),
          totalCount: Number(analysis.readiness.totalCount || 0),
          recommendation,
        }
      : undefined,
    commonErrors: toRubricErrors(analysis.commonErrors),
    strongestResponse: analysis.strongestResponse,
    collectiveBlindSpot: toTextList(analysis.collectiveBlindSpot)[0],
    trainerDebriefPrompt: toTextList(analysis.trainerDebriefPrompt)[0],
  }
}

function clampRating(value: unknown) {
  const number = Number(value || 3)
  return Math.min(5, Math.max(1, Number.isFinite(number) ? number : 3))
}

export function normalizePillarsPayload(
  payload: unknown,
): NormalizedPillarsPayload {
  const value = payload as Partial<PillarsPayloadV2 & PillarsPayloadV1> | null
  const isV2 = value?.version === 2
  const rawPillars = Array.isArray(value?.pillars) ? value.pillars : []
  const pillars = rawPillars
    .map((pillar, index) => {
      const candidate = pillar as Partial<Pillar & PillarV2>
      return {
        id: candidate.id || `pillar-${index}`,
        name: candidate.name || '',
        accessibility: clampRating(candidate.accessibility),
        importance: clampRating(candidate.importance),
        role: candidate.role || '',
        notes: candidate.notes || candidate.rationale || '',
      }
    })
    .filter((pillar) => pillar.name.trim())

  const legacySequence = Array.isArray(value?.sequence)
    ? value.sequence.filter((item): item is string => typeof item === 'string')
    : []

  const moves = Array.isArray(value?.moves)
    ? value.moves
        .flatMap((move, index) => {
          const candidate = move as Partial<PillarsMove>
          const rank = Number(candidate.rank || index + 1)
          if (rank !== 1 && rank !== 2 && rank !== 3) return []
          return [
            {
              rank,
              pillarId: candidate.pillarId || '',
              pillarName: candidate.pillarName || '',
              why: candidate.why || '',
            },
          ]
        })
        .sort((a, b) => a.rank - b.rank)
    : legacySequence.slice(0, 3).map((pillarName, index) => ({
        rank: (index + 1) as 1 | 2 | 3,
        pillarId:
          pillars.find((pillar) => pillar.name === pillarName)?.id ||
          `legacy-${index}`,
        pillarName,
        why: '',
      }))

  return {
    version: isV2 ? 2 : 1,
    powerHolder: value?.powerHolder || value?.decisionMaker || '',
    pillars,
    sequence: moves.length
      ? moves.map((move) => move.pillarName).filter(Boolean)
      : legacySequence,
    moves,
    reflection: value?.reflection || '',
  }
}

export function getPillarFrequency(submissions: Array<ActivitySubmission>) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const submission of submissions) {
    const payload = normalizePillarsPayload(submission.payload)
    for (const pillar of payload.pillars) {
      const normalized = pillar.name.trim().toLowerCase()
      const existing = counts.get(normalized)
      if (existing) {
        existing.count += 1
      } else {
        counts.set(normalized, { label: pillar.name.trim(), count: 1 })
      }
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count)
}

export function getAccessibilityPoints(submissions: Array<ActivitySubmission>) {
  return submissions.flatMap((submission) => {
    const payload = normalizePillarsPayload(submission.payload)
    return payload.pillars.map((pillar) => ({
      pillar: pillar.name,
      student: submission.displayName || 'Student',
      accessibility: pillar.accessibility,
      rank:
        payload.moves.find((move) => move.pillarName === pillar.name)?.rank ||
        null,
    }))
  })
}

export function getSequenceSummary(submissions: Array<ActivitySubmission>) {
  const positions = new Map<
    string,
    { label: string; first: number; topThree: number }
  >()
  for (const submission of submissions) {
    const payload = normalizePillarsPayload(submission.payload)
    for (const [index, name] of payload.sequence.entries()) {
      const normalized = name.trim().toLowerCase()
      if (!normalized) continue
      const existing = positions.get(normalized) || {
        label: name.trim(),
        first: 0,
        topThree: 0,
      }
      if (index === 0) existing.first += 1
      if (index < 3) existing.topThree += 1
      positions.set(normalized, existing)
    }
  }
  return [...positions.values()].sort((a, b) => b.topThree - a.topThree)
}

const rubricLabels: Record<RubricErrorCode, string> = {
  'RF-01': 'Treating power as one monolithic actor',
  'RF-03': 'Confusing a grievance with a power holder',
  'RF-04': 'Confusing tactics with pillars',
  'RF-06': 'Missing non-obvious pillars',
  'RF-07': 'Push/pull strategy not distinguished',
  'RF-08': 'Treating all pillars as equally reachable',
  'RF-09': 'Using awareness as the whole strategy',
  'RF-10': 'Leaning on moral framing instead of leverage',
  'SK-08': 'Concern appears experience-based, not conceptual',
}

function hasPattern(text: string, pattern: RegExp) {
  return pattern.test(text.toLowerCase())
}

export function getSubmissionFlags(payload: NormalizedPillarsPayload) {
  const flags = new Set<RubricErrorCode>()
  const power = payload.powerHolder.toLowerCase()
  const pillarNames = payload.pillars.map((pillar) => pillar.name.toLowerCase())
  const allText = [
    power,
    ...pillarNames,
    ...payload.moves.flatMap((move) => [move.pillarName, move.why]),
    payload.reflection,
  ].join(' ')

  if (hasPattern(power, /\beveryone\b|\bsociety\b|\bthe system\b/)) {
    flags.add('RF-01')
  }
  if (
    pillarNames.some((name) =>
      /expensive|unfair|comfort|freedom|discrimination|problem/.test(name),
    )
  ) {
    flags.add('RF-03')
  }
  if (
    pillarNames.some((name) =>
      /petition|protest|walkout|strike|boycott|social media|awareness/.test(
        name,
      ),
    )
  ) {
    flags.add('RF-04')
  }
  if (
    payload.pillars.length < 4 ||
    !pillarNames.some((name) =>
      /supplier|vendor|district|office|staff|alumni|media|board/.test(name),
    )
  ) {
    flags.add('RF-06')
  }
  if (
    payload.pillars.length > 2 &&
    new Set(payload.pillars.map((pillar) => pillar.accessibility)).size === 1
  ) {
    flags.add('RF-08')
  }
  if (hasPattern(allText, /\bawareness\b|\bspread the word\b/)) {
    flags.add('RF-09')
  }
  if (hasPattern(allText, /\bright thing\b|\bwrong\b|\bunjust\b|\bmoral\b/)) {
    flags.add('RF-10')
  }

  return [...flags].map((code) => ({ code, label: rubricLabels[code] }))
}

export function getClassRubricSummary(
  submissions: Array<ActivitySubmission>,
): ClassRubricSummary {
  const flagCounts = new Map<RubricErrorCode, number>()
  let readyCount = 0

  for (const submission of submissions) {
    const payload = normalizePillarsPayload(submission.payload)
    const flags = getSubmissionFlags(payload)
    if (
      payload.powerHolder.trim() &&
      payload.pillars.length >= 4 &&
      payload.moves.length >= 3 &&
      flags.length === 0
    ) {
      readyCount += 1
    }
    for (const flag of flags) {
      flagCounts.set(flag.code, (flagCounts.get(flag.code) || 0) + 1)
    }
  }

  const totalCount = submissions.length
  const commonErrors = [...flagCounts.entries()]
    .map(([code, count]) => ({ code, label: rubricLabels[code], count }))
    .sort((a, b) => b.count - a.count)

  const foundationalErrorCount = commonErrors
    .filter((flag) =>
      ['RF-01', 'RF-03', 'RF-04', 'RF-06'].includes(flag.code),
    )
    .reduce((sum, flag) => Math.max(sum, flag.count), 0)

  const recommendation: RubricRecommendation =
    totalCount > 0 && foundationalErrorCount / totalCount > 0.4
      ? 'FULL_RETEACH'
      : totalCount > 0 && readyCount / totalCount >= 0.7
        ? 'ADVANCE'
        : 'RETEACH_ONE_CONCEPT'

  return {
    readyCount,
    totalCount,
    recommendation,
    commonErrors,
    collectiveBlindSpot:
      commonErrors[0]?.label || 'Waiting for enough submissions to compare.',
  }
}

export const pillarColors = [
  '#6f5429',
  '#c9921a',
  '#8a5a44',
  '#2f5d50',
  '#58534b',
  '#93660e',
  '#5d4b36',
  '#1c1c1c',
]
