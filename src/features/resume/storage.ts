import Taro from '@tarojs/taro'

import { createEmptyDraft } from './mock'
import type { DraftRecord, ExperienceItem, ResumeDraft, SkillItem } from './types'
import { formatRelative, tidy } from './utils'

const KEY_DRAFT = 'urgent_resume_draft'
const KEY_HISTORY = 'urgent_resume_history'
const HISTORY_LIMIT = 20

/** 安全读取本地缓存 */
function readStorage<T> (key: string, fallback: T): T {
  try {
    const raw = Taro.getStorageSync(key)
    if (!raw) return fallback
    if (typeof raw === 'string') return JSON.parse(raw) as T
    return raw as T
  } catch {
    return fallback
  }
}

/** 安全写入本地缓存 */
function writeStorage (key: string, value: unknown): boolean {
  try {
    Taro.setStorageSync(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

/** 补齐草稿缺失字段，兼容旧版本缓存 */
export function normalizeDraft (raw: unknown): ResumeDraft {
  const base = createEmptyDraft()
  if (!raw || typeof raw !== 'object') return base

  const source = raw as Partial<ResumeDraft>
  const userInfo = { ...base.userInfo, ...(source.userInfo ?? {}) }

  const experiences: ExperienceItem[] = Array.isArray(source.experiences) && source.experiences.length
    ? source.experiences.map((item, index) => ({
      id: item?.id ?? `exp_${index}`,
      type: item?.type === 'work' || item?.type === 'project' ? item.type : 'education',
      startTime: tidy(item?.startTime),
      endTime: tidy(item?.endTime),
      org: tidy(item?.org),
      role: tidy(item?.role),
      content: typeof item?.content === 'string' ? item.content : ''
    }))
    : base.experiences

  const skills: SkillItem[] = Array.isArray(source.skills) && source.skills.length
    ? source.skills.map((item, index) => ({
      id: item?.id ?? `skill_${index}`,
      name: tidy(item?.name),
      level: typeof item?.level === 'number' ? item.level : 80
    }))
    : base.skills

  return {
    userInfo,
    experiences,
    skills,
    awards: typeof source.awards === 'string' ? source.awards : '',
    summary: typeof source.summary === 'string' ? source.summary : '',
    templateId: source.templateId ?? base.templateId,
    updatedAt: typeof source.updatedAt === 'number' ? source.updatedAt : 0
  }
}

/** 读取当前草稿 */
export function loadDraft (): ResumeDraft {
  return normalizeDraft(readStorage<unknown>(KEY_DRAFT, null))
}

/** 保存当前草稿 */
export function saveDraft (draft: ResumeDraft, alsoHistory = false): ResumeDraft {
  const payload = normalizeDraft(draft)
  payload.updatedAt = Date.now()
  writeStorage(KEY_DRAFT, payload)
  if (alsoHistory) upsertHistory(payload)
  return payload
}

/** 清空当前草稿 */
export function clearDraft (): void {
  try {
    Taro.removeStorageSync(KEY_DRAFT)
  } catch {
    // 忽略清理失败
  }
}

/** 写入 / 更新一条历史记录（以姓名 + 求职意向去重） */
function upsertHistory (draft: ResumeDraft): void {
  const list = readStorage<DraftRecord[]>(KEY_HISTORY, [])
  const safeList = Array.isArray(list) ? list : []
  const signature = `${tidy(draft.userInfo.name)}|${tidy(draft.userInfo.jobIntention)}`

  const next = safeList.filter((item) => {
    if (!item?.draft) return false
    const other = `${tidy(item.draft.userInfo?.name)}|${tidy(item.draft.userInfo?.jobIntention)}`
    return other !== signature
  })

  next.unshift({
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: draft.userInfo.name || '未命名简历',
    jobIntention: draft.userInfo.jobIntention || '',
    avatar: draft.userInfo.avatar || '',
    updatedAt: Date.now(),
    updatedText: '刚刚',
    draft
  })

  writeStorage(KEY_HISTORY, next.slice(0, HISTORY_LIMIT))
}

/** 读取历史草稿列表 */
export function loadHistory (): DraftRecord[] {
  const list = readStorage<DraftRecord[]>(KEY_HISTORY, [])
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => Boolean(item?.draft))
    .map((item) => ({
      id: item.id,
      name: tidy(item.name) || '未命名简历',
      jobIntention: tidy(item.jobIntention),
      avatar: item.avatar ?? '',
      updatedAt: item.updatedAt ?? 0,
      updatedText: formatRelative(item.updatedAt ?? 0),
      draft: normalizeDraft(item.draft)
    }))
}

/** 删除一条历史记录 */
export function removeHistory (id: string): DraftRecord[] {
  const next = loadHistory().filter((item) => item.id !== id)
  writeStorage(KEY_HISTORY, next)
  return next
}

/** 清空历史记录 */
export function clearHistory (): void {
  writeStorage(KEY_HISTORY, [])
}

/** 是否存在有效草稿 */
export function hasDraft (): boolean {
  const raw = readStorage<unknown>(KEY_DRAFT, null)
  if (!raw || typeof raw !== 'object') return false
  const draft = normalizeDraft(raw)
  return Boolean(
    tidy(draft.userInfo.name) ||
    tidy(draft.userInfo.phone) ||
    tidy(draft.userInfo.jobIntention) ||
    draft.experiences.some((item) => tidy(item.org) || tidy(item.content))
  )
}
