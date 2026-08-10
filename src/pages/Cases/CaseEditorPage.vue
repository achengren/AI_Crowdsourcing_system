<template>
  <div class="case-editor-page">
    <ConversationSidebar />
    <main class="editor-main">
      <header class="editor-header">
        <div>
          <a-button type="text" class="back-button" @click="router.push('/gallery')"><ArrowLeftOutlined />返回案例广场</a-button>
          <h1>提交问题案例</h1>
          <p>标出 AI 回复中的具体错误，并补充分类和片段批注</p>
        </div>
        <div class="save-state" :class="saveState">
          <LoadingOutlined v-if="saveState === 'saving'" />
          <CheckCircleOutlined v-else-if="saveState === 'saved'" />
          <ExclamationCircleOutlined v-else-if="saveState === 'error'" />
          <span>{{ saveStateText }}</span>
        </div>
      </header>

      <div v-if="loading" class="loading-state"><a-spin />正在读取案例资料...</div>
      <div v-else class="editor-workspace" @paste="onEditorPaste">
        <aside class="source-panel">
          <div class="panel-heading">
            <span>原始对话</span>
            <a-tag v-if="platformLocked">系统记录</a-tag>
          </div>
          <p v-if="contextMessages.length" class="source-context-note">
            <InfoCircleOutlined />
            <span>左侧展示所选回复所在的完整对话，仅用于核对上下文；案例内容和片段批注只针对你选择的这条 AI 回复。</span>
          </p>
          <div v-if="contextMessages.length" class="context-list">
            <div v-for="item in contextMessages" :key="item.id" :class="['context-message', item.role]">
              <span>{{ item.role === 'assistant' ? 'AI' : '用户' }}</span>
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="对话图片" @click="previewSrc = item.imageUrl" />
              <div v-if="item.role === 'assistant'" class="context-md markdown-body" v-html="renderMd(item.content)"></div>
              <p v-else>{{ item.content }}</p>
            </div>
          </div>
          <div v-else class="source-preview">
            <div><span>用户提问</span><p>{{ form.prompt || '填写后将在这里预览' }}</p></div>
            <div><span>AI 回复</span><p>{{ form.aiAnswer || '导入或填写 AI 回复后将在这里预览' }}</p></div>
          </div>
        </aside>

        <section class="form-panel">
          <a-form ref="formRef" :model="form" layout="vertical">
            <div v-if="!platformLocked" class="import-section">
              <div class="section-title"><span>导入对话</span><small>分享链接无法解析时，可粘贴文字或上传连续截图</small></div>
              <a-segmented v-model:value="importMode" :options="importOptions" />
              <div v-if="importMode === 'link'" class="import-control">
                <a-input-search v-model:value="linkUrl" placeholder="粘贴 AI 对话分享链接" enter-button="解析" :loading="parsing" @search="onParseLink" />
              </div>
              <div v-else-if="importMode === 'text'" class="import-control">
                <a-textarea v-model:value="rawConversation" :rows="6" placeholder="粘贴包含用户问题和 AI 回复的对话内容" />
                <div class="inline-actions">
                  <a-button @click="readClipboard"><CopyOutlined />读取剪贴板</a-button>
                  <a-button type="primary" :loading="importingText" :disabled="!rawConversation.trim()" @click="onImportText"><FileTextOutlined />识别对话</a-button>
                </div>
              </div>
              <div v-else-if="importMode === 'screenshots'" class="import-control">
                <a-upload-dragger v-model:file-list="screenshotFiles" accept="image/*" multiple :max-count="4" :before-upload="() => false">
                  <InboxOutlined class="upload-glyph" />
                  <div>选择连续对话截图，最多 4 张</div>
                </a-upload-dragger>
                <div class="inline-actions"><a-button type="primary" :loading="recognizing" :disabled="!screenshotFiles.length" @click="onImportScreenshots"><ScanOutlined />识别截图</a-button></div>
              </div>
            </div>

            <div class="section-title"><span>案例内容</span><small>案例与每日信息需求作业分别保存</small></div>
            <a-form-item label="向 AI 提出的问题（Prompt）" name="prompt" :rules="[{ required: true, message: '请填写向 AI 提出的问题' }]">
              <a-textarea v-model:value="form.prompt" :readonly="Boolean(form.sourceMessageId)" :rows="3" placeholder="填写当时向 AI 输入的问题或提示词" />
            </a-form-item>

            <a-row :gutter="16">
              <a-col :span="12">
                <a-form-item label="AI 平台" name="platform" :rules="[{ required: true, message: '请选择 AI 平台' }]">
                  <a-select v-model:value="form.platform" :disabled="platformLocked" placeholder="选择平台">
                    <a-select-option v-for="item in PLATFORM_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                  </a-select>
                  <div v-if="platformLocked" class="field-note">平台来自系统记录，不可修改<span v-if="form.model"> · {{ form.model }}</span></div>
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item v-if="form.platform === 'other'" label="具体平台名称" name="platformOther" :rules="[{ required: true, message: '请填写具体平台名称' }]">
                  <a-input v-model:value="form.platformOther" :maxlength="100" placeholder="例如：秘塔 AI 搜索" />
                </a-form-item>
              </a-col>
            </a-row>

            <a-form-item v-if="!form.sourceMessageId" label="AI 完整回复" name="aiAnswer" :rules="[{ required: true, message: '请填写 AI 回复' }]">
              <a-textarea v-model:value="form.aiAnswer" :rows="7" />
            </a-form-item>

            <div class="taxonomy-grid">
              <div class="taxonomy-field">
                <a-form-item label="错误类型（可多选）" name="errorTypes" :rules="[{ required: true, type: 'array', min: 1, message: '请至少选择一个错误类型' }]">
                  <a-select v-model:value="form.errorTypes" mode="multiple" placeholder="这条回答错在哪里">
                    <a-select-option v-for="item in ERROR_TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="form.errorTypes.includes('other')" label="其他错误类型" name="errorTypeOther" :rules="[{ required: true, message: '请具体说明其他错误类型' }]">
                  <a-input v-model:value="form.errorTypeOther" :maxlength="200" placeholder="请填写具体错误类型" />
                </a-form-item>
              </div>
              <div class="taxonomy-field">
                <a-form-item label="知识场景（可多选）">
                  <a-select v-model:value="form.knowledgeScenarios" mode="multiple" placeholder="涉及哪类知识">
                    <a-select-option v-for="item in KNOWLEDGE_SCENARIO_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="form.knowledgeScenarios.includes('other')" label="其他知识场景" name="knowledgeScenarioOther" :rules="[{ required: true, message: '请具体说明其他知识场景' }]">
                  <a-input v-model:value="form.knowledgeScenarioOther" :maxlength="200" placeholder="请填写具体知识场景" />
                </a-form-item>
              </div>
              <div class="taxonomy-field">
                <a-form-item label="来源问题（可多选）">
                  <a-select v-model:value="form.sourceIssues" mode="multiple" placeholder="没有来源问题可不选">
                    <a-select-option v-for="item in SOURCE_ISSUE_OPTIONS.filter(option => option.value !== 'none')" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item v-if="form.sourceIssues.includes('other')" label="其他来源问题" name="sourceIssueOther" :rules="[{ required: true, message: '请具体说明其他来源问题' }]">
                  <a-input v-model:value="form.sourceIssueOther" :maxlength="200" placeholder="请填写具体来源问题" />
                </a-form-item>
              </div>
            </div>

            <a-form-item label="片段批注">
              <AnnotationEditor v-model="form.annotations" :text="form.aiAnswer" />
            </a-form-item>

            <a-form-item label="整体问题说明">
              <a-textarea v-model:value="form.note" :rows="3" placeholder="仅在问题无法定位到具体语句时补充说明" />
            </a-form-item>

            <a-form-item label="相关截图">
              <a-upload v-model:file-list="uploadFiles" list-type="picture-card" :before-upload="onBeforeUpload" @preview="onPreview" @remove="onRemoveImage" accept="image/*">
                <div v-if="uploadFiles.length < 6"><PlusOutlined /><div>上传</div></div>
              </a-upload>
            </a-form-item>

            <a-form-item label="自定义标签">
              <a-select v-model:value="form.tags" mode="tags" placeholder="输入标签后按回车" />
            </a-form-item>

            <a-alert type="warning" show-icon message="发布前请确认不含姓名、联系方式等敏感信息" description="案例发布后立即对课程成员可见，发布内容只能由管理员撤回。" />
            <div class="form-actions">
              <a-button :loading="saving" @click="saveDraft(false)"><SaveOutlined />保存草稿</a-button>
              <a-popconfirm
                title="确认发布这个案例？"
                description="发布后立即对课程成员可见，案例和批注不能由学生自行修改或删除。"
                ok-text="确认发布"
                cancel-text="继续编辑"
                @confirm="publishCase"
              >
                <a-button type="primary" :loading="publishing" :disabled="saving"><SendOutlined />发布案例</a-button>
              </a-popconfirm>
            </div>
          </a-form>
        </section>
      </div>
    </main>

    <a-modal :open="Boolean(previewSrc)" :footer="null" centered width="auto" @cancel="previewSrc = ''">
      <img :src="previewSrc" class="preview-image" />
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import { ArrowLeftOutlined, CheckCircleOutlined, CopyOutlined, ExclamationCircleOutlined, FileTextOutlined, InboxOutlined, InfoCircleOutlined, LoadingOutlined, PlusOutlined, SaveOutlined, ScanOutlined, SendOutlined } from '@ant-design/icons-vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import AnnotationEditor from '../../components/cases/AnnotationEditor.vue'
import {
  deleteCaseDraft,
  getCaseDraftFromDiary,
  getCaseDraftFromMessage,
  getCaseDraftFromRevision,
  getSavedCaseDraft,
  importConversationScreenshots,
  importConversationText,
  parseLink,
  saveCaseDraft,
  submitCase,
  uploadImage,
} from '../../api/submission'
import { ERROR_TYPE_OPTIONS, KNOWLEDGE_SCENARIO_OPTIONS, PLATFORM_OPTIONS, SOURCE_ISSUE_OPTIONS } from '../../constants/options'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const loading = ref(true)
const saving = ref(false)
const publishing = ref(false)
const loaded = ref(false)
const dirty = ref(false)
const saveState = ref('idle')
const draftId = ref('')
const platformLocked = ref(false)
const contextMessages = ref([])
let autosaveTimer = null
let internalRouteUpdate = false

