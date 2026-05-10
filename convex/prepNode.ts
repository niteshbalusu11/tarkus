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

function requireIdentity(identity: UserIdentity | null) {
  if (!identity) {
    throw new Error('Not authenticated')
  }
  return identity
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
  return JSON.parse(fenced ? fenced[1] : trimmed)
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
        discussionPrompts: ['Where does power appear to sit, and who helps make it work?'],
      },
      {
        title: 'Obedience and sources of power',
        durationMinutes: 25,
        teachingNotes: excerpt || 'Introduce the key concepts from the uploaded documents.',
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
        activity: 'Run the Pillars of Support exercise using the school uniform scenario.',
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
        discussionPrompts: ['What changed after students ranked accessibility?'],
      },
    ],
    keyConcepts: [
      'Obedience',
      'Pillars of support',
      'Pillar dissection',
      'Push vs pull',
      'Accessibility',
    ],
    materialsNeeded: ['Projector or shared screen', 'Student devices', 'TARKUS live session'],
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
    title: typeof candidate.title === 'string' ? candidate.title : fallback.title,
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
      ? candidate.keyConcepts.filter((item): item is string => typeof item === 'string')
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
        type: 'title',
        title: curriculum.title,
        bullets: [curriculum.audience, `${curriculum.durationMinutes} minutes`],
        speakerNotes: curriculum.teacherNotes,
      },
      {
        type: 'concept',
        title: 'Learning objectives',
        bullets: curriculum.learningObjectives.slice(0, 4),
        speakerNotes: 'Use this slide to set expectations for the session.',
      },
      ...curriculum.agenda.slice(0, 8).map((section) => ({
        type: section.activity ? 'activity' as const : 'concept' as const,
        title: section.title,
        bullets: [
          `${section.durationMinutes} minutes`,
          section.teachingNotes,
          ...(section.activity ? [`Activity: ${section.activity}`] : []),
        ].filter(Boolean).slice(0, 4),
        speakerNotes: section.discussionPrompts.join('\n'),
      })),
      {
        type: 'discussion',
        title: 'Discussion prompts',
        bullets: curriculum.agenda
          .flatMap((section) => section.discussionPrompts)
          .slice(0, 5),
        speakerNotes: 'Use these prompts when students need a concrete entry point.',
      },
      {
        type: 'summary',
        title: 'Close and assess',
        bullets: curriculum.assessmentIdeas.slice(0, 4),
        speakerNotes: 'Move into the TARKUS live assessment or classroom debrief.',
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
}: {
  system: string
  user: unknown
  fallback: T
  imageInputs?: Array<PreparedImage>
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

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
  })

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

