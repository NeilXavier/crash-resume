import type {
  LayoutBlock,
  LayoutColumn,
  LayoutDecoration,
  LayoutResult
} from './layout-types'
import type { ResumeExperience, ResumeModel } from './types'
import { ellipsis, measureText, tidy, wrapText } from './utils'

export const CANVAS_W = 794
export const CANVAS_H = 1123

/** 调色板 */
export const PALETTE = {
  main: '#2ba471',
  mainLight: '#e8f5e9',
  mainDark: '#1f7a54',
  grid: '#3a6ea5',
  warm: '#e07a3f',
  warmLight: '#f6e3d5',
  text: '#222222',
  sub: '#888888',
  line: '#eeeeee',
  lineStrong: '#dddddd',
  side: '#f2f4f7',
  white: '#ffffff'
}

/** 字号（画布逻辑 px） */
export const FS = {
  nameXL: 42,
  nameL: 36,
  nameM: 32,
  section: 19,
  body: 15,
  small: 13,
  tiny: 11.5
}

const LH = 1.55

/** 每套模板的几何参数 */
const METRICS: Record<string, Record<string, number>> = {
  t1: { padX: 44, padTop: 0, padBottom: 44 },
  t2: { padX: 0, padTop: 0, padBottom: 44, sidebar: 240 },
  t3: { padX: 56, padTop: 56, padBottom: 56 },
  t4: { padX: 44, padTop: 0, padBottom: 44, band: 150 },
  t5: { padX: 44, padTop: 40, padBottom: 44 },
  t6: { padX: 40, padTop: 40, padBottom: 44, gap: 20 },
  t7: { padX: 48, padTop: 48, padBottom: 48, avatar: 96 },
  t8: { padX: 0, padTop: 0, padBottom: 44, sidebar: 278 },
  t9: { padX: 48, padTop: 52, padBottom: 48, rail: 104 },
  t10: { padX: 44, padTop: 40, padBottom: 40, left: 216, gap: 22 },
  t11: { padX: 44, padTop: 0, padBottom: 44, band: 172, avatar: 96 }
}

/** 新增模板的专属配色 */
const EXTRA_COLORS = {
  /** 现代卡片悬浮风：页面浅灰底衬托白色卡片 */
  cardPage: '#f7f8fa',
  /** 左深右浅：深蓝侧栏 */
  deepBlue: '#1f3a5f',
  /** 数据大屏：深蓝主色与强调色 */
  screenBlue: '#0f2b46',
  screenAccent: '#4ade80',
  screenSub: '#b8c8d8',
  /** 极简网格：浅蓝标题底 */
  gridBlue: '#4a90d9'
}

/* ------------------------------------------------------------------ */
/* 块构造函数                                                          */
/* ------------------------------------------------------------------ */

function spacer (height: number): LayoutBlock {
  return { kind: 'spacer', height }
}

interface SectionTitleOptions {
  height?: number
  accent?: string
  style?: 'bar' | 'dot' | 'block' | 'plain'
  gapAfter?: number
  /** 标题文字颜色；深色侧栏上需要浅色 */
  color?: string
}

function sectionTitle (text: string, options: SectionTitleOptions = {}): LayoutBlock {
  return {
    kind: 'sectionTitle',
    text,
    height: options.height ?? 30,
    accent: options.accent ?? PALETTE.main,
    style: options.style ?? 'bar',
    color: options.color ?? PALETTE.text,
    gapAfter: options.gapAfter ?? 10
  }
}

interface ParagraphOptions {
  width: number
  fontSize?: number
  lineHeight?: number
  color?: string
  indent?: number
  gapAfter?: number
}

function paragraph (text: string, options: ParagraphOptions): LayoutBlock {
  const fontSize = options.fontSize ?? FS.body
  const lineHeight = options.lineHeight ?? Math.round(fontSize * LH)
  const lines = wrapText(text, options.width, fontSize)
  return {
    kind: 'paragraph',
    lines,
    height: Math.max(lineHeight, lines.length * lineHeight),
    lineHeight,
    fontSize,
    color: options.color ?? PALETTE.text,
    indent: options.indent ?? 0,
    gapAfter: options.gapAfter ?? 8
  }
}

interface LabelLineOptions {
  width: number
  fontSize?: number
  color?: string
  weight?: string
  align?: 'left' | 'center' | 'right'
  height?: number
  gapAfter?: number
}

function labelLine (text: string, options: LabelLineOptions): LayoutBlock {
  const fontSize = options.fontSize ?? FS.body
  return {
    kind: 'labelLine',
    text: ellipsis(text, options.width, fontSize),
    fontSize,
    color: options.color ?? PALETTE.text,
    weight: options.weight ?? 'normal',
    align: options.align ?? 'left',
    height: options.height ?? Math.round(fontSize * 1.4),
    gapAfter: options.gapAfter ?? 6
  }
}

interface RowLineOptions {
  fontSize?: number
  leftColor?: string
  rightColor?: string
  weight?: string
  height?: number
  gapAfter?: number
}

function rowLine (left: string, right: string, options: RowLineOptions = {}): LayoutBlock {
  const fontSize = options.fontSize ?? FS.body
  return {
    kind: 'rowLine',
    left,
    right,
    fontSize,
    leftColor: options.leftColor ?? PALETTE.text,
    rightColor: options.rightColor ?? PALETTE.sub,
    weight: options.weight ?? 'bold',
    height: options.height ?? Math.round(fontSize * 1.5),
    gapAfter: options.gapAfter ?? 6
  }
}

interface TripleLineOptions {
  fontSize?: number
  height?: number
  gapAfter?: number
}

function tripleLine (period: string, org: string, role: string, options: TripleLineOptions = {}): LayoutBlock {
  const fontSize = options.fontSize ?? FS.body
  return {
    kind: 'tripleLine',
    period,
    org,
    role,
    fontSize,
    height: options.height ?? Math.round(fontSize * 1.6),
    gapAfter: options.gapAfter ?? 4
  }
}

interface ContactRowOptions {
  width: number
  fontSize?: number
  color?: string
  height?: number
  gapAfter?: number
}

function contactRow (icon: string, text: string, options: ContactRowOptions): LayoutBlock {
  const fontSize = options.fontSize ?? FS.small
  return {
    kind: 'contactRow',
    icon,
    text: ellipsis(text, options.width - fontSize - 8, fontSize),
    fontSize,
    color: options.color ?? PALETTE.text,
    height: options.height ?? 24,
    gapAfter: options.gapAfter ?? 8
  }
}

interface ProgressRowOptions {
  fontSize?: number
  color?: string
  trackColor?: string
  height?: number
  gapAfter?: number
}

function progressRow (name: string, level: number, width: number, options: ProgressRowOptions = {}): LayoutBlock {
  const fontSize = options.fontSize ?? FS.small
  return {
    kind: 'progressRow',
    name: ellipsis(name, width, fontSize),
    level: Math.max(0, Math.min(100, level)),
    width,
    fontSize,
    color: options.color ?? PALETTE.main,
    trackColor: options.trackColor ?? PALETTE.line,
    height: options.height ?? 34,
    gapAfter: options.gapAfter ?? 4
  }
}

interface TagRowOptions {
  width: number
  fontSize?: number
  accent?: string
  background?: string
  height?: number
  gapAfter?: number
}

