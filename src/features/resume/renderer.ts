/**
 * Canvas 渲染器。
 * 输入 layout 的计算结果，输出像素级绘制。
 * 预览与导出共用同一实现，因此所见即所得。
 */
import type { LayoutBlock, LayoutColumn, LayoutResult, TableCell } from './layout-types'
import { CANVAS_H, CANVAS_W, FS, PALETTE } from './layout'
import type { LoadedImage } from './types'

/** 画布 2D 上下文（收敛后的接口，屏蔽各端差异） */
export interface RenderContext {
  setFillStyle: (color: string) => void
  setStrokeStyle: (color: string) => void
  setLineWidth: (width: number) => void
  setFontSize: (size: number) => void
  setFont?: (font: string) => void
  setTextAlign: (align: 'left' | 'center' | 'right') => void
  setTextBaseline: (baseline: string) => void
  fillRect: (x: number, y: number, w: number, h: number) => void
  strokeRect: (x: number, y: number, w: number, h: number) => void
  clearRect: (x: number, y: number, w: number, h: number) => void
  fillText: (text: string, x: number, y: number, maxWidth?: number) => void
  measureText: (text: string) => { width: number }
  beginPath: () => void
  closePath: () => void
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  rect: (x: number, y: number, w: number, h: number) => void
  arc: (x: number, y: number, r: number, s: number, e: number, clockwise?: boolean) => void
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void
  fill: () => void
  stroke: () => void
  clip: () => void
  save: () => void
  restore: () => void
  drawImage: (img: unknown, dx: number, dy: number, dw: number, dh: number) => void
  /** 设置悬浮阴影（颜色、模糊半径、纵向偏移） */
  setShadow: (color: string, blur: number, offsetY: number) => void
}

const FONT_STACK = 'PingFang SC'

/**
 * 把原生或小程序画布上下文适配为统一的 RenderContext。
 *
 * 小程序 Canvas 2D 使用 setFillStyle / setFontSize / setTextAlign 等方法，
 * H5 标准 Canvas 使用 fillStyle / font / textAlign 属性。
 * 适配层同时写入两套接口，调用方无需关心平台差异。
 *
 * 注意：所有方法必须用箭头函数包一层。
 * 浏览器原生 Canvas 方法被提取后单独调用会抛 `Illegal invocation`，
 * 因此不能直接 `ctx.fillRect = raw.fillRect` 这样赋值。
 */