async function extractTextFromDocument(blob: Blob, fileName: string, mimeType: string) {
  const limit = getPrepUploadLimit('document')
  if (blob.size > limit) {
    throw new Error(`document uploads are limited to ${formatBytes(limit)}`)
  }
  const arrayBuffer = await blob.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const lower = fileName.toLowerCase()

  if (
    mimeType.includes('wordprocessingml') ||
    lower.endsWith('.docx')
  ) {
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

  if (mimeType.startsWith('text/') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return cleanText(buffer.toString('utf8'))
  }

  throw new Error('Unsupported file type. Upload PDF, DOCX, TXT, or Markdown.')
}

export const extractDocumentText = action({
  args: { documentId: v.id('prepDocuments') },
  handler: async (ctx, args) => {
    const identity = requireIdentity(await ctx.auth.getUserIdentity())
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
        error instanceof Error ? error.message : 'Could not extract document text'
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
      system:
        'You are TARKUS, a teacher prep assistant for strategic nonviolence training. Generate a polished, teacher-editable curriculum from uploaded source documents and the teacher prep brief. Return JSON only with shape: {"title":"string","audience":"string","durationMinutes":number,"learningObjectives":["string"],"agenda":[{"title":"string","durationMinutes":number,"teachingNotes":"string","activity":"string","discussionPrompts":["string"]}],"keyConcepts":["string"],"materialsNeeded":["string"],"assessmentIdeas":["string"],"teacherNotes":"string"}. Prioritize the teacher prep brief when it is specific. For this demo, pillar analysis should be central: obedience, sources of power, dissecting pillars, push vs pull, Gene Sharp, Popovic, Helvey, El Salvador 1944, and Norway 1942. Keep it classroom practical, clear, and safe. Do not invent citations. Do not give tactical operational advice; focus on teaching structure.',
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
      system:
        'You are TARKUS, a teacher prep assistant. Revise the existing curriculum according to the teacher instruction while preserving the class prep brief. Return the full updated curriculum JSON only, preserving this shape: {"title":"string","audience":"string","durationMinutes":number,"learningObjectives":["string"],"agenda":[{"title":"string","durationMinutes":number,"teachingNotes":"string","activity":"string","discussionPrompts":["string"]}],"keyConcepts":["string"],"materialsNeeded":["string"],"assessmentIdeas":["string"],"teacherNotes":"string"}. Keep the result practical and teacher-editable.',
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
      system:
        'You are TARKUS, creating a classroom PowerPoint outline from a finalized curriculum. Return JSON only with shape {"title":"string","slides":[{"type":"title|concept|discussion|activity|summary","title":"string","bullets":["string"],"speakerNotes":"string","imageFileName":"optional exact uploaded image filename"}]}. Use concise slide text and richer speaker notes. Keep to 8-12 slides. If uploaded images are useful, inspect them and assign an exact imageFileName to the most relevant slides. For this demo, the deck should emphasize pillar analysis, obedience, dissecting pillars, push vs pull, Gene Sharp, Popovic, Helvey, El Salvador 1944, and Norway 1942.',
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
    const fileName = `${slugify(curriculum.title)}.pptx`
    const presentationId: Id<'presentations'> = await ctx.runMutation(
      internal.prep.createPresentationRecord,
      {
        workspaceId: args.workspaceId,
        teacherTokenIdentifier: identity.tokenIdentifier,
        curriculumId: input.latestCurriculum._id,
        slideSpec,
        fileName,
      },
    )

    try {
      const bytes = await buildPptx(slideSpec, images)
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
        error instanceof Error ? error.message : 'Could not generate presentation'
      await ctx.runMutation(internal.prep.savePresentationResult, {
        presentationId,
        error: message,
      })
      throw new Error(message)
    }
  },
})

function normalizeSlideSpec(
  value: unknown,
  fallback: SlideSpec,
  allowedImageFileNames: Array<string> = [],
): SlideSpec {
  const candidate = value as Partial<SlideSpec> | null
  if (!candidate || typeof candidate !== 'object') return fallback
  const allowedImages = new Set(allowedImageFileNames)
  return {
    title: typeof candidate.title === 'string' ? candidate.title : fallback.title,
    slides: Array.isArray(candidate.slides)
      ? candidate.slides
          .map((slide) => {
            const item = slide as Partial<SlideSpec['slides'][number]>
            return {
              type:
                item.type === 'title' ||
                item.type === 'concept' ||
                item.type === 'discussion' ||
                item.type === 'activity' ||
                item.type === 'summary'
                  ? item.type
                  : 'concept',
              title: typeof item.title === 'string' ? item.title : 'Slide',
              bullets: Array.isArray(item.bullets)
                ? item.bullets.filter(
                    (bullet): bullet is string => typeof bullet === 'string',
                  )
                : [],
              speakerNotes:
                typeof item.speakerNotes === 'string' ? item.speakerNotes : '',
              imageFileName:
                typeof item.imageFileName === 'string' &&
                allowedImages.has(item.imageFileName)
                  ? item.imageFileName
                  : undefined,
            }
          })
          .filter((slide) => slide.title.trim())
          .slice(0, 14)
      : fallback.slides,
  }
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
        ? bullets.map((bullet) => ({ text: bullet, options: { bullet: { indent: 16 } } }))
        : [{ text: 'Use this moment to connect the source material to the room.' }],
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
