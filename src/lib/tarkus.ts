import type { Id } from '../../convex/_generated/dataModel'

export type Pillar = {
  id: string
  name: string
  importance: number
  accessibility: number
  rationale?: string
}

export type PillarsPayload = {
  decisionMaker: string
  pillars: Array<Pillar>
  sequence: Array<string>
  reflection: string
}

export type ActivitySubmission = {
  _id: Id<'activitySubmissions'>
  displayName?: string
  payload: unknown
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
        }
        const text =
          candidate.text ||
          candidate.question ||
          candidate.concept ||
          candidate.label ||
          candidate.summary ||
          candidate.insight
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
        const cluster = item as { label?: unknown; theme?: unknown; count?: unknown }
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
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => ({
      label: key,
      count: typeof item === 'number' ? item : 1,
    }))
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
    const tone = value as { label?: unknown; tone?: unknown; explanation?: unknown }
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

  return { label: 'No signal yet', explanation: 'More class activity is needed.' }
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
}

export function normalizeAnalysisOutput(
  analysis: AnalysisOutput | undefined,
): NormalizedAnalysisOutput | undefined {
  if (!analysis) return undefined

  return {
    teacherBrief: toTextList(analysis.teacherBrief),
    recurringQuestions: toTextList(analysis.recurringQuestions),
    unclearConcepts: toTextList(analysis.unclearConcepts),
    emotionalTone: toEmotionalTone(analysis.emotionalTone),
    chatClusters: toChatClusters(analysis.chatClusters),
  }
}

export function normalizePillarsPayload(payload: unknown): PillarsPayload {
  const value = payload as Partial<PillarsPayload> | null
  return {
    decisionMaker: value?.decisionMaker || '',
    pillars: Array.isArray(value?.pillars)
      ? value.pillars
          .map((pillar, index) => {
            const candidate = pillar as Partial<Pillar>
            return {
              id: candidate.id || `pillar-${index}`,
              name: candidate.name || '',
              importance: Number(candidate.importance || 3),
              accessibility: Number(candidate.accessibility || 3),
              rationale: candidate.rationale || '',
            }
          })
          .filter((pillar) => pillar.name.trim())
      : [],
    sequence: Array.isArray(value?.sequence)
      ? value.sequence.filter((item): item is string => typeof item === 'string')
      : [],
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

export function getMatrixPoints(submissions: Array<ActivitySubmission>) {
  return submissions.flatMap((submission) => {
    const payload = normalizePillarsPayload(submission.payload)
    return payload.pillars.map((pillar) => ({
      pillar: pillar.name,
      student: submission.displayName || 'Student',
      importance: pillar.importance,
      accessibility: pillar.accessibility,
    }))
  })
}

export function getSequenceSummary(submissions: Array<ActivitySubmission>) {
  const positions = new Map<string, { label: string; first: number; topThree: number }>()
  for (const submission of submissions) {
    const payload = normalizePillarsPayload(submission.payload)
    for (const [index, name] of payload.sequence.entries()) {
      const normalized = name.trim().toLowerCase()
      if (!normalized) continue
      const existing =
        positions.get(normalized) || { label: name.trim(), first: 0, topThree: 0 }
      if (index === 0) existing.first += 1
      if (index < 3) existing.topThree += 1
      positions.set(normalized, existing)
    }
  }
  return [...positions.values()].sort((a, b) => b.topThree - a.topThree)
}

export const pillarColors = [
  '#0f766e',
  '#7c3aed',
  '#dc2626',
  '#2563eb',
  '#ca8a04',
  '#059669',
  '#c2410c',
  '#4f46e5',
]