export function adaptContext (raw: unknown): RenderContext {
  const ctx = raw as Record<string, unknown>

  /** 同时写属性与小程序专用方法 */
  const assign = (nativeKey: string, value: unknown, methodKey: string) => {
    try {
      ctx[nativeKey] = value
    } catch {
      // 属性只读时忽略，交由方法调用兜底
    }
    if (typeof ctx[methodKey] === 'function') {
      try {
        ;(ctx[methodKey] as (v: unknown) => void)(value)
      } catch {
        // 方法不受支持时忽略
      }
    }
  }

  /** 安全调用：方法不存在时静默跳过，避免整页渲染中断 */
  const safe = <T extends unknown[]> (name: string, ...args: T): void => {
    const fn = ctx[name]
    if (typeof fn !== 'function') return
    try {
      ;(fn as (...a: T) => void).call(ctx, ...args)
    } catch {
      // 单次绘制失败不应中断整页
    }
  }

  return {
    setFillStyle: (color) => assign('fillStyle', color, 'setFillStyle'),
    setStrokeStyle: (color) => assign('strokeStyle', color, 'setStrokeStyle'),
    setLineWidth: (width) => assign('lineWidth', width, 'setLineWidth'),

    /**
     * 字号设置。
     * H5 写 font 属性；小程序的 setFontSize 只接受数字，
     * 不能把字体串传进去，因此两处分别处理。
     */
    setFontSize: (size) => {
      const px = Math.round(size)
      try {
        ctx.font = fontOf(px)
      } catch {
        // 属性只读时忽略
      }
      const fn = ctx.setFontSize
      if (typeof fn === 'function') {
        try {
          ;(fn as (v: number) => void).call(ctx, px)
        } catch {
          // 方法不受支持时忽略
        }
      }
    },

    /** 完整字体串（含字重），H5 与小程序的 font 属性都支持 */
    setFont: (font) => {
      try {
        ctx.font = font
      } catch {
        // 属性只读时忽略
      }
      const fn = ctx.setFont
      if (typeof fn === 'function') {
        try {
          ;(fn as (v: string) => void).call(ctx, font)
        } catch {
          // 方法不受支持时忽略
        }
      }
    },

    setTextAlign: (align) => assign('textAlign', align, 'setTextAlign'),
    setTextBaseline: (baseline) => assign('textBaseline', baseline, 'setTextBaseline'),

    // 以下方法统一通过 call(ctx, ...) 调用，保证 this 正确
    fillRect: (x, y, w, h) => safe('fillRect', x, y, w, h),
    strokeRect: (x, y, w, h) => safe('strokeRect', x, y, w, h),
    clearRect: (x, y, w, h) => safe('clearRect', x, y, w, h),
    fillText: (text, x, y, maxWidth) => {
      if (maxWidth === undefined) safe('fillText', text, x, y)
      else safe('fillText', text, x, y, maxWidth)
    },
    measureText: (text) => {
      const fn = ctx.measureText
      if (typeof fn !== 'function') return { width: String(text).length * 12 }
      try {
        const result = (fn as (t: string) => { width: number }).call(ctx, text)
        return { width: typeof result?.width === 'number' ? result.width : 0 }
      } catch {
        return { width: String(text).length * 12 }
      }
    },
    beginPath: () => safe('beginPath'),
    closePath: () => safe('closePath'),
    moveTo: (x, y) => safe('moveTo', x, y),
    lineTo: (x, y) => safe('lineTo', x, y),
    rect: (x, y, w, h) => safe('rect', x, y, w, h),
    arc: (x, y, r, s, e, clockwise) => {
      if (clockwise === undefined) safe('arc', x, y, r, s, e)
      else safe('arc', x, y, r, s, e, clockwise)
    },
    quadraticCurveTo: (cpx, cpy, x, y) => safe('quadraticCurveTo', cpx, cpy, x, y),
    fill: () => safe('fill'),
    stroke: () => safe('stroke'),
    clip: () => safe('clip'),
    save: () => safe('save'),
    restore: () => safe('restore'),
    drawImage: (image, dx, dy, dw, dh) => safe('drawImage', image, dx, dy, dw, dh),

    /**
     * 悬浮阴影。
     * 阴影是导出画面里唯一无法用几何图形模拟的效果，依赖画布自身的阴影能力。
     * 两端都支持 shadowColor / shadowBlur / shadowOffsetY，写法一致；
     * 某个端不支持时静默忽略，卡片仍能正常绘制。
     */
    setShadow: (color, blur, offsetY) => {
      assign('shadowColor', color, 'setShadowColor')
      assign('shadowBlur', blur, 'setShadowBlur')
      assign('shadowOffsetY', offsetY, 'setShadowOffsetY')
    }
  }
}

/* ------------------------------------------------------------------ */
/* 基础绘制                                                            */
/* ------------------------------------------------------------------ */

/** 构造字体串 */
export function fontOf (size: number, weight?: string): string {
  const w = weight === 'bold' ? 'bold ' : ''
  return `${w}${Math.round(size)}px ${FONT_STACK}`
}

