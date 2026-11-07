/**
 * 导出服务：微信与支付宝小程序共享实现。
 *
 * 链路：
 *   1. 取页面内隐藏的高清画布（逻辑 794 × 1123，导出倍率 2 → 1588 × 2246）
 *   2. 等待头像 onload，避免导出后头像空白
 *   3. 绘制整份简历（画布高度对齐到整页，便于按 A4 分页）
 *   4. PNG：canvasToTempFilePath 直接导出
 *      PDF：按 1123 逻辑高度分页切片，逐页导出 PNG，再由 pdf.ts 组装 A4 文档
 */
import Taro from '@tarojs/taro'

import { assertCanvasPainted, queryUnifiedCanvas, type LoadedImageResult, type UnifiedCanvas } from './canvas'
import { EXPORT_SCALE, drawResumePageToCanvas, drawResumeToCanvas, type DrawResult } from './draw'
import { CANVAS_H, CANVAS_W, computeLayout, computePageCount } from './layout'
import { buildFileName, buildResumeModel } from './model'
import { buildPdf, type PdfPage } from './pdf'
import type { ExportResult, ResumeDraft } from './types'

// 绘制逻辑与小程序端共享，保证两端导出接口一致
export { EXPORT_SCALE, drawResumePageToCanvas, drawResumeToCanvas }
export type { DrawResult }

/** 嵌入 PDF 的 JPEG 质量：接近无损，同时避免文件过大 */
const PDF_JPEG_QUALITY = 0.94

/** 查询页面内的画布节点（各端结构差异由 canvas 模块统一处理） */
export function queryCanvasNode (selector: string): Promise<UnifiedCanvas> {
  return queryUnifiedCanvas(selector)
}

/** 把本地路径 / dataURL 加载为画布可用的图片对象 */
export function loadImage (canvas: UnifiedCanvas, src: string): Promise<LoadedImageResult> {
  return canvas.loadImage(src)
}

/** 把画布指定区域导出为临时文件 */
export function canvasToTempFile (
  canvas: UnifiedCanvas,
  options: {
    x: number
    y: number
    width: number
    height: number
    fileType?: 'png' | 'jpg'
    quality?: number
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const payload = {
      // 必须传原始 canvas 节点：包装对象上的字段不参与小程序底层调用
      canvas: canvas.raw as never,
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
      // destWidth/destHeight 为输出像素，与截取坐标无关；
      // 传入等于截取区域逻辑尺寸的值可保持 1:1，避免拉伸失真
      destWidth: options.width,
      destHeight: options.height,
      // PDF 内嵌必须是 JPEG（DCTDecode），PNG 会导出空白页
      fileType: options.fileType ?? 'png',
      quality: options.quality ?? 1,
      success: (res: { tempFilePath: string }) => resolve(res.tempFilePath),
      fail: (err: { errMsg?: string }) => reject(new Error(err?.errMsg || '画布导出失败'))
    }
    Taro.canvasToTempFilePath(payload)
  })
}

/** 读取临时文件为 base64 */
function readFileAsBase64 (filePath: string): string {
  const fs = Taro.getFileSystemManager()
  const data = fs.readFileSync(filePath, 'base64')
  return typeof data === 'string' ? data : String(data)
}

/**
 * 逐页导出为图片。
 *
 * 每页单独绘制到"正好一页"的画布并整块导出，不使用 x/y 定位截取：
 * 小程序在同层渲染下按坐标切片不稳定，整块导出得到的结果最可靠。
 */
export async function capturePages (
  canvas: UnifiedCanvas,
  pageCount: number,
  draft: ResumeDraft,
  ratio = EXPORT_SCALE,
  options: { fileType?: 'png' | 'jpg', quality?: number } = {}
): Promise<string[]> {
  const pixelWidth = Math.round(CANVAS_W * ratio)
  const pixelHeight = Math.round(CANVAS_H * ratio)
  const paths: string[] = []

  for (let i = 0; i < pageCount; i += 1) {
    await drawResumePageToCanvas(canvas, draft, i, ratio)
    assertCanvasPainted(canvas, pixelWidth)

    const path = await canvasToTempFile(canvas, {
      x: 0,
      y: 0,
      width: pixelWidth,
      height: pixelHeight,
      fileType: options.fileType,
      quality: options.quality
    })
    paths.push(path)
  }

  return paths
}

