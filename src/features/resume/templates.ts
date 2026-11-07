import type { TemplateMeta } from './types'

/**
 * 简历模板元信息。
 *
 * 模板只决定布局与配色，字段数据完全共享，切换不丢数据。
 * 未填写的模块由布局层自动隐藏，不留空白。
 */
export const TEMPLATES: TemplateMeta[] = [
  {
    id: 't1',
    name: '经典表格',
    desc: '深绿表头 · 左右 28/72 分栏',
    accent: '#1f7a54',
    thumb: ['#fff', '#1f7a54', '#dce9e3']
  },
  {
    id: 't2',
    name: '左右分栏',
    desc: '灰色侧栏 · 主栏白底',
    accent: '#2ba471',
    thumb: ['#fff', '#f2f4f7', '#2ba471']
  },
  {
    id: 't3',
    name: '极简白底',
    desc: '姓名大字 · 绿色标题条',
    accent: '#2ba471',
    thumb: ['#fff', '#2ba471', '#e8f5e9']
  },
  {
    id: 't4',
    name: '商务横带',
    desc: '顶部通栏 · 头像右上',
    accent: '#2ba471',
    thumb: ['#fff', '#d6ede1', '#2ba471']
  },
  {
    id: 't5',
    name: '表格网格',
    desc: '三列信息表 · 行式经历',
    accent: '#3a6ea5',
    thumb: ['#fff', '#3a6ea5', '#dde5ef']
  },
  {
    id: 't6',
    name: '作品集宽',
    desc: '两列卡片流 · 技能进度条',
    accent: '#e07a3f',
    thumb: ['#fff', '#e07a3f', '#f6e3d5']
  },
  {
    id: 't7',
    name: '现代卡片',
    desc: '浅灰底 · 白色悬浮卡片',
    accent: '#2ba471',
    thumb: ['#f7f8fa', '#ffffff', '#2ba471']
  },
  {
    id: 't8',
    name: '深蓝分栏',
    desc: '左侧 35% 深蓝 · 右侧白底',
    accent: '#1f3a5f',
    thumb: ['#1f3a5f', '#ffffff', '#4a90d9']
  },
  {
    id: 't9',
    name: '时间轴',
    desc: '日期轴贯穿 · 内容卡片',
    accent: '#2ba471',
    thumb: ['#fff', '#2ba471', '#e8f5e9']
  },
  {
    id: 't10',
    name: '极简网格',
    desc: '浅蓝标题底 · 30/70 两列',
    accent: '#4a90d9',
    thumb: ['#fff', '#e7f1fb', '#4a90d9']
  },
  {
    id: 't11',
    name: '数据大屏',
    desc: '深蓝通栏 · 大数字与柱状图',
    accent: '#0f2b46',
    thumb: ['#0f2b46', '#ffffff', '#4ade80']
  }
]

export const TEMPLATE_IDS = TEMPLATES.map((item) => item.id)

/** 取模板元信息，非法 ID 回退到第一套 */
export function getTemplate (id?: string): TemplateMeta {
  return TEMPLATES.find((item) => item.id === id) ?? TEMPLATES[0]
}

/** 取模板在列表中的下标 */
export function getTemplateIndex (id?: string): number {
  const index = TEMPLATE_IDS.indexOf(getTemplate(id).id)
  return index < 0 ? 0 : index
}
