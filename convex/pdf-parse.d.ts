declare module 'pdf-parse/lib/pdf-parse.js' {
  export default function pdfParse(
    data: Buffer,
    options?: { max?: number },
  ): Promise<{ text?: string }>
}
