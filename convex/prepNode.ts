'use node'

import { v } from 'convex/values'
import { action } from './_generated/server'
import { internal } from './_generated/api'
import {
  MAX_EXTRACTED_DOCUMENT_TEXT_CHARS,
  formatBytes,
  getPrepUploadLimit,
} from './prepLimits'
import { buildCappedSourceDocuments } from './prepPrompt'
import { CURRICULUM_SKILL_PROMPT } from './curriculumSkill'
import type { Doc, Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import type { UserIdentity } from 'convex/server'

type CurriculumSection = {
  title: string
  durationMinutes: number
  teachingNotes: string
  activity?: string
  discussionPrompts: Array<string>
}

type CurriculumContent = {
  title: string
  audience: string
  durationMinutes: number
  learningObjectives: Array<string>
  agenda: Array<CurriculumSection>
  keyConcepts: Array<string>
  materialsNeeded: Array<string>
  assessmentIdeas: Array<string>
  teacherNotes: string
}

type SlideSpec = {
  title: string
  slides: Array<{
    id?: string
    type: 'title' | 'concept' | 'discussion' | 'activity' | 'summary'
    title: string
    bullets: Array<string>
    speakerNotes: string
    imageFileName?: string
  }>
}

type PreparedImage = {
  fileName: string
  dataUri: string
}

const DEFAULT_PILLARS_PREP_BRIEF =
  'Create the curriculum for a two hour class on pillar analysis. Include classic concepts of obedience, pillar analysis, how to dissect pillars, push vs pull from Gene Sharp, Popovic and Helvey. Include two Pillars case studies to teach in the pillars module: El Salvador 1944 and Norway 1942.'

export const MAX_PRESENTATION_SLIDES = 40

function withCurriculumSkill(corePrompt: string) {
  return `You have access to curriculum design guidance from the FUB Discussion Guide framework (SNVA Pillars of Support module). Treat the embedded stages (frame, story, cases, design) as the source of truth for audience analysis, pedagogical sequence, case-study selection, and slide design. Adapt the guidance to the inputs you are given; do not copy text verbatim. Ignore any stage-routing instructions ("ask the trainer", "create session.yaml", "lock this stage") because you are running as a single-shot generator and have no interactive loop with the trainer.\n\n<curriculum_skill>\n${CURRICULUM_SKILL_PROMPT}\n</curriculum_skill>\n\n${corePrompt}`
}

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
}

async function requireTeacherForAction(ctx: ActionCtx, identity: UserIdentity) {
  await ctx.runQuery(internal.prep.requireTeacherForAction, {
    teacherTokenIdentifier: identity.tokenIdentifier,
  })
}

function cleanText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_EXTRACTED_DOCUMENT_TEXT_CHARS)
}

function safeJsonParse(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  const jsonText = fenced ? fenced[1].trim() : extractJsonObject(trimmed)
  return JSON.parse(jsonText)
}

function extractJsonObject(value: string) {
  if (value.startsWith('{') && value.endsWith('}')) return value
  const start = value.indexOf('{')
  if (start === -1) return value
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const char = value[index]
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) return value.slice(start, index + 1)
    }
  }
  return value
}

function fallbackCurriculum(input: {
  title: string
  audience?: string
  durationMinutes?: number
  documentText: string
  prepBrief?: string
}): CurriculumContent {
  const title = input.title || 'Strategic Nonviolence Class'
  const duration = input.durationMinutes || 120
  const excerpt = input.documentText.slice(0, 900)
  return {
    title,
    audience: input.audience || 'In-person student class',
    durationMinutes: duration,
    learningObjectives: [
      'Explain why obedience and cooperation are sources of political power.',
      'Identify and dissect pillars of support in a concrete situation.',
      'Compare push and pull approaches for shifting a pillar.',
      'Apply pillar analysis to historical cases and a student exercise.',
    ],
    agenda: [
      {
        title: 'Opening frame',
        durationMinutes: 10,
        teachingNotes:
          'Introduce pillar analysis as a way to understand why authority depends on organized cooperation.',
        discussionPrompts: [
          'Where does power appear to sit, and who helps make it work?',
        ],
      },
      {
        title: 'Obedience and sources of power',
        durationMinutes: 25,
        teachingNotes:
          excerpt || 'Introduce the key concepts from the uploaded documents.',
        discussionPrompts: [
          'What changes when power is understood as cooperation?',
          'Which forms of obedience are visible, and which are hidden?',
        ],
      },
      {
        title: 'How to dissect pillars',
        durationMinutes: 30,
        teachingNotes:
          'Show how to break a broad pillar into actors, incentives, dependencies, and reachable subgroups.',
        activity:
          'Run the Pillars of Support exercise using the school uniform scenario.',
        discussionPrompts: [
          'Which pillar is too broad and needs to be split?',
          'Which sub-pillar is easiest to understand or reach?',
        ],
      },
      {
        title: 'Case studies: El Salvador 1944 and Norway 1942',
        durationMinutes: 35,
        teachingNotes:
          'Use the cases to compare how pillars can withdraw, redirect, or complicate cooperation.',
        discussionPrompts: [
          'Which pillars mattered most in each case?',
          'What makes a pillar vulnerable to persuasion, pressure, or refusal?',
        ],
      },
      {
        title: 'Push vs pull and debrief',
        durationMinutes: 20,
        teachingNotes:
          'Close by comparing student reasoning patterns and clarifying the difference between leverage and accessibility.',
        discussionPrompts: [
          'What changed after students ranked accessibility?',
        ],
      },
    ],
    keyConcepts: [
      'Obedience',
      'Pillars of support',
      'Pillar dissection',
      'Push vs pull',
      'Accessibility',
    ],
    materialsNeeded: [
      'Projector or shared screen',
      'Student devices',
      'TARKUS live session',
    ],
    assessmentIdeas: [
      'Students submit a Pillars map.',
      'Students write a reflection on accessibility versus formal power.',
    ],
    teacherNotes: `This fallback curriculum follows the prep brief: ${input.prepBrief || DEFAULT_PILLARS_PREP_BRIEF}`,
  }
}

