/**
 * 业务数据类型定义。
 */

/** 基本信息 */
export interface UserInfo {
  avatar: string
  name: string
  gender: string
  phone: string
  email: string
  jobIntention: string
  /** 选填：年龄 */
  age: string
  /** 选填：籍贯 */
  hometown: string
  /** 选填：现居城市 */
  city: string
  /** 选填：政治面貌 */
  politics: string
  /** 选填：学历 */
  education: string
  /** 选填：专业 */
  major: string
  /** 选填：毕业院校 */
  school: string
  /** 选填：出生年份 */
  birthYear: string
}

/** 经历类型 */
export type ExperienceType = 'education' | 'work' | 'project'

/** 一条经历 */
export interface ExperienceItem {
  id: string
  type: ExperienceType
  startTime: string
  endTime: string
  /** 学校 / 公司 / 项目名 */
  org: string
  /** 专业 / 岗位 / 担任角色 */
  role: string
  content: string
}

/** 技能或证书 */
export interface SkillItem {
  id: string
  name: string
  /** 掌握程度 0-100 */
  level: number
}

/** 完整草稿 */
export interface ResumeDraft {
  userInfo: UserInfo
  experiences: ExperienceItem[]
  skills: SkillItem[]
  /** 获奖情况，一行一条 */
  awards: string
  /** 自我评价 */
  summary: string
  templateId: string
  updatedAt: number
}

/** 模板元信息 */
export interface TemplateMeta {
  id: string
  name: string
  desc: string
  accent: string
  /** 缩略图配色：背景 / 主块 / 副块 */
  thumb: [string, string, string]
}

/** 校验结果 */
export interface ValidateResult {
  valid: boolean
  errors: Record<string, string>
  messages: string[]
}

/** 历史草稿记录 */
export interface DraftRecord {
  id: string
  name: string
  jobIntention: string
  avatar: string
  updatedAt: number
  updatedText: string
  draft: ResumeDraft
}

/** 基本信息行 */
export interface InfoRow {
  key: string
  label: string
  value: string
}

/** 联系方式行 */
export interface ContactRow {
  key: string
  icon: string
  value: string
}

/** 过滤后的经历 */
export interface ResumeExperience {
  id: string
  type: ExperienceType
  typeLabel: string
  typeLabelShort: string
  period: string
  org: string
  role: string
  content: string
}

/** 过滤后的技能 */
export interface ResumeSkill {
  id: string
  name: string
  level: number
}

/** 简历内容模型 */
export interface ResumeModel {
  name: string
  gender: string
  jobIntention: string
  avatar: string
  phone: string
  email: string
  city: string
  contacts: ContactRow[]
  infoRows: InfoRow[]
  intentionTags: string[]
  education: ResumeExperience[]
  work: ResumeExperience[]
  project: ResumeExperience[]
  skills: ResumeSkill[]
  awards: string[]
  summary: string
  visibility: {
    avatar: boolean
    contacts: boolean
    infoRows: boolean
    education: boolean
    work: boolean
    project: boolean
    skills: boolean
    awards: boolean
    summary: boolean
  }
  experienceCount: number
  templateId: string
  hasAnyContent: boolean
}

/** 布局块 */
export interface LayoutBlock {
  kind: string
  height: number
  gapAfter?: number
  [key: string]: unknown
}

/** 布局列 */
export interface LayoutColumn {
  x: number
  y: number
  width: number
  blocks: LayoutBlock[]
}

/** 装饰元素 */
export interface LayoutDecoration {
  kind: 'bar' | 'line' | 'text'
  x: number
  y: number
  w?: number
  h?: number
  color?: string
  text?: string
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  weight?: string
}

/** 布局结果 */
export interface ResumeLayout {
  canvasW: number
  canvasH: number
  background: string
  decorations: LayoutDecoration[]
  columns: LayoutColumn[]
  bottomPadding: number
  templateId: string
}

/** 加载完成的图片 */
export interface LoadedImage {
  node: unknown
  ratio: number
  ok: boolean
}

/** 导出结果 */
export interface ExportResult {
  type: 'pdf' | 'png'
  tempFilePath: string
  fileName: string
  pageCount: number
  /** 能力不可用时的固定状态 */
  status?: 'real_device_required'
}