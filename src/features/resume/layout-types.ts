/**
 * 布局引擎的块与列类型定义。
 * 采用宽松的联合描述，便于各模板自由组合字段，
 * 渲染层按 kind 分支读取对应属性。
 */

/** 装饰元素（横幅、分割线、横带内文字、时间轴节点） */
export interface LayoutDecoration {
  kind: 'bar' | 'line' | 'text' | 'dot'
  x: number
  y: number
  w?: number
  h?: number
  color?: string
  text?: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  weight?: string
  /** dot：半径 */
  radius?: number
}

/** 表格列定义 */
export interface TableColumn {
  width: number
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  color?: string
  background?: string
}

/** 表格单元格 */
export interface TableCell {
  text: string
  width: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  background: string
  color: string
  fontSize: number
}

/** 标签项 */
export interface TagItem {
  text: string
  width: number
}

/** 进度条对 */
export interface ProgressPairItem {
  name: string
  level: number
}

/**
 * 布局块。
 * 所有块都有 height 与 gapAfter；其余字段按 kind 取值。
 */
export interface LayoutBlock {
  kind: string
  height: number
  gapAfter?: number

  // sectionTitle
  text?: string
  accent?: string
  style?: 'bar' | 'dot' | 'block' | 'plain'

  // paragraph
  lines?: string[]
  lineHeight?: number
  fontSize?: number
  color?: string
  indent?: number

  // labelLine
  weight?: string
  align?: 'left' | 'center' | 'right'

  // rowLine
  left?: string
  right?: string
  leftColor?: string
  rightColor?: string

  // tripleLine
  period?: string
  org?: string
  role?: string

  // contactRow
  icon?: string

  // fieldPair
  label?: string
  value?: string
  labelWidth?: number

  // progressRow / progressPair
  name?: string
  level?: number
  width?: number
  trackColor?: string
  items?: ProgressPairItem[]
  itemWidth?: number
  gapX?: number

  // tagRow
  rows?: Array<{ items: TagItem[] }>
  rowHeight?: number
  padX?: number

  // avatar
  size?: number
  shape?: 'circle' | 'rect'
  radius?: number

  // 边框颜色：avatar / tableRow / tableContentRow / cardStart 共用
  borderColor?: string

  // tableTitle / cardStart
  background?: string
  padding?: number

  // cardStart：卡片填充色与悬浮阴影
  fill?: string
  shadow?: boolean

  // statRow：核心成果大号数字
  stats?: Array<{ value: string, label: string }>

  // miniBars：迷你柱状图数据点
  points?: Array<{ label: string, value: number }>
  /** miniBars：柱条宽度 */
  barWidth?: number
  /** miniBars：柱条颜色 */
  barColor?: string

  // tableRow
  cells?: TableCell[]
  columns?: TableColumn[]
}

/** 布局列 */
export interface LayoutColumn {
  x: number
  y: number
  width: number
  blocks: LayoutBlock[]
}

/** 布局结果 */
export interface LayoutResult {
  canvasW: number
  canvasH: number
  background: string
  decorations: LayoutDecoration[]
  columns: LayoutColumn[]
  bottomPadding: number
  templateId: string
}

/** 兼容占位类型 */
export type LayoutKindInput = never