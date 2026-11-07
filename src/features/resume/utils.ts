/**
 * 通用工具函数。纯函数，供预览与导出共享。
 */

/** 去掉首尾空白并压缩连续空格 */
export function tidy (text?: string | null): string {
  return String(text ?? '').replace(/\s+/g, ' ').trim()
}

/** 保留换行、去掉首尾多余空白 */
export function tidyMultiLine (text?: string | null): string {
  return String(text ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** 是否为空值 */
export function isEmpty (value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return tidy(value).length === 0
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** 手机号校验：11 位数字，1 开头 */
export function isValidPhone (phone?: string): boolean {
  return /^1\d{10}$/.test(tidy(phone))
}

/** 邮箱校验：必须包含 @ 且格式正确 */
export function isValidEmail (email?: string): boolean {
  const value = tidy(email)
  if (!value.includes('@')) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** 格式化时间区间 */
export function formatPeriod (start?: string, end?: string): string {
  const from = tidy(start)
  const to = tidy(end)
  if (!from && !to) return ''
  if (!from) return to
  if (!to) return from
  return `${from} - ${to}`
}

/** 时间戳 -> yyyy-MM-dd HH:mm */
export function formatTime (timestamp: number): string {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 相对时间描述 */
export function formatRelative (timestamp: number): string {
  if (!timestamp) return '尚未保存'
  const diff = Date.now() - timestamp
  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
  if (diff < 30 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`
  return formatTime(timestamp).slice(0, 10)
}

/** 估算单字符渲染宽度 */
export function measureChar (char: string, fontSize: number): number {
  const code = char.charCodeAt(0)
  // 中日韩文字与全角符号按 1 个字宽
  if (code >= 0x2e80 && code <= 0x9fff) return fontSize
  if (code >= 0xf900 && code <= 0xfaff) return fontSize
  if (code >= 0xff00 && code <= 0xff60) return fontSize
  if (code >= 0x3000 && code <= 0x303f) return fontSize
  if (char === ' ') return fontSize * 0.28
  if (/[iIljtfr.,:;!'|]/.test(char)) return fontSize * 0.32
  if (/[A-Z]/.test(char)) return fontSize * 0.68
  return fontSize * 0.55
}

/** 估算整段文本宽度 */
export function measureText (text: string, fontSize: number): number {
  let width = 0
  const source = String(text ?? '')
  for (let i = 0; i < source.length; i += 1) {
    width += measureChar(source[i], fontSize)
  }
  return width
}

/**
 * 按字符宽度折行（中英文混排按权重估算）。
 * @param text 原始文本
 * @param maxWidth 单行可用宽度（px）
 * @param fontSize 字号（px）
 */
export function wrapText (text: string, maxWidth: number, fontSize: number): string[] {
  const source = tidyMultiLine(text)
  if (!source) return []

  const lines: string[] = []
  for (const paragraph of source.split('\n')) {
    if (paragraph === '') {
      lines.push('')
      continue
    }

    let current = ''
    let width = 0

    for (let i = 0; i < paragraph.length; i += 1) {
      const char = paragraph[i]
      const charWidth = measureChar(char, fontSize)

      if (width + charWidth > maxWidth && current !== '') {
        lines.push(current)
        current = char
        width = charWidth
      } else {
        current += char
        width += charWidth
      }
    }

    if (current !== '') lines.push(current)
  }

  return lines
}

/** 文本超出截断，附加省略号 */
export function ellipsis (text: string, maxWidth: number, fontSize: number): string {
  const source = tidy(text)
  if (measureText(source, fontSize) <= maxWidth) return source

  let result = ''
  let width = 0
  const suffixWidth = measureText('…', fontSize)

  for (let i = 0; i < source.length; i += 1) {
    const charWidth = measureChar(source[i], fontSize)
    if (width + charWidth + suffixWidth > maxWidth) break
    result += source[i]
    width += charWidth
  }

  return result || source.slice(0, 1)
}

/** 数字安全裁剪到区间 */
export function clamp (value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}