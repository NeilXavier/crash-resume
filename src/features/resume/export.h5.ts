/**
 * 导出服务：H5 端实现。
 *
 * 浏览器有真实画布与下载能力，因此这里提供与小程序端**完全一致**的接口，
 * 并且能真实完成绘制与导出，便于在预览中直接验证整条链路。
 *
 * 与小程序端的差异仅在落地方式：
 *   小程序 → 临时文件 + 相册/打开文档
 *   H5     → dataURL / Blob + 浏览器下载
 */
import type { UnifiedCanvas, LoadedImageResult } from './canvas'
import { assertCanvasPainted, pixelSizeOf, queryUnifiedCanvas } from './canvas'
import { EXPORT_SCALE, drawResumePageToCanvas, drawResumeToCanvas, type DrawResult } from './draw'
import { CANVAS_H, CANVAS_W } from './layout'
import { buildFileName } from './model'
import { buildPdf, type PdfPage } from './pdf'
import type { ExportResult, ResumeDraft } from './types'

export { EXPORT_SCALE, drawResumePageToCanvas, drawResumeToCanvas }
export type { DrawResult }

/** 嵌入 PDF 的 JPEG 质量：接近无损，同时避免文件过大 */
const PDF_JPEG_QUALITY = 0.94

/** 查询画布节点 */
export function queryCanvasNode (selector: string): Promise<UnifiedCanvas> {
  return queryUnifiedCanvas(selector)
}

/** 加载图片为画布可用对象 */
export function loadImage (canvas: UnifiedCanvas, src: string): Promise<LoadedImageResult> {
  return canvas.loadImage(src)
}

/** 触发浏览器下载 */
function triggerDownload (href: string, fileName: string): void {
  try {
    const link = document.createElement('a')
    link.href = href
    link.download = fileName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (err) {
    console.error('[resume] 触发下载失败', err)
  }
}

/** canvas 转 base64（H5 直接读取，不落文件） */
function canvasToDataUrl (
  canvas: UnifiedCanvas,
  options: { x: number, y: number, width: number, height: number, mime?: 'image/png' | 'image/jpeg', quality?: number }
): string {
  const source = canvas.raw as HTMLCanvasElement
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(options.width))
  output.height = Math.max(1, Math.round(options.height))
  const ctx = output.getContext('2d')
  if (!ctx) throw new Error('浏览器不支持画布导出')

  // 铺白底：PNG 透明区域在部分查看器里会变黑，JPEG 也不支持透明
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, output.width, output.height)
  ctx.drawImage(
    source,
    options.x, options.y, options.width, options.height,
    0, 0, output.width, output.height
  )
  return output.toDataURL(options.mime ?? 'image/png', options.quality)
}

/** 把画布指定区域导出为图片数据（接口与小程序端一致） */
export function canvasToTempFile (
  canvas: UnifiedCanvas,
  options: { x: number, y: number, width: number, height: number, mime?: 'image/png' | 'image/jpeg', quality?: number }
): Promise<string> {
  return Promise.resolve(canvasToDataUrl(canvas, options))
}

/**
 * 按 A4 分页切片，返回每页图片数据。
 * 每页固定 A4 高度，保证比例正确。
 */
/**
 * 逐页导出为图片。
 * 与小程序端语义一致：每页单独绘制到"正好一页"的画布后整块导出。
 */
export async function capturePages (
  canvas: UnifiedCanvas,
  pageCount: number,
  draft: ResumeDraft,
  ratio = EXPORT_SCALE,
  options: { mime?: 'image/png' | 'image/jpeg', quality?: number } = {}
): Promise<string[]> {
  const pixelWidth = Math.round(CANVAS_W * ratio)
  const pixelHeight = Math.round(CANVAS_H * ratio)

  const pages: string[] = []
  for (let i = 0; i < pageCount; i += 1) {
    await drawResumePageToCanvas(canvas, draft, i, ratio)
    assertCanvasPainted(canvas, pixelWidth)
    pages.push(canvasToDataUrl(canvas, {
      x: 0,
      y: 0,
      width: pixelWidth,
      height: pixelHeight,
      mime: options.mime,
      quality: options.quality
    }))
  }
  return pages
}

/**
 * 导出 PNG。
 * 语义与小程序端一致：调用方先完成绘制，这里只读取画布产出图片。
 */
export async function exportPng (canvas: UnifiedCanvas, draft: ResumeDraft): Promise<ExportResult> {
  const pixelPageHeight = Math.round(CANVAS_H * EXPORT_SCALE)
  assertCanvasPainted(canvas, Math.round(CANVAS_W * EXPORT_SCALE))

  const size = pixelSizeOf(canvas)
  const dataUrl = canvasToDataUrl(canvas, {
    x: 0,
    y: 0,
    width: size.width,
    height: size.height
  })

  return {
    type: 'png',
    tempFilePath: dataUrl,
    fileName: buildFileName(draft, 'png'),
    pageCount: Math.max(1, Math.round(size.height / pixelPageHeight))
  }
}

/**
 * 导出 PDF：分页切片后组装 A4 文档，并以 Blob 形式提供给下载。
 * 语义与小程序端一致：调用方先完成绘制。
 */
export async function exportPdf (
  canvas: UnifiedCanvas,
  draft: ResumeDraft,
  pageCount: number
): Promise<ExportResult> {
  // PDF 的 DCTDecode 只能直接嵌入 JPEG：PNG 的字节流放进图像 XObject 会解出空白页
  const pages = await capturePages(canvas, pageCount, draft, EXPORT_SCALE, {
    mime: 'image/jpeg',
    quality: PDF_JPEG_QUALITY
  })

  const pdfPages: PdfPage[] = pages.map((dataUrl) => ({
    dataUrl,
    width: Math.round(CANVAS_W * EXPORT_SCALE),
    height: Math.round(CANVAS_H * EXPORT_SCALE)
  }))

  const bytes = buildPdf(pdfPages, {
    title: buildFileName(draft, 'pdf'),
    author: draft.userInfo.name || '简历'
  })

  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  return {
    type: 'pdf',
    tempFilePath: url,
    fileName: buildFileName(draft, 'pdf'),
    pageCount
  }
}

/** 生成分页预览图（导出前防截断检查） */
export async function previewPdfPages (
  canvas: UnifiedCanvas,
  pageCount: number,
  draft: ResumeDraft
): Promise<string[]> {
  return capturePages(canvas, pageCount, draft, EXPORT_SCALE, {
    mime: 'image/jpeg',
    quality: PDF_JPEG_QUALITY
  })
}

/** 打开生成的 PDF：H5 直接触发下载 */
export function openPdf (filePath: string): Promise<boolean> {
  if (!filePath) return Promise.resolve(false)
  triggerDownload(filePath, `resume-${Date.now()}.pdf`)
  return Promise.resolve(true)
}

/** 保存图片：H5 直接触发下载 */
export function saveImageToAlbum (filePath: string): Promise<boolean> {
  if (!filePath) return Promise.resolve(false)
  triggerDownload(filePath, `resume-${Date.now()}.png`)
  return Promise.resolve(true)
}