/**
 * 填写页：头像上传裁剪 + 分组表单 + 经历增删 + 实时校验。
 */
import { Image, Input, Picker, Slider, Text, Textarea, View } from '@tarojs/components'
import type { BaseEventOrig, InputProps, PickerSelectorProps, SliderProps, TextareaProps } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'

import AppButton from '@/features/resume/components/AppButton'
import AvatarCropper from '@/features/resume/components/AvatarCropper'
import {
  EDUCATION_OPTIONS,
  GENDER_OPTIONS,
  POLITICS_OPTIONS,
  createEmptyDraft,
  createEmptyExperience,
  createEmptySkill
} from '@/features/resume/mock'
import * as storage from '@/features/resume/storage'
import { persistImage, pickImage } from '@/features/resume/pick'
import type { ExperienceItem, ResumeDraft, SkillItem, UserInfo } from '@/features/resume/types'
import { validateField, validateUserInfo } from '@/features/resume/validate'

import './index.less'

type GroupKey = 'basic' | 'experience' | 'skill' | 'extra'

const EXPERIENCE_TABS: Array<{ value: ExperienceItem['type'], label: string }> = [
  { value: 'education', label: '教育' },
  { value: 'work', label: '工作' },
  { value: 'project', label: '项目' }
]

/** 载入初始草稿，并保证经历与技能至少各有一条 */
function loadInitialDraft (mode: string): ResumeDraft {
  const initial = mode === 'create' && !storage.hasDraft() ? createEmptyDraft() : storage.loadDraft()
  if (initial.experiences.length === 0) initial.experiences = [createEmptyExperience('education')]
  if (initial.skills.length === 0) initial.skills = [createEmptySkill()]
  return initial
}

