import type {
  ContactRow,
  InfoRow,
  ResumeDraft,
  ResumeExperience,
  ResumeModel,
  ResumeSkill
} from './types'
import { getTemplate } from './templates'
import { formatPeriod, isEmpty, tidy, tidyMultiLine } from './utils'

const TYPE_LABEL: Record<string, string> = {
  education: '教育经历',
  work: '工作 / 实习经历',
  project: '项目经历'
}

const TYPE_LABEL_SHORT: Record<string, string> = {
  education: '教育',
  work: '工作',
  project: '项目'
}

/** 基本信息行（用于表格网格与侧栏） */
function buildInfoRows (userInfo: ResumeDraft['userInfo']): InfoRow[] {
  const rows: InfoRow[] = [
    { key: 'name', label: '姓名', value: tidy(userInfo.name) },
    { key: 'gender', label: '性别', value: tidy(userInfo.gender) },
    { key: 'age', label: '年龄', value: tidy(userInfo.age) || tidy(userInfo.birthYear) },
    { key: 'education', label: '学历', value: tidy(userInfo.education) },
    { key: 'major', label: '专业', value: tidy(userInfo.major) },
    { key: 'school', label: '毕业院校', value: tidy(userInfo.school) },
    { key: 'hometown', label: '籍贯', value: tidy(userInfo.hometown) },
    { key: 'city', label: '现居城市', value: tidy(userInfo.city) },
    { key: 'politics', label: '政治面貌', value: tidy(userInfo.politics) }
  ]
  return rows.filter((row) => !isEmpty(row.value))
}

/** 联系方式行 */
function buildContacts (userInfo: ResumeDraft['userInfo']): ContactRow[] {
  const contacts: ContactRow[] = [
    { key: 'phone', icon: 'phone', value: tidy(userInfo.phone) },
    { key: 'email', icon: 'mail', value: tidy(userInfo.email) },
    { key: 'city', icon: 'city', value: tidy(userInfo.city) }
  ]
  return contacts.filter((item) => !isEmpty(item.value))
}

/** 过滤有效经历并按时间倒序（「至今」优先） */
function buildExperiences (
  experiences: ResumeDraft['experiences'],
  type?: string
): ResumeExperience[] {
  return (experiences ?? [])
    .filter((item) => item && (!type || item.type === type))
    .filter((item) => !isEmpty(item.org) || !isEmpty(item.role) || !isEmpty(item.content))
    .map<ResumeExperience>((item) => ({
      id: item.id,
      type: item.type,
      typeLabel: TYPE_LABEL[item.type] ?? '经历',
      typeLabelShort: TYPE_LABEL_SHORT[item.type] ?? '经历',
      period: formatPeriod(item.startTime, item.endTime),
      org: tidy(item.org),
      role: tidy(item.role),
      content: tidyMultiLine(item.content)
    }))
    .sort((a, b) => {
      const rankA = a.period.includes('至今') ? 1 : 0
      const rankB = b.period.includes('至今') ? 1 : 0
      if (rankA !== rankB) return rankB - rankA
      return b.period.localeCompare(a.period)
    })
}

/** 技能列表 */
function buildSkills (skills: ResumeDraft['skills']): ResumeSkill[] {
  return (skills ?? [])
    .filter((item) => item && !isEmpty(item.name))
    .map((item) => ({
      id: item.id,
      name: tidy(item.name),
      level: Math.max(0, Math.min(100, Number(item.level) || 0))
    }))
}

/** 获奖列表 */
function buildAwards (awards: string): string[] {
  return String(awards ?? '')
    .split('\n')
    .map((line) => tidy(line))
    .filter((line) => line.length > 0)
}

/**
 * 组装完整内容模型。预览与导出共用，
 * 空模块在此处被标记为不可见，渲染层据此自动隐藏不留白。
 */
export function buildResumeModel (draft: ResumeDraft): ResumeModel {
  const safe = draft ?? createFallbackDraft()
  const userInfo = safe.userInfo ?? createFallbackDraft().userInfo
  const template = getTemplate(safe.templateId)

  const education = buildExperiences(safe.experiences, 'education')
  const work = buildExperiences(safe.experiences, 'work')
  const project = buildExperiences(safe.experiences, 'project')
  const skills = buildSkills(safe.skills)
  const awards = buildAwards(safe.awards)
  const summary = tidyMultiLine(safe.summary)

  const contactList = buildContacts(userInfo)
  const infoRowList = buildInfoRows(userInfo)

  const model: ResumeModel = {
    name: tidy(userInfo.name),
    gender: tidy(userInfo.gender),
    jobIntention: tidy(userInfo.jobIntention),
    avatar: userInfo.avatar ?? '',
    phone: tidy(userInfo.phone),
    email: tidy(userInfo.email),
    city: tidy(userInfo.city),
    contacts: contactList,
    infoRows: infoRowList,
    intentionTags: [tidy(userInfo.jobIntention), tidy(userInfo.city)].filter(Boolean),
    education,
    work,
    project,
    skills,
    awards,
    summary,
    visibility: {
      avatar: !isEmpty(userInfo.avatar),
      contacts: contactList.length > 0,
      infoRows: infoRowList.length > 0,
      education: education.length > 0,
      work: work.length > 0,
      project: project.length > 0,
      skills: skills.length > 0,
      awards: awards.length > 0,
      summary: !isEmpty(summary)
    },
    experienceCount: education.length + work.length + project.length,
    templateId: template.id,
    hasAnyContent: false
  }

  model.hasAnyContent =
    !isEmpty(model.name) ||
    model.experienceCount > 0 ||
    model.visibility.skills ||
    model.visibility.awards ||
    model.visibility.summary

  return model
}

function createFallbackDraft (): ResumeDraft {
  return {
    userInfo: {
      avatar: '', name: '', gender: '', phone: '', email: '', jobIntention: '',
      age: '', hometown: '', city: '', politics: '', education: '', major: '',
      school: '', birthYear: ''
    },
    experiences: [],
    skills: [],
    awards: '',
    summary: '',
    templateId: 't1',
    updatedAt: 0
  }
}

/** 导出文件名：姓名-岗位-简历.扩展名 */
export function buildFileName (draft: ResumeDraft, ext: string): string {
  const userInfo = draft?.userInfo
  const name = tidy(userInfo?.name) || '我的'
  const job = tidy(userInfo?.jobIntention) || '求职'
  const safe = (text: string) => text.replace(/[\\/:*?"<>|\s]/g, '')
  return `${safe(name)}-${safe(job)}-简历.${ext}`
}

export { TYPE_LABEL, TYPE_LABEL_SHORT }