function tagRow (tags: string[], options: TagRowOptions): LayoutBlock {
  const fontSize = options.fontSize ?? FS.small
  const rowHeight = options.height ?? 34
  const padX = 10
  const gapX = 8
  const rows: Array<{ items: Array<{ text: string, width: number }> }> = []

  let current: Array<{ text: string, width: number }> = []
  let currentWidth = 0

  for (const raw of tags) {
    const text = tidy(raw)
    if (!text) continue
    const itemWidth = measureText(text, fontSize) + padX * 2
    if (currentWidth + itemWidth > options.width && current.length > 0) {
      rows.push({ items: current })
      current = []
      currentWidth = 0
    }
    current.push({ text, width: itemWidth })
    currentWidth += itemWidth + gapX
  }
  if (current.length > 0) rows.push({ items: current })

  return {
    kind: 'tagRow',
    rows,
    rowHeight,
    gapX,
    padX,
    fontSize,
    accent: options.accent ?? PALETTE.main,
    background: options.background ?? PALETTE.mainLight,
    height: Math.max(1, rows.length) * (rowHeight + 8),
    gapAfter: options.gapAfter ?? 6
  }
}

interface TableRowOptions {
  columns: Array<{ width: number, align?: 'left' | 'center' | 'right', bold?: boolean, color?: string, background?: string }>
  height?: number
  fontSize?: number
  borderColor?: string
  gapAfter?: number
}

function tableRow (cells: string[], options: TableRowOptions): LayoutBlock {
  const fontSize = options.fontSize ?? FS.body
  const rowHeight = options.height ?? 36
  const prepared = cells.map((cell, index) => {
    const col = options.columns[index] ?? { width: 0 }
    return {
      text: ellipsis(cell ?? '', Math.max(20, col.width - 20), fontSize),
      width: col.width,
      align: col.align ?? 'left',
      bold: Boolean(col.bold),
      background: col.background ?? '',
      color: col.color ?? PALETTE.text,
      fontSize
    }
  })
  return {
    kind: 'tableRow',
    cells: prepared,
    height: rowHeight,
    borderColor: options.borderColor ?? PALETTE.lineStrong,
    gapAfter: options.gapAfter ?? 0
  }
}

interface AvatarBlockOptions {
  align?: 'left' | 'center' | 'right'
  shape?: 'circle' | 'rect'
  radius?: number
  borderColor?: string
  gapAfter?: number
}

function avatarBlock (size: number, options: AvatarBlockOptions = {}): LayoutBlock {
  return {
    kind: 'avatar',
    size,
    align: options.align ?? 'left',
    shape: options.shape ?? 'circle',
    radius: options.radius ?? 8,
    borderColor: options.borderColor ?? '',
    height: size,
    gapAfter: options.gapAfter ?? 12
  }
}

/** 卡片开始块 */
function cardStart (options: {
  radius?: number
  borderColor?: string
  padding?: number
  /** 卡片填充色；不传则只描边 */
  fill?: string
  /** 是否绘制悬浮阴影 */
  shadow?: boolean
  /** 左侧强调条颜色；传空串则不绘制 */
  accent?: string
} = {}): LayoutBlock {
  return {
    kind: 'cardStart',
    radius: options.radius ?? 12,
    borderColor: options.borderColor ?? PALETTE.line,
    padding: options.padding ?? 14,
    fill: options.fill ?? '',
    shadow: options.shadow === true,
    accent: options.accent,
    height: 0,
    gapAfter: 0
  }
}

/** 卡片结束块 */
function cardEnd (gapAfter = 12): LayoutBlock {
  return { kind: 'cardEnd', height: 0, gapAfter }
}

/** 核心成果大号数字行 */
function statRow (
  stats: Array<{ value: string, label: string }>,
  width: number,
  options: { color?: string, fontSize?: number, gapAfter?: number } = {}
): LayoutBlock {
  if (stats.length === 0) return { kind: 'spacer', height: 0, gapAfter: 0 }
  const fontSize = options.fontSize ?? 32
  return {
    kind: 'statRow',
    stats,
    width,
    fontSize,
    color: options.color ?? PALETTE.main,
    height: Math.round(fontSize * 1.9),
    gapAfter: options.gapAfter ?? 18
  }
}

/** 迷你柱状图（技能水平） */
function miniBars (
  points: Array<{ label: string, value: number }>,
  width: number,
  options: { barColor?: string, gapX?: number, height?: number, gapAfter?: number } = {}
): LayoutBlock {
  if (points.length === 0) return { kind: 'spacer', height: 0, gapAfter: 0 }
  return {
    kind: 'miniBars',
    points,
    width,
    barColor: options.barColor ?? PALETTE.main,
    gapX: options.gapX ?? 12,
    height: options.height ?? 72,
    gapAfter: options.gapAfter ?? 14
  }
}

interface ExperienceBlockOptions {
  fontSize?: number
  contentFontSize?: number
  titleStyle?: 'double' | 'row' | 'triple'
  leftColor?: string
  roleColor?: string
}

/** 把一条经历拆成若干块 */
function experienceBlocks (item: ResumeExperience, width: number, options: ExperienceBlockOptions = {}): LayoutBlock[] {
  const blocks: LayoutBlock[] = []
  const titleStyle = options.titleStyle ?? 'double'

  if (titleStyle === 'triple') {
    blocks.push(tripleLine(item.period, item.org, item.role, { fontSize: options.fontSize ?? FS.body }))
  } else if (titleStyle === 'row') {
    blocks.push(rowLine(item.org, item.period, { fontSize: options.fontSize ?? FS.body, leftColor: options.leftColor }))
    if (item.role) {
      blocks.push(labelLine(item.role, {
        width,
        fontSize: FS.small,
        color: options.roleColor ?? PALETTE.main,
        gapAfter: 4
      }))
    }
  } else {
    blocks.push(rowLine(item.org || item.role, item.period, {
      fontSize: options.fontSize ?? FS.body,
      leftColor: options.leftColor
    }))
    if (item.org && item.role) {
      blocks.push(labelLine(item.role, {
        width,
        fontSize: FS.small,
        color: options.roleColor ?? PALETTE.main,
        gapAfter: 4
      }))
    }
  }

  if (item.content) {
    blocks.push(paragraph(item.content, {
      width,
      fontSize: options.contentFontSize ?? FS.small,
      color: PALETTE.text,
      gapAfter: 0
    }))
  }

  return blocks
}

/* ------------------------------------------------------------------ */
/* 堆叠器                                                              */
/* ------------------------------------------------------------------ */

interface Stack {
  blocks: LayoutBlock[]
  push: (block: LayoutBlock) => LayoutBlock
  pushAll: (list: LayoutBlock[]) => void
  blank: (height: number) => void
  height: () => number
}

function createStack (): Stack {
  const blocks: LayoutBlock[] = []
  let y = 0
  return {
    blocks,
    push (block) {
      blocks.push(block)
      y += (block.height ?? 0) + (block.gapAfter ?? 0)
      return block
    },
    pushAll (list) {
      list.forEach((block) => this.push(block))
    },
    blank (height) {
      this.push(spacer(height))
    },
    height () {
      return y
    }
  }
}

/* ------------------------------------------------------------------ */
/* 模板布局                                                            */
/* ------------------------------------------------------------------ */

