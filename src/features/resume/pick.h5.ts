/**
 * 图片选择的 H5 实现。
 *
 * H5 预览环境没有相册选择能力，调用时提示需在真机使用，
 * 返回固定 status 并立即结束流程，不进入裁剪与保存。
 */
import { showRealDevicePreviewNotice } from '@/platform/realDevicePreview'

export interface PickImageResult {
  tempFilePath: string
  canceled: boolean
  status?: 'real_device_required'
}

/**
 * H5 端图片本身就是 dataURL，可直接存入本地草稿，不存在临时路径过期问题，
 * 因此原样返回，仅保持与小程序端一致的调用契约。
 */
export async function persistImage (src: string): Promise<string> {
  return src
}

/**
 * H5 端选择图片不可用。
 * 通过隐藏的 file input 选取本地文件，转成 dataURL 后仍可完成裁剪与预览，
 * 因此优先提供可用路径；仅在浏览器不支持时回退到真机提示。
 */
export async function pickImage (): Promise<PickImageResult> {
  if (typeof document === 'undefined') {
    await showRealDevicePreviewNotice('头像上传')
    return { tempFilePath: '', canceled: false, status: 'real_device_required' }
  }

  const file = await openFileDialog()
  if (!file) return { tempFilePath: '', canceled: true }

  try {
    const dataUrl = await readAsDataUrl(file)
    return { tempFilePath: dataUrl, canceled: false }
  } catch {
    throw new Error('图片读取失败，请重新选择')
  }
}

/** 打开文件选择对话框 */
function openFileDialog (): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'

    let settled = false
    const finish = (value: File | null) => {
      if (settled) return
      settled = true
      if (input.parentNode) input.parentNode.removeChild(input)
      resolve(value)
    }

    input.onchange = () => {
      finish(input.files?.[0] ?? null)
    }

    // 用户直接关闭对话框时无法可靠捕获，交由超时兜底
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => finish(input.files?.[0] ?? null), 500)
      },
      { once: true }
    )

    document.body.appendChild(input)
    input.click()
  })
}

/** 读取文件为 dataURL */
function readAsDataUrl (file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取失败'))
    reader.readAsDataURL(file)
  })
}