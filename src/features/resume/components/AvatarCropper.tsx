/**
 * 头像裁剪浮层。
 *
 * 小程序与 H5 都没有浏览器裁剪库，这里用 Canvas 2D 自绘：
 *   - 单指拖动调整位置
 *   - 双指捏合 / 滑条缩放（1× ~ 3×）
 *   - 输出 512 × 512 圆形头像 PNG
 *
 * 几何约定：图片以 cover 方式铺满取景圆，偏移量始终被限制在取景圆内不出现空白。
 */
import { Canvas, Slider, Text, View } from '@tarojs/components'
import type { BaseEventOrig } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import { queryUnifiedCanvas, type UnifiedCanvas } from '../canvas'
import { adaptContext, type RenderContext } from '../renderer'

import './avatar-cropper.less'

const OUTPUT_SIZE = 512
const STAGE_SIZE = 300
const SAFE_INSET = 18
const CROP_RADIUS = STAGE_SIZE / 2 - SAFE_INSET

/**
 * 缩放范围。
 *
 * 取景圆为圆形且要求不留空白，因此图片最小必须铺满取景框（1 倍）。
 * 再小就会出现空白边，裁出的头像会带上空白，因此下限取 1 倍而非 0.5 倍。
 */
const MIN_SCALE = 1
const MAX_SCALE = 2
const SCALE_STEP = 0.1

/** 取景圆在舞台中的左边界 */
const CROP_LEFT = (STAGE_SIZE - CROP_RADIUS * 2) / 2
/** 取景圆在舞台中的右边界 */
const CROP_RIGHT = CROP_LEFT + CROP_RADIUS * 2

interface CropGeometry {
  baseWidth: number
  baseHeight: number
  displayWidth: number
  displayHeight: number
  offsetX: number
  offsetY: number
  scale: number
}

interface Gesture {
  mode: 'drag' | 'pinch'
  /** 触点坐标（画布坐标系） */
  x: number
  y: number
  offsetX: number
  offsetY: number
  distance: number
  scale: number
}

interface Props {
  visible: boolean
  /** 待裁剪图片的本地路径 */
  src: string
  onCancel: () => void
  onConfirm: (tempFilePath: string) => void
  /** 重新选择图片（加载失败或用户想换一张时使用） */
  onRepick: () => void
  /** 跳过裁剪直接使用原图（裁剪反复失败时的最终兜底） */
  onSkip: (originalSrc: string) => void
}

/**
 * 舞台触摸事件。
 *
 * 框架把 View 的触摸事件标成通用事件类型，未描述触点结构，
 * 这里按运行时真实结构做一次收窄，避免直接读 undefined。
 */
interface StageTouchEvent {
  touches?: Array<{ x?: number, y?: number, clientX?: number, clientY?: number }>
}

/** 取出触点列表，缺失时返回空数组 */
function touchesOf (event: unknown): NonNullable<StageTouchEvent['touches']> {
  const touches = (event as StageTouchEvent | null)?.touches
  return Array.isArray(touches) ? touches : []
}

/**
 * 读取触点坐标。
 *
 * 两端触点结构不同：
 *   - 小程序 Canvas 2D：触点带 `x` / `y`
 *   - H5 原生 TouchEvent：触点带 `clientX` / `clientY`，没有 x / y
 * 拖拽与捏合都用相对位移，因此无需扣除画布偏移。
 */
function pointOf (touch: { x?: number, y?: number, clientX?: number, clientY?: number }): {
  x: number
  y: number
} {
  const x = typeof touch.x === 'number' ? touch.x : touch.clientX
  const y = typeof touch.y === 'number' ? touch.y : touch.clientY
  return {
    x: typeof x === 'number' && Number.isFinite(x) ? x : 0,
    y: typeof y === 'number' && Number.isFinite(y) ? y : 0
  }
}

/**
 * 头像裁剪浮层。
 * @param props 组件参数
 */
