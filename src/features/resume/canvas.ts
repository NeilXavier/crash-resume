/**
 * 画布节点解析与图片加载。
 *
 * 各端 SelectorQuery 返回的 node 结构不同，必须统一收敛：
 *
 *   - 小程序 Canvas 2D：node 是画布对象，同时具备
 *     `getContext` 与 `createImage`。
 *   - H5：Taro 的 selectorQuery 会返回**真实的 HTMLCanvasElement**
 *     （见 taro-h5 的 wxml/selectorQuery.js：tagName 匹配 taro-canvas-core 时
 *     取内部 canvas 作为 node）。它有 `getContext`，但**没有 `createImage`**。
 *
 * 因此判定必须依据 `createImage`，不能依据 `getContext`——
 * 后者会把 H5 的真实 canvas 误判成小程序画布，导致图片加载永远失败。
 */

import Taro from '@tarojs/taro'

/** 统一的画布对象 */
export interface UnifiedCanvas {
  /** 底层真实画布（具备标准 2D 上下文） */
  raw: {
    width: number
    height: number
    getContext: (type: '2d') => unknown
  }
  /** 是否为小程序画布 */
  isMiniApp: boolean
  /** 设置画布尺寸（像素），H5 同时同步 CSS 尺寸保证清晰 */
  resize: (width: number, height: number) => void
  /** 加载图片，失败返回 ok: false 而不抛错 */
  loadImage: (src: string) => Promise<LoadedImageResult>
}

/** 加载结果 */
export interface LoadedImageResult {
  node: unknown
  ratio: number
  ok: boolean
}

/**
 * 读取画布的像素尺寸。
 *
 * 用于导出前校验：平台在组件重新渲染时会把画布尺寸重置为 CSS 尺寸，
 * 而设置画布尺寸会清空内容。提前发现可以给出明确提示，
 * 避免用户拿到空白图片却没有任何反馈。
 */
export function pixelSizeOf (canvas: UnifiedCanvas): { width: number, height: number } {
  const target = canvas.raw as { width?: unknown, height?: unknown }
  return {
    width: Math.max(0, Math.round(Number(target?.width ?? 0))),
    height: Math.max(0, Math.round(Number(target?.height ?? 0)))
  }
}

/** 导出前校验画布仍保持绘制尺寸，否则抛出可读错误 */
export function assertCanvasPainted (canvas: UnifiedCanvas, expectedWidth: number): void {
  const size = pixelSizeOf(canvas)
  if (size.width < expectedWidth) {
    throw new Error('画布在导出前被重置，请重新点击导出')
  }
}

/** 画布节点（各端字段可能有缺失） */
interface RawCanvasNode {
  width: number
  height: number
  getContext?: (type: '2d') => unknown
  createImage?: () => RawImage
  style?: { width: string, height: string }
}

/** 画布图片对象 */
interface RawImage {
  src: string
  width: number
  height: number
  onload: (() => void) | null
  onerror: (() => void) | null
}

/**
 * 把 SelectorQuery 返回的节点包装为统一画布。
 * @param node SelectorQuery 取得的 node
 * @returns 统一画布；无法解析时返回 null
 */
export function resolveCanvas (node: unknown): UnifiedCanvas | null {
  if (!node || typeof node !== 'object') return null

  const candidate = node as RawCanvasNode

  // 小程序画布：createImage 是小程序 Canvas 2D 的标志能力
  if (typeof candidate.createImage === 'function' && typeof candidate.getContext === 'function') {
    return {
      raw: candidate as UnifiedCanvas['raw'],
      isMiniApp: true,
      resize (width, height) {
        candidate.width = width
        candidate.height = height
      },
      loadImage: (src) => loadMiniAppImage(candidate, src)
    }
  }

  // 标准画布（H5 真实 canvas）：有 getContext 但没有 createImage
  if (typeof candidate.getContext === 'function') {
    return {
      raw: candidate as UnifiedCanvas['raw'],
      isMiniApp: false,
      resize (width, height) {
        // 只改像素尺寸（决定清晰度），CSS 显示尺寸仍由组件样式控制，
        // 这样画布不会被拉伸，同时保证高分屏清晰
        candidate.width = width
        candidate.height = height
      },
      loadImage: (src) => loadBrowserImage(src)
    }
  }

  // 兜底：若拿到的是自定义元素，向下查找真实 canvas
  const element = node as { querySelector?: (selector: string) => unknown }
  if (typeof element.querySelector === 'function') {
    const inner = element.querySelector('canvas') as RawCanvasNode | null
    if (inner && typeof inner.getContext === 'function') {
      return {
        raw: inner as UnifiedCanvas['raw'],
        isMiniApp: false,
        resize (width, height) {
          inner.width = width
          inner.height = height
        },
        loadImage: (src) => loadBrowserImage(src)
      }
    }
  }

  return null
}

