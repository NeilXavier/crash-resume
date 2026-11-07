/**
 * 通用按钮。
 * 统一点击态与尺寸，避免各页面重复实现。
 */
import { Text, View } from '@tarojs/components'
import type { ReactNode } from 'react'

import './button.less'

interface Props {
  /** 视觉样式：主色实底 / 浅绿底 / 白底描边 / 危险 */
  variant?: 'primary' | 'ghost' | 'plain' | 'danger'
  /** 是否占满整行 */
  block?: boolean
  /** 是否禁用（禁用时忽略点击） */
  disabled?: boolean
  className?: string
  children: ReactNode
  onClick?: () => void
}

/**
 * 业务按钮。
 * @param props 组件参数
 */
export default function AppButton ({
  variant = 'primary',
  block = false,
  disabled = false,
  className = '',
  children,
  onClick
}: Props) {
  const classes = [
    'app-btn',
    `app-btn--${variant}`,
    block ? 'app-btn--block' : '',
    disabled ? 'is-disabled' : '',
    className
  ].filter(Boolean).join(' ')

  const handleClick = () => {
    if (disabled) return
    onClick?.()
  }

  return (
    <View className={classes} hoverClass={disabled ? 'none' : 'app-btn--hover'} hoverStayTime={80} onClick={handleClick}>
      <Text className='app-btn__label'>{children}</Text>
    </View>
  )
}