function normalizeCurriculum(value: unknown, fallback: CurriculumContent) {
  const candidate = value as Partial<CurriculumContent> | null
  if (!candidate || typeof candidate !== 'object') return fallback
  return {
    title:
      typeof candidate.title === 'string' ? candidate.title : fallback.title,
    audience:
      typeof candidate.audience === 'string'
        ? candidate.audience
        : fallback.audience,
    durationMinutes:
      typeof candidate.durationMinutes === 'number'
        ? candidate.durationMinutes
        : fallback.durationMinutes,
    learningObjectives: Array.isArray(candidate.learningObjectives)
      ? candidate.learningObjectives.filter(
          (item): item is string => typeof item === 'string',
        )
      : fallback.learningObjectives,
    agenda: Array.isArray(candidate.agenda)
      ? candidate.agenda
          .map((section, index) => {
            const item = section as Partial<CurriculumSection>
            return {
              title:
                typeof item.title === 'string'
                  ? item.title
                  : `Section ${index + 1}`,
              durationMinutes:
                typeof item.durationMinutes === 'number'
                  ? item.durationMinutes
                  : 10,
              teachingNotes:
                typeof item.teachingNotes === 'string'
                  ? item.teachingNotes
                  : '',
              activity: typeof item.activity === 'string' ? item.activity : '',
              discussionPrompts: Array.isArray(item.discussionPrompts)
                ? item.discussionPrompts.filter(
                    (prompt): prompt is string => typeof prompt === 'string',
                  )
                : [],
            }
          })
          .filter((section) => section.title.trim())
      : fallback.agenda,
    keyConcepts: Array.isArray(candidate.keyConcepts)
      ? candidate.keyConcepts.filter(
          (item): item is string => typeof item === 'string',
        )
      : fallback.keyConcepts,
    materialsNeeded: Array.isArray(candidate.materialsNeeded)
      ? candidate.materialsNeeded.filter(
          (item): item is string => typeof item === 'string',
        )
      : fallback.materialsNeeded,
    assessmentIdeas: Array.isArray(candidate.assessmentIdeas)
      ? candidate.assessmentIdeas.filter(
          (item): item is string => typeof item === 'string',
        )
      : fallback.assessmentIdeas,
    teacherNotes:
      typeof candidate.teacherNotes === 'string'
        ? candidate.teacherNotes
        : fallback.teacherNotes,
  } satisfies CurriculumContent
}

function slideSpecFromCurriculum(curriculum: CurriculumContent): SlideSpec {
  return {
    title: curriculum.title,
    slides: [
      {
        id: 'slide-01-title',
        type: 'title',
        title: curriculum.title,
        bullets: [curriculum.audience, `${curriculum.durationMinutes} minutes`],
        speakerNotes: curriculum.teacherNotes,
      },
      {
        id: 'slide-02-learning-objectives',
        type: 'concept',
        title: 'Learning objectives',
        bullets: curriculum.learningObjectives.slice(0, 4),
        speakerNotes: 'Use this slide to set expectations for the session.',
      },
      ...curriculum.agenda.slice(0, 8).map((section, index) => ({
        id: slideIdFor(index + 2, section.title),
        type: section.activity ? ('activity' as const) : ('concept' as const),
        title: section.title,
        bullets: [
          `${section.durationMinutes} minutes`,
          section.teachingNotes,
          ...(section.activity ? [`Activity: ${section.activity}`] : []),
        ]
          .filter(Boolean)
          .slice(0, 4),
        speakerNotes: section.discussionPrompts.join('\n'),
      })),
      {
        id: 'slide-discussion-prompts',
        type: 'discussion',
        title: 'Discussion prompts',
        bullets: curriculum.agenda
          .flatMap((section) => section.discussionPrompts)
          .slice(0, 5),
        speakerNotes:
          'Use these prompts when students need a concrete entry point.',
      },
      {
        id: 'slide-close-and-assess',
        type: 'summary',
        title: 'Close and assess',
        bullets: curriculum.assessmentIdeas.slice(0, 4),
        speakerNotes:
          'Move into the TARKUS live assessment or classroom debrief.',
      },
    ],
  }
}

function isImageDocument(document: Doc<'prepDocuments'>) {
  return (
    document.kind === 'image' ||
    document.mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp)$/i.test(document.fileName)
  )
}

async function blobToDataUri(blob: Blob) {
  const arrayBuffer = await blob.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return `data:${blob.type || 'image/png'};base64,${base64}`
}

async function loadPreparedImages(
  ctx: ActionCtx,
  imageDocs: Array<Doc<'prepDocuments'>>,
): Promise<Array<PreparedImage>> {
  const images: Array<PreparedImage> = []
  for (const document of imageDocs.slice(0, 12)) {
    const blob = await ctx.storage.get(document.storageId)
    if (!blob) continue
    const limit = getPrepUploadLimit('image')
    if (blob.size > limit) {
      throw new Error(`image uploads are limited to ${formatBytes(limit)}`)
    }
    images.push({
      fileName: document.fileName,
      dataUri: await blobToDataUri(blob),
    })
  }
  return images
}

async function openRouterJson<T>({
  system,
  user,
  fallback,
  imageInputs = [],
  maxTokens,
}: {
  system: string
  user: unknown
  fallback: T
  imageInputs?: Array<PreparedImage>
  maxTokens?: number
}): Promise<{ output: T; error?: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return { output: fallback, error: 'OPENROUTER_API_KEY is not set' }
  }

  const userContent =
    imageInputs.length > 0
      ? [
          {
            type: 'text',
            text: JSON.stringify(user),
          },
          ...imageInputs.slice(0, 8).map((image) => ({
            type: 'image_url',
            image_url: {
              url: image.dataUri,
            },
          })),
        ]
      : JSON.stringify(user)

  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
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
        max_tokens: maxTokens ?? 8000,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userContent },
        ],
      }),
    },
  )

  if (!response.ok) {
    return { output: fallback, error: `OpenRouter returned ${response.status}` }
  }
  const json = await response.json()
  const content = json.choices?.[0]?.message?.content
  if (!content) {
    return { output: fallback, error: 'OpenRouter returned no content' }
  }
  try {
    return { output: safeJsonParse(content) as T }
  } catch {
    return { output: fallback, error: 'OpenRouter returned invalid JSON' }
  }
}

async function extractTextFromDocument(
  blob: Blob,
  fileName: string,
  mimeType: string,
) {
  const limit = getPrepUploadLimit('document')
  if (blob.size > limit) {
    throw new Error(`document uploads are limited to ${formatBytes(limit)}`)
  }
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const lower = fileName.toLowerCase()

  if (mimeType.includes('wordprocessingml') || lower.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return cleanText(result.value)
  }

  if (mimeType.includes('pdf') || lower.endsWith('.pdf')) {
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = pdfParseModule.default
    const result = await pdfParse(buffer, { max: 30 })
    return cleanText(result.text || '')
  }

  if (
    mimeType.startsWith('text/') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md')
  ) {
    return cleanText(buffer.toString('utf8'))
  }

  throw new Error('Unsupported file type. Upload PDF, DOCX, TXT, or Markdown.')
}

