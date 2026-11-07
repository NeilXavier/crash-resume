import type { ResumeDraft, ValidateResult } from './types'
import { isValidEmail, isValidPhone, tidy } from './utils'

const REQUIRED_LABELS: Record<string, string> = {
  name: '姓名',
  phone: '手机号',
  email: '邮箱',
  jobIntention: '求职意向'
}

/**
 * 校验基本信息。只做阻断导出的强校验（必填、手机号、邮箱格式）。
 */
export function validateUserInfo (userInfo: ResumeDraft['userInfo']): ValidateResult {
  const errors: Record<string, string> = {}
  const messages: string[] = []

  Object.keys(REQUIRED_LABELS).forEach((key) => {
    const label = REQUIRED_LABELS[key]
    if (!tidy(userInfo[key as keyof typeof userInfo])) {
      errors[key] = `请填写${label}`
      messages.push(`${label}不能为空`)
    }
  })

  if (!errors.phone && !isValidPhone(userInfo.phone)) {
    errors.phone = '手机号需为 11 位数字'
    messages.push('手机号格式不正确')
  }

  if (!errors.email && !isValidEmail(userInfo.email)) {
    errors.email = '邮箱需包含 @ 且格式正确'
    messages.push('邮箱格式不正确')
  }

  return { valid: messages.length === 0, errors, messages }
}

/** 单字段即时校验 */
export function validateField (key: string, value: string): string {
  if (key === 'phone') {
    if (!tidy(value)) return '请填写手机号'
    if (!isValidPhone(value)) return '手机号需为 11 位数字'
    return ''
  }

  if (key === 'email') {
    if (!tidy(value)) return '请填写邮箱'
    if (!isValidEmail(value)) return '邮箱需包含 @ 且格式正确'
    return ''
  }

  if (REQUIRED_LABELS[key] && !tidy(value)) {
    return `请填写${REQUIRED_LABELS[key]}`
  }

  return ''
}
