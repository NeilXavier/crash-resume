/**
 * A4 简历画布组件。
 *
 * 逻辑尺寸固定 794 × 1123（96dpi 的 A4），按屏幕可用宽度等比缩放显示。
 * 屏幕显示与导出使用同一套布局结果，因此预览即所得。
 *
 * 通过 resolveCanvas / adaptContext 同时兼容小程序 Canvas 2D 与 H5 标准 Canvas，
 * 两端绘制调用完全一致。
 */
import { Canvas, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { queryUnifiedCanvas, type UnifiedCanvas } from '../canvas'
import { CANVAS_H, CANVAS_W, computeLayout } from '../layout'
import { buildResumeModel } from '../model'
import { adaptContext, renderCardBackgrounds, renderLayout } from '../renderer'
import type { ResumeDraft, ResumeModel } from '../types'

import './resume-canvas.less'

/** 预览绘制倍率：屏幕尺寸 × 该值，保证高分屏下清晰 */
const PREVIEW_PIXEL_RATIO = 2

/** 桌面端页面容器最大宽度（与 app.less 中的 750PX 对应） */
const MAX_FRAME_WIDTH = 750

interface Props {
  draft: ResumeDraft
  /** 画布标识，导出页需传入固定 id 以复用同一节点 */
  canvasId?: string
  /** 内容高度变化回调，用于提示页数 */
  onMeta?: (meta: { pageCount: number, model: ResumeModel }) => void
  /** 是否显示底部尺寸说明 */
  showMeta?: boolean
}

/** 计算画布在屏幕上的显示尺寸 */
function measureFrame (): { width: number, height: number } {
  let windowWidth = 375
  try {
    const info = process.env.TARO_ENV === 'h5' && typeof window !== 'undefined'
      ? { windowWidth: window.innerWidth }
      : Taro.getWindowInfo()
    windowWidth = info.windowWidth || 375
  } catch {
    windowWidth = 375
  }

  // 桌面端容器最宽 750，画布不能按整个窗口宽度撑开
  windowWidth = Math.min(windowWidth, MAX_FRAME_WIDTH)

  // 页面左右各留 24px（750 设计坐标），再留 8px 余量
  const horizontal = (windowWidth * 48) / 750 + 8
  const width = Math.max(200, Math.floor(windowWidth - horizontal))
  return { width, height: Math.round((width * CANVAS_H) / CANVAS_W) }
}

/**
 * A4 简历画布。
 * @param props 组件参数
 */
export default function ResumeCanvas ({
  draft,
  canvasId = 'resumePreviewCanvas',
  onMeta,
  showMeta = false
}: Props) {
  const [frame, setFrame] = useState(measureFrame)
  const [rendering, setRendering] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [failed, setFailed] = useState('')

  const canvasRef = useRef<UnifiedCanvas | null>(null)
  const onMetaRef = useRef(onMeta)
  /** 已完成绘制的草稿签名，避免相同内容重复绘制 */
  const paintedRef = useRef('')

  /** 草稿内容签名：仅内容真正变化时才重新绘制 */
  const contentSignature = useMemo(() => JSON.stringify(draft), [draft])

  useEffect(() => {
    onMetaRef.current = onMeta
  }, [onMeta])

  /** 窗口尺寸变化时重新测量画布，避免旋转屏幕或拉伸窗口后比例错位 */
  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5' || typeof window === 'undefined') return
    const handleResize = () => {
      const next = measureFrame()
      setFrame((prev) => (prev.width === next.width ? prev : next))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  /** 绘制简历 */
  const draw = useCallback(async (canvas: UnifiedCanvas) => {
    // 标记已绘制的内容签名，供调用方判断是否需要重绘
    paintedRef.current = contentSignature

    const model = buildResumeModel(draft)
    const layout = computeLayout(model.templateId, model)

    const scale = (frame.width / CANVAS_W) * PREVIEW_PIXEL_RATIO
    const pixelWidth = Math.round(CANVAS_W * scale)
    const pixelHeight = Math.round(layout.canvasH * scale)

    // 先加载头像，再动画布。
    // H5 端若在 resize 与绘制之间 await，可能被平台重渲染打断，
    // 导致画布尺寸被重置、画面错位或空白，因此 await 必须前置。
    const avatarImage = model.visibility.avatar
      ? await canvas.loadImage(model.avatar)
      : { node: null, ratio: 1, ok: false as const }

    // 以下为同步步骤：resize 后立即绘制，中间不再 await
    canvas.resize(pixelWidth, pixelHeight)

    const raw = canvas.raw.getContext('2d') as {
      scale: (x: number, y: number) => void
      setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    }
    if (typeof raw.setTransform === 'function') {
      raw.setTransform(1, 0, 0, 1, 0, 0)
    }
    raw.scale(scale, scale)

    const ctx = adaptContext(raw)

    // 先铺白底，保证文字下方不是透明
    ctx.setFillStyle(layout.background || '#ffffff')
    ctx.fillRect(0, 0, CANVAS_W, layout.canvasH)

    // 卡片与装饰由各模板自行声明，这里统一渲染；
    // 未声明卡片/装饰的列不会产生任何绘制，因此可以无条件调用。
    renderCardBackgrounds(ctx, layout)
    renderLayout(ctx, layout, { avatarImage })

    setRendering(false)
    setEmpty(!model.hasAnyContent)
    onMetaRef.current?.({
      pageCount: Math.max(1, Math.ceil(layout.canvasH / CANVAS_H)),
      model
    })
  }, [draft, frame.width, contentSignature])

  /** 解析画布并按需绘制：画布未就绪时先查询，内容变化时重绘 */
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      let canvas = canvasRef.current

      if (!canvas) {
        try {
          canvas = await queryUnifiedCanvas(`#${canvasId}`)
        } catch (err) {
          if (cancelled) return
          setRendering(false)
          setFailed(err instanceof Error ? err.message : '画布初始化失败')
          return
        }
        if (cancelled) return
        canvasRef.current = canvas
      }

      // 内容未变化时无需重绘，直接结束加载态
      if (paintedRef.current === contentSignature) {
        if (!cancelled) setRendering(false)
        return
      }

      setRendering(true)
      try {
        await draw(canvas)
      } catch (err) {
        if (cancelled) return
        setRendering(false)
        setFailed(err instanceof Error ? err.message : '渲染失败')
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [canvasId, draw, contentSignature])

  return (
    <View className='resume-canvas'>
      <View
        className='resume-canvas__frame'
        style={{ width: `${frame.width}px`, height: `${frame.height}px` }}
      >
        <Canvas
          id={canvasId}
          canvasId={canvasId}
          type='2d'
          className='resume-canvas__node'
          style={{ width: `${frame.width}px`, height: `${frame.height}px` }}
        />
        {rendering && !failed && (
          <View className='resume-canvas__mask'>
            <View className='resume-canvas__spinner' />
            <View className='resume-canvas__mask-text'>正在渲染…</View>
          </View>
        )}
        {failed !== '' && (
          <View className='resume-canvas__empty'>
            <View className='resume-canvas__empty-title'>画布初始化失败</View>
            <View className='resume-canvas__empty-desc'>{failed}</View>
          </View>
        )}
        {!rendering && failed === '' && empty && (
          <View className='resume-canvas__empty'>
            <View className='resume-canvas__empty-title'>还没有内容</View>
            <View className='resume-canvas__empty-desc'>回到填写页补充姓名与经历后即可成稿</View>
          </View>
        )}
      </View>

      {showMeta && (
        <View className='resume-canvas__meta'>
          <View className='resume-canvas__meta-item'>逻辑尺寸 794 × 1123</View>
          <View className='resume-canvas__meta-item'>导出倍率 2×</View>
          <View className='resume-canvas__meta-item'>A4 210 × 297mm</View>
        </View>
      )}
    </View>
  )
}