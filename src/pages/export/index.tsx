/**
 * 导出页：PDF / PNG 导出 + 保存草稿 + 导出前分页预览。
 *
 * 导出链路：
 *   页面内隐藏一张高清画布（逻辑 794 × 1123，倍率 2）→ 绘制整份简历 →
 *   PNG 直接导出；PDF 按 A4 高度分页切片后由 pdf.ts 组装。
 * H5 端不具备小程序画布与文件能力，由 export.h5.ts 提示真机预览并终止流程。
 */
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useRef, useState } from 'react'

import AppButton from '@/features/resume/components/AppButton'
import ExportStage from '@/features/resume/components/ExportStage'
import type { UnifiedCanvas } from '@/features/resume/canvas'
import * as exporter from '@/features/resume/export'
import { computeLayout, computePageCount } from '@/features/resume/layout'
import { buildFileName, buildResumeModel } from '@/features/resume/model'
import * as storage from '@/features/resume/storage'
import { getTemplate } from '@/features/resume/templates'
import type { ResumeDraft, ResumeModel } from '@/features/resume/types'

import './index.less'

/** 首屏派生状态：从本地草稿计算概览信息 */
function deriveInitial (): { draft: ResumeDraft, model: ResumeModel, pageCount: number } {
  const current = storage.loadDraft()
  const nextModel = buildResumeModel(current)
  const layout = computeLayout(nextModel.templateId, nextModel)
  return { draft: current, model: nextModel, pageCount: computePageCount(layout) }
}