export const extractDocumentText = action({
  args: { documentId: v.id('prepDocuments') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherForAction(ctx, identity)
    const document: Doc<'prepDocuments'> = await ctx.runQuery(
      internal.prep.getDocumentForAction,
      {
        documentId: args.documentId,
        teacherTokenIdentifier: identity.tokenIdentifier,
      },
    )

    await ctx.runMutation(internal.prep.markDocumentExtracting, {
      documentId: args.documentId,
    })

    try {
      const blob = await ctx.storage.get(document.storageId)
      if (!blob) {
        throw new Error('Uploaded file not found')
      }
      const extractedText = await extractTextFromDocument(
        blob,
        document.fileName,
        document.mimeType,
      )
      await ctx.runMutation(internal.prep.saveDocumentExtraction, {
        documentId: args.documentId,
        extractedText,
      })
      return { extractedText }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not extract document text'
      await ctx.runMutation(internal.prep.saveDocumentExtraction, {
        documentId: args.documentId,
        error: message,
      })
      throw new Error(message)
    }
  },
})

export const generateCurriculum = action({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherForAction(ctx, identity)
    const input: {
      workspace: Doc<'prepWorkspaces'>
      documents: Array<Doc<'prepDocuments'>>
    } = await ctx.runQuery(internal.prep.getWorkspaceInputForAction, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
    })
    const extractedDocs = input.documents.filter(
      (document) =>
        (document.kind || 'document') === 'document' &&
        document.status === 'extracted' &&
        document.extractedText,
    )
    if (!extractedDocs.length) {
      throw new Error('Extract at least one uploaded document first')
    }
    const { documentText, sourceDocuments } =
      buildCappedSourceDocuments(extractedDocs)
    const fallback = fallbackCurriculum({
      title: input.workspace.title,
      audience: input.workspace.audience,
      durationMinutes: input.workspace.durationMinutes,
      documentText,
      prepBrief: input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
    })
    const result = await openRouterJson<unknown>({
      fallback,
      system: withCurriculumSkill(
        'You are TARKUS, a teacher prep assistant for strategic nonviolence training. Generate a polished, teacher-editable curriculum from uploaded source documents and the teacher prep brief. Return JSON only with shape: {"title":"string","audience":"string","durationMinutes":number,"learningObjectives":["string"],"agenda":[{"title":"string","durationMinutes":number,"teachingNotes":"string","activity":"string","discussionPrompts":["string"]}],"keyConcepts":["string"],"materialsNeeded":["string"],"assessmentIdeas":["string"],"teacherNotes":"string"}. Prioritize the teacher prep brief when it is specific. For this demo, pillar analysis should be central: obedience, sources of power, dissecting pillars, push vs pull, Gene Sharp, Popovic, Helvey, El Salvador 1944, and Norway 1942. Each agenda section\'s teachingNotes must be substantive — at least 6 sentences (about 120-200 words) — and walk the teacher through: how to open the segment, the key concepts to introduce in teaching order, one or two concrete classroom-ready examples or contrasts, the facilitator move (board diagram, sorting activity, named worksheet step), and the bridge into the next section. The activity field, when present, should describe the exact classroom activity in 2-4 sentences (grouping, materials, time-boxing, output expected). discussionPrompts should be 2-4 specific prompts per section. Keep it classroom practical, clear, and safe. Do not invent citations. Do not give tactical operational advice; focus on teaching structure.',
      ),
      user: {
        workspace: input.workspace,
        teacherPrepBrief:
          input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
        sourceDocuments,
      },
    })
    const content = normalizeCurriculum(result.output, fallback)
    const curriculumId: Id<'curricula'> = await ctx.runMutation(
      internal.prep.saveGeneratedCurriculum,
      {
        workspaceId: args.workspaceId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        content,
      },
    )
    await ctx.runMutation(internal.prep.addCurriculumMessage, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      role: 'assistant',
      body: result.error
        ? `Generated a fallback curriculum. ${result.error}`
        : 'Generated a curriculum from the uploaded source documents.',
    })
    return { curriculumId, error: result.error }
  },
})

export const refineCurriculum = action({
  args: {
    workspaceId: v.id('prepWorkspaces'),
    instruction: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherForAction(ctx, identity)
    const input: {
      workspace: Doc<'prepWorkspaces'>
      latestCurriculum: Doc<'curricula'> | null
    } = await ctx.runQuery(internal.prep.getWorkspaceInputForAction, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
    })
    if (!input.latestCurriculum) {
      throw new Error('Generate a curriculum before refining it')
    }
    const instruction = args.instruction.trim()
    if (!instruction) {
      throw new Error('Instruction is required')
    }

    await ctx.runMutation(internal.prep.addCurriculumMessage, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      role: 'teacher',
      body: instruction,
    })

    const fallback = normalizeCurriculum(
      input.latestCurriculum.content,
      fallbackCurriculum({
        title: input.workspace.title,
        audience: input.workspace.audience,
        durationMinutes: input.workspace.durationMinutes,
        documentText: '',
        prepBrief: input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
      }),
    )
    const result = await openRouterJson<unknown>({
      fallback,
      system: withCurriculumSkill(
        'You are TARKUS, a teacher prep assistant. Revise the existing curriculum according to the teacher instruction while preserving the class prep brief. Return the full updated curriculum JSON only, preserving this shape: {"title":"string","audience":"string","durationMinutes":number,"learningObjectives":["string"],"agenda":[{"title":"string","durationMinutes":number,"teachingNotes":"string","activity":"string","discussionPrompts":["string"]}],"keyConcepts":["string"],"materialsNeeded":["string"],"assessmentIdeas":["string"],"teacherNotes":"string"}. Preserve the existing depth: each agenda section\'s teachingNotes should remain at least 6 sentences (around 120-200 words) covering opening move, key concepts in teaching order, one or two concrete examples or contrasts, the facilitator move, and the bridge to the next section. The activity field, when present, stays specific (grouping, materials, time-boxing, output). Only reduce detail if the teacher explicitly asks for compression. Keep the result practical and teacher-editable.',
      ),
      user: {
        currentCurriculum: input.latestCurriculum.content,
        teacherPrepBrief:
          input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
        teacherInstruction: instruction,
      },
    })
    const content = normalizeCurriculum(result.output, fallback)
    const curriculumId: Id<'curricula'> = await ctx.runMutation(
      internal.prep.saveGeneratedCurriculum,
      {
        workspaceId: args.workspaceId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        content,
      },
    )
    await ctx.runMutation(internal.prep.addCurriculumMessage, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      role: 'assistant',
      body: result.error
        ? `I kept the curriculum stable because refinement failed. ${result.error}`
        : 'Updated the curriculum with your requested change.',
    })
    return { curriculumId, error: result.error }
  },
})