/** T1 经典表格型：顶部深绿通栏 + 左 28% / 右 72% */
function layoutT1 (model: ResumeModel): LayoutResult {
  const m = METRICS.t1
  const headerHeight = 74
  const inner = CANVAS_W - m.padX * 2
  const leftWidth = Math.round(inner * 0.28)
  const rightWidth = inner - leftWidth - 20
  const leftX = m.padX
  const rightX = m.padX + leftWidth + 20

  const left = createStack()
  if (model.visibility.avatar) left.push(avatarBlock(110, { gapAfter: 14 }))
  // 未填写联系方式时不渲染该模块，避免留下空标题
  if (model.visibility.contacts) {
    left.push(sectionTitle('联系方式', { style: 'plain', accent: PALETTE.mainDark, height: 26, gapAfter: 6 }))
    model.contacts.forEach((item) => {
      left.push(contactRow(item.icon, item.value, { width: leftWidth, fontSize: FS.tiny }))
    })
  }
  if (model.visibility.skills) {
    left.push(sectionTitle('技能证书', { style: 'plain', accent: PALETTE.mainDark, height: 26, gapAfter: 6 }))
    model.skills.forEach((skill) => {
      left.push(progressRow(skill.name, skill.level, leftWidth, { fontSize: FS.tiny, color: PALETTE.mainDark }))
    })
  }
  if (model.visibility.awards) {
    left.push(sectionTitle('获奖情况', { style: 'plain', accent: PALETTE.mainDark, height: 26, gapAfter: 6 }))
    left.push(paragraph(model.awards.join('\n'), { width: leftWidth, fontSize: FS.tiny, gapAfter: 0 }))
  }

  const right = createStack()
  const groups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work },
    { list: model.project, visible: model.visibility.project }
  ]
  groups.forEach((group, index) => {
    if (!group.visible) return
    if (index > 0) right.blank(4)
    right.push(sectionTitle(group.list[0].typeLabel, { style: 'plain', accent: PALETTE.mainDark, height: 30, gapAfter: 10 }))
    group.list.forEach((item) => {
      right.pushAll(experienceBlocks(item, rightWidth, { titleStyle: 'double' }))
      right.blank(8)
    })
  })
  if (model.visibility.summary) {
    right.push(sectionTitle('自我评价', { style: 'plain', accent: PALETTE.mainDark, height: 30, gapAfter: 10 }))
    right.push(paragraph(model.summary, { width: rightWidth, fontSize: FS.small, gapAfter: 0 }))
  }

  const contentTop = headerHeight + 32
  const bodyHeight = Math.max(left.height(), right.height())

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, contentTop + bodyHeight + m.padBottom),
    background: PALETTE.white,
    decorations: [
      { kind: 'bar', x: 0, y: 0, w: CANVAS_W, h: headerHeight, color: PALETTE.mainDark },
      { kind: 'text', x: m.padX, y: headerHeight / 2 + 12, text: model.name || '个人简历', fontSize: 26, color: PALETTE.white, weight: 'bold' },
      { kind: 'text', x: CANVAS_W - m.padX, y: headerHeight / 2 + 9, text: model.jobIntention, fontSize: 18, color: '#d8ede3', align: 'right' },
      { kind: 'line', x: rightX - 10, y: contentTop - 16, w: 1, h: bodyHeight + 8, color: PALETTE.line }
    ],
    columns: [
      { x: leftX, y: contentTop, width: leftWidth, blocks: left.blocks },
      { x: rightX, y: contentTop, width: rightWidth, blocks: right.blocks }
    ],
    bottomPadding: m.padBottom,
    templateId: 't1'
  }
}

/** T2 左右分栏型：左侧灰底 240px */
function layoutT2 (model: ResumeModel): LayoutResult {
  const m = METRICS.t2
  const sidebarWidth = m.sidebar
  const sidePadX = 24
  const sideInner = sidebarWidth - sidePadX * 2
  const mainX = sidebarWidth + 32
  const mainWidth = CANVAS_W - mainX - 40

  const side = createStack()
  if (model.visibility.avatar) side.push(avatarBlock(120, { align: 'center', gapAfter: 16 }))
  side.push(labelLine(model.name || '姓名', {
    width: sideInner, fontSize: FS.nameM, weight: 'bold', align: 'center', gapAfter: 6
  }))
  if (model.jobIntention) {
    side.push(labelLine(model.jobIntention, {
      width: sideInner, fontSize: FS.small, color: PALETTE.main, weight: 'bold', align: 'center', gapAfter: 18
    }))
  }
  if (model.visibility.contacts) {
    side.push(sectionTitle('联系方式', { style: 'dot', height: 28, gapAfter: 8 }))
    model.contacts.forEach((item) => {
      side.push(contactRow(item.icon, item.value, { width: sideInner, fontSize: FS.tiny }))
    })
  }
  if (model.visibility.infoRows) {
    side.push(sectionTitle('基本信息', { style: 'dot', height: 28, gapAfter: 8 }))
    model.infoRows.forEach((row) => {
      side.push({
        kind: 'fieldPair',
        label: row.label,
        value: ellipsis(row.value, sideInner - 62, FS.tiny),
        labelWidth: 62,
        fontSize: FS.tiny,
        height: 26,
        gapAfter: 2
      })
    })
  }
  if (model.visibility.skills) {
    side.push(sectionTitle('技能证书', { style: 'dot', height: 28, gapAfter: 8 }))
    model.skills.forEach((skill) => {
      side.push(progressRow(skill.name, skill.level, sideInner, { fontSize: FS.tiny }))
    })
  }

  const main = createStack()
  main.blank(24)
  const groups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work },
    { list: model.project, visible: model.visibility.project }
  ]
  groups.forEach((group, index) => {
    if (!group.visible) return
    if (index > 0) main.blank(8)
    main.push(sectionTitle(group.list[0].typeLabel, { style: 'bar', height: 30, gapAfter: 12 }))
    group.list.forEach((item) => {
      main.pushAll(experienceBlocks(item, mainWidth, { titleStyle: 'row' }))
      main.blank(10)
    })
  })
  if (model.visibility.awards) {
    main.push(sectionTitle('获奖情况', { style: 'bar', height: 30, gapAfter: 12 }))
    model.awards.forEach((line) => {
      main.push(paragraph(`· ${line}`, { width: mainWidth, fontSize: FS.small, gapAfter: 4 }))
    })
  }
  if (model.visibility.summary) {
    main.push(sectionTitle('自我评价', { style: 'bar', height: 30, gapAfter: 12 }))
    main.push(paragraph(model.summary, { width: mainWidth, fontSize: FS.small, gapAfter: 0 }))
  }

  const bodyHeight = Math.max(24 + side.height() + 32, main.height())

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, bodyHeight + m.padBottom),
    background: PALETTE.white,
    decorations: [{ kind: 'bar', x: 0, y: 0, w: sidebarWidth, h: bodyHeight, color: PALETTE.side }],
    columns: [
      { x: sidePadX, y: 24, width: sideInner, blocks: side.blocks },
      { x: mainX, y: 0, width: mainWidth, blocks: main.blocks }
    ],
    bottomPadding: m.padBottom,
    templateId: 't2'
  }
}