const emptyForm = () => ({
  prompt: '', platform: undefined, platformOther: '', model: '', aiAnswer: '',
  errorTypes: [], errorTypeOther: '', knowledgeScenarios: [], knowledgeScenarioOther: '',
  sourceIssues: [], sourceIssueOther: '', note: '',
  tags: [], shareLink: '', images: [], annotations: [], sourceMessageId: null,
  sourceDiaryId: null, revisionOfId: null,
})
const formKeys = Object.keys(emptyForm())
const form = reactive(emptyForm())
const saveStateText = computed(() => ({ idle: '尚未保存', saving: '正在保存', saved: '草稿已保存', error: '保存失败' })[saveState.value])

const importMode = ref('link')
const importOptions = [
  { label: '分享链接', value: 'link' }, { label: '粘贴对话', value: 'text' },
  { label: '对话截图', value: 'screenshots' }, { label: '手动填写', value: 'manual' },
]
const linkUrl = ref('')
const rawConversation = ref('')
const screenshotFiles = ref([])
const uploadFiles = ref([])
const parsing = ref(false)
const importingText = ref(false)
const recognizing = ref(false)
const previewSrc = ref('')

onMounted(loadInitialData)
onBeforeUnmount(() => {
  if (autosaveTimer) clearTimeout(autosaveTimer)
  window.removeEventListener('beforeunload', preventUnsavedExit)
})
window.addEventListener('beforeunload', preventUnsavedExit)