export const generatePresentation = action({
  args: { workspaceId: v.id('prepWorkspaces') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherForAction(ctx, identity)
    const input: {
      workspace: Doc<'prepWorkspaces'>
      documents: Array<Doc<'prepDocuments'>>
      latestCurriculum: Doc<'curricula'> | null
    } = await ctx.runQuery(internal.prep.getWorkspaceInputForAction, {
      workspaceId: args.workspaceId,
      teacherTokenIdentifier: identity.tokenIdentifier,
    })
    if (!input.latestCurriculum) {
      throw new Error('Generate a curriculum first')
    }
    const curriculum = normalizeCurriculum(
      input.latestCurriculum.content,
      fallbackCurriculum({
        title: input.workspace.title,
        audience: input.workspace.audience,
        durationMinutes: input.workspace.durationMinutes,
        documentText: '',
        prepBrief: input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
      }),
    )
    const imageDocs = input.documents.filter((document) =>
      isImageDocument(document),
    )
    const images = await loadPreparedImages(ctx, imageDocs)
    const fallback = slideSpecFromCurriculum(curriculum)
    const result = await openRouterJson<unknown>({
      fallback,
      system: withCurriculumSkill(
        `You are TARKUS, creating a classroom PowerPoint outline from a finalized curriculum. Treat the curriculum-skill design and full-session mode stages as the authority on deck structure, not a generic slide outline. Return JSON only with shape {"title":"string","slides":[{"id":"stable-slide-id","type":"title|concept|discussion|activity|summary","title":"string","bullets":["string"],"speakerNotes":"string","imageFileName":"optional exact uploaded image filename"}]}. Use stable unique id values for every slide (e.g., "title-1", "block-2-five-supplies", "case-norway-1942") so the teacher can edit individual slides later.\n\nDeck structure must follow the skill's seven blocks for a full session: (1) Power Theory and Sharp's quote, (2) What Pillars Supply (obedience, resources, skills, enforcement, legitimacy), (3) The Pillars Model and concentric circles, (4) Strategic Analysis with Helvey's three dimensions (importance, loyalty, vulnerability), (5) What Pillars Are NOT — the four anti-patterns, one slide each, revealed in sequence, (6) Case Studies (El Salvador 1944 and Norway 1942), (7) Exercise and closing. Open with a title slide and finish with a closing slide that carries the arrow + closing question.\n\nAim for 18-30 slides for a 90-120 minute session, fewer when the curriculum's durationMinutes is shorter; never exceed ${MAX_PRESENTATION_SLIDES} slides. Map skill slide types onto our 5 enum values: title type for title slides, section breaks, and the closing slide; concept type for concept slides, quote slides, diagram slides, contrast slides, table or list slides, and grid slides; discussion type for any prompt-only slide; activity type for exercise instruction slides; summary type for the wrap-up takeaway.\n\nTraining-deck text density: slide text is sparse (the trainer talks; the slide anchors). Concept slides: term + 1-2 sentence definition. Quote slides: just the quote and attribution in bullets. Discussion slides: just the question, no suggested answers. Contrast slides: pair the wrong-vs-right examples in two bullets ("the economy" → "CAINCO in Santa Cruz"). Exercise slides: numbered, complete steps that participants can read without the trainer repeating them. Closing: the arrow + the closing question.\n\nspeakerNotes is where the substance lives. Every slide needs facilitator notes covering: a one-line opening cue (what the trainer says or asks), the key concept or move for the slide, an engagement instruction when relevant (pair discussion, show of hands, sorting activity), an explicit timing cue ("[2 min]"), and a transition prompt to the next slide. Do not put the explanation on the slide and leave the notes blank.\n\nIf uploaded images are useful, inspect them and assign an exact imageFileName from uploadedImages to the most relevant slides — Sharp/palace-on-pillars diagram, concentric circles, case-study photos. Do not fabricate citations. Keep the deck classroom practical, safe, and analytical (no tactical operational instruction).`,
      ),
      user: {
        curriculum,
        teacherPrepBrief:
          input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
        uploadedImages: imageDocs.map((document) => ({
          fileName: document.fileName,
          mimeType: document.mimeType,
        })),
      },
      imageInputs: images,
    })
    const slideSpec = normalizeSlideSpec(
      result.output,
      fallback,
      imageDocs.map((document) => document.fileName),
    )
    const placedSlideSpec = ensureImagePlacements(
      slideSpec,
      imageDocs.map((document) => document.fileName),
    )
    const fileName = `${slugify(curriculum.title)}.pptx`
    const presentationId: Id<'presentations'> = await ctx.runMutation(
      internal.prep.createPresentationRecord,
      {
        workspaceId: args.workspaceId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        curriculumId: input.latestCurriculum._id,
        slideSpec: placedSlideSpec,
        fileName,
      },
    )

    try {
      const bytes = await buildPptx(placedSlideSpec, images)
      const storageId = await ctx.storage.store(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      )
      await ctx.runMutation(internal.prep.savePresentationResult, {
        presentationId,
        storageId,
      })
      await ctx.runMutation(internal.prep.addCurriculumMessage, {
        workspaceId: args.workspaceId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        role: 'assistant',
        body: result.error
          ? `Generated a presentation with a fallback slide plan. ${result.error}`
          : 'Generated a downloadable PowerPoint from the curriculum.',
      })
      return { presentationId, error: result.error }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not generate presentation'
      await ctx.runMutation(internal.prep.savePresentationResult, {
        presentationId,
        error: message,
      })
      throw new Error(message)
    }
  },
})