/** T3 极简白底型 */
function layoutT3 (model: ResumeModel): LayoutResult {
  const m = METRICS.t3
  const inner = CANVAS_W - m.padX * 2
  const stack = createStack()

  stack.push(labelLine(model.name || '姓名', {
    width: inner, fontSize: FS.nameXL, weight: 'bold', height: Math.round(FS.nameXL * 1.35), gapAfter: 4
  }))
  if (model.jobIntention) {
    stack.push(labelLine(model.jobIntention, {
      width: inner, fontSize: FS.section, color: PALETTE.main, weight: 'bold', gapAfter: 10
    }))
  }
  if (model.visibility.contacts) {
    stack.push(paragraph(model.contacts.map((item) => item.value).join('    '), {
      width: inner, fontSize: FS.small, color: PALETTE.sub, gapAfter: 2
    }))
  }
  if (model.visibility.infoRows) {
    stack.push(paragraph(model.infoRows.map((row) => `${row.label}：${row.value}`).join('    '), {
      width: inner, fontSize: FS.small, color: PALETTE.sub, gapAfter: 0
    }))
  }

  stack.blank(14)
  stack.push({ kind: 'rule', height: 2, color: PALETTE.text, gapAfter: 22 })

  const groups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work },
    { list: model.project, visible: model.visibility.project }
  ]
  groups.forEach((group, index) => {
    if (!group.visible) return
    if (index > 0) stack.blank(10)
    stack.push(sectionTitle(group.list[0].typeLabel, { height: 30, gapAfter: 12 }))
    group.list.forEach((item) => {
      stack.pushAll(experienceBlocks(item, inner, { titleStyle: 'double' }))
      stack.blank(10)
    })
  })

  if (model.visibility.skills) {
    stack.push(sectionTitle('技能证书', { height: 30, gapAfter: 12 }))
    stack.push(tagRow(model.skills.map((skill) => skill.name), { width: inner, fontSize: FS.small }))
  }
  if (model.visibility.awards) {
    stack.push(sectionTitle('获奖情况', { height: 30, gapAfter: 12 }))
    model.awards.forEach((line) => {
      stack.push(paragraph(`· ${line}`, { width: inner, fontSize: FS.small, gapAfter: 4 }))
    })
  }
  if (model.visibility.summary) {
    stack.push(sectionTitle('自我评价', { height: 30, gapAfter: 12 }))
    stack.push(paragraph(model.summary, { width: inner, fontSize: FS.small, gapAfter: 0 }))
  }

  const columns: LayoutColumn[] = [{ x: m.padX, y: m.padTop, width: inner, blocks: stack.blocks }]
  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - 96,
      y: 40,
      width: 96,
      blocks: [avatarBlock(96, { align: 'right', gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, m.padTop + stack.height() + m.padBottom),
    background: PALETTE.white,
    decorations: [],
    columns,
    bottomPadding: m.padBottom,
    templateId: 't3'
  }
}

/** T4 商务横带型 */
function layoutT4 (model: ResumeModel): LayoutResult {
  const m = METRICS.t4
  const bandHeight = m.band
  const inner = CANVAS_W - m.padX * 2
  const avatarSize = 108
  const stack = createStack()

  if (model.visibility.contacts) {
    stack.push(tagRow(model.contacts.map((item) => item.value), { width: inner, fontSize: FS.small, gapAfter: 10 }))
  }

  const groups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work },
    { list: model.project, visible: model.visibility.project }
  ]
  groups.forEach((group, index) => {
    if (!group.visible) return
    if (index > 0) stack.blank(8)
    stack.push(sectionTitle(group.list[0].typeLabel, { style: 'plain', height: 30, gapAfter: 10 }))
    group.list.forEach((item) => {
      stack.pushAll(experienceBlocks(item, inner, { titleStyle: 'triple', contentFontSize: FS.small }))
      stack.blank(10)
    })
  })

  if (model.visibility.skills) {
    const itemWidth = Math.round((inner - 24) / 2)
    stack.push(sectionTitle('技能证书', { style: 'plain', height: 30, gapAfter: 10 }))
    for (let i = 0; i < Math.ceil(model.skills.length / 2); i += 1) {
      const pair = model.skills.slice(i * 2, i * 2 + 2).map((skill) => ({
        name: ellipsis(skill.name, itemWidth, FS.tiny),
        level: skill.level
      }))
      stack.push({
        kind: 'progressPair',
        items: pair,
        itemWidth,
        gapX: 24,
        fontSize: FS.tiny,
        color: PALETTE.main,
        trackColor: PALETTE.line,
        height: 32,
        gapAfter: 4
      })
    }
  }
  if (model.visibility.awards) {
    stack.push(sectionTitle('获奖情况', { style: 'plain', height: 30, gapAfter: 10 }))
    model.awards.forEach((line) => {
      stack.push(paragraph(`· ${line}`, { width: inner, fontSize: FS.small, gapAfter: 4 }))
    })
  }
  if (model.visibility.summary) {
    stack.push(sectionTitle('自我评价', { style: 'plain', height: 30, gapAfter: 10 }))
    stack.push(paragraph(model.summary, { width: inner, fontSize: FS.small, gapAfter: 0 }))
  }

  const contentTop = bandHeight + 24
  const decorations: LayoutDecoration[] = [
    { kind: 'bar', x: 0, y: 0, w: CANVAS_W, h: bandHeight, color: '#d6ede1' },
    { kind: 'bar', x: 0, y: bandHeight - 4, w: CANVAS_W, h: 4, color: PALETTE.main },
    { kind: 'text', x: m.padX, y: 66, text: model.name || '姓名', fontSize: FS.nameL, color: PALETTE.text, weight: 'bold' },
    { kind: 'text', x: m.padX, y: 104, text: model.jobIntention, fontSize: FS.section, color: PALETTE.mainDark, weight: 'bold' },
    { kind: 'text', x: m.padX, y: 132, text: model.city, fontSize: FS.tiny, color: PALETTE.sub }
  ]

  const columns: LayoutColumn[] = [{ x: m.padX, y: contentTop, width: inner, blocks: stack.blocks }]
  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - avatarSize,
      y: 24,
      width: avatarSize,
      blocks: [avatarBlock(avatarSize, { align: 'center', borderColor: PALETTE.white, gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, contentTop + stack.height() + m.padBottom),
    background: PALETTE.white,
    decorations,
    columns,
    bottomPadding: m.padBottom,
    templateId: 't4'
  }
}