/** 十六进制颜色转 rgba */
export function hexToRgba (hex: string, alpha: number): string {
  const value = String(hex).replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/** 圆角矩形路径 */
export function roundRectPath (ctx: RenderContext, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/** 填充圆角矩形 */
export function fillRoundRect (ctx: RenderContext, x: number, y: number, w: number, h: number, r: number, color: string): void {
  if (w <= 0 || h <= 0) return
  ctx.save()
  ctx.setFillStyle(color)
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
  ctx.restore()
}

/** 描边圆角矩形 */
export function strokeRoundRect (ctx: RenderContext, x: number, y: number, w: number, h: number, r: number, color: string, lineWidth = 1): void {
  if (w <= 0 || h <= 0) return
  ctx.save()
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(lineWidth)
  roundRectPath(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.restore()
}

/** 画一条直线 */
export function drawLine (ctx: RenderContext, x1: number, y1: number, x2: number, y2: number, color: string, lineWidth = 1): void {
  ctx.save()
  ctx.setStrokeStyle(color)
  ctx.setLineWidth(lineWidth)
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
  ctx.restore()
}

/** 绘制文本 */
function drawText (
  ctx: RenderContext,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'left',
  weight?: string
): void {
  if (text === undefined || text === null || text === '') return
  ctx.save()
  ctx.setFontSize(Math.round(size))
  if (typeof ctx.setFont === 'function') {
    try {
      ctx.setFont(fontOf(size, weight))
    } catch {
      // 部分实现不支持 setFont，忽略即可
    }
  }
  ctx.setFillStyle(color)
  ctx.setTextAlign(align)
  ctx.setTextBaseline('alphabetic')
  ctx.fillText(String(text), x, y)
  ctx.restore()
}

/** 小图标：用几何图形近似绘制，避免依赖外部图片 */
function drawIcon (ctx: RenderContext, icon: string, x: number, y: number, size: number, color: string): void {
  ctx.save()
  ctx.setStrokeStyle(color)
  ctx.setFillStyle(color)
  ctx.setLineWidth(1.2)

  const cx = x + size / 2
  const cy = y + size / 2
  const r = size / 2

  if (icon === 'phone') {
    ctx.beginPath()
    ctx.moveTo(x + 2, y + 2)
    ctx.lineTo(x + size - 2, y + size - 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 2, y + size - 2)
    ctx.lineTo(x + size - 2, y + 2)
    ctx.stroke()
  } else if (icon === 'mail') {
    strokeRoundRect(ctx, x + 1, y + 3, size - 2, size - 7, 2, color, 1.2)
    ctx.beginPath()
    ctx.moveTo(x + 1, y + 4)
    ctx.lineTo(cx, y + size / 2 + 1)
    ctx.lineTo(x + size - 1, y + 4)
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.arc(cx, cy - 1, Math.max(1, r - 2), 0, Math.PI * 2, false)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(cx - 2.5, cy + 1.5)
    ctx.lineTo(cx, y + size - 1)
    ctx.lineTo(cx + 2.5, cy + 1.5)
    ctx.stroke()
  }

  ctx.restore()
}

/** 头像占位：人像剪影，保证未上传头像时不出现空白 */
export function drawAvatarPlaceholder (
  ctx: RenderContext,
  x: number,
  y: number,
  size: number,
  shape: 'circle' | 'rect',
  radius: number
): void {
  // 统一裁剪到头像框内，避免剪影溢出边框
  ctx.save()
  if (shape === 'circle') {
    ctx.beginPath()
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, false)
    ctx.clip()
  } else {
    roundRectPath(ctx, x, y, size, size, radius)
    ctx.clip()
  }

  ctx.setFillStyle('#e8edf1')
  ctx.fillRect(x, y, size, size)

  const headCx = x + size / 2
  ctx.setFillStyle('#b7c2cb')
  ctx.beginPath()
  ctx.arc(headCx, y + size * 0.37, size * 0.17, 0, Math.PI * 2, false)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(headCx, y + size * 1.02, size * 0.34, Math.PI, Math.PI * 2, false)
  ctx.fill()

  ctx.restore()
}

/** 绘制头像（真实图片或占位） */
function drawAvatar (
  ctx: RenderContext,
  block: LayoutBlock,
  x: number,
  y: number,
  width: number,
  avatarImage?: LoadedImage
): void {
  const size = block.size ?? 100
  const shape = block.shape ?? 'circle'
  const radius = block.radius ?? 8
  const align = block.align ?? 'left'

  let ax = x
  if (align === 'center') ax = x + (width - size) / 2
  if (align === 'right') ax = x + width - size

  if (avatarImage && avatarImage.ok && avatarImage.node) {
    ctx.save()
    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(ax + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, false)
      ctx.clip()
    } else {
      roundRectPath(ctx, ax, y, size, size, radius)
      ctx.clip()
    }

    // 居中裁剪，按比例铺满
    const ratio = avatarImage.ratio || 1
    let dw = size
    let dh = size / ratio
    if (dh < size) {
      dh = size
      dw = size * ratio
    }
    ctx.drawImage(avatarImage.node, ax + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
    ctx.restore()
  } else {
    drawAvatarPlaceholder(ctx, ax, y, size, shape, radius)
  }

  if (block.borderColor) {
    ctx.save()
    ctx.setStrokeStyle(block.borderColor)
    ctx.setLineWidth(3)
    if (shape === 'circle') {
      ctx.beginPath()
      ctx.arc(ax + size / 2, y + size / 2, size / 2 - 1.5, 0, Math.PI * 2, false)
      ctx.stroke()
    } else {
      roundRectPath(ctx, ax + 1.5, y + 1.5, size - 3, size - 3, radius)
      ctx.stroke()
    }
    ctx.restore()
  }
}

/* ------------------------------------------------------------------ */
/* 块渲染                                                              */
/* ------------------------------------------------------------------ */

interface BlockOptions {
  x: number
  y: number
  width: number
  avatarImage?: LoadedImage
}

/** 渲染单个块，返回占用高度（含 gapAfter） */
export function renderBlock (ctx: RenderContext, block: LayoutBlock, options: BlockOptions): number {
  const { x, y, width } = options
  const gapAfter = block.gapAfter ?? 0

  switch (block.kind) {
    case 'spacer':
      return block.height + gapAfter

    case 'rule': {
      ctx.save()
      ctx.setFillStyle(block.color ?? PALETTE.text)
      ctx.fillRect(x, y, width, block.height || 1)
      ctx.restore()
      return (block.height || 1) + gapAfter
    }

    case 'sectionTitle': {
      const accent = block.accent ?? PALETTE.main
      const textY = y + block.height - 9
      const text = block.text ?? ''
      // 深色侧栏上需要浅色标题
      const titleColor = block.color ?? PALETTE.text

      if (block.style === 'bar') {
        ctx.save()
        ctx.setFillStyle(accent)
        ctx.fillRect(x, y + 4, 4, Math.max(1, block.height - 8))
        ctx.restore()
        drawText(ctx, text, x + 14, textY, FS.section, titleColor, 'left', 'bold')
      } else if (block.style === 'dot') {
        ctx.save()
        ctx.setFillStyle(accent)
        ctx.beginPath()
        ctx.arc(x + 4, y + block.height / 2, 4, 0, Math.PI * 2, false)
        ctx.fill()
        ctx.restore()
        drawText(ctx, text, x + 16, textY, FS.small, titleColor, 'left', 'bold')
      } else if (block.style === 'block') {
        fillRoundRect(ctx, x, y + 4, width, Math.max(1, block.height - 8), 6, hexToRgba(accent, 0.14))
        drawText(ctx, text, x + 12, textY, FS.small, accent, 'left', 'bold')
      } else {
        drawText(ctx, text, x, textY, FS.small, titleColor, 'left', 'bold')
        // 下划线取 accent，便于分栏模板使用主题色
        drawLine(ctx, x, y + block.height - 3, x + width, y + block.height - 3, block.accent ?? PALETTE.line, 1)
      }

      return block.height + gapAfter
    }

    case 'paragraph': {
      const lineHeight = block.lineHeight ?? 20
      const lines = block.lines ?? []
      lines.forEach((line, i) => {
        drawText(
          ctx,
          line,
          x + (block.indent ?? 0),
          y + lineHeight * (i + 1) - 4,
          block.fontSize ?? FS.body,
          block.color ?? PALETTE.text
        )
      })
      return block.height + gapAfter
    }

    case 'labelLine': {
      const align = block.align ?? 'left'
      const tx = align === 'center' ? x + width / 2 : align === 'right' ? x + width : x
      drawText(ctx, block.text ?? '', tx, y + block.height - 5, block.fontSize ?? FS.body, block.color ?? PALETTE.text, align, block.weight)
      return block.height + gapAfter
    }

    case 'rowLine': {
      drawText(ctx, block.left ?? '', x, y + block.height - 6, block.fontSize ?? FS.body, block.leftColor ?? PALETTE.text, 'left', block.weight)
      if (block.right) {
        drawText(ctx, block.right, x + width, y + block.height - 6, (block.fontSize ?? FS.body) - 1, block.rightColor ?? PALETTE.sub, 'right')
      }
      return block.height + gapAfter
    }

    case 'tripleLine': {
      const half = block.height / 2
      const fontSize = block.fontSize ?? FS.body
      drawText(ctx, block.period ?? '', x, y + half - 4, fontSize - 1, PALETTE.sub)
      drawText(ctx, block.org ?? '', x, y + block.height - 4, fontSize, PALETTE.text, 'left', 'bold')
      return block.height + gapAfter
    }

    case 'contactRow': {
      const fontSize = block.fontSize ?? FS.small
      const iconSize = fontSize + 3
      drawIcon(ctx, block.icon ?? 'city', x, y + 4, iconSize, PALETTE.main)
      drawText(ctx, block.text ?? '', x + iconSize + 8, y + block.height - 6, fontSize, block.color ?? PALETTE.text)
      return block.height + gapAfter
    }

    case 'fieldPair': {
      const fontSize = block.fontSize ?? FS.small
      drawText(ctx, block.label ?? '', x, y + block.height - 6, fontSize, PALETTE.sub)
      drawText(ctx, block.value ?? '', x + (block.labelWidth ?? 60), y + block.height - 6, fontSize, PALETTE.text)
      return block.height + gapAfter
    }

    case 'progressRow': {
      const fontSize = block.fontSize ?? FS.small
      const nameHeight = Math.round(fontSize * 1.5)
      drawText(ctx, block.name ?? '', x, y + nameHeight - 4, fontSize, PALETTE.text)
      drawText(ctx, `${block.level ?? 0}%`, x + width, y + nameHeight - 4, fontSize - 1, PALETTE.sub, 'right')

      const barY = y + nameHeight + 2
      const barH = 6
      const level = block.level ?? 0
      fillRoundRect(ctx, x, barY, width, barH, barH / 2, block.trackColor ?? PALETTE.line)
      fillRoundRect(ctx, x, barY, Math.max(4, (width * level) / 100), barH, barH / 2, block.color ?? PALETTE.main)
      return block.height + gapAfter
    }

    case 'progressPair': {
      const itemWidth = block.itemWidth ?? 120
      const gapX = block.gapX ?? 24
      const fontSize = block.fontSize ?? FS.small
      const nameHeight = Math.round(fontSize * 1.5)
      const items = block.items ?? []

      items.forEach((item, i) => {
        const ix = x + i * (itemWidth + gapX)
        drawText(ctx, item.name, ix, y + nameHeight - 4, fontSize, PALETTE.text)
        const barY = y + nameHeight + 2
        const barH = 6
        fillRoundRect(ctx, ix, barY, itemWidth, barH, barH / 2, block.trackColor ?? PALETTE.line)
        fillRoundRect(ctx, ix, barY, Math.max(4, (itemWidth * item.level) / 100), barH, barH / 2, block.color ?? PALETTE.main)
      })
      return block.height + gapAfter
    }

    case 'tagRow': {
      const rowHeight = block.rowHeight ?? 34
      const rows = block.rows ?? []
      rows.forEach((row, r) => {
        let cx = x
        row.items.forEach((item) => {
          const ty = y + r * (rowHeight + 8)
          fillRoundRect(ctx, cx, ty, item.width, rowHeight, rowHeight / 2, block.background ?? PALETTE.mainLight)
          drawText(ctx, item.text, cx + (block.padX ?? 10), ty + rowHeight - 11, block.fontSize ?? FS.small, block.accent ?? PALETTE.main, 'left', 'bold')
          cx += item.width + (block.gapX ?? 8)
        })
      })
      return block.height + gapAfter
    }

    case 'avatar':
      drawAvatar(ctx, block, x, y, width, options.avatarImage)
      return block.height + gapAfter

    case 'tableTitle': {
      ctx.save()
      ctx.setFillStyle(block.background ?? PALETTE.grid)
      ctx.fillRect(x, y, block.width ?? width, block.height)
      ctx.restore()
      drawText(ctx, block.text ?? '', x + 12, y + block.height - 12, block.fontSize ?? FS.body, block.color ?? PALETTE.white, 'left', 'bold')
      return block.height + gapAfter
    }

    case 'tableRow': {
      const cells: TableCell[] = block.cells ?? []
      const borderColor = block.borderColor ?? PALETTE.lineStrong
      let cx = x

      cells.forEach((cell: TableCell) => {
        if (cell.background) {
          ctx.save()
          ctx.setFillStyle(cell.background)
          ctx.fillRect(cx, y, cell.width, block.height)
          ctx.restore()
        }
        const align = cell.align ?? 'left'
        const tx = align === 'center' ? cx + cell.width / 2 : align === 'right' ? cx + cell.width - 10 : cx + 10
        drawText(ctx, cell.text, tx, y + block.height / 2 + cell.fontSize * 0.35, cell.fontSize, cell.color, align, cell.bold ? 'bold' : undefined)
        cx += cell.width
      })

      // 单元格竖线
      let vx = x
      for (let i = 0; i < cells.length - 1; i += 1) {
        vx += cells[i].width
        drawLine(ctx, vx, y, vx, y + block.height, borderColor, 1)
      }

      ctx.save()
      ctx.setStrokeStyle(borderColor)
      ctx.setLineWidth(1)
      ctx.strokeRect(x, y, width, block.height)
      ctx.restore()
      return block.height + gapAfter
    }

    case 'tableContentRow': {
      const lines = block.lines ?? []
      const lineHeight = block.lineHeight ?? 20
      lines.forEach((line, i) => {
        drawText(ctx, line, x + 10, y + 10 + lineHeight * (i + 1) - 4, block.fontSize ?? FS.small, block.color ?? PALETTE.text)
      })
      ctx.save()
      ctx.setStrokeStyle(block.borderColor ?? PALETTE.lineStrong)
      ctx.setLineWidth(1)
      ctx.strokeRect(x, y, width, block.height)
      ctx.restore()
      return block.height + gapAfter
    }

    case 'tableAvatarRow': {
      const size = block.size ?? 72
      const ax = x + 10
      const ay = y + (block.height - size) / 2

      if (options.avatarImage && options.avatarImage.ok && options.avatarImage.node) {
        ctx.save()
        roundRectPath(ctx, ax, ay, size, size, 6)
        ctx.clip()
        const ratio = options.avatarImage.ratio || 1
        let dw = size
        let dh = size / ratio
        if (dh < size) {
          dh = size
          dw = size * ratio
        }
        ctx.drawImage(options.avatarImage.node, ax + (size - dw) / 2, ay + (size - dh) / 2, dw, dh)
        ctx.restore()
      } else {
        drawAvatarPlaceholder(ctx, ax, ay, size, 'rect', 6)
      }

      drawText(ctx, '照片', x + (block.labelWidth ?? 60) + 10, y + block.height / 2 + 5, block.fontSize ?? FS.small, PALETTE.sub)

      ctx.save()
      ctx.setStrokeStyle(block.borderColor ?? PALETTE.lineStrong)
      ctx.setLineWidth(1)
      ctx.strokeRect(x, y, width, block.height)
      ctx.restore()
      return block.height + gapAfter
    }

    case 'statRow': {
      // 核心成果：大号数字 + 说明，用于数据大屏型模板
      const stats = block.stats ?? []
      if (stats.length === 0) return block.height + gapAfter

      const cellWidth = width / stats.length
      const valueSize = block.fontSize ?? 32

      stats.forEach((stat, i) => {
        const cx = x + cellWidth * i + cellWidth / 2
        drawText(ctx, stat.value, cx, y + valueSize, valueSize, block.color ?? PALETTE.main, 'center', 'bold')
        drawText(ctx, stat.label, cx, y + valueSize + 18, FS.tiny, PALETTE.sub, 'center')
      })

      return block.height + gapAfter
    }

    case 'miniBars': {
      // 迷你柱状图：用于技能水平展示
      const points = block.points ?? []
      if (points.length === 0) return block.height + gapAfter

      const gap = block.gapX ?? 10
      const count = points.length
      const barWidth = block.barWidth ?? Math.max(6, (width - gap * (count - 1)) / count)
      const maxValue = Math.max(...points.map((p) => p.value), 1)
      const labelHeight = 16
      const plotHeight = Math.max(10, block.height - labelHeight - 4)
      const baseY = y + plotHeight

      points.forEach((point, i) => {
        const bx = x + i * (barWidth + gap)
        const ratio = Math.max(0, Math.min(1, point.value / maxValue))
        const barH = Math.max(3, plotHeight * ratio)

        fillRoundRect(ctx, bx, baseY - barH, barWidth, barH, 2, block.barColor ?? PALETTE.main)
        if (point.label) {
          drawText(ctx, point.label, bx + barWidth / 2, y + block.height - 2, FS.tiny - 1, PALETTE.sub, 'center')
        }
      })

      return block.height + gapAfter
    }

    case 'cardStart':
    case 'cardEnd':
      return gapAfter

    default:
      return block.height + gapAfter
  }
}

/* ------------------------------------------------------------------ */
/* 入口                                                                */
/* ------------------------------------------------------------------ */

/** 渲染带边框的卡片背景（用于 T6 卡片流） */
export function renderCardBackgrounds (ctx: RenderContext, layout: LayoutResult): void {
  (layout.columns ?? []).forEach((column: LayoutColumn) => {
    let cy = column.y
    let cardTop = -1
    let cardRadius = 12
    let cardBorder = PALETTE.line
    let cardFill = ''
    let cardShadow = false
    let cardPad = 0
    // 默认沿用早期模板的左侧暖色强调条；显式传空串则不绘制
    let cardAccent: string | null = PALETTE.warm

    column.blocks.forEach((block) => {
      if (block.kind === 'cardStart') {
        cardTop = cy
        cardRadius = block.radius ?? 12
        cardBorder = block.borderColor ?? PALETTE.line
        cardFill = block.fill ?? ''
        cardShadow = block.shadow === true
        cardPad = block.padding ?? 0
        cardAccent = block.accent === undefined ? PALETTE.warm : (block.accent || null)
      } else if (block.kind === 'cardEnd' && cardTop >= 0) {
        // padding 表示内容与卡片边缘的距离：卡片向外扩展，内容保持原位
        const cx = column.x - cardPad
        const cw = column.width + cardPad * 2
        const cardHeight = cy - cardTop + cardPad * 2
        const top = cardTop - cardPad

        // 阴影必须先于填充绘制：阴影是绘制时的状态，不影响已画内容
        if (cardShadow) {
          ctx.save()
          ctx.setShadow('rgba(15, 43, 70, 0.10)', 10, 3)
          fillRoundRect(ctx, cx, top, cw, cardHeight, cardRadius, cardFill || PALETTE.white)
          ctx.restore()
        }

        if (cardFill) {
          fillRoundRect(ctx, cx, top, cw, cardHeight, cardRadius, cardFill)
        }

        if (cardBorder) {
          strokeRoundRect(ctx, cx, top, cw, cardHeight, cardRadius, cardBorder, 1)
        }

        if (cardAccent) {
          fillRoundRect(ctx, cx, top, 3, cardHeight, 1.5, cardAccent)
        }

        cardTop = -1
        cardFill = ''
        cardShadow = false
        cardPad = 0
        cardAccent = PALETTE.warm
      }
      cy += (block.height ?? 0) + (block.gapAfter ?? 0)
    })
  })
}

/** 绘制整份简历 */
export function renderLayout (ctx: RenderContext, layout: LayoutResult, options: { avatarImage?: LoadedImage } = {}): void {
  const width = layout.canvasW || CANVAS_W
  const pageCount = Math.max(1, Math.ceil(layout.canvasH / CANVAS_H))
  const fullHeight = pageCount * CANVAS_H

  // 白底铺满整页，避免导出透明或黑边
  ctx.save()
  ctx.setFillStyle(layout.background || '#ffffff')
  ctx.fillRect(0, 0, width, Math.max(fullHeight, layout.canvasH))
  ctx.restore()

  // 装饰层
  ;(layout.decorations ?? []).forEach((item) => {
    if (item.kind === 'bar') {
      ctx.save()
      ctx.setFillStyle(item.color ?? PALETTE.main)
      ctx.fillRect(item.x, item.y, item.w ?? 0, item.h ?? 0)
      ctx.restore()
    } else if (item.kind === 'dot') {
      // 时间轴节点：实心圆
      const radius = item.radius ?? 4
      ctx.save()
      ctx.setFillStyle(item.color ?? PALETTE.main)
      ctx.beginPath()
      ctx.arc(item.x, item.y, radius, 0, Math.PI * 2, false)
      ctx.fill()
      ctx.restore()
    } else if (item.kind === 'line') {
      drawLine(ctx, item.x, item.y, item.x + (item.w ?? 1), item.y + (item.h ?? 0), item.color ?? PALETTE.line, item.w ?? 1)
    } else if (item.kind === 'text') {
      drawText(ctx, item.text ?? '', item.x, item.y, item.fontSize ?? FS.body, item.color ?? PALETTE.text, item.align ?? 'left', item.weight)
    }
  })

  // 内容列
  ;(layout.columns ?? []).forEach((column) => {
    let cy = column.y
    column.blocks.forEach((block) => {
      cy += renderBlock(ctx, block, {
        x: column.x,
        y: cy,
        width: column.width,
        avatarImage: options.avatarImage
      })
    })
  })
}