watch(form, () => {
  if (!loaded.value || publishing.value) return
  dirty.value = true
  saveState.value = 'idle'
  if (autosaveTimer) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => saveDraft(true), 1200)
}, { deep: true })

watch(() => route.fullPath, () => {
  if (!loaded.value || internalRouteUpdate) return
  loadInitialData()
})

onBeforeRouteLeave(() => {
  if (!dirty.value && !saving.value) return true
  return window.confirm('草稿仍在保存中，确定离开当前页面吗？')
})

onBeforeRouteUpdate(() => {
  if (internalRouteUpdate) return true
  if (!dirty.value && !saving.value) return true
  return window.confirm('当前案例仍有未保存内容，确定切换吗？')
})

function preventUnsavedExit(event) {
  if (!dirty.value && !saving.value) return
  event.preventDefault()
  event.returnValue = ''
}

function renderMd(text) {
  return DOMPurify.sanitize(marked(text || ''))
}

async function loadInitialData() {
  resetEditorState()
  try {
    if (route.query.draftId) {
      const response = await getSavedCaseDraft(route.query.draftId)
      draftId.value = response.data.id
      applyFormData(response.data.payload || {})
      if (form.sourceMessageId) await loadMessageSource(form.sourceMessageId, false)
      platformLocked.value = Boolean(form.sourceMessageId || form.sourceDiaryId)
    } else if (route.query.messageId) {
      await loadMessageSource(route.query.messageId, true)
    } else if (route.query.diaryId) {
      const response = await getCaseDraftFromDiary(route.query.diaryId)
      applyFormData(response.data)
      contextMessages.value = response.data.contextMessages || []
      platformLocked.value = Boolean(response.data.platformLocked)
    } else if (route.query.revisionId) {
      const response = await getCaseDraftFromRevision(route.query.revisionId)
      applyFormData(response.data)
      platformLocked.value = Boolean(response.data.platformLocked)
    } else {
      applyFormData({ prompt: String(route.query.prompt || ''), aiAnswer: String(route.query.aiAnswer || '') })
      if (route.query.imageUrl) form.images = [String(route.query.imageUrl)]
    }
    syncUploadFiles()
  } catch (error) {
    message.error(error.response?.data?.message || '案例资料读取失败')
  } finally {
    loading.value = false
    loaded.value = true
  }
}