/** 小程序端图片加载 */
function loadMiniAppImage (canvas: RawCanvasNode, src: string): Promise<LoadedImageResult> {
  return new Promise((resolve) => {
    if (!src || typeof canvas.createImage !== 'function') {
      resolve({ node: null, ratio: 1, ok: false })
      return
    }

    let settled = false
    const finish = (result: LoadedImageResult) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    let image: RawImage
    try {
      image = canvas.createImage()
    } catch {
      finish({ node: null, ratio: 1, ok: false })
      return
    }

    // 兜底：部分基础库不触发 onload 时按已加载处理，不阻断渲染
    const timer = setTimeout(() => {
      finish({
        node: image,
        ratio: image.width && image.height ? image.width / image.height : 1,
        ok: true
      })
    }, 3000)

    image.onload = () => {
      clearTimeout(timer)
      finish({
        node: image,
        ratio: image.width && image.height ? image.width / image.height : 1,
        ok: true
      })
    }
    image.onerror = () => {
      clearTimeout(timer)
      // 加载失败回退到占位图，不中断渲染
      finish({ node: null, ratio: 1, ok: false })
    }

    try {
      image.src = src
    } catch {
      clearTimeout(timer)
      finish({ node: null, ratio: 1, ok: false })
    }
  })
}

/** H5 端图片加载：浏览器原生 Image */
function loadBrowserImage (src: string): Promise<LoadedImageResult> {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ node: null, ratio: 1, ok: false })
      return
    }

    const ImageCtor = typeof window !== 'undefined' ? window.Image : undefined
    if (typeof ImageCtor !== 'function') {
      resolve({ node: null, ratio: 1, ok: false })
      return
    }

    const image = new ImageCtor()
    // 仅远程地址声明跨域；dataURL 与 blob 不需要，设了反而可能失败
    if (/^https?:/i.test(src)) image.crossOrigin = 'anonymous'

    let settled = false
    const finish = (result: LoadedImageResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }

    // 超时兜底：图片既不触发 onload 也不触发 onerror 时，
    // 不能让预览永久停在加载态，直接回退占位图
    const timer = setTimeout(() => {
      finish({ node: null, ratio: 1, ok: false })
    }, 2000)

    image.onload = () => {
      finish({
        node: image,
        ratio: image.width && image.height ? image.width / image.height : 1,
        ok: true
      })
    }
    image.onerror = () => finish({ node: null, ratio: 1, ok: false })

    try {
      image.src = src
    } catch {
      finish({ node: null, ratio: 1, ok: false })
    }
  })
}

/**
 * 查询页面内的画布并统一包装。
 * 自定义元素挂载可能有延迟，因此带有限次重试而不是单次静默失败。
 * @param selector 形如 `#canvasId`
 */
export function queryUnifiedCanvas (selector: string): Promise<UnifiedCanvas> {
  return new Promise((resolve, reject) => {
    const attempt = (remaining: number) => {
      const query = Taro.createSelectorQuery()
      query
        .select(selector)
        .fields({ node: true, size: true }, () => undefined)
        .exec((res: unknown[]) => {
          const first = (res ?? [])[0] as { node?: unknown } | undefined
          const resolved = resolveCanvas(first?.node)

          if (resolved) {
            resolve(resolved)
            return
          }

          if (remaining > 0) {
            setTimeout(() => attempt(remaining - 1), 80)
            return
          }

          // eslint-disable-next-line no-console
          console.error('[resume] 未找到可用画布节点', selector, first)
          reject(new Error('未找到画布节点，请退出重进本页'))
        })
    }

    attempt(5)
  })
}