export const refinePresentation = action({
  args: {
    presentationId: v.id('presentations'),
    instruction: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
    await requireTeacherForAction(ctx, identity)
    const instruction = args.instruction.trim()
    if (!instruction) {
      throw new Error('Instruction is required')
    }
    const input: {
      presentation: Doc<'presentations'>
      workspace: Doc<'prepWorkspaces'>
      curriculum: Doc<'curricula'> | null
      documents: Array<Doc<'prepDocuments'>>
      messages: Array<Doc<'presentationMessages'>>
    } = await ctx.runMutation(internal.prep.beginPresentationEdit, {
      presentationId: args.presentationId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      instruction,
    })
    const imageDocs = input.documents.filter((document) =>
      isImageDocument(document),
    )
    const images = await loadPreparedImages(ctx, imageDocs)
    const curriculumFallback = input.curriculum
      ? slideSpecFromCurriculum(
          normalizeCurriculum(
            input.curriculum.content,
            fallbackCurriculum({
              title: input.workspace.title,
              audience: input.workspace.audience,
              durationMinutes: input.workspace.durationMinutes,
              documentText: '',
              prepBrief:
                input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
            }),
          ),
        )
      : {
          title: input.workspace.title,
          slides: [
            {
              type: 'title' as const,
              title: input.workspace.title,
              bullets: [input.workspace.audience || 'In-person student class'],
              speakerNotes: input.workspace.prepBrief || '',
            },
          ],
        }
    const allowedImageFileNames = imageDocs.map((document) => document.fileName)
    const currentSlideSpec = normalizeSlideSpec(
      input.presentation.slideSpec,
      curriculumFallback,
      allowedImageFileNames,
    )
    const deterministicSlideSpec = applyDeterministicPresentationEdit(
      currentSlideSpec,
      instruction,
    )
    if (deterministicSlideSpec) {
      await ctx.runMutation(internal.prep.savePresentationSlideSpecDraft, {
        presentationId: args.presentationId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        slideSpec: deterministicSlideSpec,
      })
      try {
        const bytes = await buildPptx(deterministicSlideSpec, images)
        const storageId = await ctx.storage.store(
          new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          }),
        )
        await ctx.runMutation(internal.prep.finishPresentationEdit, {
          presentationId: args.presentationId,
          teacherTokenIdentifier: identity.tokenIdentifier,
          editStatus: 'idle',
          downloadStatus: 'ready',
          storageId,
          assistantMessage:
            'Moved the image and refreshed the PPTX download.',
        })
        return { presentationId: args.presentationId }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not refresh the downloadable PPTX'
        await ctx.runMutation(internal.prep.finishPresentationEdit, {
          presentationId: args.presentationId,
          teacherTokenIdentifier: identity.tokenIdentifier,
          editStatus: 'idle',
          downloadStatus: 'failed',
          downloadError: message,
          assistantMessage: `Updated the preview, but could not refresh the downloadable PPTX. ${message}`,
        })
        return { presentationId: args.presentationId, error: message }
      }
    }
    const result = await openRouterJson<unknown>({
      fallback: currentSlideSpec,
      system: withCurriculumSkill(
        `You are TARKUS, editing a classroom PowerPoint outline for strategic nonviolence training. The curriculum-skill design and full-session mode stages remain the authority on deck shape. Return the full updated deck as JSON only with shape {"title":"string","slides":[{"id":"stable-slide-id","type":"title|concept|discussion|activity|summary","title":"string","bullets":["string"],"speakerNotes":"string","imageFileName":"optional exact uploaded image filename"}]}. Preserve existing slide ids exactly for slides that still exist; create stable unique ids only for new slides.\n\nApply the teacher instruction directly to the slide deck. Preserve the seven-block structure (Power Theory → Pillars Supply → Model → Helvey → What Pillars Are NOT → Case Studies → Exercise/Closing) and any must-have slides (Sharp quote, five supplies, concentric circles, Helvey dimensions, four anti-pattern contrast slides, exercise with the three numbered steps, closing) unless the teacher explicitly asks to remove them.\n\nIf the teacher requests a specific slide count, honor it as closely as possible up to ${MAX_PRESENTATION_SLIDES} slides. Otherwise keep the deck in the 16-30 slide range; do not compress or prune unless asked. Maintain training-deck text density: sparse slide text, substantive speakerNotes that include opening cue, key move, engagement instruction when relevant, timing cue, and transition. Map skill slide types onto our 5 enum values as in initial generation (title for titles/section breaks/closing, concept for concept/quote/diagram/contrast/table/grid, discussion for prompt-only, activity for exercise, summary for wrap-up).\n\nOnly use imageFileName values from the uploadedImages list. Preserve existing imageFileName placements unless the teacher explicitly asks to move or remove images. If moving images, move the exact existing filename to the requested slide. If removing an image, set imageFileName to an empty string for that slide. When adding new image placements, prefer Sharp diagram, concentric-circles, and case-study context slides. Do not fabricate citations or give tactical operational instruction.`,
      ),
      user: {
        currentSlideSpec,
        teacherInstruction: instruction,
        teacherPrepBrief:
          input.workspace.prepBrief || DEFAULT_PILLARS_PREP_BRIEF,
        recentMessages: input.messages.map((message) => ({
          role: message.role,
          body: message.body,
        })),
        uploadedImages: imageDocs.map((document) => ({
          fileName: document.fileName,
          mimeType: document.mimeType,
        })),
      },
      imageInputs: images,
    })

    if (result.error) {
      await ctx.runMutation(internal.prep.finishPresentationEdit, {
        presentationId: args.presentationId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        editStatus: 'failed',
        downloadStatus: input.presentation.storageId ? 'ready' : 'failed',
        editError: result.error,
        ...(input.presentation.storageId
          ? {}
          : { downloadError: result.error }),
        assistantMessage: `I could not update the presentation. ${result.error}`,
      })
      return { presentationId: args.presentationId, error: result.error }
    }

    const normalizedSlideSpec = normalizeSlideSpec(
      result.output,
      currentSlideSpec,
      allowedImageFileNames,
    )
    const reconciledSlideSpec = reconcilePresentationEditResult(
      result.output,
      currentSlideSpec,
      normalizedSlideSpec,
      instruction,
    )
    const slideSpec =
      shouldAutoPlaceImagesOnEdit(
        instruction,
        currentSlideSpec,
        reconciledSlideSpec,
        allowedImageFileNames,
      )
        ? ensureImagePlacements(reconciledSlideSpec, allowedImageFileNames)
        : reconciledSlideSpec
    await ctx.runMutation(internal.prep.savePresentationSlideSpecDraft, {
      presentationId: args.presentationId,
      teacherTokenIdentifier: identity.tokenIdentifier,
      slideSpec,
    })

    try {
      const bytes = await buildPptx(slideSpec, images)
      const storageId = await ctx.storage.store(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        }),
      )
      await ctx.runMutation(internal.prep.finishPresentationEdit, {
        presentationId: args.presentationId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        editStatus: 'idle',
        downloadStatus: 'ready',
        storageId,
        assistantMessage:
          'Updated the presentation and refreshed the PPTX download.',
      })
      return { presentationId: args.presentationId }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not refresh the downloadable PPTX'
      await ctx.runMutation(internal.prep.finishPresentationEdit, {
        presentationId: args.presentationId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        editStatus: 'idle',
        downloadStatus: 'failed',
        downloadError: message,
        assistantMessage: `Updated the preview, but could not refresh the downloadable PPTX. ${message}`,
      })
      return { presentationId: args.presentationId, error: message }
    }
  },
})