function resetEditorState() {
  loaded.value = false
  loading.value = true
  dirty.value = false
  saveState.value = 'idle'
  draftId.value = ''
  platformLocked.value = false
  contextMessages.value = []
  linkUrl.value = ''
  rawConversation.value = ''
  screenshotFiles.value = []
  uploadFiles.value = []
  importMode.value = 'link'
  if (autosaveTimer) clearTimeout(autosaveTimer)
  Object.assign(form, emptyForm())
}

function applyFormData(data = {}) {
  const selected = Object.fromEntries(formKeys.filter(key => data[key] !== undefined).map(key => [key, data[key]]))
  if (!selected.errorTypes && data.errorType) selected.errorTypes = [data.errorType]
  if (!selected.sourceIssues && data.sourceIssue && data.sourceIssue !== 'none') selected.sourceIssues = [data.sourceIssue]
  Object.assign(form, emptyForm(), selected)
}

async function loadMessageSource(messageId, applyContent) {
  const response = await getCaseDraftFromMessage(messageId)
  if (applyContent) applyFormData(response.data)
  else {
    contextMessages.value = response.data.contextMessages || []
    platformLocked.value = true
    return
  }
  contextMessages.value = response.data.contextMessages || []
  platformLocked.value = true
}

function serializedForm() {
  const payload = JSON.parse(JSON.stringify(form))
  delete payload.contextMessages
  delete payload.platformLocked
  return payload
}

function hasDraftContent() {
  return Boolean(form.prompt.trim() || form.aiAnswer.trim() || form.note.trim() || form.annotations.length || form.images.length)
}

async function saveDraft(quiet = false) {
  if (!hasDraftContent() || publishing.value || saving.value) return
  saving.value = true
  saveState.value = 'saving'
  try {
    const response = await saveCaseDraft({
      id: draftId.value || undefined,
      sourceMessageId: form.sourceMessageId || null,
      sourceDiaryId: form.sourceDiaryId || null,
      payload: serializedForm(),
    })
    draftId.value = response.data.id
    dirty.value = false
    saveState.value = 'saved'
    if (route.query.draftId !== draftId.value) {
      internalRouteUpdate = true
      try {
        await router.replace({ path: '/cases/new', query: { draftId: draftId.value } })
      } finally {
        internalRouteUpdate = false
      }
    }
    if (!quiet) message.success('草稿已保存')
  } catch (error) {
    saveState.value = 'error'
    if (!quiet) message.error(error.response?.data?.message || '草稿保存失败')
  } finally {
    saving.value = false
  }
}