export default function ExportPage () {
  // 首屏直接读取草稿，避免在 effect 中同步 setState
  const [initial] = useState(deriveInitial)
  const [draft, setDraft] = useState<ResumeDraft>(initial.draft)
  const [model, setModel] = useState<ResumeModel>(initial.model)
  const [pageCount, setPageCount] = useState(initial.pageCount)
  const [busy, setBusy] = useState<'' | 'pdf' | 'png' | 'save'>('')
  const [pages, setPages] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [lastExport, setLastExport] = useState<{
    filePath: string
    fileName: string
    type: 'pdf' | 'png'
  } | null>(null)

  const canvasRef = useRef<UnifiedCanvas | null>(null)
  const draftRef = useRef<ResumeDraft | null>(initial.draft)

  /** 应用草稿并同步派生状态 */
  const applyDraft = useCallback((current: ResumeDraft) => {
    draftRef.current = current
    setDraft(current)

    const nextModel = buildResumeModel(current)
    const layout = computeLayout(nextModel.templateId, nextModel)
    setModel(nextModel)
    setPageCount(computePageCount(layout))
    setPages([])
    setLastExport(null)
  }, [])

  /** 从填写页或预览页返回时重新读取草稿 */
  useDidShow(() => {
    applyDraft(storage.loadDraft())
  })

  /** 取高清画布节点 */
  const getCanvas = useCallback(async () => {
    if (canvasRef.current) return canvasRef.current
    const node = await exporter.queryCanvasNode('#exportCanvas')
    canvasRef.current = node
    return node
  }, [])

  /** 绘制简历到隐藏画布 */
  const prepare = useCallback(async () => {
    const current = draftRef.current
    if (!current) throw new Error('草稿未就绪')

    const canvas = await getCanvas()
    const result = await exporter.drawResumeToCanvas(canvas, current)
    // 切勿在此处更新界面状态：绘制后立刻重渲染会让平台重置画布尺寸并清空内容，
    // 导致随后切片导出空白图。页数等状态统一在导出完成后再更新。
    return { canvas, result }
  }, [getCanvas])

  /** 校验是否可以导出 */
  const guard = useCallback(() => {
    const current = draftRef.current
    if (!current) {
      void Taro.showToast({ title: '草稿未就绪', icon: 'none' })
      return false
    }

    const check = buildResumeModel(current)
    if (!check.visibility.avatar && !check.name) {
      void Taro.showToast({ title: '请先填写姓名', icon: 'none' })
      return false
    }

    if (!check.name || !check.phone || !check.email || !check.jobIntention) {
      void Taro.showModal({
        title: '必填项未完成',
        content: '姓名、手机号、邮箱、求职意向为必填项，请返回填写后再导出。',
        confirmText: '去填写',
        confirmColor: '#2ba471',
        success: (res) => {
          if (res.confirm) void Taro.navigateTo({ url: '/pages/form/index?mode=edit' })
        }
      })
      return false
    }

    return true
  }, [])

  /** 导出 PDF */
  const handlePdf = useCallback(async () => {
    if (busy || !guard()) return
    setBusy('pdf')
    // 导出要绘制整页并生成文件，耗时较长，给出全屏提示避免误以为卡死
    void Taro.showLoading({ title: '正在生成 PDF', mask: true })

    try {
      const { canvas, result } = await prepare()
      const output = await exporter.exportPdf(canvas, draftRef.current as ResumeDraft, result.pageCount)

      if (output.status === 'real_device_required') {
        setBusy('')
        return
      }

      setLastExport({ filePath: output.tempFilePath, fileName: output.fileName, type: 'pdf' })
      setPageCount(result.pageCount)
      setBusy('')

      void Taro.showModal({
        title: 'PDF 已生成',
        content: `${output.fileName}（${result.pageCount} 页，A4 210 × 297mm）`,
        confirmText: '打开',
        cancelText: '稍后',
        confirmColor: '#2ba471',
        success: (res) => {
          if (!res.confirm) return
          void exporter.openPdf(output.tempFilePath).then((opened) => {
            if (!opened) void Taro.showToast({ title: '已取消打开', icon: 'none' })
          }).catch((err: Error) => {
            void Taro.showToast({ title: err.message, icon: 'none' })
          })
        }
      })
    } catch (err) {
      console.error('[resume] PDF 导出失败', err)
      void Taro.showToast({
        title: err instanceof Error ? err.message : '导出失败，请重试',
        icon: 'none'
      })
      setBusy('')
    } finally {
      void Taro.hideLoading()
    }
  }, [busy, guard, prepare])

  /** 导出 PNG */
  const handlePng = useCallback(async () => {
    if (busy || !guard()) return
    setBusy('png')
    void Taro.showLoading({ title: '正在生成 PNG', mask: true })

    try {
      const { canvas, result } = await prepare()
      const output = await exporter.exportPng(canvas, draftRef.current as ResumeDraft)

      if (output.status === 'real_device_required') {
        setBusy('')
        return
      }

      setLastExport({ filePath: output.tempFilePath, fileName: output.fileName, type: 'png' })
      setPageCount(result.pageCount)
      setBusy('')

      void Taro.showModal({
        title: 'PNG 已生成',
        content: `${output.fileName}（长图，可保存到相册）`,
        // showModal 的 confirmText 最多 4 个汉字，超限时接口会直接失败
        confirmText: '保存',
        cancelText: '稍后',
        confirmColor: '#2ba471',
        success: (res) => {
          if (!res.confirm) return
          void exporter.saveImageToAlbum(output.tempFilePath).then((saved) => {
            if (saved) void Taro.showToast({ title: '已保存到相册', icon: 'success' })
          }).catch((err: Error) => {
            void Taro.showToast({ title: err.message, icon: 'none' })
          })
        }
      })
    } catch (err) {
      console.error('[resume] PNG 导出失败', err)
      void Taro.showToast({
        title: err instanceof Error ? err.message : '导出失败，请重试',
        icon: 'none'
      })
      setBusy('')
    } finally {
      void Taro.hideLoading()
    }
  }, [busy, guard, prepare])

  /** 导出前分页预览，防止截断 */
  const openPreview = useCallback(async () => {
    if (busy || !guard()) return
    setBusy('save')

    try {
      const { canvas, result } = await prepare()

      if (!exporter.previewPdfPages) {
        setPreviewOpen(true)
        setBusy('')
        return
      }

      const images = await exporter.previewPdfPages(canvas, result.pageCount, draftRef.current as ResumeDraft)
      setPages(images)
      setPreviewOpen(true)
    } catch (err) {
      void Taro.showToast({
        title: err instanceof Error ? err.message : '预览生成失败',
        icon: 'none'
      })
    } finally {
      setBusy('')
    }
  }, [busy, guard, prepare])

  /** 保存草稿到历史 */
  const handleSave = useCallback(() => {
    const current = draftRef.current
    if (!current) return
    const saved = storage.saveDraft(current, true)
    setDraft(saved)
    void Taro.showToast({ title: '草稿已保存到历史', icon: 'success' })
  }, [])

  const template = getTemplate(draft?.templateId)

  return (
    <View className='export'>
      {/* 概览 */}
      <View className='export__card'>
        <View className='export__row'>
          <Text className='export__row-label'>姓名</Text>
          <Text className='export__row-value'>{model?.name || '未填写'}</Text>
        </View>
        <View className='export__row'>
          <Text className='export__row-label'>求职意向</Text>
          <Text className='export__row-value'>{model?.jobIntention || '未填写'}</Text>
        </View>
        <View className='export__row'>
          <Text className='export__row-label'>当前模板</Text>
          <Text className='export__row-value'>{template.name}</Text>
        </View>
        <View className='export__row'>
          <Text className='export__row-label'>预计页数</Text>
          <Text className='export__row-value'>
            {pageCount > 1 ? `${pageCount} 页 A4` : '单页 A4'}
          </Text>
        </View>
        <View className='export__row export__row--last'>
          <Text className='export__row-label'>文件名</Text>
          <Text className='export__row-value export__row-value--small'>
            {draft ? buildFileName(draft, 'pdf') : '-'}
          </Text>
        </View>
      </View>

      {/* 导出说明 */}
      <View className='export__card export__card--info'>
        <Text className='export__info-title'>导出规格</Text>
        <View className='export__spec'>
          <View className='export__spec-item'>A4 210 × 297mm</View>
          <View className='export__spec-item'>边距 0</View>
          <View className='export__spec-item'>倍率 2×</View>
          <View className='export__spec-item'>1588 × 2246px</View>
        </View>
        <Text className='export__info-desc'>
          导出前会等待头像加载完成；内容超过一页时按 A4 高度自动分页，不会截断文字。
        </Text>
      </View>

      {/* 头像状态提醒 */}
      {model && !model.visibility.avatar && (
        <View className='export__notice'>
          <Text className='export__notice-text'>未上传头像，将使用占位图，不影响正常导出。</Text>
        </View>
      )}

      {/* 操作区 */}
      <View className='export__actions'>
        <AppButton variant='primary' block disabled={busy !== ''} onClick={handlePdf}>
          {busy === 'pdf' ? '正在生成 PDF…' : '导出 PDF'}
        </AppButton>
        <View className='export__gap' />
        <AppButton variant='ghost' block disabled={busy !== ''} onClick={handlePng}>
          {busy === 'png' ? '正在生成 PNG…' : '导出 PNG'}
        </AppButton>
        <View className='export__gap' />
        <AppButton variant='plain' block disabled={busy !== ''} onClick={openPreview}>
          导出前分页预览
        </AppButton>
        <View className='export__gap' />
        <AppButton variant='plain' block onClick={handleSave}>
          {busy === 'save' ? '处理中…' : '保存草稿到历史'}
        </AppButton>
      </View>

      {/* 上次导出结果 */}
      {lastExport && (
        <View className='export__card export__card--result'>
          <Text className='export__info-title'>已生成</Text>
          <Text className='export__result-name'>{lastExport.fileName}</Text>
          <Text className='export__result-path'>存放于小程序文件目录，可通过「打开」或「保存到相册」取出</Text>
        </View>
      )}

      <Text className='export__foot'>返回预览页可继续切换模板，模板不影响已填数据</Text>

      {/* 隐藏的高清导出画布：逻辑尺寸 794 × 1123，倍率由 exporter 控制 */}
      <ExportStage />

      {/* 分页预览弹窗 */}
      {previewOpen && (
        <View className='export__mask' onClick={() => setPreviewOpen(false)}>
          <View className='export__modal' onClick={(event) => event.stopPropagation()}>
            <View className='export__modal-head'>
              <Text className='export__modal-title'>分页预览 · {pages.length || pageCount} 页</Text>
              <Text className='export__modal-close' onClick={() => setPreviewOpen(false)}>关闭</Text>
            </View>

            <View className='export__modal-body'>
              {pages.length === 0 ? (
                <View className='export__modal-empty'>
                  <Text className='export__modal-empty-title'>分页预览需在小程序端生成</Text>
                  <Text className='export__modal-empty-desc'>
                    当前环境无法生成页面缩略图，导出时会按同样的 A4 高度分页处理。
                  </Text>
                </View>
              ) : (
                pages.map((src, index) => (
                  <View className='export__page' key={src}>
                    <Image className='export__page-img' src={src} mode='widthFix' />
                    <Text className='export__page-tag'>第 {index + 1} 页 / 共 {pages.length} 页</Text>
                  </View>
                ))
              )}
            </View>

            <View className='export__modal-foot'>
              <AppButton
                variant='primary'
                block
                onClick={() => {
                  setPreviewOpen(false)
                  void handlePdf()
                }}
              >
                确认无误，导出 PDF
              </AppButton>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}