<template>
  <div class="diary-editor-page">
    <ConversationSidebar />
    <main class="editor-main">
      <header class="editor-header">
        <div>
          <a-button type="text" class="back-button" @click="router.push('/diaries')"><ArrowLeftOutlined />返回信息需求记录</a-button>
          <h1>{{ editingId ? '编辑信息需求记录' : '每日信息需求记录' }}</h1>
          <p>{{ editingId ? '修改当天的信息需求、获取过程与反思' : '记录信息需求、搜寻过程、获取结果与反思' }}</p>
        </div>
        <a-tag v-if="sourcePreview" color="green"><LinkOutlined /> 已关联 {{ sourceSubmissionId ? '案例' : 'AI 对话' }}</a-tag>
      </header>

      <div v-if="loading" class="loading-state"><a-spin />正在读取来源内容...</div>
      <div v-else class="editor-grid">
        <aside class="source-panel">
          <div class="panel-heading">
            <span>{{ sourcePreview ? '来源内容' : '记录日期' }}</span>
            <a-tag v-if="sourcePreview?.platform">{{ sourcePreview.platform }}</a-tag>
          </div>
          <template v-if="sourcePreview">
            <section class="source-block">
              <small>向 AI 提出的问题</small>
              <p>{{ sourcePreview.prompt }}</p>
            </section>
            <section class="source-block answer-block">
              <small>AI 回复</small>
              <p>{{ sourcePreview.aiAnswer }}</p>
            </section>
            <div v-if="sourcePreview.model" class="source-model">模型：{{ sourcePreview.model }}</div>
          </template>
          <template v-else>
            <div class="date-card">
              <strong>{{ diaryDate.format('DD') }}</strong>
              <span>{{ diaryDate.format('YYYY 年 MM 月') }}</span>
            </div>
          </template>
        </aside>

        <section class="form-panel">
          <a-form ref="formRef" :model="form" layout="vertical">
            <div class="section-title"><span>发生时间与情境</span><small>第 1 部分</small></div>
            <a-row :gutter="16">
              <a-col :xs="24" :md="12">
                <a-form-item label="日期" required>
                  <a-date-picker v-model:value="diaryDate" :allow-clear="false" :disabled="Boolean(editingId)" style="width:100%" />
                </a-form-item>
              </a-col>
              <a-col :xs="24" :md="12">
                <a-form-item label="发生时间">
                  <a-time-picker v-model:value="diaryTime" format="HH:mm" style="width:100%" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="发生情境" name="contextText" :rules="requiredRule('请描述发生情境')">
              <a-textarea v-model:value="form.contextText" :rows="2" placeholder="什么情境触发了这次信息需求？" />
            </a-form-item>
            <a-form-item label="信息需求" name="needDescription" :rules="requiredRule('请描述信息需求')">
              <a-textarea v-model:value="form.needDescription" :rows="2" placeholder="当时具体想知道或解决什么？" />
            </a-form-item>

            <div class="section-title"><span>搜寻与获取过程</span><small>第 2 部分</small></div>
            <a-form-item label="使用的渠道和工具" name="channels" :rules="requiredRule('请填写渠道和工具')">
              <a-input v-model:value="form.channels" placeholder="搜索引擎、同学、图书馆、AI 等" />
            </a-form-item>
            <a-form-item label="搜寻过程" name="searchProcess" :rules="requiredRule('请完整记录搜寻过程')">
              <a-textarea v-model:value="form.searchProcess" :rows="4" placeholder="按实际顺序记录关键词、工具选择和调整过程" />
            </a-form-item>

            <div class="section-title"><span>结果与反思</span><small>第 3 部分</small></div>
            <a-form-item label="获取结果" name="outcome" :rules="requiredRule('请记录获取结果')">
              <a-textarea v-model:value="form.outcome" :rows="4" placeholder="记录最终获得的信息或答案" />
            </a-form-item>
            <a-form-item label="反思" name="reflection" :rules="requiredRule('请填写反思')">
              <a-textarea v-model:value="form.reflection" :rows="3" placeholder="结果是否满足需求？下次会如何改进？" />
            </a-form-item>

            <div class="genai-row">
              <a-checkbox v-model:checked="form.isGenaiRelated" :disabled="Boolean(sourcePreview)">与 GenAI 有关</a-checkbox>
              <a-select
                v-if="form.isGenaiRelated"
                v-model:value="form.genaiPlatform"
                :disabled="platformLocked"
                placeholder="选择 GenAI 平台"
                style="width:220px"
              >
                <a-select-option v-for="item in PLATFORM_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </div>

            <a-alert type="info" show-icon message="每日作业与案例分别保存" description="提交这条记录不会自动发布案例；提交成功后可以再决定是否同时提交为案例。" />
            <div class="form-actions">
              <a-button v-if="originalStatus !== 'submitted'" :loading="savingDraft" :disabled="submitting" @click="saveRecord('draft')"><SaveOutlined />保存草稿</a-button>
              <a-button type="primary" :loading="submitting" :disabled="savingDraft" @click="saveRecord('submitted')"><SendOutlined />{{ originalStatus === 'submitted' ? '保存修改' : '提交作业' }}</a-button>
            </div>
          </a-form>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { onActivated, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { ArrowLeftOutlined, LinkOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { createDiary, getDiary, getDiaryDraftFromCase, getDiaryDraftFromMessage, updateDiary } from '../../api/diary'
import { PLATFORM_OPTIONS } from '../../constants/options'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const loading = ref(true)
const savingDraft = ref(false)
const submitting = ref(false)
const loaded = ref(false)
const dirty = ref(false)
const diaryDate = ref(dayjs())
const diaryTime = ref(dayjs())
const sourcePreview = ref(null)
const platformLocked = ref(false)
const editingId = ref('')
const originalStatus = ref(null)

const emptyForm = () => ({
  contextText: '', needDescription: '', channels: '', searchProcess: '', outcome: '', reflection: '',
  isGenaiRelated: false, genaiPlatform: undefined, linkedConversationId: null,
  sourceMessageId: null, sourceSubmissionId: null,
})
const form = reactive(emptyForm())
const sourceSubmissionId = ref(null)
const requiredRule = messageText => [{ required: true, whitespace: true, message: messageText }]

onActivated(() => loadSource(route))
watch(form, () => { if (loaded.value) dirty.value = true }, { deep: true })
watch([diaryDate, diaryTime], () => { if (loaded.value) dirty.value = true })

onBeforeRouteLeave(() => {
  if (!dirty.value || savingDraft.value || submitting.value) return true
  return window.confirm('信息需求记录尚未保存，确定离开吗？')
})

onBeforeRouteUpdate(async to => {
  if (dirty.value && !window.confirm('信息需求记录尚未保存，确定切换吗？')) return false
  await loadSource(to)
})

function resetEditorState() {
  loading.value = true
  loaded.value = false
  dirty.value = false
  editingId.value = ''
  originalStatus.value = null
  diaryDate.value = dayjs()
  diaryTime.value = dayjs()
  sourcePreview.value = null
  sourceSubmissionId.value = null
  platformLocked.value = false
  Object.assign(form, emptyForm())
  formRef.value?.clearValidate()
}

async function loadSource(targetRoute = route) {
  resetEditorState()
  try {
    let response = null
    if (targetRoute.params.id) {
      response = await getDiary(targetRoute.params.id)
      if (!response.data.editable) {
        message.warning('历史信息需求记录仅供查看，只能修改当天记录')
        await router.replace('/diaries')
        return
      }
      editingId.value = response.data.id
      originalStatus.value = response.data.status
    } else if (targetRoute.query.caseId) response = await getDiaryDraftFromCase(targetRoute.query.caseId)
    else if (targetRoute.query.messageId) response = await getDiaryDraftFromMessage(targetRoute.query.messageId)
    if (response) {
      const data = response.data
      Object.assign(form, emptyForm(), Object.fromEntries(Object.keys(emptyForm()).map(key => [key, data[key] ?? emptyForm()[key]])))
      diaryDate.value = dayjs(data.logDate || undefined)
      diaryTime.value = data.occurredAt ? dayjs(`${data.logDate}T${data.occurredAt}`) : dayjs()
      sourcePreview.value = data.sourcePreview || null
      sourceSubmissionId.value = data.sourceSubmissionId || null
      platformLocked.value = Boolean(data.platformLocked || data.sourceMessageId || data.sourceSubmissionId)
    }
  } catch (error) {
    message.error(error.response?.data?.message || '来源内容读取失败')
  } finally {
    loaded.value = true
    dirty.value = false
    loading.value = false
  }
}

function hasDraftContent() {
  return [form.contextText, form.needDescription, form.searchProcess, form.outcome, form.reflection].some(value => value.trim())
}

function serializedForm(status) {
  return {
    ...form,
    logDate: diaryDate.value.format('YYYY-MM-DD'),
    occurredAt: diaryTime.value?.format('HH:mm') || null,
    genaiPlatform: form.isGenaiRelated ? form.genaiPlatform || '' : '',
    status,
  }
}

async function saveRecord(status) {
  if (status === 'draft' && !hasDraftContent()) return message.warning('请至少填写一项内容后再保存草稿')
  if (status === 'submitted') {
    try { await formRef.value.validate() } catch { return message.warning('请完整填写信息需求及获取过程') }
    if (form.isGenaiRelated && !form.genaiPlatform) return message.warning('请选择 GenAI 平台')
  }

  const loadingRef = status === 'draft' ? savingDraft : submitting
  loadingRef.value = true
  try {
    const response = editingId.value
      ? await updateDiary(editingId.value, serializedForm(status))
      : await createDiary(serializedForm(status))
    const diaryId = editingId.value || response.data.id
    dirty.value = false
    if (status === 'draft') {
      message.success('信息需求草稿已保存')
      return router.push('/diaries')
    }

    const justSubmitted = originalStatus.value !== 'submitted'
    message.success(justSubmitted ? '信息需求作业已提交' : '信息需求记录已更新')
    if (justSubmitted && form.isGenaiRelated && !form.sourceSubmissionId) {
      Modal.confirm({
        title: '是否同时提交为案例？',
        content: '信息需求作业已经提交。选择同时提交后会打开案例标注页，并带入这次 AI 对话；案例仍需单独批注和发布。',
        okText: '同时提交为案例',
        cancelText: '暂不提交',
        onOk: () => router.push({ path: '/cases/new', query: { diaryId } }),
        onCancel: () => router.push('/diaries'),
      })
    } else {
      await router.push('/diaries')
    }
  } catch (error) {
    message.error(error.response?.data?.message || '保存失败，请重试')
  } finally {
    loadingRef.value = false
  }
}
</script>

<style scoped>
.diary-editor-page { display: flex; min-height: 100vh; background: var(--hib-paper); color: var(--hib-text); }
.editor-main { flex: 1; min-width: 0; padding: 28px 36px 56px; }
.editor-header { display: flex; align-items: flex-end; justify-content: space-between; min-height: 92px; padding-bottom: 20px; border-bottom: 1px solid var(--hib-line); }
.editor-header h1 { margin: 8px 0 4px; font-size: 25px; }
.editor-header p { margin: 0; color: var(--hib-muted); }
.back-button { height: auto; padding: 0; color: var(--hib-red); }
.loading-state { display: flex; justify-content: center; gap: 10px; padding: 120px 0; color: var(--hib-muted); }
.editor-grid { display: grid; grid-template-columns: minmax(280px, 34%) minmax(520px, 1fr); gap: 28px; max-width: 1320px; margin: 28px auto 0; align-items: start; }
.source-panel { position: sticky; top: 24px; min-width: 0; border: 1px solid var(--hib-line); border-radius: 7px; background: var(--hib-surface); overflow: hidden; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; min-height: 50px; padding: 0 18px; border-bottom: 1px solid var(--hib-line); font-weight: 600; }
.source-block { padding: 18px; border-bottom: 1px solid var(--hib-line); }
.source-block small { display: block; margin-bottom: 8px; color: var(--hib-muted); }
.source-block p { margin: 0; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.answer-block { max-height: 360px; overflow: auto; background: rgba(255,255,255,.5); }
.source-model { padding: 12px 18px; color: var(--hib-muted); font-size: 12px; }
.date-card { display: grid; place-items: center; min-height: 260px; }
.date-card strong { font: 64px/1 Georgia, serif; color: var(--hib-red); }
.date-card span { color: var(--hib-muted); }
.form-panel { min-width: 0; padding: 26px 30px 30px; border: 1px solid var(--hib-line); border-radius: 7px; background: #fff; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin: 8px 0 18px; padding-bottom: 9px; border-bottom: 2px solid var(--hib-red-soft); }
.section-title:not(:first-child) { margin-top: 30px; }
.section-title span { font-weight: 700; }
.section-title small { color: var(--hib-muted); }
.genai-row { display: flex; align-items: center; gap: 18px; min-height: 52px; margin: 6px 0 20px; padding: 0 16px; border-left: 3px solid var(--hib-red); background: var(--hib-red-soft); }
.form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px; }
@media (max-width: 980px) { .editor-grid { grid-template-columns: 1fr; } .source-panel { position: static; } .answer-block { max-height: 240px; } }
@media (max-width: 760px) { .editor-main { padding: 72px 14px 36px; } .editor-header { align-items: flex-start; flex-direction: column; gap: 14px; } .form-panel { padding: 20px 16px; } .genai-row { align-items: flex-start; flex-direction: column; padding: 14px; } .genai-row :deep(.ant-select) { width: 100% !important; } }
</style>
