/**
 * 预览页：A4 简历实时渲染 + 6 套模板切换 + 表单抽屉。
 */
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import AppButton from '@/features/resume/components/AppButton'
import ResumeCanvas from '@/features/resume/components/ResumeCanvas'
import * as storage from '@/features/resume/storage'
import { TEMPLATES, getTemplate, getTemplateIndex } from '@/features/resume/templates'
import type { ResumeDraft, ResumeModel } from '@/features/resume/types'

import './index.less'

export default function PreviewPage () {
  // 首屏直接读取本地草稿，无需在 effect 中再赋值
  const [draft, setDraft] = useState<ResumeDraft>(() => storage.loadDraft())
  const [pageCount, setPageCount] = useState(1)
  const [model, setModel] = useState<ResumeModel | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  const draftRef = useRef(draft)

  // 草稿变化时同步到 ref，供事件回调读取最新值
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  /** 从填写页返回时重新读取草稿 */
  useDidShow(() => {
    const current = storage.loadDraft()
    setDraft(current)
  })

  const activeIndex = getTemplateIndex(draft.templateId)
  const activeTemplate = getTemplate(draft.templateId)

  /** 画布回调保持稳定引用，避免画布重复渲染 */
  const handleMeta = useCallback((meta: { pageCount: number, model: ResumeModel }) => {
    setPageCount(meta.pageCount)
    setModel(meta.model)
  }, [])

  /** 切换模板：只换布局与配色，字段数据不变 */
  const switchTemplate = useCallback((id: string, silent = false) => {
    const next = getTemplate(id)
    if (next.id === getTemplate(draftRef.current.templateId).id) return

    setSwitching(true)
    const updated = { ...draftRef.current, templateId: next.id }
    setDraft(updated)
    storage.saveDraft(updated, false)

    if (!silent) {
      void Taro.showToast({ title: `已切换为${next.name}`, icon: 'none' })
    }
    setTimeout(() => setSwitching(false), 220)
  }, [])

  /** 上一套 / 下一套 */
  const stepTemplate = useCallback((delta: number) => {
    const total = TEMPLATES.length
    const nextIndex = (activeIndex + delta + total) % total
    switchTemplate(TEMPLATES[nextIndex].id)
  }, [activeIndex, switchTemplate])

  /** 合并校验摘要 */
  const summaryText = model
    ? `${model.experienceCount} 段经历 · ${model.skills.length} 项技能`
    : '正在计算…'

  return (
    <View className='preview'>
      {/* 顶部信息条 */}
      <View className='preview__bar'>
        <View className='preview__bar-left'>
          <Text className='preview__bar-title'>
            {model?.name || '未命名'}
            {model?.jobIntention ? ` · ${model.jobIntention}` : ''}
          </Text>
          <Text className='preview__bar-sub'>{summaryText}</Text>
        </View>
        <View className={`preview__page-tag ${pageCount > 1 ? 'is-multi' : ''}`}>
          {pageCount > 1 ? `${pageCount} 页 A4` : '单页 A4'}
        </View>
      </View>

      {/* 画布 */}
      <View className='preview__stage'>
        <ResumeCanvas
          draft={draft}
          canvasId='resumePreviewCanvas'
          showMeta
          onMeta={handleMeta}
        />
      </View>

      {/* 模板切换条 */}
      <View className='preview__templates'>
        <View className='preview__templates-head'>
          <Text className='preview__templates-title'>模板 · {activeTemplate.name}</Text>
          <Text className='preview__templates-desc'>{activeTemplate.desc}</Text>
        </View>

        <View className='preview__tpl-row'>
          {TEMPLATES.map((item) => (
            <View
              key={item.id}
              className={`preview__tpl ${item.id === activeTemplate.id ? 'is-active' : ''}`}
              onClick={() => switchTemplate(item.id)}
            >
              <View className='preview__tpl-thumb' style={{ background: item.thumb[0] }}>
                <View className='preview__tpl-block' style={{ background: item.thumb[1] }} />
                <View className='preview__tpl-lines'>
                  <View className='preview__tpl-line' style={{ background: item.thumb[2] }} />
                  <View className='preview__tpl-line preview__tpl-line--w70' style={{ background: item.thumb[2] }} />
                  <View className='preview__tpl-line preview__tpl-line--w80' style={{ background: item.thumb[2] }} />
                </View>
              </View>
              <Text className='preview__tpl-name'>{item.name}</Text>
            </View>
          ))}
        </View>

        <View className='preview__step'>
          <AppButton variant='plain' className='preview__step-btn' onClick={() => stepTemplate(-1)}>上一套</AppButton>
          <Text className='preview__step-index'>{activeIndex + 1} / {TEMPLATES.length}</Text>
          <AppButton variant='plain' className='preview__step-btn' onClick={() => stepTemplate(1)}>下一套</AppButton>
        </View>
      </View>

      {/* 底部操作 */}
      <View className='preview__footer'>
        <View className='preview__footer-inner'>
          <AppButton variant='ghost' className='preview__footer-plain' onClick={() => setSheetOpen(true)}>
            查看信息
          </AppButton>
          <AppButton
            variant='primary'
            className='preview__footer-main'
            onClick={() => {
              storage.saveDraft(draftRef.current, false)
              void Taro.navigateTo({ url: '/pages/export/index' })
            }}
          >
            去导出
          </AppButton>
        </View>
      </View>

      {/* 信息抽屉 */}
      {sheetOpen && (
        <View className='preview__mask' onClick={() => setSheetOpen(false)}>
          <View className='preview__sheet' onClick={(event) => event.stopPropagation()}>
            <View className='preview__sheet-head'>
              <Text className='preview__sheet-title'>简历速览</Text>
              <Text className='preview__sheet-close' onClick={() => setSheetOpen(false)}>关闭</Text>
            </View>

            <View className='preview__sheet-body'>
              <View className='preview__row'>
                <Text className='preview__row-label'>姓名</Text>
                <Text className='preview__row-value'>{model?.name || '未填写'}</Text>
              </View>
              <View className='preview__row'>
                <Text className='preview__row-label'>求职意向</Text>
                <Text className='preview__row-value'>{model?.jobIntention || '未填写'}</Text>
              </View>
              <View className='preview__row'>
                <Text className='preview__row-label'>手机号</Text>
                <Text className='preview__row-value'>{model?.phone || '未填写'}</Text>
              </View>
              <View className='preview__row'>
                <Text className='preview__row-label'>邮箱</Text>
                <Text className='preview__row-value'>{model?.email || '未填写'}</Text>
              </View>
              <View className='preview__row'>
                <Text className='preview__row-label'>头像</Text>
                <Text className='preview__row-value'>
                  {model?.visibility.avatar ? '已上传' : '使用占位图'}
                </Text>
              </View>
              <View className='preview__row'>
                <Text className='preview__row-label'>模块</Text>
                <Text className='preview__row-value'>{summaryText}</Text>
              </View>

              <View className='preview__sheet-tip'>
                空模块会自动隐藏，不会在简历里留下空白。切换模板只改布局与配色，字段数据不丢失。
              </View>
            </View>

            <View className='preview__sheet-foot'>
              <AppButton
                variant='plain'
                block
                onClick={() => {
                  setSheetOpen(false)
                  void Taro.navigateTo({ url: '/pages/form/index?mode=edit' })
                }}
              >
                返回修改填写内容
              </AppButton>
            </View>
          </View>
        </View>
      )}

      {switching && <View className='preview__switching'>切换布局中…</View>}
    </View>
  )
}