export function normalizeSlideSpec(
  value: unknown,
  fallback: SlideSpec,
  allowedImageFileNames: Array<string> = [],
): SlideSpec {
  const candidate = value as Partial<SlideSpec> | null
  if (!candidate || typeof candidate !== 'object') return fallback
  const allowedImages = new Set(allowedImageFileNames)
  const allowedImageLookup = buildAllowedImageLookup(allowedImageFileNames)
  const candidateSlides = Array.isArray(candidate.slides)
    ? candidate.slides
    : null
  if (!candidateSlides) {
    return fallback
  }
  const explicitlyAssignedImages = new Set(
    candidateSlides
      .map((slide) => {
        const requested = (slide as Record<string, unknown>).imageFileName
        return typeof requested === 'string'
          ? resolveAllowedImageFileName(requested, allowedImageLookup)
          : null
      })
      .filter(
        (imageFileName): imageFileName is string => imageFileName !== null,
      ),
  )
  return {
    title:
      typeof candidate.title === 'string' ? candidate.title : fallback.title,
    slides: candidateSlides
      .map((slide, index) => {
        const item = slide as Record<string, unknown>
        const title = typeof item.title === 'string' ? item.title : 'Slide'
        const fallbackSlide = findFallbackSlide(fallback, item, index)
        const imageFileName = resolveSlideImageFileName(
          item,
          fallbackSlide,
          allowedImages,
          allowedImageLookup,
          explicitlyAssignedImages,
        )
        const normalizedSlide: SlideSpec['slides'][number] = {
          id:
            typeof item.id === 'string' && item.id.trim()
              ? item.id.trim()
              : reusableFallbackSlideId(fallbackSlide, title) ||
                slideIdFor(index, title),
          type:
            item.type === 'title' ||
            item.type === 'concept' ||
            item.type === 'discussion' ||
            item.type === 'activity' ||
            item.type === 'summary'
              ? item.type
              : fallbackSlide?.type || 'concept',
          title,
          bullets: Array.isArray(item.bullets)
            ? item.bullets.filter(
                (bullet): bullet is string => typeof bullet === 'string',
              )
            : fallbackSlide?.bullets || [],
          speakerNotes:
            typeof item.speakerNotes === 'string'
              ? item.speakerNotes
              : fallbackSlide?.speakerNotes || '',
        }
        if (imageFileName) {
          normalizedSlide.imageFileName = imageFileName
        }
        return normalizedSlide
      })
      .filter((slide) => slide.title.trim())
      .slice(0, MAX_PRESENTATION_SLIDES),
  }
}

export function reconcilePresentationEditResult(
  rawValue: unknown,
  currentSlideSpec: SlideSpec,
  normalizedSlideSpec: SlideSpec,
  instruction: string,
): SlideSpec {
  const candidate = rawValue as Partial<SlideSpec> | null
  const candidateSlides = Array.isArray(candidate?.slides)
    ? candidate.slides
    : []
  if (!candidateSlides.length) return currentSlideSpec
  if (canReplaceDeckSlides(instruction, candidateSlides.length, currentSlideSpec)) {
    return normalizedSlideSpec
  }

  const targetSlideIndexes = getReferencedSlideIndexes(instruction)
  const mergedSlides = [...currentSlideSpec.slides]
  const appendedSlides: SlideSpec['slides'] = []
  const usedIndexes = new Set<number>()
  let changedExistingSlide = false

  for (const [candidateIndex, slide] of normalizedSlideSpec.slides.entries()) {
    const rawSlide = candidateSlides[candidateIndex] as Record<string, unknown>
    const matchedIndex = findExistingSlideIndexForEdit(
      currentSlideSpec,
      rawSlide,
      slide,
      targetSlideIndexes,
      candidateIndex,
      usedIndexes,
    )
    if (matchedIndex >= 0) {
      mergedSlides[matchedIndex] = mergeSlideForEdit(
        currentSlideSpec.slides[matchedIndex],
        slide,
      )
      usedIndexes.add(matchedIndex)
      changedExistingSlide = true
      continue
    }
    appendedSlides.push(slide)
  }

  const shouldAppend =
    hasSlideAdditionIntent(instruction) || (!changedExistingSlide && appendedSlides.length > 0)
  const slides = shouldAppend
    ? [...mergedSlides, ...renumberNewSlideIds(appendedSlides, mergedSlides.length)]
    : mergedSlides

  return {
    title: normalizedSlideSpec.title || currentSlideSpec.title,
    slides: slides.slice(0, MAX_PRESENTATION_SLIDES),
  }
}

function canReplaceDeckSlides(
  instruction: string,
  candidateSlideCount: number,
  currentSlideSpec: SlideSpec,
) {
  if (hasSlideRemovalOrReductionIntent(instruction)) return true
  if (candidateSlideCount >= currentSlideSpec.slides.length) return true
  return false
}

function findExistingSlideIndexForEdit(
  currentSlideSpec: SlideSpec,
  rawSlide: Record<string, unknown>,
  normalizedSlide: SlideSpec['slides'][number],
  targetSlideIndexes: Array<number>,
  candidateIndex: number,
  usedIndexes: Set<number>,
) {
  const rawId = typeof rawSlide.id === 'string' ? rawSlide.id.trim() : ''
  const id = rawId || normalizedSlide.id || ''
  if (id) {
    const byId = currentSlideSpec.slides.findIndex((slide) => slide.id === id)
    if (byId >= 0 && !usedIndexes.has(byId)) return byId
  }

  const title = normalizedSlide.title.trim().toLowerCase()
  const titleMatches = currentSlideSpec.slides
    .map((slide, index) => ({ slide, index }))
    .filter(
      ({ slide, index }) =>
        !usedIndexes.has(index) &&
        slide.title.trim().toLowerCase() === title,
    )
  if (titleMatches.length === 1) return titleMatches[0].index

  if (targetSlideIndexes.length === 1 && candidateIndex === 0) {
    const targetIndex = targetSlideIndexes[0]
    if (
      targetIndex >= 0 &&
      targetIndex < currentSlideSpec.slides.length &&
      !usedIndexes.has(targetIndex)
    ) {
      return targetIndex
    }
  }

  if (targetSlideIndexes.length > candidateIndex) {
    const targetIndex = targetSlideIndexes[candidateIndex]
    if (
      targetIndex >= 0 &&
      targetIndex < currentSlideSpec.slides.length &&
      !usedIndexes.has(targetIndex)
    ) {
      return targetIndex
    }
  }

  return -1
}