async function publishCase() {
  try {
    await formRef.value.validate()
  } catch {
    return message.warning('请补充所有必填信息')
  }
  if (!form.annotations.length && !form.note.trim()) return message.warning('请至少添加一条片段批注或填写整体问题说明')
  publishing.value = true
  try {
    const response = await submitCase({ ...serializedForm(), draftId: draftId.value || null })
    dirty.value = false
    if (draftId.value) await deleteCaseDraft(draftId.value).catch(() => {})
    message.success('案例已发布')
    if (form.sourceDiaryId) {
      await router.push('/gallery')
    } else {
      Modal.confirm({
        title: '是否同时提交为信息需求作业？',
        content: '案例已经单独发布。选择同时提交后会打开信息需求作业页，并带入这次提问和 AI 回复；作业仍需补充搜寻过程与反思后单独提交。',
        okText: '同时提交为作业',
        cancelText: '暂不填写',
        onOk: () => router.push({ path: '/diaries/new', query: { caseId: response.data.id } }),
        onCancel: () => router.push('/gallery'),
      })
    }
  } catch (error) {
    message.error(error.response?.data?.message || '发布失败，请重试')
  } finally {
    publishing.value = false
  }
}

async function onParseLink() {
  if (!linkUrl.value.trim()) return
  parsing.value = true
  try {
    const response = await parseLink(linkUrl.value.trim())
    applyImported(response.data)
    form.shareLink = linkUrl.value.trim()
    if (response.data.manualRequired) message.warning(response.data.warning || '无法读取正文，请手动补充')
    else message.success('链接解析成功，请核对内容')
  } catch (error) {
    message.error(error.response?.data?.message || '链接解析失败，请改用粘贴或截图导入')
  } finally { parsing.value = false }
}

async function readClipboard() {
  try { rawConversation.value = await navigator.clipboard.readText() }
  catch { message.warning('浏览器未允许读取剪贴板，请直接粘贴') }
}

async function onImportText() {
  importingText.value = true
  try {
    const response = await importConversationText({ text: rawConversation.value, platform: form.platform || '' })
    applyImported(response.data)
    message.success('对话内容已识别，请核对后批注')
  } catch (error) {
    message.error(error.response?.data?.message || '识别失败，请改用手动填写')
  } finally { importingText.value = false }
}

async function onImportScreenshots() {
  recognizing.value = true
  try {
    const response = await importConversationScreenshots(screenshotFiles.value, form.platform || '')
    applyImported(response.data)
    for (const url of response.data.images || []) if (!form.images.includes(url)) form.images.push(url)
    syncUploadFiles()
    screenshotFiles.value = []
    message.success('截图内容已识别，请核对后批注')
  } catch (error) {
    message.error(error.response?.data?.message || '截图识别失败')
  } finally { recognizing.value = false }
}

function applyImported(data) {
  form.prompt = data.prompt || ''
  form.aiAnswer = data.aiAnswer || ''
  if (data.platform) form.platform = data.platform
  form.model = data.model || ''
  form.annotations = []
}

async function onBeforeUpload(file) {
  try {
    const response = await uploadImage(file)
    if (!form.images.includes(response.data.url)) form.images.push(response.data.url)
    syncUploadFiles()
  } catch { message.error('图片上传失败') }
  return false
}

async function onEditorPaste(e) {
  const file = e.clipboardData?.files?.[0]
  if (!file?.type?.startsWith('image/')) return
  if (form.images.length >= 6) { message.warning('最多上传 6 张图片'); return }
  e.preventDefault()
  try {
    const response = await uploadImage(file)
    if (!form.images.includes(response.data.url)) form.images.push(response.data.url)
    syncUploadFiles()
    message.success('图片已粘贴')
  } catch { message.error('图片上传失败') }
}

function syncUploadFiles() {
  uploadFiles.value = form.images.map((url, index) => ({ uid: `image-${index}`, name: `相关截图 ${index + 1}`, status: 'done', url, thumbUrl: url }))
}

function onRemoveImage(file) {
  const index = form.images.indexOf(file.url)
  if (index >= 0) form.images.splice(index, 1)
}

function onPreview(file) { previewSrc.value = file.url || file.thumbUrl }
</script>