/** T5 表格网格型 */
function layoutT5 (model: ResumeModel): LayoutResult {
  const m = METRICS.t5
  const inner = CANVAS_W - m.padX * 2
  const stack = createStack()
  const headHeight = 68

  stack.blank(24)

  const infoPairs = model.infoRows.map((row) => ({ label: row.label, value: row.value }))
  const infoRows: Array<Array<{ label: string, value: string }>> = []
  for (let i = 0; i < infoPairs.length; i += 3) {
    infoRows.push(infoPairs.slice(i, i + 3))
  }

  const colWidth = Math.round(inner / 3)
  const tableColumns = [
    { width: colWidth, align: 'left' as const },
    { width: colWidth, align: 'left' as const },
    { width: inner - colWidth * 2, align: 'left' as const }
  ]

  const pushTableTitle = (text: string) => {
    stack.push({
      kind: 'tableTitle',
      text,
      height: 36,
      fontSize: FS.body,
      color: PALETTE.white,
      background: PALETTE.grid,
      width: inner,
      gapAfter: 0
    })
  }

  if (model.visibility.infoRows) {
    pushTableTitle('基本信息')
    if (model.visibility.avatar) {
      stack.push({
        kind: 'tableAvatarRow',
        size: 72,
        labelWidth: colWidth,
        width: inner,
        fontSize: FS.small,
        borderColor: PALETTE.lineStrong,
        height: 86,
        gapAfter: 0
      })
    }
    infoRows.forEach((row) => {
      const cells = row.map((pair) => `${pair.label}：${pair.value}`)
      while (cells.length < 3) cells.push('')
      stack.push(tableRow(cells, { columns: tableColumns, height: 38 }))
    })
  }

  const groups = [
    { key: 'education' as const, label: '教育经历', visible: model.visibility.education },
    { key: 'work' as const, label: '工作 / 实习经历', visible: model.visibility.work },
    { key: 'project' as const, label: '项目经历', visible: model.visibility.project }
  ]

  const spanColumns = [
    { width: Math.round(inner * 0.3), align: 'left' as const, bold: true },
    { width: Math.round(inner * 0.28), align: 'left' as const },
    { width: inner - Math.round(inner * 0.3) - Math.round(inner * 0.28), align: 'left' as const }
  ]

  groups.forEach((group) => {
    if (!group.visible) return
    pushTableTitle(group.label)
    model[group.key].forEach((item) => {
      stack.push(tableRow([item.period, item.org, item.role], { columns: spanColumns, height: 36 }))
      if (item.content) {
        const lineHeight = Math.round(FS.small * LH)
        const lines = wrapText(item.content, inner - 20, FS.small)
        stack.push({
          kind: 'tableContentRow',
          lines,
          lineHeight,
          fontSize: FS.small,
          width: inner,
          color: PALETTE.text,
          borderColor: PALETTE.lineStrong,
          height: Math.max(lineHeight, lines.length * lineHeight) + 12,
          gapAfter: 0
        })
      }
    })
  })

  const tailSections: Array<{ title: string, rows: string[][] }> = []
  if (model.visibility.skills) {
    tailSections.push({
      title: '技能证书',
      rows: model.skills.map((skill) => [skill.name, `${skill.level}%`])
    })
  }
  if (model.visibility.awards) {
    tailSections.push({
      title: '获奖情况',
      rows: model.awards.map((line, index) => [`${index + 1}`, line])
    })
  }

  tailSections.forEach((section) => {
    pushTableTitle(section.title)
    const twoColumns = [
      { width: Math.round(inner * 0.34), align: 'left' as const },
      { width: inner - Math.round(inner * 0.34), align: 'left' as const }
    ]
    section.rows.forEach((row) => {
      stack.push(tableRow(row, { columns: twoColumns, height: 36 }))
    })
  })

  if (model.visibility.summary) {
    pushTableTitle('自我评价')
    const lineHeight = Math.round(FS.small * LH)
    const lines = wrapText(model.summary, inner - 20, FS.small)
    stack.push({
      kind: 'tableContentRow',
      lines,
      lineHeight,
      fontSize: FS.small,
      width: inner,
      color: PALETTE.text,
      borderColor: PALETTE.lineStrong,
      height: Math.max(lineHeight, lines.length * lineHeight) + 12,
      gapAfter: 0
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, headHeight + m.padTop + stack.height() + m.padBottom),
    background: PALETTE.white,
    decorations: [
      { kind: 'bar', x: 0, y: 0, w: CANVAS_W, h: headHeight, color: PALETTE.grid },
      { kind: 'text', x: m.padX, y: headHeight / 2 + 9, text: model.name || '个人简历', fontSize: 24, color: PALETTE.white, weight: 'bold' },
      { kind: 'text', x: CANVAS_W - m.padX, y: headHeight / 2 + 6, text: model.jobIntention, fontSize: 15, color: '#dce6f2', align: 'right' }
    ],
    columns: [{ x: m.padX, y: m.padTop + headHeight, width: inner, blocks: stack.blocks }],
    bottomPadding: m.padBottom,
    templateId: 't5'
  }
}

/** T6 作品集宽型：两列卡片流 */
function layoutT6 (model: ResumeModel): LayoutResult {
  const m = METRICS.t6
  const inner = CANVAS_W - m.padX * 2
  const gap = m.gap
  const leftWidth = Math.round((inner - gap) * 0.58)
  const rightWidth = inner - gap - leftWidth
  const headerTop = m.padTop
  const headerHeight = 132

  const header = createStack()
  header.push(rowLine(model.name || '姓名', model.jobIntention, {
    fontSize: FS.nameL, leftColor: PALETTE.text, rightColor: PALETTE.warm, gapAfter: 6
  }))
  if (model.visibility.contacts) {
    header.push(paragraph(model.contacts.map((item) => item.value).join('    '), {
      width: inner - 120, fontSize: FS.small, color: PALETTE.sub, gapAfter: 0
    }))
  }

  const left = createStack()
  const leftGroups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work }
  ]
  leftGroups.forEach((group, index) => {
    if (!group.visible) return
    if (index > 0) left.blank(12)
    left.push(sectionTitle(group.list[0].typeLabel, { style: 'block', accent: PALETTE.warm, height: 34, gapAfter: 10 }))
    group.list.forEach((item) => {
      left.push(cardStart({ borderColor: PALETTE.line, padding: 0 }))
      left.pushAll(experienceBlocks(item, leftWidth - 28, {
        titleStyle: 'row', leftColor: PALETTE.text, roleColor: PALETTE.warm, contentFontSize: FS.tiny
      }))
      left.push(cardEnd(12))
    })
  })

  const right = createStack()
  if (model.visibility.project) {
    right.push(sectionTitle('项目经历', { style: 'block', accent: PALETTE.warm, height: 34, gapAfter: 10 }))
    model.project.forEach((item) => {
      right.push(cardStart({ borderColor: PALETTE.line, padding: 0 }))
      right.pushAll(experienceBlocks(item, rightWidth - 28, {
        titleStyle: 'row', leftColor: PALETTE.text, roleColor: PALETTE.warm, contentFontSize: FS.tiny
      }))
      right.push(cardEnd(12))
    })
  }
  if (model.visibility.skills) {
    right.push(sectionTitle('技能证书', { style: 'block', accent: PALETTE.warm, height: 34, gapAfter: 10 }))
    model.skills.forEach((skill) => {
      right.push(progressRow(skill.name, skill.level, rightWidth, {
        fontSize: FS.tiny, color: PALETTE.warm, trackColor: '#f0e4da'
      }))
    })
  }
  if (model.visibility.awards) {
    right.push(sectionTitle('获奖情况', { style: 'block', accent: PALETTE.warm, height: 34, gapAfter: 10 }))
    right.push(tagRow(model.awards, { width: rightWidth, fontSize: FS.tiny, accent: PALETTE.warm, background: PALETTE.warmLight }))
  }
  if (model.visibility.summary) {
    right.push(cardStart({ borderColor: PALETTE.line, padding: 0 }))
    right.push(labelLine('自我评价', { width: rightWidth - 28, fontSize: FS.small, color: PALETTE.warm, weight: 'bold', gapAfter: 6 }))
    right.push(paragraph(model.summary, { width: rightWidth - 28, fontSize: FS.tiny, gapAfter: 0 }))
    right.push(cardEnd(0))
  }

  const contentTop = headerTop + headerHeight
  const columns: LayoutColumn[] = [
    { x: m.padX, y: headerTop, width: inner - 120, blocks: header.blocks },
    { x: m.padX, y: contentTop, width: leftWidth, blocks: left.blocks },
    { x: m.padX + leftWidth + gap, y: contentTop, width: rightWidth, blocks: right.blocks }
  ]

  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - 100,
      y: headerTop,
      width: 100,
      blocks: [avatarBlock(100, { align: 'right', gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, contentTop + Math.max(left.height(), right.height()) + m.padBottom),
    background: PALETTE.white,
    decorations: [{ kind: 'bar', x: 0, y: 0, w: CANVAS_W, h: 6, color: PALETTE.warm }],
    columns,
    bottomPadding: m.padBottom,
    templateId: 't6'
  }
}

