import type { ExperienceItem, ExperienceType, ResumeDraft, SkillItem, UserInfo } from './types'

/** 空白基本信息 */
export const EMPTY_USER_INFO: UserInfo = {
  avatar: '',
  name: '',
  gender: '',
  phone: '',
  email: '',
  jobIntention: '',
  age: '',
  hometown: '',
  city: '',
  politics: '',
  education: '',
  major: '',
  school: '',
  birthYear: ''
}

/** 经历类型选项 */
export const EXPERIENCE_TYPES: Array<{ value: ExperienceType, label: string }> = [
  { value: 'education', label: '教育经历' },
  { value: 'work', label: '工作实习' },
  { value: 'project', label: '项目经历' }
]

export const GENDER_OPTIONS = ['男', '女', '保密']
export const POLITICS_OPTIONS = ['中共党员', '中共预备党员', '共青团员', '群众', '民主党派']
export const EDUCATION_OPTIONS = ['大专', '本科', '硕士', '博士', '高中及以下']

/** 生成短 ID */
export function createId (prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

/** 创建一条空经历 */
export function createEmptyExperience (type: ExperienceType = 'education'): ExperienceItem {
  return {
    id: createId(type === 'education' ? 'edu' : type === 'work' ? 'work' : 'proj'),
    type,
    startTime: '',
    endTime: '',
    org: '',
    role: '',
    content: ''
  }
}

/** 创建一条空技能 */
export function createEmptySkill (): SkillItem {
  return { id: createId('skill'), name: '', level: 80 }
}

/** 空白草稿 */
export function createEmptyDraft (templateId = 't1'): ResumeDraft {
  return {
    userInfo: { ...EMPTY_USER_INFO },
    experiences: [createEmptyExperience('education')],
    skills: [createEmptySkill()],
    awards: '',
    summary: '',
    templateId,
    updatedAt: 0
  }
}

/**
 * 示例草稿：用于首次体验与模板对比。
 *
 * 姓名、手机号、邮箱、学校、公司等全部为虚构演示数据：
 * 邮箱使用 RFC 2606 保留域名 example.com，手机号使用公开的测试号段，
 * 与仓库作者及任何真实个人无关。
 */
export const MOCK_DRAFT: ResumeDraft = {
  userInfo: {
    avatar: '',
    name: '林知远',
    gender: '男',
    phone: '13800138000',
    email: 'linzhiyuan@example.com',
    jobIntention: '前端开发工程师',
    age: '26',
    hometown: '浙江杭州',
    city: '上海',
    politics: '共青团员',
    education: '本科',
    major: '计算机科学与技术',
    school: '同济大学',
    birthYear: '1999'
  },
  experiences: [
    {
      id: 'edu_1',
      type: 'education',
      startTime: '2017.09',
      endTime: '2021.06',
      org: '同济大学',
      role: '计算机科学与技术 · 本科',
      content: '主修数据结构、计算机网络与软件工程，连续三年获校级奖学金，GPA 3.7/4.0。'
    },
    {
      id: 'work_1',
      type: 'work',
      startTime: '2021.07',
      endTime: '至今',
      org: '云启科技（上海）有限公司',
      role: '前端开发工程师',
      content:
        '负责企业级中台前端架构与业务组件库建设，主导性能优化专项，首屏加载耗时下降 42%；沉淀 30 余个通用业务组件，覆盖 4 条产品线。'
    },
    {
      id: 'work_2',
      type: 'work',
      startTime: '2020.07',
      endTime: '2021.06',
      org: '星野网络科技有限公司',
      role: '前端开发实习生',
      content: '参与活动运营 H5 开发，独立完成抽奖、榜单等 6 个活动模块，支撑单日峰值 12 万访问量。'
    },
    {
      id: 'proj_1',
      type: 'project',
      startTime: '2023.03',
      endTime: '2023.11',
      org: '智能简历生成平台',
      role: '前端负责人',
      content:
        '负责小程序端与 H5 端双端架构设计，实现 6 套简历模板实时切换与 Canvas 高清导出，导出成功率 99.6%，平均耗时 1.8 秒。'
    },
    {
      id: 'proj_2',
      type: 'project',
      startTime: '2022.05',
      endTime: '2022.10',
      org: '数据可视化大屏项目',
      role: '核心开发',
      content: '基于 Canvas 实现万级数据点实时渲染，帧率稳定在 55 FPS 以上。'
    }
  ],
  skills: [
    { id: 'skill_1', name: 'TypeScript / JavaScript', level: 92 },
    { id: 'skill_2', name: 'React / Vue3', level: 90 },
    { id: 'skill_3', name: '小程序开发（原生 / Taro）', level: 88 },
    { id: 'skill_4', name: 'Canvas / 可视化', level: 82 },
    { id: 'skill_5', name: 'Node.js / 工程化', level: 75 },
    { id: 'skill_6', name: 'CET-6 / 软件设计师', level: 70 }
  ],
  awards: '2023 年度公司技术创新奖\n2022 全国大学生前端挑战赛二等奖\n2020 校级优秀毕业生',
  summary:
    '五年一线前端开发经验，擅长复杂业务架构与性能优化，主导过百万级用户产品的双端交付。沟通直接、交付稳定，能在紧急档期快速拉通需求并落地。',
  templateId: 't1',
  updatedAt: 0
}