/** 导出 PNG（长图） */
export async function exportPng (canvas: UnifiedCanvas, draft: ResumeDraft): Promise<ExportResult> {
  const model = buildResumeModel(draft)
  const layout = computeLayout(model.templateId, model)
  const pageCount = computePageCount(layout)

  // 与绘图流程一致：先绘制整份内容
  const result = await drawResumeToCanvas(canvas, draft, EXPORT_SCALE)
  assertCanvasPainted(canvas, result.width)

  const tempFilePath = await canvasToTempFile(canvas, {
    x: 0,
    y: 0,
    width: result.width,
    height: result.height
  })

  return {
    type: 'png',
    tempFilePath,
    fileName: buildFileName(draft, 'png'),
    pageCount
  }
}

/** 把字节写入用户目录 */
function writeBytesToDisk (bytes: Uint8Array, fileName: string): string {
  const fs = Taro.getFileSystemManager()
  const dir = `${Taro.env.USER_DATA_PATH}/resume`
  const filePath = `${dir}/${fileName}`

  try {
    try {
      fs.accessSync(dir)
    } catch {
      fs.mkdirSync(dir, true)
    }
    fs.writeFileSync(filePath, bytes.buffer as ArrayBuffer)
    return filePath
  } catch {
    const fallback = `${Taro.env.USER_DATA_PATH}/${fileName}`
    fs.writeFileSync(fallback, bytes.buffer as ArrayBuffer)
    return fallback
  }
}

/** 导出 PDF（A4，边距 0） */
export async function exportPdf (
  canvas: UnifiedCanvas,
  draft: ResumeDraft,
  pageCount: number,
  ratio = EXPORT_SCALE
): Promise<ExportResult> {
  // PDF 图像 XObject 用 DCTDecode 直接嵌入 JPEG；PNG 字节会导致空白页
  const paths = await capturePages(canvas, pageCount, draft, ratio, {
    fileType: 'jpg',
    quality: PDF_JPEG_QUALITY
  })

  const pages: PdfPage[] = paths.map((path) => ({
    dataUrl: `data:image/jpeg;base64,${readFileAsBase64(path)}`,
    width: Math.round(CANVAS_W * ratio),
    height: Math.round(CANVAS_H * ratio)
  }))

  const userInfo = draft.userInfo
  const bytes = buildPdf(pages, {
    title: `${userInfo.name || '我的'}的简历`,
    author: userInfo.name || '',
    subject: userInfo.jobIntention || ''
  })

  const fileName = buildFileName(draft, 'pdf')
  const tempFilePath = writeBytesToDisk(bytes, fileName)

  return { type: 'pdf', tempFilePath, fileName, pageCount }
}

/** 生成 PDF 分页预览图（用于导出前防截断检查） */
export async function previewPdfPages (
  canvas: UnifiedCanvas,
  pageCount: number,
  draft: ResumeDraft,
  ratio = EXPORT_SCALE
): Promise<string[]> {
  return capturePages(canvas, pageCount, draft, ratio)
}

/** 打开已生成的 PDF */
export function openPdf (filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    Taro.openDocument({
      filePath,
      fileType: 'pdf',
      showMenu: true,
      success: () => resolve(true),
      fail: (err: { errMsg?: string }) => {
        const message = err?.errMsg ?? ''
        if (message.includes('cancel')) {
          resolve(false)
          return
        }
        reject(new Error('无法打开 PDF，请重试'))
      }
    })
  })
}

/** 保存图片到相册 */
export function saveImageToAlbum (filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    Taro.saveImageToPhotosAlbum({
      filePath,
      success: () => resolve(true),
      fail: (err: { errMsg?: string }) => {
        const message = err?.errMsg ?? ''
        if (message.includes('auth deny') || message.includes('authorize')) {
          reject(new Error('需要相册权限，请在设置中开启后重试'))
          return
        }
        if (message.includes('cancel')) {
          resolve(false)
          return
        }
        reject(new Error('保存到相册失败'))
      }
    })
  })
}