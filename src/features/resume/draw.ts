/**
 * 简历绘制（平台无关）。
 *
 * 预览与导出共用同一份实现，因此所见即所得。
 * 小程序端与 H5 端都从这里取用，保证两端导出接口一致，
 * 不会出现某一端缺少方法的情况。
 */
import type { UnifiedCanvas } from './canvas'
import { CANVAS_H, CANVAS_W, computeLayout, computePageCount } from './layout'
import { buildResumeModel } from './model'
import { adaptContext, renderCardBackgrounds, renderLayout } from './renderer'
import type { ResumeDraft, ResumeModel } from './types'
import type { LayoutResult } from './layout-types'

/** 导出倍率：2 倍时画布为 1588 × 2246，约 192dpi */
export const EXPORT_SCALE = 2

export interface DrawResult {
  model: ResumeModel
  layout: LayoutResult
  pageCount: number
  /** 画布像素宽 */
  width: number
  /** 画布像素高（已对齐到整页） */
  height: number
  ratio: number
}

/**
 * 把整份简历绘制到画布。
 *
 * @param canvas 高清画布
 * @param draft 草稿
 * @param scale 导出倍率
 */
export async function drawResumeToCanvas (
  canvas: UnifiedCanvas,
  draft: ResumeDraft,
  scale = EXPORT_SCALE
): Promise<DrawResult> {
  const model = buildResumeModel(draft)
  const layout = computeLayout(model.templateId, model)

  const pageCount = computePageCount(layout)
  const alignedHeight = pageCount * CANVAS_H
  const pixelWidth = Math.round(CANVAS_W * scale)
  const pixelHeight = Math.round(alignedHeight * scale)

  // 先加载头像，再调整画布。
  // 若在 resize 与绘制之间 await，H5 端可能被平台的重渲染打断，
  // 导致画布尺寸被重置、画面错位或空白。
  const avatarImage = model.visibility.avatar
    ? await canvas.loadImage(model.avatar)
    : { node: null, ratio: 1, ok: false as const }

  // 以下为同步步骤：resize 后立即绘制，中间不再 await
  canvas.resize(pixelWidth, pixelHeight)

  const ctx = canvas.raw.getContext('2d') as {
    scale: (x: number, y: number) => void
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(scale, scale)

  // 铺满白底，多出的部分保持白色，导出不会有透明或黑边
  const adapted = adaptContext(ctx)
  adapted.setFillStyle(layout.background || '#ffffff')
  adapted.fillRect(0, 0, CANVAS_W, alignedHeight)

  // 卡片与装饰由各模板自行声明，这里统一渲染；
  // 未声明卡片/装饰的列不会产生任何绘制，因此可以无条件调用。
  renderCardBackgrounds(adapted, layout)
  renderLayout(adapted, layout, { avatarImage })

  return { model, layout, pageCount, width: pixelWidth, height: pixelHeight, ratio: scale }
}

/**
 * 把简历的指定页绘制到画布，画布尺寸正好是一页。
 *
 * 用于逐页导出：小程序 `canvasToTempFilePath` 的 x/y 定位在部分机型与
 * 同层渲染下不稳定，整块导出单页内容更可靠。
 */
export async function drawResumePageToCanvas (
  canvas: UnifiedCanvas,
  draft: ResumeDraft,
  pageIndex: number,
  scale = EXPORT_SCALE
): Promise<DrawResult> {
  const model = buildResumeModel(draft)
  const layout = computeLayout(model.templateId, model)

  const pageCount = computePageCount(layout)
  const safeIndex = Math.min(Math.max(0, pageIndex), pageCount - 1)
  const pixelWidth = Math.round(CANVAS_W * scale)
  const pixelHeight = Math.round(CANVAS_H * scale)

  const avatarImage = model.visibility.avatar
    ? await canvas.loadImage(model.avatar)
    : { node: null, ratio: 1, ok: false as const }

  // resize 与绘制之间不得 await，避免画布被平台重渲染重置
  canvas.resize(pixelWidth, pixelHeight)

  const ctx = canvas.raw.getContext('2d') as {
    scale: (x: number, y: number) => void
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    translate: (x: number, y: number) => void
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(scale, scale)

  const adapted = adaptContext(ctx)
  adapted.setFillStyle(layout.background || '#ffffff')
  adapted.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // 把整份内容上移，使目标页落到画布可视范围内
  ctx.translate(0, -safeIndex * CANVAS_H)

  renderCardBackgrounds(adapted, layout)
  renderLayout(adapted, layout, { avatarImage })

  return {
    model,
    layout,
    pageCount,
    width: pixelWidth,
    height: pixelHeight,
    ratio: scale
  }
}