function mergeSlideForEdit(
  currentSlide: SlideSpec['slides'][number],
  updatedSlide: SlideSpec['slides'][number],
): SlideSpec['slides'][number] {
  return {
    ...currentSlide,
    ...updatedSlide,
    id: currentSlide.id || updatedSlide.id,
    imageFileName:
      updatedSlide.imageFileName === undefined
        ? currentSlide.imageFileName
        : updatedSlide.imageFileName,
  }
}

function renumberNewSlideIds(
  slides: SlideSpec['slides'],
  existingSlideCount: number,
) {
  return slides.map((slide, index) => ({
    ...slide,
    id: slide.id || slideIdFor(existingSlideCount + index, slide.title),
  }))
}

function getReferencedSlideIndexes(instruction: string) {
  const indexes: Array<number> = []
  const pattern = /\bslide\s+(\d+)\b/gi
  let match: RegExpExecArray | null
  while ((match = pattern.exec(instruction)) !== null) {
    const index = Number(match[1]) - 1
    if (Number.isInteger(index) && index >= 0 && !indexes.includes(index)) {
      indexes.push(index)
    }
  }
  return indexes
}

function reusableFallbackSlideId(
  fallbackSlide: SlideSpec['slides'][number] | undefined,
  title: string,
) {
  if (!fallbackSlide?.id) return undefined
  if (fallbackSlide.title.trim().toLowerCase() !== title.trim().toLowerCase()) {
    return undefined
  }
  return fallbackSlide.id
}

function findFallbackSlide(
  fallback: SlideSpec,
  item: Record<string, unknown>,
  index: number,
): SlideSpec['slides'][number] | undefined {
  if (typeof item.id === 'string' && item.id.trim()) {
    const id = item.id.trim()
    const byId = fallback.slides.find((slide) => slide.id === id)
    if (byId) return byId
  }
  if (typeof item.title === 'string' && item.title.trim()) {
    const title = item.title.trim().toLowerCase()
    const byTitle = fallback.slides.find(
      (slide) => slide.title.trim().toLowerCase() === title,
    )
    if (byTitle) return byTitle
  }
  return fallback.slides[index]
}

function resolveSlideImageFileName(
  item: Record<string, unknown>,
  fallbackSlide: SlideSpec['slides'][number] | undefined,
  allowedImages: Set<string>,
  allowedImageLookup: Map<string, string>,
  explicitlyAssignedImages: Set<string>,
) {
  const requested = item.imageFileName
  if (typeof requested === 'string') {
    const trimmed = requested.trim()
    if (isExplicitImageRemoval(trimmed)) return undefined
    const resolved = resolveAllowedImageFileName(trimmed, allowedImageLookup)
    if (resolved) return resolved
  }
  if (
    fallbackSlide?.imageFileName &&
    allowedImages.has(fallbackSlide.imageFileName) &&
    !explicitlyAssignedImages.has(fallbackSlide.imageFileName)
  ) {
    return fallbackSlide.imageFileName
  }
  return undefined
}

function buildAllowedImageLookup(allowedImageFileNames: Array<string>) {
  const lookup = new Map<string, string>()
  for (const fileName of allowedImageFileNames) {
    lookup.set(fileName, fileName)
    lookup.set(fileName.toLowerCase(), fileName)
    lookup.set(slugify(fileName), fileName)
    lookup.set(slugify(fileName.replace(/\.[^.]+$/, '')), fileName)
  }
  return lookup
}

function resolveAllowedImageFileName(
  requested: string,
  lookup: Map<string, string>,
) {
  const trimmed = requested.trim()
  return (
    lookup.get(trimmed) ||
    lookup.get(trimmed.toLowerCase()) ||
    lookup.get(slugify(trimmed)) ||
    lookup.get(slugify(trimmed.replace(/\.[^.]+$/, ''))) ||
    null
  )
}

function isExplicitImageRemoval(value: string) {
  return (
    !value ||
    value.toLowerCase() === 'none' ||
    value.toLowerCase() === 'null' ||
    value.toLowerCase() === 'remove' ||
    value.toLowerCase() === 'removed' ||
    value.toLowerCase() === 'no image'
  )
}

export function ensureImagePlacements(
  slideSpec: SlideSpec,
  imageFileNames: Array<string>,
): SlideSpec {
  const availableImageFileNames = imageFileNames.filter(Boolean)
  if (!availableImageFileNames.length) return slideSpec
  if (slideSpec.slides.some((slide) => slide.imageFileName)) return slideSpec

  const eligibleIndexes = slideSpec.slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide, index }) => index > 0 && slide.type !== 'title')
    .map(({ index }) => index)
  if (!eligibleIndexes.length) return slideSpec

  const imageCount = Math.min(
    availableImageFileNames.length,
    eligibleIndexes.length,
  )
  const selectedIndexes = Array.from({ length: imageCount }, (_, imageIndex) => {
    const position = Math.round(
      (imageIndex * (eligibleIndexes.length - 1)) / Math.max(imageCount - 1, 1),
    )
    return eligibleIndexes[position]
  })
  const placements = new Map(
    selectedIndexes.map((slideIndex, imageIndex) => [
      slideIndex,
      availableImageFileNames[imageIndex],
    ]),
  )

  return {
    ...slideSpec,
    slides: slideSpec.slides.map((slide, index) => {
      const imageFileName = placements.get(index)
      return imageFileName ? { ...slide, imageFileName } : slide
    }),
  }
}

