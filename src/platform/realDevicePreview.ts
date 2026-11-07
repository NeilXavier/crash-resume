import Taro from '@tarojs/taro'

export interface RealDeviceRequiredResult {
  status: 'real_device_required'
}

const REAL_DEVICE_REQUIRED_RESULT: RealDeviceRequiredResult = {
  status: 'real_device_required',
}

let activeNotice: Promise<RealDeviceRequiredResult> | undefined

export function showRealDevicePreviewNotice(
  capabilityName = '该功能',
): Promise<RealDeviceRequiredResult> {
  if (activeNotice) return activeNotice

  activeNotice = Taro.showModal({
    title: '请使用真机预览',
    content: `${capabilityName}依赖小程序端能力，请在微信或支付宝小程序中使用真机预览。`,
    showCancel: false,
    confirmText: '知道了',
  })
    .then(() => REAL_DEVICE_REQUIRED_RESULT)
    .finally(() => {
      activeNotice = undefined
    })

  return activeNotice
}