/* ------------------------------------------------------------------ */
/* 新增模板                                                            */
/* ------------------------------------------------------------------ */

/** 头部信息块（姓名 / 岗位 / 联系方式 / 基本信息），多套模板共用 */
function pushHeader (
  stack: Stack,
  model: ResumeModel,
  width: number,
  options: { nameSize?: number, nameColor?: string, subColor?: string, align?: 'left' | 'center' } = {}
): void {
  const align = options.align ?? 'left'

  stack.push(labelLine(model.name || '姓名', {
    width,
    fontSize: options.nameSize ?? FS.nameL,
    weight: 'bold',
    color: options.nameColor ?? PALETTE.text,
    align,
    height: Math.round((options.nameSize ?? FS.nameL) * 1.3),
    gapAfter: 6
  }))

  if (model.jobIntention) {
    stack.push(labelLine(model.jobIntention, {
      width,
      fontSize: FS.section,
      color: options.subColor ?? PALETTE.main,
      weight: 'bold',
      align,
      gapAfter: 10
    }))
  }

  if (model.visibility.contacts) {
    stack.push(paragraph(model.contacts.map((item) => item.value).join('    '), {
      width,
      fontSize: FS.small,
      color: PALETTE.sub,
      gapAfter: 2
    }))
  }

  if (model.visibility.infoRows) {
    stack.push(paragraph(model.infoRows.map((row) => `${row.label}：${row.value}`).join('    '), {
      width,
      fontSize: FS.small,
      color: PALETTE.sub,
      gapAfter: 0
    }))
  }
}

/** 经历分组（按可见性过滤，空模块不占位） */
function experienceGroups (model: ResumeModel): Array<{ list: ResumeExperience[], label: string }> {
  const groups = [
    { list: model.education, visible: model.visibility.education },
    { list: model.work, visible: model.visibility.work },
    { list: model.project, visible: model.visibility.project }
  ]

  return groups
    .filter((group) => group.visible && group.list.length > 0)
    .map((group) => ({ list: group.list, label: group.list[0].typeLabel }))
}

/** 尾部通用模块（技能 / 获奖 / 自评） */
function pushTail (
  stack: Stack,
  model: ResumeModel,
  width: number,
  options: { titleStyle?: SectionTitleOptions['style'], accent?: string, titleColor?: string, gapAfter?: number } = {}
): void {
  const titleOptions = {
    height: 30,
    gapAfter: options.gapAfter ?? 12,
    style: options.titleStyle,
    accent: options.accent,
    color: options.titleColor
  }

  if (model.visibility.skills) {
    stack.push(sectionTitle('技能证书', titleOptions))
    stack.push(tagRow(model.skills.map((skill) => skill.name), {
      width,
      fontSize: FS.small,
      gapAfter: options.gapAfter ?? 12
    }))
  }

  if (model.visibility.awards) {
    stack.push(sectionTitle('获奖情况', titleOptions))
    model.awards.forEach((line) => {
      stack.push(paragraph(`· ${line}`, { width, fontSize: FS.small, gapAfter: 4 }))
    })
    stack.blank(8)
  }

  if (model.visibility.summary) {
    stack.push(sectionTitle('自我评价', titleOptions))
    stack.push(paragraph(model.summary, { width, fontSize: FS.small, gapAfter: 0 }))
  }
}

/**
 * T7 现代卡片悬浮风。
 * 浅灰页面底衬托白色卡片，模块标题用主色粗竖条，头像右上圆形悬浮。
 */
