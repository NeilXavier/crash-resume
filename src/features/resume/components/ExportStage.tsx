/**
 * 导出专用高清画布。
 *
 * 关键点：该组件用 memo 包裹且不接收任何 props，
 * 因此父页面因状态变化重渲染时，它不会跟着重新渲染。
 *
 * 原因：平台画布组件在自身重新渲染时会把画布像素尺寸重置为 CSS 尺寸，
 * 而设置画布尺寸会清空内容。若导出过程中页面更新导致画布被重置，
 * 随后切片读到的就是空白图（表现为导出空白页）。
 *
 * 画布本身移出视口但不使用 display: none，
 * 保证既能正常绘制、又不影响页面布局。
 */
import { Canvas } from '@tarojs/components'
import { memo } from 'react'

/** 屏幕展示尺寸：极小但保留布局，真正的像素尺寸由导出逻辑设置 */
const KEEP_ALIVE_SIZE = 1

function ExportStageInner (): JSX.Element {
  return (
    <Canvas
      id='exportCanvas'
      canvasId='exportCanvas'
      type='2d'
      className='export__canvas'
      style={{ width: `${KEEP_ALIVE_SIZE}px`, height: `${KEEP_ALIVE_SIZE}px` }}
    />
  )
}

export default memo(ExportStageInner)