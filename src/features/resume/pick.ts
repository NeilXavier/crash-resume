/**
 * 图片选择（跨端适配入口）。
 *
 * 微信与支付宝小程序契约一致，直接用 `Taro.chooseMedia`；
 * H5 不具备相册与相机能力，走 `pick.h5.ts`，
 * 调用时提示需在真机预览并立即结束，不进入后续裁剪流程。
 *
 * 调用方只导入本文件，不感知平台差异。
 *
 * 选图链路按顺序处理三件事：
 *   1. 隐私授权：未同意隐私协议时 `chooseMedia` 会直接失败，需先唤起授权
 *   2. 选图：`chooseMedia` 为主，旧基础库不支持时退回 `chooseImage`
 *   3. 压缩：大图先压缩，避免后续裁剪与导出卡死
 */
import Taro from '@tarojs/taro'

export interface PickImageResult {
  /** 选中图片的本地路径；未选择或能力不可用时为空 */
  tempFilePath: string
  /** 用户主动取消 */
  canceled: boolean
  /** 能力不可用时的固定状态 */
  status?: 'real_device_required'
}

/** 压缩后最长边上限 */
const COMPRESS_MAX_EDGE = 1600

/**
 * 把临时文件转成持久路径。
 *
 * 小程序临时文件在本次会话结束后可能被清理，重启后头像会变成空白，
 * 因此保存草稿前先落成用户级持久文件；失败时退回原路径，不阻断流程。
 */
export async function persistImage (src: string): Promise<string> {
  if (!src) return src
  // 已经是持久目录（wxfile://usr/）的路径无需重复保存
  if (/wxfile:\/\/usr\//i.test(src)) return src

  try {
    const result = await Taro.saveFile({ tempFilePath: src })
    // 成功与失败共用返回类型，取用前先确认字段存在
    const saved = 'savedFilePath' in result ? result.savedFilePath : ''
    return saved || src
  } catch (err) {
    // 持久化失败不影响本次使用，仅记录便于排查
    console.warn('[resume] 头像持久化失败，继续使用临时路径', err)
    return src
  }
}

/**
 * 选择一张图片用于头像。
 * 用户取消时返回 canceled；能力不可用时返回 real_device_required；
 * 权限被拒绝时抛出带引导文案的错误，其余失败抛出通用文案。
 */
export async function pickImage (): Promise<PickImageResult> {
  // 1. 隐私授权：未同意时选图接口会被平台直接拦截
  const allowed = await ensurePrivacy()
  if (!allowed) {
    throw new Error('需先同意隐私协议后才能选择图片')
  }

  let source = ''

  try {
    // 2. 选图
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['original', 'compressed']
      })
      const file = res.tempFiles?.[0]
      if (!file?.tempFilePath) {
        return { tempFilePath: '', canceled: true }
      }
      source = file.tempFilePath
    } catch (err) {
      // 旧基础库不支持 chooseMedia 时退回 chooseImage
      if (isUnsupported(err)) {
        const res = await Taro.chooseImage({
          count: 1,
          sourceType: ['album', 'camera'],
          sizeType: ['original', 'compressed']
        })
        const path = res.tempFilePaths?.[0]
        if (!path) return { tempFilePath: '', canceled: true }
        source = path
      } else {
        throw err
      }
    }

    // 3. 压缩：失败不影响主流程，退回原图
    return { tempFilePath: await compress(source), canceled: false }
  } catch (err) {
    if (isCancel(err)) {
      // 用户取消不视为错误
      return { tempFilePath: '', canceled: true }
    }

    if (isAuthError(err)) {
      throw new Error('需要相册或相机权限，请在右上角设置中开启后重试')
    }

    const message = err instanceof Error ? err.message : String(err)
    throw new Error(message.includes('隐私') ? '需先同意隐私协议后才能选择图片' : '选择图片失败，请重试')
  }
}

/**
 * 隐私授权。
 *
 * 这两个接口都是回调风格，需要自行包装成 Promise。
 * 未在后台声明隐私收集时 `needAuthorization` 为 false，不阻断流程；
 * 用户拒绝授权时返回 false，交由调用方给出明确提示。
 */
async function ensurePrivacy (): Promise<boolean> {
  const getSetting = Taro.getPrivacySetting
  if (typeof getSetting !== 'function') return true

  const needAuth = await new Promise<boolean>((resolve) => {
    try {
      getSetting({
        success: (res) => resolve(res?.needAuthorization === true),
        fail: () => resolve(false)
      })
    } catch {
      resolve(false)
    }
  })

  if (!needAuth) return true

  const authorize = Taro.requirePrivacyAuthorize
  if (typeof authorize !== 'function') return true

  return new Promise<boolean>((resolve) => {
    try {
      authorize({
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

/**
 * 压缩大图。
 * 按最长边判断：尺寸不大时直接返回原图，避免无谓的压缩耗时。
 * 压缩本身失败不阻断流程，退回原图。
 */
async function compress (src: string): Promise<string> {
  try {
    const info = await Taro.getImageInfo({ src })
    const width = info.width ?? 0
    const height = info.height ?? 0
    const longest = Math.max(width, height)

    if (longest <= 0 || longest <= COMPRESS_MAX_EDGE) return src

    const result = await Taro.compressImage({
      src,
      quality: 80,
      compressedWidth: Math.round((COMPRESS_MAX_EDGE / longest) * width)
    })

    return result.tempFilePath || src
  } catch {
    return src
  }
}

/** 用户取消 */
function isCancel (err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /cancel|取消/i.test(message)
}

/** 未授权 */
function isAuthError (err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /auth|deny|denied|permission/i.test(message)
}

/**
 * 接口在当前基础库不可用。
 *
 * 只匹配真正的「不支持」错误。
 * 不能把接口名写进正则——否则用户取消、权限拒绝等错误都会被误判为不支持，
 * 进而走错兜底分支，真实原因被吞掉。
 */
function isUnsupported (err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /not support|unsupported|is not a function|undefined is not/i.test(message)
}