export const MAX_PREP_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024
export const MAX_PREP_IMAGE_UPLOAD_BYTES = 8 * 1024 * 1024
export const MAX_LLM_DOCUMENT_CONTEXT_CHARS = 55_000
export const MAX_EXTRACTED_DOCUMENT_TEXT_CHARS = 140_000

export function getPrepUploadLimit(kind: 'document' | 'image') {
  return kind === 'image'
    ? MAX_PREP_IMAGE_UPLOAD_BYTES
    : MAX_PREP_DOCUMENT_UPLOAD_BYTES
}

export function formatBytes(bytes: number) {
  return `${Math.floor(bytes / (1024 * 1024))}MB`
}
