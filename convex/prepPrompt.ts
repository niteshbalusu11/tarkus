import { MAX_LLM_DOCUMENT_CONTEXT_CHARS } from './prepLimits'

type ExtractedDocumentInput = {
  fileName: string
  extractedText?: string
}

export type CappedSourceDocument = {
  fileName: string
  text: string
}

export function buildCappedSourceDocuments(
  documents: Array<ExtractedDocumentInput>,
  maxChars = MAX_LLM_DOCUMENT_CONTEXT_CHARS,
) {
  const sourceDocuments: Array<CappedSourceDocument> = []
  let remaining = maxChars

  for (const document of documents) {
    if (remaining <= 0) break
    const text = document.extractedText || ''
    const header = `# ${document.fileName}\n`
    const availableText = Math.max(0, remaining - header.length)
    if (availableText <= 0) break
    const cappedText = text.slice(0, availableText)
    sourceDocuments.push({
      fileName: document.fileName,
      text: cappedText,
    })
    remaining -= header.length + cappedText.length + 2
  }

  const documentText = sourceDocuments
    .map((document) => `# ${document.fileName}\n${document.text}`)
    .join('\n\n')
    .slice(0, maxChars)

  return { documentText, sourceDocuments }
}
