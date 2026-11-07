/**
 * 首页：三个入口 + 模板快选 + 历史草稿。
 */
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useState } from 'react'

import AppButton from '@/features/resume/components/AppButton'
import { MOCK_DRAFT } from '@/features/resume/mock'
import * as storage from '@/features/resume/storage'
import { getTemplate, TEMPLATES } from '@/features/resume/templates'
import type { DraftRecord } from '@/features/resume/types'
import { tidy } from '@/features/resume/utils'

import './index.less'

const TIPS = [
  '先填姓名、手机号、邮箱、求职意向这 4 项必填内容',
  '上传一张正面头像，导出更正式',
  '选一套模板，预览页可随时切换',
  '导出页生成 PDF 或 PNG，草稿自动留存'
]

export default function Index () {
  const [templateId, setTemplateId] = useState('t1')
  const [hasDraft, setHasDraft] = useState(false)
  const [draftSummary, setDraftSummary] = useState('')
  const [history, setHistory] = useState<DraftRecord[]>([])
  const [sheet, setSheet] = useState<'' | 'template' | 'history'>('')
  const [entering, setEntering] = useState(false)

  /** 同步首页展示状态 */
  const syncHome = useCallback(() => {
    const draft = storage.loadDraft()
    const list = storage.loadHistory()
    const exists = storage.hasDraft()

    setTemplateId(getTemplate(draft.templateId).id)
    setHasDraft(exists)
    setEntering(false)
    setHistory(list)
    setDraftSummary(
      exists
        ? `${tidy(draft.userInfo.name) || '未命名'} · ${tidy(draft.userInfo.jobIntention) || '未填写意向'}`
        : ''
    )
  }, [])

  useDidShow(() => {
    syncHome()
  })

  const currentTemplateName = useMemo(() => getTemplate(templateId).name, [templateId])

  /**
   * 开始制作 / 继续。
   *
   * 点击后立刻锁定并切换按钮文案，给出明确反馈；如果 navigateTo 失败
   * （页面栈已满等），退化为 redirectTo，而不是静默停在首页。
   */
  const goCreate = useCallback(() => {
    if (entering) return
    setEntering(true)

    const url = '/pages/form/index?mode=create'
    void Taro.navigateTo({ url }).catch((err) => {
      console.error('[resume] 打开填写页失败', err)
      return Taro.redirectTo({ url }).catch(() => {
        setEntering(false)
        void Taro.showToast({ title: '页面打开失败，请重试', icon: 'none' })
      })
    })
  }, [entering])

  /** 用草稿直接预览 */
  const goPreview = useCallback(() => {
    if (!storage.hasDraft()) {
      void Taro.showToast({ title: '还没有草稿，先填写吧', icon: 'none' })
      void Taro.navigateTo({ url: '/pages/form/index?mode=create' })
      return
    }
    void Taro.navigateTo({ url: '/pages/preview/index' })
  }, [])

  /** 填充示例数据 */
  const fillMock = useCallback(() => {
    void Taro.showModal({
      title: '填充示例数据',
      content: '会用一份完整示例简历覆盖当前草稿，用于快速查看 6 套模板效果。',
      confirmText: '填充',
      confirmColor: '#2ba471',
      success: (res) => {
        if (!res.confirm) return
        const draft = { ...MOCK_DRAFT, userInfo: { ...MOCK_DRAFT.userInfo }, templateId }
        storage.saveDraft(draft, false)
        syncHome()
        void Taro.showToast({ title: '已填充示例', icon: 'success' })
        setTimeout(() => {
          void Taro.navigateTo({ url: '/pages/form/index?mode=edit' })
        }, 400)
      }
    })
  }, [syncHome, templateId])

  /** 切换模板 */
  const pickTemplate = useCallback((id: string) => {
    const draft = storage.loadDraft()
    draft.templateId = id
    storage.saveDraft(draft, false)
    setTemplateId(id)
    void Taro.showToast({ title: `已切换为${getTemplate(id).name}`, icon: 'none' })
  }, [])

  /** 载入历史草稿 */
  const openDraft = useCallback((id: string) => {
    const record = storage.loadHistory().find((item) => item.id === id)
    if (!record) {
      void Taro.showToast({ title: '草稿已失效', icon: 'none' })
      return
    }
    storage.saveDraft(record.draft, false)
    setSheet('')
    void Taro.showToast({ title: '已载入草稿', icon: 'success' })
    setTimeout(() => {
      void Taro.navigateTo({ url: '/pages/preview/index' })
    }, 400)
  }, [])

  /** 删除一条草稿 */
  const removeDraft = useCallback((id: string) => {
    void Taro.showModal({
      title: '删除草稿',
      content: '删除后无法恢复，确定继续吗？',
      confirmText: '删除',
      confirmColor: '#e53935',
      success: (res) => {
        if (!res.confirm) return
        storage.removeHistory(id)
        syncHome()
        void Taro.showToast({ title: '已删除', icon: 'none' })
      }
    })
  }, [syncHome])

  /** 清空全部草稿 */
  const clearAll = useCallback(() => {
    void Taro.showModal({
      title: '清空草稿',
      content: '将删除全部历史草稿记录，当前编辑中的内容不受影响。',
      confirmText: '清空',
      confirmColor: '#e53935',
      success: (res) => {
        if (!res.confirm) return
        storage.clearHistory()
        setSheet('')
        syncHome()
        void Taro.showToast({ title: '已清空', icon: 'none' })
      }
    })
  }, [syncHome])

  return (
    <View className='home'>
      {/* Hero */}
      <View className='home__hero'>
        <View className='home__badge'>紧急场景专用</View>
        <Text className='home__title'>极速简历</Text>
        <Text className='home__desc'>
          传一张头像，填几行关键信息，一分钟内拿到可直接投递的简历。
        </Text>
      </View>

      {/* 主入口 */}
      <View
        className={`home__entry${entering ? ' is-entering' : ''}`}
        hoverClass={entering ? 'none' : 'home__entry--hover'}
        hoverStayTime={80}
        onClick={goCreate}
      >
        <View className='home__entry-main'>
          <Text className='home__entry-title'>开始制作</Text>
          <Text className='home__entry-desc'>
            {hasDraft ? draftSummary : '从空白开始，4 个必填项即可成稿'}
          </Text>
        </View>
        <View className='home__entry-badge'>{entering ? '进入中…' : hasDraft ? '继续' : '新建'}</View>
      </View>

      {/* 两宫格 */}
      <View className='home__grid'>
        <View className='home__cell' hoverClass='home__cell--hover' hoverStayTime={80} onClick={() => setSheet('template')}>
          <View className='home__cell-icon home__cell-icon--primary'>模</View>
          <Text className='home__cell-title'>选择模板</Text>
          <Text className='home__cell-desc'>当前：{currentTemplateName}</Text>
        </View>

        <View className='home__cell' hoverClass='home__cell--hover' hoverStayTime={80} onClick={() => setSheet('history')}>
          <View className='home__cell-icon home__cell-icon--warm'>稿</View>
          <Text className='home__cell-title'>历史草稿</Text>
          <Text className='home__cell-desc'>
            {history.length > 0 ? `${history.length} 份已保存` : '暂无保存记录'}
          </Text>
        </View>
      </View>

      {/* 快捷动作 */}
      <View className='home__quick'>
        <AppButton variant='ghost' className='home__quick-btn' onClick={fillMock}>填充示例数据</AppButton>
        <AppButton variant='ghost' className='home__quick-btn' onClick={goPreview}>用草稿生成</AppButton>
      </View>

      {/* 急救清单 */}
      <View className='home__card'>
        <Text className='home__section'>最快成稿路径</Text>
        {TIPS.map((tip, index) => (
          <View className='home__tip' key={tip}>
            <View className='home__tip-index'>{index + 1}</View>
            <Text className='home__tip-text'>{tip}</Text>
          </View>
        ))}
      </View>

      <Text className='home__foot'>简历数据仅保存在本机，不会上传服务器</Text>

      {/* 模板选择弹层 */}
      {sheet === 'template' && (
        <View className='home__mask' onClick={() => setSheet('')}>
          <View className='home__sheet' onClick={(event) => event.stopPropagation()}>
            <View className='home__sheet-head'>
              <Text className='home__section'>选择模板</Text>
              <Text className='home__sheet-close' onClick={() => setSheet('')}>关闭</Text>
            </View>

            <ScrollView className='home__sheet-body' scrollY>
              <View className='home__tpl-list'>
                {TEMPLATES.map((item) => (
                  <View
                    key={item.id}
                    className={`home__tpl ${item.id === templateId ? 'is-active' : ''}`}
                    onClick={() => pickTemplate(item.id)}
                  >
                    <View className='home__tpl-thumb' style={{ background: item.thumb[0] }}>
                      <View className='home__tpl-block' style={{ background: item.thumb[1] }} />
                      <View className='home__tpl-rows'>
                        <View className='home__tpl-row' style={{ background: item.thumb[2] }} />
                        <View className='home__tpl-row home__tpl-row--w70' style={{ background: item.thumb[2] }} />
                        <View className='home__tpl-row home__tpl-row--w85' style={{ background: item.thumb[2] }} />
                        <View className='home__tpl-row home__tpl-row--w55' style={{ background: item.thumb[2] }} />
                      </View>
                    </View>
                    <Text className='home__tpl-name'>{item.name}</Text>
                    <Text className='home__tpl-desc'>{item.desc}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>

            <View className='home__sheet-foot'>
              <AppButton block onClick={goPreview}>使用该模板并预览</AppButton>
            </View>
          </View>
        </View>
      )}

      {/* 历史草稿弹层 */}
      {sheet === 'history' && (
        <View className='home__mask' onClick={() => setSheet('')}>
          <View className='home__sheet' onClick={(event) => event.stopPropagation()}>
            <View className='home__sheet-head'>
              <Text className='home__section'>历史草稿</Text>
              <Text className='home__sheet-close' onClick={() => setSheet('')}>关闭</Text>
            </View>

            <ScrollView className='home__sheet-body' scrollY>
              {history.length === 0 ? (
                <View className='home__empty'>
                  <View className='home__empty-icon'>稿</View>
                  <Text className='home__empty-title'>还没有保存的草稿</Text>
                  <Text className='home__empty-desc'>在导出页点击「保存草稿」即可留存</Text>
                </View>
              ) : (
                history.map((item) => (
                  <View className='home__draft' key={item.id} onClick={() => openDraft(item.id)}>
                    <View className='home__draft-avatar'>
                      {item.avatar
                        ? <Image className='home__draft-img' src={item.avatar} mode='aspectFill' />
                        : <Text className='home__draft-holder'>{item.name.slice(0, 1)}</Text>}
                    </View>
                    <View className='home__draft-main'>
                      <Text className='home__draft-name'>{item.name}</Text>
                      <Text className='home__draft-desc'>{item.jobIntention || '未填写求职意向'}</Text>
                      <Text className='home__draft-time'>{item.updatedText}</Text>
                    </View>
                    <Text
                      className='home__draft-del'
                      onClick={(event) => {
                        event.stopPropagation()
                        removeDraft(item.id)
                      }}
                    >
                      删除
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {history.length > 0 && (
              <View className='home__sheet-foot'>
                <AppButton variant='danger' block onClick={clearAll}>清空全部草稿</AppButton>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  )
}