export default function FormPage () {
  const router = useRouter()
  const mode = router.params?.mode ?? 'edit'

  // 首屏直接计算初始草稿，避免在 effect 中同步 setState
  const [draft, setDraft] = useState<ResumeDraft>(() => loadInitialDraft(mode))
  const [groups, setGroups] = useState<Record<GroupKey, boolean>>({
    basic: true,
    experience: true,
    skill: true,
    extra: false
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focusKey, setFocusKey] = useState('')

  const [cropVisible, setCropVisible] = useState(false)
  const [cropSrc, setCropSrc] = useState('')

  const draftRef = useRef(draft)

  // 草稿变化时同步到 ref，供自动保存与校验在事件中读取最新值
  useEffect(() => {
    draftRef.current = draft
  }, [draft])

  /** 首次进入提示 */
  useEffect(() => {
    if (mode !== 'create') return
    const timer = setTimeout(() => {
      void Taro.showToast({ title: '填写 4 项必填即可成稿', icon: 'none' })
    }, 300)
    return () => clearTimeout(timer)
  }, [mode])

  /**
   * 自动保存（防抖）。
   * 由调用方传入最新草稿，函数自身不持有组件状态引用，
   * 因此可以在渲染期只创建一次且不触碰 ref。
   */
  const [autoSave] = useState(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return (next: ResumeDraft) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        storage.saveDraft(next, false)
      }, 600)
    }
  })

  /** 立即持久化当前草稿 */
  const persist = useCallback(() => {
    const latest = draftRef.current
    if (latest) storage.saveDraft(latest, false)
  }, [])

  /** 更新基本信息字段 */
  const updateField = useCallback((key: keyof UserInfo, value: string) => {
    setDraft((prev) => {
      const next = { ...prev, userInfo: { ...prev.userInfo, [key]: value } }
      autoSave(next)
      return next
    })
    setErrors((prev) => {
      const message = validateField(key, value)
      const next = { ...prev }
      if (message) next[key] = message
      else delete next[key]
      return next
    })
  }, [autoSave])

  const handleInput = useCallback((key: keyof UserInfo) =>
    (event: BaseEventOrig<InputProps.inputEventDetail>) => {
      updateField(key, event.detail.value)
    }, [updateField])

  const handlePicker = useCallback((key: keyof UserInfo, options: string[]) =>
    (event: BaseEventOrig<PickerSelectorProps.ChangeEventDetail>) => {
      updateField(key, options[Number(event.detail.value)] ?? '')
    }, [updateField])

  /** 更新经历 */
  const updateExperience = useCallback((id: string, patch: Partial<ExperienceItem>) => {
    setDraft((prev) => {
      const next = {
        ...prev,
        experiences: prev.experiences.map((item) => (item.id === id ? { ...item, ...patch } : item))
      }
      autoSave(next)
      return next
    })
  }, [autoSave])

  /** 更新技能 */
  const updateSkill = useCallback((id: string, patch: Partial<SkillItem>) => {
    setDraft((prev) => {
      const next = {
        ...prev,
        skills: prev.skills.map((item) => (item.id === id ? { ...item, ...patch } : item))
      }
      autoSave(next)
      return next
    })
  }, [autoSave])

  const addExperience = useCallback((type: ExperienceItem['type']) => {
    setDraft((prev) => {
      const next = { ...prev, experiences: [...prev.experiences, createEmptyExperience(type)] }
      autoSave(next)
      return next
    })
    setGroups((prev) => ({ ...prev, experience: true }))
    void Taro.showToast({ title: '已添加一条', icon: 'none' })
  }, [autoSave])

  const removeExperience = useCallback((id: string) => {
    setDraft((prev) => {
      const filtered = prev.experiences.filter((item) => item.id !== id)
      const next = {
        ...prev,
        experiences: filtered.length > 0 ? filtered : [createEmptyExperience('education')]
      }
      autoSave(next)
      return next
    })
  }, [autoSave])

  const addSkill = useCallback(() => {
    setDraft((prev) => {
      const next = { ...prev, skills: [...prev.skills, createEmptySkill()] }
      autoSave(next)
      return next
    })
    setGroups((prev) => ({ ...prev, skill: true }))
  }, [autoSave])

  const removeSkill = useCallback((id: string) => {
    setDraft((prev) => {
      const filtered = prev.skills.filter((item) => item.id !== id)
      const next = { ...prev, skills: filtered.length > 0 ? filtered : [createEmptySkill()] }
      autoSave(next)
      return next
    })
  }, [autoSave])

  /** 选择头像 */
  const chooseAvatar = useCallback(async () => {
    try {
      const result = await pickImage()

      // 用户取消或能力不可用：安静结束，不修改任何数据
      if (result.canceled || !result.tempFilePath) return

      setCropSrc(result.tempFilePath)
      setCropVisible(true)
    } catch (err) {
      void Taro.showToast({
        title: err instanceof Error ? err.message : '选择图片失败',
        icon: 'none'
      })
    }
  }, [])

  /**
   * 落盘头像。
   *
   * 先持久化路径再写入草稿：小程序临时文件重启后会失效，
   * 直接存临时路径会导致下次打开头像变空白。
   */
  const applyAvatar = useCallback(async (path: string, toast = '头像已更新') => {
    setCropVisible(false)
    setCropSrc('')

    try {
      const persisted = await persistImage(path)
      setDraft((prev) => {
        const next = { ...prev, userInfo: { ...prev.userInfo, avatar: persisted } }
        // 立即落盘，避免用户随后离开导致头像丢失
        storage.saveDraft(next, false)
        return next
      })
      void Taro.showToast({ title: toast, icon: 'success' })
    } catch (err) {
      console.error('[resume] 头像保存失败', err)
      void Taro.showToast({ title: '头像保存失败，请重试', icon: 'none' })
    }
  }, [])

  /** 校验并提示 */
  const checkForm = useCallback(() => {
    const result = validateUserInfo(draftRef.current.userInfo)
    setErrors(result.errors)
    if (!result.valid) {
      setGroups((prev) => ({ ...prev, basic: true }))
      void Taro.showToast({ title: result.messages[0], icon: 'none' })
    }
    return result
  }, [])

  /** 保存草稿 */
  const saveDraft = useCallback(() => {
    const result = validateUserInfo(draftRef.current.userInfo)
    if (result.valid) {
      storage.saveDraft(draftRef.current, true)
      void Taro.showToast({ title: '草稿已保存', icon: 'success' })
      return
    }

    void Taro.showModal({
      title: '还有必填项未完成',
      content: `${result.messages[0]}。仍要保存为草稿吗？`,
      confirmText: '保存',
      confirmColor: '#2ba471',
      success: (res) => {
        if (!res.confirm) return
        storage.saveDraft(draftRef.current, true)
        void Taro.showToast({ title: '草稿已保存', icon: 'success' })
      }
    })
  }, [])

  /** 去预览 */
  const goPreview = useCallback(() => {
    const result = checkForm()
    if (!result.valid) return
    persist()
    void Taro.navigateTo({ url: '/pages/preview/index' })
  }, [checkForm, persist])

  return (
    <View className='form'>
      {/* 头像 */}
      <View className='form__card form__avatar-card'>
        <View className='form__avatar-box' onClick={chooseAvatar}>
          {draft.userInfo.avatar ? (
            <Image className='form__avatar-img' src={draft.userInfo.avatar} mode='aspectFill' />
          ) : (
            <View className='form__avatar-holder'>
              <View className='form__avatar-head' />
              <View className='form__avatar-body' />
            </View>
          )}
        </View>

        <View className='form__avatar-main'>
          <Text className='form__avatar-title'>头像</Text>
          <Text className='form__avatar-desc'>点击上传并裁剪；未上传时使用占位图，不影响导出</Text>
          <View className='form__avatar-actions'>
            <AppButton variant='primary' className='form__mini-btn' onClick={chooseAvatar}>选择图片</AppButton>
            {draft.userInfo.avatar !== '' && (
              <AppButton
                variant='plain'
                className='form__mini-btn'
                onClick={() => {
                  setDraft((prev) => ({ ...prev, userInfo: { ...prev.userInfo, avatar: '' } }))
                  persist()
                  void Taro.showToast({ title: '已移除头像', icon: 'none' })
                }}
              >
                移除
              </AppButton>
            )}
          </View>
        </View>
      </View>

      {/* 基本信息 */}
      <View className='form__card'>
        <View className='form__group-head' onClick={() => setGroups((prev) => ({ ...prev, basic: !prev.basic }))}>
          <View className='form__group-title'>
            <Text className='form__group-text'>基本信息</Text>
            <Text className='form__flag'>必填 4 项</Text>
          </View>
          <Text className={`form__arrow ${groups.basic ? 'is-open' : ''}`}>⌄</Text>
        </View>

        {groups.basic && (
          <View className='form__group-body'>
            {([
              { key: 'name' as const, label: '姓名', placeholder: '请输入真实姓名', required: true },
              { key: 'phone' as const, label: '手机号', placeholder: '11 位手机号', required: true, type: 'number' as const },
              { key: 'email' as const, label: '邮箱', placeholder: 'name@example.com', required: true },
              { key: 'jobIntention' as const, label: '求职意向', placeholder: '如：前端开发工程师', required: true }
            ]).map((field) => (
              <View className='form__field-wrap' key={field.key}>
                <View className={`form__field ${errors[field.key] ? 'is-error' : ''} ${focusKey === field.key ? 'is-focus' : ''}`}>
                  <Text className='form__label'>
                    {field.label}
                    {field.required && <Text className='form__req'>*</Text>}
                  </Text>
                  <Input
                    className='form__input'
                    type={field.type ?? 'text'}
                    value={draft.userInfo[field.key]}
                    placeholder={field.placeholder}
                    placeholderClass='form__ph'
                    maxlength={field.key === 'phone' ? 11 : 60}
                    onInput={handleInput(field.key)}
                    onFocus={() => setFocusKey(field.key)}
                    onBlur={() => {
                      setFocusKey('')
                      persist()
                    }}
                  />
                </View>
                {errors[field.key] && <Text className='form__tip'>{errors[field.key]}</Text>}
              </View>
            ))}

            <Text className='form__sub'>选填信息</Text>

            <View className='form__grid2'>
              <View className='form__field'>
                <Text className='form__label'>性别</Text>
                <Picker
                  mode='selector'
                  range={GENDER_OPTIONS}
                  onChange={handlePicker('gender', GENDER_OPTIONS)}
                >
                  <View className={`form__picker ${draft.userInfo.gender ? '' : 'is-placeholder'}`}>
                    {draft.userInfo.gender || '请选择'}
                  </View>
                </Picker>
              </View>
              <View className='form__field'>
                <Text className='form__label'>年龄</Text>
                <Input
                  className='form__input'
                  type='number'
                  value={draft.userInfo.age}
                  placeholder='如 26'
                  placeholderClass='form__ph'
                  maxlength={2}
                  onInput={handleInput('age')}
                />
              </View>
            </View>

            <View className='form__grid2'>
              <View className='form__field'>
                <Text className='form__label'>籍贯</Text>
                <Input
                  className='form__input'
                  value={draft.userInfo.hometown}
                  placeholder='如 浙江杭州'
                  placeholderClass='form__ph'
                  maxlength={20}
                  onInput={handleInput('hometown')}
                />
              </View>
              <View className='form__field'>
                <Text className='form__label'>现居城市</Text>
                <Input
                  className='form__input'
                  value={draft.userInfo.city}
                  placeholder='如 上海'
                  placeholderClass='form__ph'
                  maxlength={20}
                  onInput={handleInput('city')}
                />
              </View>
            </View>

            <View className='form__grid2'>
              <View className='form__field'>
                <Text className='form__label'>政治面貌</Text>
                <Picker
                  mode='selector'
                  range={POLITICS_OPTIONS}
                  onChange={handlePicker('politics', POLITICS_OPTIONS)}
                >
                  <View className={`form__picker ${draft.userInfo.politics ? '' : 'is-placeholder'}`}>
                    {draft.userInfo.politics || '请选择'}
                  </View>
                </Picker>
              </View>
              <View className='form__field'>
                <Text className='form__label'>学历</Text>
                <Picker
                  mode='selector'
                  range={EDUCATION_OPTIONS}
                  onChange={handlePicker('education', EDUCATION_OPTIONS)}
                >
                  <View className={`form__picker ${draft.userInfo.education ? '' : 'is-placeholder'}`}>
                    {draft.userInfo.education || '请选择'}
                  </View>
                </Picker>
              </View>
            </View>

            <View className='form__field form__field--full'>
              <Text className='form__label'>专业</Text>
              <Input
                className='form__input'
                value={draft.userInfo.major}
                placeholder='如 计算机科学与技术'
                placeholderClass='form__ph'
                maxlength={30}
                onInput={handleInput('major')}
              />
            </View>

            <View className='form__field form__field--full'>
              <Text className='form__label'>毕业院校</Text>
              <Input
                className='form__input'
                value={draft.userInfo.school}
                placeholder='如 同济大学'
                placeholderClass='form__ph'
                maxlength={30}
                onInput={handleInput('school')}
              />
            </View>
          </View>
        )}
      </View>

      {/* 经历 */}
      <View className='form__card'>
        <View className='form__group-head' onClick={() => setGroups((prev) => ({ ...prev, experience: !prev.experience }))}>
          <View className='form__group-title'>
            <Text className='form__group-text'>经历</Text>
            <Text className='form__flag form__flag--plain'>{draft.experiences.length} 条</Text>
          </View>
          <Text className={`form__arrow ${groups.experience ? 'is-open' : ''}`}>⌄</Text>
        </View>

        {groups.experience && (
          <View className='form__group-body'>
            {draft.experiences.map((item) => (
              <View className='form__exp' key={item.id}>
                <View className='form__exp-head'>
                  <View className='form__tabs'>
                    {EXPERIENCE_TABS.map((tab) => (
                      <Text
                        key={tab.value}
                        className={`form__tab ${item.type === tab.value ? 'is-active' : ''}`}
                        onClick={() => updateExperience(item.id, { type: tab.value })}
                      >
                        {tab.label}
                      </Text>
                    ))}
                  </View>
                  <Text className='form__del' onClick={() => removeExperience(item.id)}>删除</Text>
                </View>

                <View className='form__grid2'>
                  <View className='form__field'>
                    <Text className='form__label'>开始时间</Text>
                    <Input
                      className='form__input'
                      value={item.startTime}
                      placeholder='2019.09'
                      placeholderClass='form__ph'
                      maxlength={12}
                      onInput={(e) => updateExperience(item.id, { startTime: e.detail.value })}
                    />
                  </View>
                  <View className='form__field'>
                    <Text className='form__label'>结束时间</Text>
                    <Input
                      className='form__input'
                      value={item.endTime}
                      placeholder='至今'
                      placeholderClass='form__ph'
                      maxlength={12}
                      onInput={(e) => updateExperience(item.id, { endTime: e.detail.value })}
                    />
                  </View>
                </View>

                <View className='form__field form__field--full'>
                  <Text className='form__label'>
                    {item.type === 'education' ? '学校名称' : item.type === 'work' ? '公司名称' : '项目名称'}
                  </Text>
                  <Input
                    className='form__input'
                    value={item.org}
                    placeholder={item.type === 'education' ? '如 同济大学' : item.type === 'work' ? '如 云启科技' : '如 智能简历平台'}
                    placeholderClass='form__ph'
                    maxlength={40}
                    onInput={(e) => updateExperience(item.id, { org: e.detail.value })}
                  />
                </View>

                <View className='form__field form__field--full'>
                  <Text className='form__label'>{item.type === 'education' ? '专业 / 学历' : '岗位 / 角色'}</Text>
                  <Input
                    className='form__input'
                    value={item.role}
                    placeholder={item.type === 'education' ? '如 计算机科学与技术 · 本科' : '如 前端开发工程师'}
                    placeholderClass='form__ph'
                    maxlength={40}
                    onInput={(e) => updateExperience(item.id, { role: e.detail.value })}
                  />
                </View>

                <View className='form__field form__field--full'>
                  <Text className='form__label'>内容描述</Text>
                  <Textarea
                    className='form__textarea'
                    value={item.content}
                    placeholder='一句话说清做了什么、结果如何，用数字更有说服力'
                    placeholderClass='form__ph'
                    maxlength={500}
                    autoHeight
                    onInput={(e: BaseEventOrig<TextareaProps.onInputEventDetail>) =>
                      updateExperience(item.id, { content: e.detail.value })}
                  />
                </View>
              </View>
            ))}

            <View className='form__add-row'>
              <Text className='form__add' onClick={() => addExperience('education')}>+ 教育经历</Text>
              <Text className='form__add' onClick={() => addExperience('work')}>+ 工作实习</Text>
              <Text className='form__add' onClick={() => addExperience('project')}>+ 项目经历</Text>
            </View>
          </View>
        )}
      </View>

      {/* 技能证书 */}
      <View className='form__card'>
        <View className='form__group-head' onClick={() => setGroups((prev) => ({ ...prev, skill: !prev.skill }))}>
          <View className='form__group-title'>
            <Text className='form__group-text'>技能证书</Text>
            <Text className='form__flag form__flag--plain'>{draft.skills.length} 项</Text>
          </View>
          <Text className={`form__arrow ${groups.skill ? 'is-open' : ''}`}>⌄</Text>
        </View>

        {groups.skill && (
          <View className='form__group-body'>
            {draft.skills.map((item) => (
              <View className='form__skill' key={item.id}>
                <View className='form__skill-row'>
                  <Input
                    className='form__skill-input'
                    value={item.name}
                    placeholder='如 TypeScript / CET-6'
                    placeholderClass='form__ph'
                    maxlength={30}
                    onInput={(e) => updateSkill(item.id, { name: e.detail.value })}
                  />
                  <Text className='form__del' onClick={() => removeSkill(item.id)}>删除</Text>
                </View>
                <View className='form__skill-level'>
                  <Text className='form__skill-label'>掌握程度</Text>
                  <Slider
                    className='form__slider'
                    min={0}
                    max={100}
                    step={5}
                    value={item.level}
                    activeColor='#2ba471'
                    backgroundColor='#eee'
                    blockSize={18}
                    onChanging={(e: BaseEventOrig<SliderProps.onChangeEventDetail>) =>
                      updateSkill(item.id, { level: e.detail.value })}
                    onChange={(e: BaseEventOrig<SliderProps.onChangeEventDetail>) =>
                      updateSkill(item.id, { level: e.detail.value })}
                  />
                  <Text className='form__skill-value'>{item.level}%</Text>
                </View>
              </View>
            ))}

            <View className='form__add-row'>
              <Text className='form__add form__add--wide' onClick={addSkill}>+ 添加技能或证书</Text>
            </View>
          </View>
        )}
      </View>

      {/* 获奖与自我评价 */}
      <View className='form__card'>
        <View className='form__group-head' onClick={() => setGroups((prev) => ({ ...prev, extra: !prev.extra }))}>
          <View className='form__group-title'>
            <Text className='form__group-text'>获奖与自我评价</Text>
          </View>
          <Text className={`form__arrow ${groups.extra ? 'is-open' : ''}`}>⌄</Text>
        </View>

        {groups.extra && (
          <View className='form__group-body'>
            <View className='form__field form__field--full'>
              <Text className='form__label'>获奖情况</Text>
              <Textarea
                className='form__textarea'
                value={draft.awards}
                placeholder='一行一条，如：2023 年度公司技术创新奖'
                placeholderClass='form__ph'
                maxlength={500}
                autoHeight
                onInput={(e) => {
                  setDraft((prev) => {
                    const next = { ...prev, awards: e.detail.value }
                    autoSave(next)
                    return next
                  })
                }}
              />
            </View>

            <View className='form__field form__field--full'>
              <Text className='form__label'>自我评价</Text>
              <Textarea
                className='form__textarea'
                value={draft.summary}
                placeholder='两三句话，突出经验年限、擅长方向与交付稳定性'
                placeholderClass='form__ph'
                maxlength={500}
                autoHeight
                onInput={(e) => {
                  setDraft((prev) => {
                    const next = { ...prev, summary: e.detail.value }
                    autoSave(next)
                    return next
                  })
                }}
              />
            </View>
          </View>
        )}
      </View>

      <Text className='form__note'>内容实时保存到本机草稿，切页不会丢失</Text>

      {/* 底部操作 */}
      <View className='form__footer'>
        <View className='form__footer-inner'>
          <AppButton variant='ghost' className='form__footer-plain' onClick={saveDraft}>保存草稿</AppButton>
          <AppButton variant='primary' className='form__footer-main' onClick={goPreview}>预览简历</AppButton>
        </View>
      </View>

      {/* 头像裁剪 */}
      <AvatarCropper
        visible={cropVisible}
        src={cropSrc}
        onCancel={() => setCropVisible(false)}
        onRepick={() => {
          // 重新选择：先关闭浮层，再唤起选图
          setCropVisible(false)
          setCropSrc('')
          setTimeout(() => { void chooseAvatar() }, 100)
        }}
        onConfirm={(path) => {
          void applyAvatar(path)
        }}
        onSkip={(original) => {
          // 裁剪反复失败时的兜底：直接用原图，保证流程能走完
          void applyAvatar(original, '已使用原图')
        }}
      />
    </View>
  )
}