<style scoped>
.case-editor-page { display: flex; min-height: 100vh; background: var(--hib-paper); color: var(--hib-text); }
.editor-main { flex: 1; min-width: 0; height: 100vh; overflow: auto; }
.editor-header { min-height: 112px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 20px 32px; border-bottom: 1px solid var(--hib-line); background: rgba(255,255,255,.72); }
.editor-header h1 { margin: 6px 0 2px; font-size: 25px; letter-spacing: 0; }
.editor-header p { margin: 0; color: var(--hib-muted); }
.back-button { height: auto; padding: 0; color: var(--hib-muted); }
.save-state { display: flex; align-items: center; gap: 7px; padding-bottom: 4px; color: var(--hib-muted); font-size: 13px; }
.save-state.saved { color: #47745c; }
.save-state.error { color: #a6404c; }
.loading-state { min-height: 420px; display: grid; place-items: center; color: var(--hib-muted); }
.editor-workspace { display: grid; grid-template-columns: minmax(340px, .82fr) minmax(620px, 1.45fr); max-width: 1500px; min-height: calc(100vh - 112px); margin: 0 auto; }
.source-panel { position: sticky; top: 0; align-self: start; box-sizing: border-box; display: flex; flex-direction: column; min-width: 0; height: clamp(520px, calc(100vh - 112px), 760px); padding: 26px 16px 24px 30px; border-right: 1px solid var(--hib-line); background: rgba(255,255,255,.38); overflow: hidden; }
.panel-heading { flex: 0 0 auto; display: flex; align-items: center; justify-content: space-between; margin: 0 8px 18px 0; padding-bottom: 12px; border-bottom: 1px solid var(--hib-line); font-weight: 650; }
.source-context-note { display: flex; align-items: flex-start; gap: 8px; margin: -4px 0 18px; padding: 10px 12px; border-left: 2px solid var(--hib-red); background: var(--hib-red-soft); color: var(--hib-muted); font-size: 12px; line-height: 1.65; }
.source-context-note :deep(.anticon) { flex: 0 0 auto; margin-top: 3px; color: var(--hib-red); }
.context-list, .source-preview { flex: 1 1 auto; min-height: 0; padding-right: 8px; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; }
.context-list { display: grid; align-content: start; gap: 14px; }
.context-list::-webkit-scrollbar, .source-preview::-webkit-scrollbar { width: 8px; }
.context-list::-webkit-scrollbar-thumb, .source-preview::-webkit-scrollbar-thumb { border: 2px solid transparent; border-radius: 8px; background: #cdbfbc; background-clip: padding-box; }
.context-list::-webkit-scrollbar-track, .source-preview::-webkit-scrollbar-track { background: transparent; }
.context-message { padding: 14px 18px 14px 22px; border-left: 3px solid #9da5a0; background: rgba(255,255,255,.66); }
.context-message.assistant { border-left-color: var(--hib-red); }
.context-message > span, .source-preview span { display: block; color: var(--hib-muted); font-size: 11px; font-weight: 650; text-transform: uppercase; }
.context-message p, .source-preview p { margin: 7px 0 0; white-space: pre-wrap; line-height: 1.65; }
.context-message img { width: min(240px, 100%); max-height: 180px; margin-top: 8px; object-fit: cover; cursor: zoom-in; }
.source-preview { display: grid; align-content: start; gap: 20px; }
.source-preview > div { padding-bottom: 18px; border-bottom: 1px solid var(--hib-line); }
.form-panel { min-width: 0; padding: 28px 34px 64px; background: #fff; }
.section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 4px 0 18px; padding-bottom: 10px; border-bottom: 2px solid var(--hib-red-soft); }
.section-title span { font-size: 17px; font-weight: 650; }
.section-title small, .field-note { color: var(--hib-muted); font-size: 12px; }
.import-section { margin-bottom: 30px; }
.import-control { display: grid; gap: 10px; margin-top: 14px; }
.inline-actions { display: flex; justify-content: flex-end; gap: 8px; }
.upload-glyph { color: var(--hib-red); font-size: 26px; }
.taxonomy-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.form-actions { position: sticky; bottom: 0; z-index: 4; display: flex; justify-content: flex-end; gap: 10px; margin: 22px -34px -64px; padding: 15px 34px; border-top: 1px solid var(--hib-line); background: rgba(255,255,255,.96); }
.preview-image { display: block; max-width: 82vw; max-height: 82vh; }
@media (max-width: 1050px) { .editor-workspace { grid-template-columns: minmax(290px, .7fr) minmax(500px, 1.3fr); } .taxonomy-grid { grid-template-columns: 1fr; gap: 0; } }
@media (max-width: 760px) { .editor-header { padding: 70px 16px 16px; align-items: flex-start; flex-direction: column; gap: 10px; } .editor-workspace { display: block; } .source-panel { position: static; width: 100%; height: min(560px, 62vh); min-height: 360px; padding: 20px 12px 18px 16px; border-right: 0; border-bottom: 1px solid var(--hib-line); } .form-panel { padding: 24px 16px 80px; } .form-actions { margin: 20px -16px -80px; padding: 12px 16px; } }
</style>