function layoutT7 (model: ResumeModel): LayoutResult {
  const m = METRICS.t7
  const inner = CANVAS_W - m.padX * 2
  const stack = createStack()

  const groups = experienceGroups(model)

  pushHeader(stack, model, inner, { nameSize: FS.nameL })
  stack.blank(22)

  groups.forEach((group) => {
    stack.push(sectionTitle(group.label, { height: 30, gapAfter: 14 }))
    group.list.forEach((item) => {
      // 白色卡片 + 轻微阴影，内容与卡片边缘留 16 内边距
      stack.push(cardStart({
        fill: PALETTE.white,
        shadow: true,
        padding: 16,
        borderColor: '',
        accent: '',
        radius: 14
      }))
      stack.pushAll(experienceBlocks(item, inner, { titleStyle: 'row' }))
      stack.push(cardEnd(16))
    })
  })

  pushTail(stack, model, inner, { accent: PALETTE.main, gapAfter: 14 })

  const columns: LayoutColumn[] = [{ x: m.padX, y: m.padTop, width: inner, blocks: stack.blocks }]

  // 右上角圆形头像
  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - m.avatar,
      y: m.padTop - 4,
      width: m.avatar,
      blocks: [avatarBlock(m.avatar, { align: 'right', gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, m.padTop + stack.height() + m.padBottom),
    background: EXTRA_COLORS.cardPage,
    decorations: [],
    columns,
    bottomPadding: m.padBottom,
    templateId: 't7'
  }
}

/**
 * T8 左深右浅经典分栏。
 * 左侧 35% 深蓝底白字放头像与基本信息，右侧 65% 白底放经历，标题带深蓝下划线。
 */
function layoutT8 (model: ResumeModel): LayoutResult {
  const m = METRICS.t8
  const sidebar = m.sidebar
  const sidePad = 32
  const sideInner = sidebar - sidePad * 2
  const rightX = sidebar + 44
  const rightInner = CANVAS_W - rightX - 44
  const padTop = 56

  const side = createStack()
  const right = createStack()

  // 左侧：头像 + 姓名 + 岗位 + 联系方式 + 技能
  if (model.visibility.avatar) {
    side.push(avatarBlock(116, {
      align: 'center',
      shape: 'circle',
      borderColor: '#ffffff',
      gapAfter: 20
    }))
  }

  side.push(labelLine(model.name || '姓名', {
    width: sideInner, fontSize: FS.nameM, weight: 'bold',
    color: '#ffffff', align: 'center', height: Math.round(FS.nameM * 1.3), gapAfter: 8
  }))

  if (model.jobIntention) {
    side.push(labelLine(model.jobIntention, {
      width: sideInner, fontSize: FS.small, color: '#a9c6e8', align: 'center', gapAfter: 22
    }))
  }

  if (model.visibility.contacts) {
    side.push(sectionTitle('联系方式', {
      height: 28, accent: '#4a90d9', style: 'bar', color: '#ffffff', gapAfter: 10
    }))
    model.contacts.forEach((contact) => {
      side.push(paragraph(contact.value, {
        width: sideInner, fontSize: FS.small, color: '#cfe0f2', gapAfter: 6
      }))
    })
    side.blank(10)
  }

  if (model.visibility.skills) {
    side.push(sectionTitle('技能证书', {
      height: 28, accent: '#4a90d9', style: 'bar', color: '#ffffff', gapAfter: 10
    }))
    model.skills.forEach((skill) => {
      side.push(progressRow(skill.name, skill.level, sideInner, {
        fontSize: FS.small,
        color: '#4a90d9',
        trackColor: 'rgba(255,255,255,0.18)',
        gapAfter: 10
      }))
    })
  }

  if (model.visibility.infoRows) {
    side.push(sectionTitle('基本信息', {
      height: 28, accent: '#4a90d9', style: 'bar', color: '#ffffff', gapAfter: 10
    }))
    model.infoRows.forEach((row) => {
      side.push(paragraph(`${row.label}：${row.value}`, {
        width: sideInner, fontSize: FS.small, color: '#cfe0f2', gapAfter: 6
      }))
    })
  }

  // 右侧：经历 + 获奖 + 自评，标题带深蓝下划线
  const groups = experienceGroups(model)
  groups.forEach((group) => {
    right.push(sectionTitle(group.label, {
      height: 32, style: 'plain', accent: EXTRA_COLORS.deepBlue, gapAfter: 14
    }))
    group.list.forEach((item) => {
      right.pushAll(experienceBlocks(item, rightInner, { titleStyle: 'double' }))
      right.blank(12)
    })
  })

  if (model.visibility.awards) {
    right.push(sectionTitle('获奖情况', {
      height: 32, style: 'plain', accent: EXTRA_COLORS.deepBlue, gapAfter: 14
    }))
    model.awards.forEach((line) => {
      right.push(paragraph(`· ${line}`, { width: rightInner, fontSize: FS.small, gapAfter: 4 }))
    })
    right.blank(8)
  }

  if (model.visibility.summary) {
    right.push(sectionTitle('自我评价', {
      height: 32, style: 'plain', accent: EXTRA_COLORS.deepBlue, gapAfter: 14
    }))
    right.push(paragraph(model.summary, { width: rightInner, fontSize: FS.small, gapAfter: 0 }))
  }

  const contentHeight = Math.max(side.height() + padTop * 2, right.height() + padTop * 2)
  const canvasH = Math.max(CANVAS_H, contentHeight + m.padBottom)

  return {
    canvasW: CANVAS_W,
    canvasH,
    background: PALETTE.white,
    decorations: [
      // 左侧深蓝通栏背景
      { kind: 'bar', x: 0, y: 0, w: sidebar, h: canvasH, color: EXTRA_COLORS.deepBlue }
    ],
    columns: [
      { x: sidePad, y: padTop, width: sideInner, blocks: side.blocks },
      { x: rightX, y: padTop, width: rightInner, blocks: right.blocks }
    ],
    bottomPadding: m.padBottom,
    templateId: 't8'
  }
}

/**
 * T9 时间轴串联风。
 * 左侧固定日期轴竖线贯穿，右侧内容卡片，经历按时间倒序串联。
 */
function layoutT9 (model: ResumeModel): LayoutResult {
  const m = METRICS.t9
  const railX = m.padX + 8
  const contentX = m.padX + m.rail
  const inner = CANVAS_W - contentX - m.padX
  const headerStack = createStack()
  const stack = createStack()

  pushHeader(headerStack, model, CANVAS_W - m.padX * 2, { nameSize: FS.nameL })

  const decorations: LayoutDecoration[] = []
  const groups = experienceGroups(model)

  let firstY = -1
  let lastY = -1

  groups.forEach((group) => {
    stack.push(sectionTitle(group.label, { height: 30, gapAfter: 16 }))

    group.list.forEach((item) => {
      const itemY = m.padTop + headerStack.height() + 22 + stack.height()
      if (firstY < 0) firstY = itemY
      lastY = itemY + 44

      // 日期轴上的节点与日期文字
      decorations.push({ kind: 'dot', x: railX, y: itemY + 9, radius: 5, color: PALETTE.main })
      if (item.period) {
        decorations.push({
          kind: 'text',
          x: railX - 14,
          y: itemY + 14,
          text: item.period,
          fontSize: FS.tiny,
          color: PALETTE.sub,
          align: 'right'
        })
      }

      stack.pushAll(experienceBlocks(item, inner, { titleStyle: 'double' }))
      stack.blank(20)
    })
  })

  // 贯穿竖线：连接首尾经历
  if (firstY >= 0) {
    decorations.unshift({
      kind: 'bar',
      x: railX - 1,
      y: firstY + 12,
      w: 2,
      h: Math.max(4, lastY - firstY - 12),
      color: PALETTE.mainLight
    })
  }

  pushTail(stack, model, inner, { accent: PALETTE.main, gapAfter: 14 })

  const columns: LayoutColumn[] = [
    { x: m.padX, y: m.padTop, width: CANVAS_W - m.padX * 2, blocks: headerStack.blocks },
    { x: contentX, y: m.padTop + headerStack.height() + 22, width: inner, blocks: stack.blocks }
  ]

  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - 88,
      y: m.padTop - 4,
      width: 88,
      blocks: [avatarBlock(88, { align: 'right', gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH: Math.max(CANVAS_H, m.padTop + headerStack.height() + 22 + stack.height() + m.padBottom),
    background: PALETTE.white,
    decorations,
    columns,
    bottomPadding: m.padBottom,
    templateId: 't9'
  }
}

/**
 * T10 极简网格型。
 * 浅蓝模块标题底，两列网格（左 30% 技能标签云，右 70% 经历），强制收敛在一页内。
 */
function layoutT10 (model: ResumeModel): LayoutResult {
  const m = METRICS.t10
  const leftWidth = m.left
  const rightX = m.padX + leftWidth + m.gap
  const rightWidth = CANVAS_W - m.padX - rightX
  const head = createStack()
  const left = createStack()
  const right = createStack()

  pushHeader(head, model, CANVAS_W - m.padX * 2, { nameSize: FS.nameL })
  head.push({ kind: 'rule', height: 2, color: PALETTE.text, gapAfter: 24 })

  const headHeight = head.height()

  // 左列：技能标签云 + 基本信息
  if (model.visibility.skills) {
    left.push(sectionTitle('技能证书', {
      height: 30, style: 'block', accent: EXTRA_COLORS.gridBlue, gapAfter: 14
    }))
    left.push(tagRow(model.skills.map((skill) => skill.name), {
      width: leftWidth, fontSize: FS.tiny, gapAfter: 18
    }))
  }

  if (model.visibility.infoRows) {
    left.push(sectionTitle('基本信息', {
      height: 30, style: 'block', accent: EXTRA_COLORS.gridBlue, gapAfter: 14
    }))
    model.infoRows.forEach((row) => {
      left.push(paragraph(`${row.label}：${row.value}`, {
        width: leftWidth, fontSize: FS.tiny, color: PALETTE.sub, gapAfter: 6
      }))
    })
  }

  if (model.visibility.awards) {
    left.push(sectionTitle('获奖情况', {
      height: 30, style: 'block', accent: EXTRA_COLORS.gridBlue, gapAfter: 14
    }))
    model.awards.forEach((line) => {
      left.push(paragraph(`· ${line}`, { width: leftWidth, fontSize: FS.tiny, gapAfter: 6 }))
    })
  }

  // 右列：经历 + 自评
  const groups = experienceGroups(model)
  groups.forEach((group) => {
    right.push(sectionTitle(group.label, {
      height: 30, style: 'block', accent: EXTRA_COLORS.gridBlue, gapAfter: 14
    }))
    group.list.forEach((item) => {
      right.pushAll(experienceBlocks(item, rightWidth, {
        titleStyle: 'row',
        fontSize: FS.small,
        contentFontSize: FS.tiny
      }))
      right.blank(12)
    })
  })

  if (model.visibility.summary) {
    right.push(sectionTitle('自我评价', {
      height: 30, style: 'block', accent: EXTRA_COLORS.gridBlue, gapAfter: 14
    }))
    right.push(paragraph(model.summary, { width: rightWidth, fontSize: FS.tiny, gapAfter: 0 }))
  }

  const bodyTop = m.padTop + headHeight
  const bodyHeight = Math.max(left.height(), right.height())

  // 强制一页：内容超出时收敛到画布高度，由导出分页处理
  const canvasH = Math.min(
    Math.max(CANVAS_H, bodyTop + bodyHeight + m.padBottom),
    CANVAS_H
  )

  const columns: LayoutColumn[] = [
    { x: m.padX, y: m.padTop, width: CANVAS_W - m.padX * 2, blocks: head.blocks },
    { x: m.padX, y: bodyTop, width: leftWidth, blocks: left.blocks },
    { x: rightX, y: bodyTop, width: rightWidth, blocks: right.blocks }
  ]

  return {
    canvasW: CANVAS_W,
    canvasH,
    background: PALETTE.white,
    decorations: [],
    columns,
    bottomPadding: m.padBottom,
    templateId: 't10'
  }
}

/**
 * T11 数据大屏型。
 * 深蓝主色 + 对比色强调，顶部通栏放姓名与岗位，核心成果用大号数字，技能用迷你柱状图。
 */
function layoutT11 (model: ResumeModel): LayoutResult {
  const m = METRICS.t11
  const inner = CANVAS_W - m.padX * 2
  const stack = createStack()

  const contacts = model.visibility.contacts
    ? model.contacts.map((item) => item.value).join('    ')
    : ''

  // 顶部通栏内的文字用装饰层绘制，主列从通栏下方开始
  const bandTexts: LayoutDecoration[] = [
    {
      kind: 'text',
      x: m.padX,
      y: 62,
      text: model.name || '姓名',
      fontSize: FS.nameL,
      color: '#ffffff',
      weight: 'bold'
    }
  ]
  if (model.jobIntention) {
    bandTexts.push({
      kind: 'text',
      x: m.padX,
      y: 94,
      text: model.jobIntention,
      fontSize: FS.section,
      color: EXTRA_COLORS.screenAccent,
      weight: 'bold'
    })
  }
  if (contacts) {
    bandTexts.push({
      kind: 'text',
      x: m.padX,
      y: 128,
      text: contacts,
      fontSize: FS.small,
      color: EXTRA_COLORS.screenSub
    })
  }

  // 核心成果：用经历与技能数量派生
  const stats: Array<{ value: string, label: string }> = []
  if (model.visibility.work && model.work.length > 0) {
    stats.push({ value: String(model.work.length), label: '工作经历' })
  }
  if (model.visibility.project && model.project.length > 0) {
    stats.push({ value: String(model.project.length), label: '项目经历' })
  }
  if (model.visibility.skills && model.skills.length > 0) {
    stats.push({ value: String(model.skills.length), label: '技能证书' })
  }
  if (model.visibility.awards && model.awards.length > 0) {
    stats.push({ value: String(model.awards.length), label: '获奖情况' })
  }

  if (stats.length > 0) {
    stack.push(statRow(stats.slice(0, 4), inner, {
      color: EXTRA_COLORS.screenBlue,
      fontSize: 34,
      gapAfter: 22
    }))
  }

  const groups = experienceGroups(model)
  groups.forEach((group) => {
    stack.push(sectionTitle(group.label, {
      height: 30, accent: EXTRA_COLORS.screenBlue, gapAfter: 14
    }))
    group.list.forEach((item) => {
      stack.pushAll(experienceBlocks(item, inner, { titleStyle: 'double' }))
      stack.blank(12)
    })
  })

  if (model.visibility.skills) {
    stack.push(sectionTitle('技能水平', {
      height: 30, accent: EXTRA_COLORS.screenBlue, gapAfter: 16
    }))
    stack.push(miniBars(
      model.skills.slice(0, 8).map((skill) => ({
        label: skill.name.slice(0, 4),
        value: skill.level
      })),
      inner,
      { barColor: EXTRA_COLORS.screenBlue, gapX: 12, height: 78, gapAfter: 18 }
    ))
  }

  if (model.visibility.awards) {
    stack.push(sectionTitle('获奖情况', { height: 30, accent: EXTRA_COLORS.screenBlue, gapAfter: 14 }))
    model.awards.forEach((line) => {
      stack.push(paragraph(`· ${line}`, { width: inner, fontSize: FS.small, gapAfter: 4 }))
    })
    stack.blank(8)
  }

  if (model.visibility.summary) {
    stack.push(sectionTitle('自我评价', { height: 30, accent: EXTRA_COLORS.screenBlue, gapAfter: 14 }))
    stack.push(paragraph(model.summary, { width: inner, fontSize: FS.small, gapAfter: 0 }))
  }

  const contentTop = m.band + 32
  const canvasH = Math.max(CANVAS_H, contentTop + stack.height() + m.padBottom)

  const decorations: LayoutDecoration[] = [
    { kind: 'bar', x: 0, y: 0, w: CANVAS_W, h: m.band, color: EXTRA_COLORS.screenBlue },
    // 通栏底部强调线
    { kind: 'bar', x: 0, y: m.band - 4, w: CANVAS_W, h: 4, color: EXTRA_COLORS.screenAccent },
    ...bandTexts
  ]

  const columns: LayoutColumn[] = [
    { x: m.padX, y: contentTop, width: inner, blocks: stack.blocks }
  ]

  if (model.visibility.avatar) {
    columns.push({
      x: CANVAS_W - m.padX - m.avatar,
      y: (m.band - m.avatar) / 2,
      width: m.avatar,
      blocks: [avatarBlock(m.avatar, { align: 'right', borderColor: '#ffffff', gapAfter: 0 })]
    })
  }

  return {
    canvasW: CANVAS_W,
    canvasH,
    background: PALETTE.white,
    decorations,
    columns,
    bottomPadding: m.padBottom,
    templateId: 't11'
  }
}

const LAYOUTS: Record<string, (model: ResumeModel) => LayoutResult> = {
  t1: layoutT1,
  t2: layoutT2,
  t3: layoutT3,
  t4: layoutT4,
  t5: layoutT5,
  t6: layoutT6,
  t7: layoutT7,
  t8: layoutT8,
  t9: layoutT9,
  t10: layoutT10,
  t11: layoutT11
}

/** 计算布局 */
export function computeLayout (templateId: string, model: ResumeModel): LayoutResult {
  const builder = LAYOUTS[templateId] ?? LAYOUTS.t1
  return builder(model)
}

/** 计算需要几页 A4 */
export function computePageCount (layout: LayoutResult): number {
  return Math.max(1, Math.ceil(layout.canvasH / CANVAS_H))
}

export type { LayoutResult, LayoutBlock, LayoutColumn, LayoutDecoration }