function shouldAutoPlaceImagesOnEdit(
  instruction: string,
  currentSlideSpec: SlideSpec,
  updatedSlideSpec: SlideSpec,
  imageFileNames: Array<string>,
) {
  if (!imageFileNames.length) return false
  if (updatedSlideSpec.slides.some((slide) => slide.imageFileName)) return false
  if (currentSlideSpec.slides.some((slide) => slide.imageFileName)) return false
  if (hasImageRemovalIntent(instruction)) return false
  return hasImagePlacementIntent(instruction)
}

export function applyDeterministicPresentationEdit(
  slideSpec: SlideSpec,
  instruction: string,
): SlideSpec | null {
  const moveImageMatch = instruction.match(
    /\bmove\s+(?:the\s+)?(?:image|photo|picture|visual)\s+from\s+slide\s+(\d+)\s+to\s+slide\s+(\d+)\b/i,
  )
  if (!moveImageMatch) return null
  const fromIndex = Number(moveImageMatch[1]) - 1
  const toIndex = Number(moveImageMatch[2]) - 1
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= slideSpec.slides.length ||
    toIndex >= slideSpec.slides.length ||
    fromIndex === toIndex
  ) {
    return null
  }
  const sourceImageFileName = slideSpec.slides[fromIndex]?.imageFileName
  if (!sourceImageFileName) return null
  return {
    ...slideSpec,
    slides: slideSpec.slides.map((slide, index) => {
      if (index === fromIndex) {
        const { imageFileName: _imageFileName, ...rest } = slide
        return rest
      }
      if (index === toIndex) {
        return { ...slide, imageFileName: sourceImageFileName }
      }
      return slide
    }),
  }
}

function hasImagePlacementIntent(instruction: string) {
  return /\b(image|images|photo|photos|picture|pictures|visual|visuals|diagram|diagrams)\b/i.test(
    instruction,
  )
}

function hasSlideAdditionIntent(instruction: string) {
  return /\b(add|append|insert|create|include|expand)\b.{0,48}\b(slide|slides)\b/i.test(
    instruction,
  )
}

function hasSlideRemovalOrReductionIntent(instruction: string) {
  return (
    /\b(remove|delete|drop|cut)\b.{0,48}\b(slide|slides)\b/i.test(
      instruction,
    ) ||
    /\b(shorten|reduce|condense|trim)\b.{0,48}\b(to\s+)?\d+\s+slides?\b/i.test(
      instruction,
    ) ||
    /\b(make|turn)\b.{0,32}\b(to\s+)?\d+\s+slides?\b/i.test(instruction)
  )
}

function hasImageRemovalIntent(instruction: string) {
  return (
    /\b(remove|delete|drop|clear)\b.{0,32}\b(image|images|photo|photos|picture|pictures|visual|visuals|diagram|diagrams)\b/i.test(
      instruction,
    ) ||
    /\b(no|without)\b.{0,16}\b(image|images|photo|photos|picture|pictures|visual|visuals|diagram|diagrams)\b/i.test(
      instruction,
    )
  )
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'tarkus-curriculum'
  )
}

function slideIdFor(index: number, title: string) {
  const position = String(index + 1).padStart(2, '0')
  return `slide-${position}-${slugify(title).slice(0, 32) || 'untitled'}`
}

async function buildPptx(
  slideSpec: SlideSpec,
  images: Array<PreparedImage> = [],
) {
  const pptxModule = await import('pptxgenjs')
  const PptxGenJS = pptxModule.default
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'TARKUS'
  pptx.subject = slideSpec.title
  pptx.title = slideSpec.title
  pptx.company = 'TARKUS'
  pptx.theme = {
    headFontFace: 'Aptos Display',
    bodyFontFace: 'Aptos',
  }
  const imagesByFileName = new Map(
    images.map((image) => [image.fileName, image.dataUri]),
  )

  for (const [index, slide] of slideSpec.slides.entries()) {
    const page = pptx.addSlide()
    page.background = { color: index === 0 ? '1C1C1C' : 'FAF9F6' }
    const isTitle = index === 0 || slide.type === 'title'
    page.addText(isTitle ? 'TARKUS' : String(index).padStart(2, '0'), {
      x: 0.55,
      y: 0.35,
      w: 1.2,
      h: 0.3,
      fontFace: 'Aptos',
      fontSize: 9,
      bold: true,
      color: isTitle ? 'F2DFAD' : '93660E',
    })
    page.addShape(pptx.ShapeType.line, {
      x: 0.55,
      y: 0.82,
      w: 12.2,
      h: 0,
      line: { color: isTitle ? 'C9921A' : 'D8CBB3', width: 1 },
    })
    const slideImage = slide.imageFileName
      ? imagesByFileName.get(slide.imageFileName)
      : null
    page.addText(slide.title, {
      x: 0.75,
      y: isTitle ? 1.55 : 1.18,
      w: slideImage && !isTitle ? 6.2 : 11.2,
      h: isTitle ? 1.1 : 0.72,
      fontFace: 'Aptos Display',
      fontSize: isTitle ? 34 : 26,
      bold: true,
      color: isTitle ? 'FAF9F6' : '1C1C1C',
      breakLine: false,
      fit: 'shrink',
    })
    if (slideImage && !isTitle) {
      page.addImage({
        data: slideImage,
        x: 7.65,
        y: 1.55,
        w: 4.85,
        h: 3.9,
      })
      page.addText(slide.imageFileName || '', {
        x: 7.65,
        y: 5.55,
        w: 4.85,
        h: 0.3,
        fontFace: 'Aptos',
        fontSize: 8,
        color: '756D60',
        fit: 'shrink',
      })
    }
    const bullets = slide.bullets.slice(0, 5)
    page.addText(
      bullets.length
        ? bullets.map((bullet) => ({
            text: bullet,
            options: { bullet: { indent: 16 } },
          }))
        : [
            {
              text: 'Use this moment to connect the source material to the room.',
            },
          ],
      {
        x: 0.95,
        y: isTitle ? 3.15 : 2.25,
        w: slideImage && !isTitle ? 5.9 : 10.5,
        h: 2.9,
        fontFace: 'Aptos',
        fontSize: isTitle ? 18 : 16,
        color: isTitle ? 'F8EBCD' : '3D382F',
        breakLine: false,
        paraSpaceAfter: 10,
        fit: 'shrink',
      },
    )
    page.addNotes(slide.speakerNotes || slide.bullets.join('\n'))
    page.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 7.0,
      w: 13.34,
      h: 0.5,
      fill: { color: isTitle ? 'C9921A' : 'F2DFAD' },
      line: { color: isTitle ? 'C9921A' : 'F2DFAD' },
    })
  }

  return (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer
}
