/**
 * 极简 PDF 生成器（纯 TypeScript，无外部依赖）。
 *
 * 小程序与 H5 都没有 jsPDF 可用（小程序无 DOM），这里直接按 PDF 1.4 规范拼装：
 * 每页 = 页面对象 + 图片 XObject + 内容流。
 *
 * 注意：PDF 的 DCTDecode 只能直接嵌入 JPEG。PNG 文件头不能直接塞进
 * FlateDecode 图像流（解出来会是空白页），因此调用方必须传入 JPEG dataURL。
 */

export const A4_WIDTH_PT = 595.28
export const A4_HEIGHT_PT = 841.89

/** 字符串按 Latin-1 编码为字节数组 */
function stringToBytes (text: string): number[] {
  const bytes: number[] = []
  for (let i = 0; i < text.length; i += 1) {
    bytes.push(text.charCodeAt(i) & 0xff)
  }
  return bytes
}

/** base64 解码为字节数组 */
export function base64ToBytes (base64: string): number[] {
  const source = String(base64).replace(/^data:[^,]+,/, '').replace(/\s/g, '')
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup: Record<string, number> = {}
  for (let i = 0; i < table.length; i += 1) lookup[table[i]] = i

  const bytes: number[] = []
  let buffer = 0
  let bits = 0

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    if (char === '=') break
    const value = lookup[char]
    if (value === undefined) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }

  return bytes
}

/** 从 dataURL 判断图像过滤器 */
function detectImageFilter (dataUrl: string): string {
  const match = /^data:image\/([a-zA-Z0-9+.-]+);/.exec(String(dataUrl))
  const sub = match ? match[1].toLowerCase() : 'png'
  if (sub === 'jpg' || sub === 'jpeg') return 'DCTDecode'
  return 'FlateDecode'
}

/** 转义 PDF 文本字段 */
function escapePdfText (text: string): string {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[\r\n]/g, ' ')
}

/**
 * PDF 文本串编码。
 * 字面量字符串按 Latin-1 解释，中文会变成乱码（查看器标题栏会显示怪字符）；
 * 非 ASCII 内容改用带 BOM 的 UTF-16BE 十六进制串。
 */
function pdfTextString (text: string): string {
  const value = String(text)
  if (/^[\x20-\x7e]*$/.test(value)) return `(${escapePdfText(value)})`

  let hex = 'FEFF'
  for (let i = 0; i < value.length; i += 1) {
    hex += value.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')
  }
  return `<${hex}>`
}

export interface PdfPage {
  dataUrl: string
  width: number
  height: number
}

export interface PdfMeta {
  title?: string
  author?: string
  subject?: string
}

/**
 * 生成 PDF 字节数组（可直接写入文件）。
 * @param pages 每页一张图片
 * @param meta 文档信息
 */
export function buildPdf (pages: PdfPage[], meta: PdfMeta = {}): Uint8Array {
  // PNG 不能直接作为 FlateDecode 图像嵌入，提前给出可读错误而不是导出空白 PDF
  const unsupported = pages.find((page) => page.dataUrl && detectImageFilter(page.dataUrl) !== 'DCTDecode')
  if (unsupported) {
    throw new Error('PDF 内嵌图片必须是 JPEG，请重试导出')
  }

  const pageCount = Math.max(1, pages.length)
  const objectCount = 3 + pageCount * 3

  const chunks: Array<{ id: number, bytes: number[] }> = []
  const offsets = new Array<number>(objectCount + 1).fill(0)

  const childrenIds: number[] = []
  for (let i = 0; i < pageCount; i += 1) {
    childrenIds.push(3 + i * 3 + 1)
  }

  chunks.push({ id: 1, bytes: stringToBytes('<< /Type /Catalog /Pages 2 0 R >>\n') })
  chunks.push({
    id: 2,
    bytes: stringToBytes(
      `<< /Type /Pages /Count ${pageCount} /Kids [${childrenIds.map((id) => `${id} 0 R`).join(' ')}] >>\n`
    )
  })

  const infoParts = ['<< /Producer (Qmuse Urgent Resume)']
  if (meta.title) infoParts.push(`/Title ${pdfTextString(meta.title)}`)
  if (meta.author) infoParts.push(`/Author ${pdfTextString(meta.author)}`)
  if (meta.subject) infoParts.push(`/Subject ${pdfTextString(meta.subject)}`)
  infoParts.push('/Creator (Qmuse Urgent Resume) >>\n')
  chunks.push({ id: 3, bytes: stringToBytes(infoParts.join(' ')) })

  for (let i = 0; i < pageCount; i += 1) {
    const pageId = 3 + i * 3 + 1
    const contentId = pageId + 1
    const imageId = pageId + 2

    const page = pages[i] ?? { dataUrl: '', width: A4_WIDTH_PT, height: A4_HEIGHT_PT }
    const imageBytes = page.dataUrl ? base64ToBytes(page.dataUrl) : []

    const content = `q\n${A4_WIDTH_PT} 0 0 ${A4_HEIGHT_PT} 0 0 cm\n/Im0 Do\nQ\n`
    const contentBytes = stringToBytes(content)

    chunks.push({
      id: pageId,
      bytes: stringToBytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] ` +
        '/Resources << /XObject << /Im0 ' + imageId + ' 0 R >> /ProcSet [/PDF /ImageC] >> ' +
        `/Contents ${contentId} 0 R >>\n`
      )
    })

    chunks.push({
      id: contentId,
      bytes: stringToBytes(`<< /Length ${contentBytes.length} >>\nstream\n${content}endstream\n`)
    })

    const filter = detectImageFilter(page.dataUrl)
    const imageHeader = stringToBytes(
      `<< /Type /XObject /Subtype /Image /Width ${Math.round(page.width)} /Height ${Math.round(page.height)} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filter} /Length ${imageBytes.length} >>\nstream\n`
    )

    chunks.push({
      id: imageId,
      bytes: imageHeader.concat(imageBytes, stringToBytes('\nendstream\n'))
    })
  }

  chunks.sort((a, b) => a.id - b.id)

  const header = stringToBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  const bodyParts: number[][] = [header]
  let cursor = header.length

  chunks.forEach((chunk) => {
    offsets[chunk.id] = cursor
    const objectHeader = stringToBytes(`${chunk.id} 0 obj\n`)
    const objectFooter = stringToBytes('endobj\n')
    bodyParts.push(objectHeader, chunk.bytes, objectFooter)
    cursor += objectHeader.length + chunk.bytes.length + objectFooter.length
  })

  const xrefStart = cursor
  const xrefLines = [`xref\n0 ${objectCount + 1}\n`, '0000000000 65535 f \n']
  for (let id = 1; id <= objectCount; id += 1) {
    xrefLines.push(`${String(offsets[id] ?? 0).padStart(10, '0')} 00000 n \n`)
  }
  const xrefBytes = stringToBytes(xrefLines.join(''))
  bodyParts.push(xrefBytes)
  cursor += xrefBytes.length

  bodyParts.push(
    stringToBytes(
      `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
    )
  )

  let total = 0
  bodyParts.forEach((part) => {
    total += part.length
  })

  const output = new Uint8Array(total)
  let offset = 0
  bodyParts.forEach((part) => {
    output.set(part, offset)
    offset += part.length
  })

  return output
}