export default function AvatarCropper ({ visible, src, onCancel, onConfirm, onRepick, onSkip }: Props) {
  const [zoomPercent, setZoomPercent] = useState(100)
  const [processing, setProcessing] = useState(false)
  const [errorText, setErrorText] = useState('')

  const canvasRef = useRef<UnifiedCanvas | null>(null)
  const imageRef = useRef<unknown>(null)
  const geometryRef = useRef<CropGeometry | null>(null)
  const gestureRef = useRef<Gesture | null>(null)

  /** 回调存入 ref，避免父组件重渲染导致 effect 反复执行 */
  const onCancelRef = useRef(onCancel)
  const onConfirmRef = useRef(onConfirm)
  useEffect(() => {
    onCancelRef.current = onCancel
    onConfirmRef.current = onConfirm
  }, [onCancel, onConfirm])

  /** 把偏移量限制在取景圆内 */
  const clampOffsets = useCallback(() => {
    const geometry = geometryRef.current
    if (!geometry) return

    geometry.offsetX = Math.min(CROP_LEFT, Math.max(CROP_RIGHT - geometry.displayWidth, geometry.offsetX))
    geometry.offsetY = Math.min(CROP_LEFT, Math.max(CROP_RIGHT - geometry.displayHeight, geometry.offsetY))
  }, [])

  /** 重绘裁剪画面 */
  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const geometry = geometryRef.current
    const image = imageRef.current
    if (!canvas || !geometry || !image) return

    const ratio = 2
    canvas.resize(STAGE_SIZE * ratio, STAGE_SIZE * ratio)

    const raw = canvas.raw.getContext('2d') as {
      scale: (x: number, y: number) => void
      setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    }
    if (typeof raw.setTransform === 'function') {
      raw.setTransform(1, 0, 0, 1, 0, 0)
    }
    raw.scale(ratio, ratio)

    const ctx: RenderContext = adaptContext(raw)

    // 背板
    ctx.setFillStyle('#1c1f22')
    ctx.fillRect(0, 0, STAGE_SIZE, STAGE_SIZE)

    // 图片
    ctx.drawImage(image, geometry.offsetX, geometry.offsetY, geometry.displayWidth, geometry.displayHeight)

    // 取景区外压暗：矩形 + 反向圆弧挖孔
    const center = STAGE_SIZE / 2
    ctx.save()
    ctx.setFillStyle('rgb(0 0 0 / 58%)')
    ctx.beginPath()
    ctx.rect(0, 0, STAGE_SIZE, STAGE_SIZE)
    ctx.arc(center, center, CROP_RADIUS, 0, Math.PI * 2, true)
    ctx.fill()
    ctx.restore()

    // 取景圆描边
    ctx.save()
    ctx.setStrokeStyle('#2ba471')
    ctx.setLineWidth(2)
    ctx.beginPath()
    ctx.arc(center, center, CROP_RADIUS, 0, Math.PI * 2, false)
    ctx.stroke()
    ctx.restore()
  }, [])

  /** 以某点为锚点缩放 */
  const zoomTo = useCallback((nextScale: number, anchorX: number, anchorY: number) => {
    const geometry = geometryRef.current
    if (!geometry) return

    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
    if (scale === geometry.scale) return

    const ratioX = (anchorX - geometry.offsetX) / geometry.displayWidth
    const ratioY = (anchorY - geometry.offsetY) / geometry.displayHeight

    geometry.scale = scale
    geometry.displayWidth = geometry.baseWidth * scale
    geometry.displayHeight = geometry.baseHeight * scale
    geometry.offsetX = anchorX - ratioX * geometry.displayWidth
    geometry.offsetY = anchorY - ratioY * geometry.displayHeight

    clampOffsets()
    setZoomPercent(Math.round(scale * 100))
    paint()
  }, [clampOffsets, paint])

  /** 初始化：解析画布并加载图片 */
  useEffect(() => {
    if (!visible || !src) return

    let cancelled = false

    const boot = async () => {
      try {
        const canvas = canvasRef.current ?? await queryUnifiedCanvas('#avatarCropCanvas')
        if (cancelled) return

        // 画布存在但尺寸未同步时先固定尺寸，保证后续绘制可见
        canvas.resize(STAGE_SIZE * 2, STAGE_SIZE * 2)
        canvasRef.current = canvas

        const image = await canvas.loadImage(src)
        if (cancelled) return

        if (!image.ok || !image.node) {
          imageRef.current = null
          geometryRef.current = null
          setErrorText('图片读取失败，请点右上角「重选」换一张')
          return
        }

        setErrorText('')

        imageRef.current = image.node

        const imageRatio = image.ratio > 0 ? image.ratio : 1
        const baseWidth = imageRatio >= 1 ? STAGE_SIZE * imageRatio : STAGE_SIZE
        const baseHeight = imageRatio >= 1 ? STAGE_SIZE : STAGE_SIZE / imageRatio

        geometryRef.current = {
          baseWidth,
          baseHeight,
          displayWidth: baseWidth,
          displayHeight: baseHeight,
          offsetX: (STAGE_SIZE - baseWidth) / 2,
          offsetY: (STAGE_SIZE - baseHeight) / 2,
          scale: 1
        }

        clampOffsets()
        setZoomPercent(100)
        paint()
      } catch (err) {
        if (cancelled) return
        imageRef.current = null
        geometryRef.current = null
        setErrorText(err instanceof Error ? err.message : '头像加载失败，请点右上角「重选」')
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [visible, src, paint, clampOffsets])

  /** 关闭浮层并清理状态 */
  const handleCancel = useCallback(() => {
    imageRef.current = null
    geometryRef.current = null
    gestureRef.current = null
    setErrorText('')
    onCancelRef.current()
  }, [])

  /** 手势开始 */
  const handleTouchStart = useCallback((event: BaseEventOrig) => {
    const touches = touchesOf(event)
    const geometry = geometryRef.current
    if (!geometry || !touches || touches.length === 0) return

    const first = pointOf(touches[0] as never)

    if (touches.length === 1) {
      gestureRef.current = {
        mode: 'drag',
        x: first.x,
        y: first.y,
        offsetX: geometry.offsetX,
        offsetY: geometry.offsetY,
        distance: 0,
        scale: geometry.scale
      }
    } else {
      const second = pointOf(touches[1] as never)
      const dx = first.x - second.x
      const dy = first.y - second.y
      gestureRef.current = {
        mode: 'pinch',
        x: 0,
        y: 0,
        offsetX: geometry.offsetX,
        offsetY: geometry.offsetY,
        distance: Math.sqrt(dx * dx + dy * dy) || 1,
        scale: geometry.scale
      }
    }
  }, [])

  /** 拖动与捏合 */
  const handleTouchMove = useCallback((event: BaseEventOrig) => {
    const gesture = gestureRef.current
    const geometry = geometryRef.current
    if (!gesture || !geometry) return

    const touches = touchesOf(event)
    if (!touches || touches.length === 0) return

    if (gesture.mode === 'drag' && touches.length === 1) {
      const point = pointOf(touches[0] as never)
      geometry.offsetX = gesture.offsetX + (point.x - gesture.x)
      geometry.offsetY = gesture.offsetY + (point.y - gesture.y)
      clampOffsets()
      paint()
      return
    }

    if (touches.length >= 2) {
      const first = pointOf(touches[0] as never)
      const second = pointOf(touches[1] as never)
      const dx = first.x - second.x
      const dy = first.y - second.y
      const distance = Math.sqrt(dx * dx + dy * dy) || 1
      const baseDistance = gesture.mode === 'pinch' ? gesture.distance : distance
      const baseScale = gesture.mode === 'pinch' ? gesture.scale : geometry.scale
      zoomTo((distance / baseDistance) * baseScale, STAGE_SIZE / 2, STAGE_SIZE / 2)
    }
  }, [clampOffsets, paint, zoomTo])

  const handleTouchEnd = useCallback(() => {
    gestureRef.current = null
  }, [])

  const handleZoomChange = useCallback((event: { detail: { value: number } }) => {
    zoomTo(event.detail.value / 100, STAGE_SIZE / 2, STAGE_SIZE / 2)
  }, [zoomTo])

  /** 按步长缩放（滑条或手势不可用时的备用操作） */
  const stepZoom = useCallback((delta: number) => {
    const geometry = geometryRef.current
    const current = geometry ? geometry.scale : MIN_SCALE
    zoomTo(Number((current + delta).toFixed(2)), STAGE_SIZE / 2, STAGE_SIZE / 2)
  }, [zoomTo])

  /** 跳过裁剪，直接把原图作为头像 */
  const handleSkip = useCallback(() => {
    if (!src) {
      setErrorText('没有可用的原图，请点右上角「重选」')
      return
    }
    onSkip(src)
  }, [src, onSkip])

  /** 确认裁剪并输出头像 */
  /**
   * 确认裁剪。
   *
   * 图片未就绪时不能静默返回——那样用户点了按钮完全没有反馈，
   * 表现就是「按钮点不动」。这里根据当前状态给出明确提示。
   */
  const handleConfirm = useCallback(async () => {
    const geometry = geometryRef.current
    const image = imageRef.current

    if (processing) return

    if (!image || !geometry) {
      // 已有错误说明加载失败，否则视为仍在加载
      setErrorText(
        errorText !== '' && !errorText.includes('还在加载')
          ? '图片未就绪，请点右上角「重选」换一张'
          : '图片还在加载，请稍候再点确定'
      )
      return
    }

    setProcessing(true)

    try {
      // 传入当前画布，作为离屏画布不可用时的兜底
      const output = await cropToFile(image, geometry, canvasRef.current)
      imageRef.current = null
      geometryRef.current = null
      onConfirmRef.current(output)
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : '裁剪失败，请重试')
    } finally {
      setProcessing(false)
    }
  }, [processing, errorText])

  if (!visible) return null

  return (
    <View className='cropper' catchMove>
      <View className='cropper__head'>
        <Text className='cropper__cancel' onClick={handleCancel}>取消</Text>
        <Text className='cropper__title'>调整头像</Text>
        <Text className='cropper__repick' onClick={onRepick}>重选</Text>
      </View>

      {/*
        手势绑在舞台而非画布上：画布显示尺寸小于舞台，
        只绑画布会让边缘区域的拖动完全收不到事件。
      */}
      <View
        className='cropper__stage'
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <Canvas
          id='avatarCropCanvas'
          canvasId='avatarCropCanvas'
          type='2d'
          className='cropper__canvas'
        />
        {errorText !== '' ? (
          <Text className='cropper__error'>{errorText}</Text>
        ) : (
          <Text className='cropper__hint'>拖动调整位置，双指或滑条缩放</Text>
        )}
      </View>

      <View className='cropper__zoom'>
        <Text className='cropper__zoom-btn' onClick={() => stepZoom(-SCALE_STEP)}>−</Text>
        <Slider
          className='cropper__slider'
          min={MIN_SCALE * 100}
          max={MAX_SCALE * 100}
          step={SCALE_STEP * 100}
          value={zoomPercent}
          activeColor='#2ba471'
          backgroundColor='#3a3a3a'
          blockSize={18}
          onChanging={handleZoomChange}
          onChange={handleZoomChange}
        />
        <Text className='cropper__zoom-btn' onClick={() => stepZoom(SCALE_STEP)}>＋</Text>
      </View>

      {/* 底部操作条：固定贴底并适配全面屏安全区 */}
      <View className='cropper__footer'>
        <Text className='cropper__skip' onClick={handleSkip}>跳过裁剪，直接用原图</Text>
        <Text
          className={`cropper__save${processing ? ' cropper__save--busy' : ''}`}
          onClick={handleConfirm}
        >
          {processing ? '处理中…' : '保存头像'}
        </Text>
      </View>
    </View>
  )
}

/**
 * 把取景圆内的画面导出为 512 × 512 的 PNG。
 *
 * 小程序：优先使用离屏画布 + canvasToTempFilePath，
 * 基础库不支持离屏时退回页面内画布（此时浮层即将关闭，视觉影响可忽略）。
 * H5：用浏览器 canvas 直接 toDataURL，无需文件系统。
 *
 * @param canvas 当前裁剪画布，作为离屏不可用时的兜底
 */
async function cropToFile (
  image: unknown,
  geometry: CropGeometry,
  canvas: UnifiedCanvas | null
): Promise<string> {
  const factor = OUTPUT_SIZE / (CROP_RADIUS * 2)

  const render = (target: {
    width: number
    height: number
    getContext: (type: '2d') => unknown
  }) => {
    target.width = OUTPUT_SIZE
    target.height = OUTPUT_SIZE

    const raw = target.getContext('2d') as {
      setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void
    }
    if (typeof raw.setTransform === 'function') {
      raw.setTransform(1, 0, 0, 1, 0, 0)
    }

    const ctx = adaptContext(raw)
    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    // 圆形裁剪，保持头像为圆形
    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2, false)
    ctx.clip()

    ctx.drawImage(
      image,
      (geometry.offsetX - CROP_LEFT) * factor,
      (geometry.offsetY - CROP_LEFT) * factor,
      geometry.displayWidth * factor,
      geometry.displayHeight * factor
    )
    ctx.restore()
  }

  /* H5：直接导出 dataURL */
  if (canvas?.isMiniApp !== true) {
    if (typeof document === 'undefined') {
      throw new Error('当前环境不支持裁剪')
    }
    const element = document.createElement('canvas')
    render(element as unknown as { width: number, height: number, getContext: (t: '2d') => unknown })

    // H5 的头像以 dataURL 存入本地存储，用 JPEG 控制体积避免超出容量
    let dataUrl = ''
    try {
      dataUrl = (element as HTMLCanvasElement).toDataURL('image/jpeg', 0.92)
    } catch {
      throw new Error('裁剪导出失败，请重试')
    }
    if (!dataUrl || dataUrl === 'data:,') {
      throw new Error('裁剪导出失败，请重试')
    }
    return dataUrl
  }

  /* 小程序：优先离屏画布 */
  type RenderTarget = { width: number, height: number, getContext: (type: '2d') => unknown }
  let target: RenderTarget | null = null
  try {
    const offscreen = Taro.createOffscreenCanvas({
      type: '2d',
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE
    })
    if (offscreen) {
      target = offscreen as unknown as RenderTarget
    }
  } catch {
    target = null
  }

  // 兜底：使用页面内画布
  if (!target && canvas) {
    target = canvas.raw as unknown as RenderTarget
  }
  if (!target) {
    throw new Error('裁剪导出失败，请重试')
  }

  render(target)

  const result = await new Promise<{ tempFilePath: string }>((resolve, reject) => {
    Taro.canvasToTempFilePath({
      canvas: target as never,
      x: 0,
      y: 0,
      width: OUTPUT_SIZE,
      height: OUTPUT_SIZE,
      destWidth: OUTPUT_SIZE,
      destHeight: OUTPUT_SIZE,
      fileType: 'png',
      quality: 1,
      success: (res) => resolve(res as { tempFilePath: string }),
      fail: () => reject(new Error('裁剪导出失败，请重试'))
    })
  })

  if (!result.tempFilePath) throw new Error('裁剪导出失败，请重试')
  return result.tempFilePath
}