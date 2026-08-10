<template>
  <div class="gallery-page">
    <ConversationSidebar />

    <!-- 右侧主区 -->
    <div class="main">
      <header class="workspace-header">
        <div><span>CASE LIBRARY</span><h1>案例广场</h1></div>
        <small>{{ total }} 条已发布案例</small>
      </header>
      <div class="toolbar">
        <div class="toolbar-left">
          <a-input-search
            v-model:value="search"
            placeholder="搜索案例..."
            style="width: 280px"
            @search="onSearch"
          />
          <a-select v-model:value="filterErrorType" placeholder="错误类型" style="width: 170px" allow-clear @change="onFilter">
            <a-select-option v-for="item in ERROR_TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filterScenario" placeholder="知识场景" style="width: 170px" allow-clear @change="onFilter">
            <a-select-option v-for="item in KNOWLEDGE_SCENARIO_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="filterSourceIssue" placeholder="来源问题" style="width: 170px" allow-clear @change="onFilter">
            <a-select-option v-for="item in SOURCE_ISSUE_OPTIONS.filter(option => option.value !== 'none')" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
          </a-select>
        </div>
        <a-radio-group v-model:value="sortBy" @change="onSort" size="small">
          <a-radio-button value="latest">最新</a-radio-button>
          <a-radio-button value="hot">最热</a-radio-button>
          <a-radio-button value="controversial">争议最多</a-radio-button>
        </a-radio-group>
      </div>

      <div class="card-grid">
        <!-- + 上传卡片 -->
        <div class="upload-card" :class="{ 'has-draft': draftCount > 0 }" @click="openManualSubmit">
          <span v-if="draftCount > 0" class="draft-dot">{{ draftCount > 99 ? '99+' : draftCount }}</span>
          <PlusOutlined class="upload-icon" />
          <span v-if="draftCount > 0">{{ draftCount }} 份草稿待提交</span>
          <span v-else>提交案例</span>
        </div>

        <!-- 案例卡片 -->
        <div
          v-for="item in cases"
          :key="item.id"
          class="case-card"
        >
          <div class="case-card-top">
            <a-tag v-for="type in taxonomyValues(item.errorTypes, item.errorType || item.category)" :key="type" :color="categoryColor(type)">{{ taxonomyLabel(ERROR_TYPE_OPTIONS, type, item.errorTypeOther) }}</a-tag>
            <a-tag>{{ displayPlatform(item) }}</a-tag>
            <span v-if="item.images?.length" class="card-img-badge"><PictureOutlined /> {{ item.images.length }}</span>
          </div>

          <div class="case-prompt" @click="openDetail(item)">{{ item.prompt }}</div>

          <div class="case-answer" v-if="item.aiAnswer" @click="openDetail(item)">
            {{ item.aiAnswer.slice(0, 120) }}{{ item.aiAnswer.length > 120 ? '...' : '' }}
          </div>

          <div class="case-tags" v-if="item.tags?.length">
            <a-tag v-for="tag in item.tags" :key="tag" size="small">{{ tag }}</a-tag>
          </div>

          <div class="case-card-footer">
            <span class="case-author">{{ item.author }}</span>
            <a-space>
              <span class="action-btn" title="查看片段批注" @click.stop="openDetail(item, 'annotations')">
                <HighlightOutlined />
                {{ item.annotationCount || 0 }}
              </span>
              <span class="action-btn" title="查看批注投票" @click.stop="openDetail(item, 'annotations')">
                <CheckOutlined />
                {{ item.annotationAgreeCount || 0 }}
              </span>
              <span class="action-btn" title="查看批注投票" @click.stop="openDetail(item, 'annotations')">
                <CloseOutlined />
                {{ item.annotationDisagreeCount || 0 }}
              </span>
              <span class="action-btn" title="查看批注讨论" @click.stop="openDetail(item, 'comments')">
                <CommentOutlined />
                {{ item.annotationCommentCount || 0 }}
              </span>
            </a-space>
          </div>
        </div>
      </div>

      <a-spin v-if="loading" size="large" style="display: flex; justify-content: center; margin-top: 64px" />
      <a-empty v-if="!loading && cases.length === 0" description="暂无案例，快来提交第一个吧" style="margin-top: 64px" />

      <div class="pagination" v-if="total > pageSize">
        <a-pagination
          v-model:current="page"
          :total="total"
          :page-size="pageSize"
          @change="loadCases"
          size="small"
        />
      </div>
    </div>

    <a-modal v-model:open="draftPickerVisible" title="新建案例" width="620px" :footer="null">
      <div class="draft-picker-head">
        <div><strong>已有 {{ caseDrafts.length }} 份草稿</strong><p>可以继续其中一份，也可以创建互不影响的新案例。</p></div>
        <a-button type="primary" @click="startNewCase"><PlusOutlined />新建空白案例</a-button>
      </div>
      <a-spin :spinning="draftsLoading">
        <div class="draft-list">
          <div v-for="draft in caseDrafts" :key="draft.id" class="draft-row">
            <button type="button" class="draft-content" @click="continueDraft(draft.id)">
              <strong>{{ draft.payload?.prompt || '未命名案例草稿' }}</strong>
              <span>{{ displayDraftPlatform(draft) }} · {{ formatDraftTime(draft.updatedAt) }}</span>
            </button>
            <a-popconfirm title="确定删除这份草稿？" ok-text="删除" cancel-text="取消" @confirm="removeDraft(draft.id)">
              <a-button type="text" danger title="删除草稿" aria-label="删除草稿"><DeleteOutlined /></a-button>
            </a-popconfirm>
          </div>
        </div>
      </a-spin>
    </a-modal>

    <!-- 提交案例弹窗 -->
    <a-modal
      v-model:open="showSubmitModal"
      title="提交 AI 未满足信息需求案例"
      width="min(1080px, 94vw)"
      :footer="null"
      :destroy-on-close="true"
    >
      <a-form :model="form" layout="vertical" ref="formRef">
        <a-alert v-if="form.revisionOfId" type="warning" show-icon class="revision-alert" :message="`修改第 ${form.revisionNumber || 1} 版退回案例`" :description="form.rejectionReason" />
        <a-form-item v-if="!isFromChat" label="导入方式">
          <a-segmented v-model:value="importMode" :options="[
            { label: '分享链接', value: 'link' },
            { label: '粘贴对话', value: 'text' },
            { label: '对话截图', value: 'screenshots' },
            { label: '手动填写', value: 'manual' },
          ]" />
        </a-form-item>

        <a-form-item v-if="!isFromChat && importMode === 'link'" label="分享链接">
          <a-input-search
            v-model:value="linkUrl"
            placeholder="粘贴 AI 对话分享链接，如 https://chat.deepseek.com/share/..."
            enter-button="解析"
            :loading="parsing"
            @search="onParseLink"
          />
        </a-form-item>

        <a-form-item v-if="!isFromChat && importMode === 'text'" label="对话内容">
          <div class="import-panel">
            <a-textarea v-model:value="rawConversation" :rows="7" placeholder="粘贴包含用户问题和 AI 回答的对话内容" />
            <div class="import-actions">
              <a-button @click="readConversationClipboard"><CopyOutlined />读取剪贴板</a-button>
              <a-button type="primary" :loading="importingText" :disabled="!rawConversation.trim()" @click="onImportConversationText"><FileTextOutlined />识别对话</a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item v-if="!isFromChat && importMode === 'screenshots'" label="对话截图">
          <div class="import-panel">
            <a-upload-dragger v-model:file-list="screenshotFileList" accept="image/*" multiple :max-count="4" :before-upload="onBeforeScreenshotImport">
              <InboxOutlined class="screenshot-import-icon" />
              <div>选择连续对话截图（最多 4 张）</div>
            </a-upload-dragger>
            <div class="import-actions end">
              <a-button type="primary" :loading="recognizingScreenshots" :disabled="!screenshotFileList.length" @click="onImportScreenshots"><ScanOutlined />识别截图</a-button>
            </div>
          </div>
        </a-form-item>

        <a-form-item label="Prompt（必填）" name="prompt" :rules="[{ required: true, message: '请输入你的 Prompt' }]">
          <a-textarea v-model:value="form.prompt" :readonly="Boolean(form.sourceMessageId)" :rows="3" placeholder="描述你的信息需求和给 AI 的提示词..." />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="AI 平台" name="platform" :rules="[{ required: true, message: '请选择' }]">
              <a-select v-model:value="form.platform" :disabled="platformLocked" placeholder="选择平台">
                <a-select-option v-for="item in PLATFORM_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
              <div v-if="platformLocked" class="field-note">来源于系统记录，平台不可修改<span v-if="form.model"> · {{ form.model }}</span></div>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="案例主分类" name="category" :rules="[{ required: true, message: '请选择' }]">
              <a-select v-model:value="form.category" placeholder="未满足原因">
                <a-select-option v-for="item in CASE_CATEGORIES" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item v-if="!form.sourceMessageId" label="AI 回答">
          <a-textarea v-model:value="form.aiAnswer" :rows="5" placeholder="粘贴 AI 的完整回答..." />
        </a-form-item>

        <a-form-item :label="form.sourceMessageId ? 'AI 回复与片段批注' : '片段批注'">
          <AnnotationEditor v-model="form.annotations" :text="form.aiAnswer" />
        </a-form-item>

        <a-form-item label="相关截图">
          <div v-if="parsedFiles.length" style="font-size: 12px; color: var(--hib-red); margin-bottom: 8px">
            此对话包含 {{ parsedFiles.length }} 个文件：{{ parsedFiles.map(f => f.name).join(', ') }}，请手动上传相关截图
          </div>
          <a-upload
            v-model:file-list="uploadFileList"
            list-type="picture-card"
            :before-upload="onBeforeUpload"
            @preview="onPreviewImage"
            @remove="onRemoveImage"
            accept="image/*"
          >
            <div v-if="uploadFileList.length < 6">
              <PlusOutlined />
              <div style="margin-top: 8px">上传</div>
            </div>
          </a-upload>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="满意度">
              <a-rate v-model:value="form.satisfaction" :count="5" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="优质案例">
              <a-switch v-model:checked="form.isGoodCase" checked-children="是" un-checked-children="否" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="整体问题说明">
          <a-textarea v-model:value="form.note" :rows="2" placeholder="如果问题无法定位到具体语句，可在这里说明" />
        </a-form-item>

        <a-form-item label="自定义标签">
          <a-select v-model:value="form.tags" mode="tags" placeholder="输入标签，按回车添加" />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" :loading="submitting" block @click="handleSubmit">提交案例</a-button>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 案例详情 & 评论弹窗 -->
    <a-modal
      v-model:open="detailVisible"
      title="案例详情"
      width="min(1280px, 96vw)"
      :footer="null"
      @cancel="detailVisible = false"
    >
      <div v-if="detailCase">
        <div class="detail-taxonomy">
          <span class="taxonomy-label">错误类型</span>
          <a-tag v-for="type in taxonomyValues(detailCase.errorTypes, detailCase.errorType || detailCase.category)" :key="`error-${type}`" :color="categoryColor(type)">{{ taxonomyLabel(ERROR_TYPE_OPTIONS, type, detailCase.errorTypeOther) }}</a-tag>
          <span class="taxonomy-label">知识场景</span>
          <a-tag v-for="scenario in detailCase.knowledgeScenarios || []" :key="`scenario-${scenario}`">{{ taxonomyLabel(KNOWLEDGE_SCENARIO_OPTIONS, scenario, detailCase.knowledgeScenarioOther) }}</a-tag>
          <span v-if="detailCase.sourceIssues?.length" class="taxonomy-label">来源问题</span>
          <a-tag v-for="issue in detailCase.sourceIssues || []" :key="`source-${issue}`" color="orange">{{ taxonomyLabel(SOURCE_ISSUE_OPTIONS, issue, detailCase.sourceIssueOther) }}</a-tag>
          <a-tag>{{ displayPlatform(detailCase) }}</a-tag>
          <span class="detail-meta">{{ detailCase.author }} · {{ detailCase.createdAt }}</span>
        </div>
        <div class="detail-section">
          <div class="detail-section-title">Prompt</div>
          <div>
            <template v-if="detailPromptCollapsed && detailCase.prompt && detailCase.prompt.length > 100">
              {{ detailCase.prompt.slice(0, 100) }}...
              <a-button type="link" size="small" class="collapse-btn" @click="detailPromptCollapsed = false">
                <DownOutlined />
              </a-button>
            </template>
            <template v-else>
              {{ detailCase.prompt }}
              <a-button
                v-if="detailCase.prompt && detailCase.prompt.length > 100"
                type="link" size="small" class="collapse-btn"
                @click="detailPromptCollapsed = true"
              >
                <UpOutlined />
              </a-button>
            </template>
          </div>
        </div>

        <div class="detail-section" v-if="detailCase.images?.length">
          <div class="detail-section-title">相关图片</div>
          <div class="detail-images">
            <img
              v-for="(url, idx) in detailCase.images"
              :key="idx"
              :src="url"
              class="detail-img"
              @click="onPreviewImage(detailCase.images, idx)"
            />
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">AI 回复</div>
          <div :class="{ collapsed: detailAnswerCollapsed }">
            <div class="detail-answer markdown-body" v-html="renderMd(detailCase.aiAnswer)"></div>
          </div>
          <a-button
            v-if="detailCase.aiAnswer && detailCase.aiAnswer.length > 100"
            type="link" size="small" class="collapse-btn"
            @click="detailAnswerCollapsed = !detailAnswerCollapsed"
          >
            {{ detailAnswerCollapsed ? '展开全部' : '收起' }}
          </a-button>
        </div>
        <div class="detail-section annotation-compose-section">
          <div class="section-heading-line"><div><span>ADD ANNOTATION</span><h3>补充批注</h3></div><p>选择 AI 回复中的具体语句，提交新的判断。</p></div>
          <AnnotationEditor
            :text="detailCase.aiAnswer"
            :model-value="detailCase.annotations || []"
            :creating="annotationCreating"
            readonly
            collaborative
            composer-only
            @create-annotation="onCreateDetailAnnotation"
          />
        </div>
        <div ref="annotationSection" class="detail-section annotation-discussion-section">
          <AnnotationDiscussion
            :case-id="detailCase.id"
            :annotations="detailCase.annotations || []"
            @vote="onVoteAnnotation"
            @withdraw="onWithdrawAnnotation"
            @comment-count-change="onAnnotationCommentCountChange"
          />
        </div>
        <a-collapse v-if="detailComments.length" ghost class="legacy-discussion">
          <a-collapse-panel key="legacy" :header="`整体讨论（历史评论 ${detailComments.length}）`">
            <a-list :data-source="detailComments" size="small">
              <template #renderItem="{ item: c }">
                <a-list-item><a-list-item-meta :title="c.author" :description="c.content" /></a-list-item>
              </template>
            </a-list>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-modal>

    <!-- 图片预览 -->
    <a-modal
      :open="previewVisible"
      :footer="null"
      :title="null"
      width="auto"
      centered
      @cancel="previewVisible = false"
    >
      <img :src="previewSrc" style="max-width: 80vw; max-height: 80vh; display: block" />
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, onActivated, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined, CommentOutlined, CopyOutlined, DeleteOutlined, DownOutlined, FileTextOutlined, HighlightOutlined, InboxOutlined, PictureOutlined, PlusOutlined, ScanOutlined, UpOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import AnnotationEditor from '../../components/cases/AnnotationEditor.vue'
import AnnotationDiscussion from '../../components/cases/AnnotationDiscussion.vue'
import { addCaseAnnotation, deleteCaseDraft, getCaseDraftFromDiary, getCaseDraftFromMessage, getCaseDraftFromRevision, getCases, getComments, getSavedCaseDrafts, importConversationScreenshots, importConversationText, parseLink, submitCase, uploadImage, voteCaseAnnotation, withdrawCaseAnnotation } from '../../api/submission'
import { CASE_CATEGORIES, ERROR_TYPE_OPTIONS, KNOWLEDGE_SCENARIO_OPTIONS, PLATFORM_OPTIONS, SOURCE_ISSUE_OPTIONS, optionLabel, platformLabel } from '../../constants/options'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const router = useRouter()
const route = useRoute()

// 从 URL query 参数打开提交案例弹窗
async function openSubmitFromQuery() {
  if (route.query.submit === '1') {
    const query = { ...route.query }
    delete query.submit
    delete query.satisfaction
    await router.replace({ path: '/cases/new', query })
  }
}

// keep-alive 激活时检查（覆盖首次挂载和从 Chat 页切回）
onActivated(() => {
  loadCases()
  loadDraftCount()
  openSubmitFromQuery()
})

// 已在 Gallery 页面时 query 变化
watch(() => route.query.submit, (val) => {
  if (val === '1') openSubmitFromQuery()
})

// 列表
const search = ref('')
const filterErrorType = ref(undefined)
const filterScenario = ref(undefined)
const filterSourceIssue = ref(undefined)
const sortBy = ref('latest')
const loading = ref(false)
const cases = ref([])
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)
let loadCasesSeq = 0

onMounted(() => { loadCases(); loadDraftCount(); openSubmitFromQuery() })

async function loadCases() {
  const seq = ++loadCasesSeq
  loading.value = true
  try {
    const res = await getCases({
      page: page.value,
      pageSize: pageSize.value,
      errorType: filterErrorType.value,
      knowledgeScenario: filterScenario.value,
      sourceIssue: filterSourceIssue.value,
      keyword: search.value,
      sortBy: sortBy.value,
    })
    if (seq !== loadCasesSeq) return // 忽略过期响应，防止旧筛选结果覆盖最新结果
    cases.value = res.data.list || []
    total.value = res.data.total || 0
  } catch { /* ignore */ } finally {
    if (seq === loadCasesSeq) loading.value = false
  }
}

function onSearch() { page.value = 1; loadCases() }
function onFilter() { page.value = 1; loadCases() }
function onSort() { page.value = 1; loadCases() }

// 提交
const showSubmitModal = ref(false)
const submitting = ref(false)
const parsing = ref(false)
const importingText = ref(false)
const recognizingScreenshots = ref(false)
const platformLocked = ref(false)
const linkUrl = ref('')
const importMode = ref('link')
const rawConversation = ref('')
const screenshotFileList = ref([])
const formRef = ref()
const form = reactive({
  prompt: '', platform: undefined, model: '', category: undefined,
  aiAnswer: '', satisfaction: 0, isGoodCase: false,
  note: '', tags: [], shareLink: '', images: [], annotations: [],
  sourceMessageId: null, sourceDiaryId: null, revisionOfId: null, revisionNumber: 1, rejectionReason: '',
})

const isFromChat = ref(false)

function resetForm() {
  Object.assign(form, {
    prompt: '', platform: undefined, model: '', category: undefined,
    aiAnswer: '', satisfaction: 0, isGoodCase: false,
    note: '', tags: [], shareLink: '', images: [], annotations: [],
    sourceMessageId: null, sourceDiaryId: null, revisionOfId: null, revisionNumber: 1, rejectionReason: '',
  })
  platformLocked.value = false
  linkUrl.value = ''
  importMode.value = 'link'
  rawConversation.value = ''
  screenshotFileList.value = []
  parsedFiles.value = []
  uploadFileList.value = []
  formRef.value?.resetFields()
}

const draftPickerVisible = ref(false)
const draftsLoading = ref(false)
const caseDrafts = ref([])
const draftCount = ref(0)

async function loadDraftCount() {
  try {
    const res = await getSavedCaseDrafts()
    draftCount.value = (res.data || []).length
  } catch { /* ignore */ }
}

async function openManualSubmit() {
  draftsLoading.value = true
  try {
    caseDrafts.value = (await getSavedCaseDrafts()).data || []
    draftCount.value = caseDrafts.value.length
    if (caseDrafts.value.length) draftPickerVisible.value = true
    else startNewCase()
  } finally { draftsLoading.value = false }
}

function startNewCase() {
  draftPickerVisible.value = false
  router.push({ path: '/cases/new', query: { new: Date.now().toString() } })
}

function continueDraft(id) {
  draftPickerVisible.value = false
  router.push({ path: '/cases/new', query: { draftId: id } })
}

async function removeDraft(id) {
  try {
    await deleteCaseDraft(id)
    caseDrafts.value = caseDrafts.value.filter(item => item.id !== id)
    draftCount.value = caseDrafts.value.length
    message.success('草稿已删除')
  } catch (err) {
    message.error(err.response?.data?.message || '草稿删除失败，请重试')
  }
}

function displayDraftPlatform(draft) {
  const payload = draft.payload || {}
  return platformLabel(payload.platform, payload.platformOther) || '平台未填写'
}

function formatDraftTime(value) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '尚未保存时间'
}

watch(showSubmitModal, (val) => {
  if (!val) {
    isFromChat.value = false
    resetForm()
  }
})
const parsedFiles = ref([])

async function onParseLink() {
  if (!linkUrl.value.trim()) return
  parsing.value = true
  try {
    const res = await parseLink(linkUrl.value.trim())
    const d = res.data
    if (d.prompt) form.prompt = d.prompt
    if (d.aiAnswer) form.aiAnswer = d.aiAnswer
    if (d.platform) form.platform = d.platform
    form.shareLink = linkUrl.value.trim()
    parsedFiles.value = d.files || []
    if (d.manualRequired) {
      message.warning(d.warning || '平台未公开对话正文，已保留链接，请手动补充内容')
      return
    }
    message.success('链接解析成功，内容已自动填入')
  } catch (err) {
    message.error(err.response?.data?.message || '链接解析失败，请手动填写')
  } finally {
    parsing.value = false
  }
}

// 图片上传
const uploadFileList = ref([])
const previewVisible = ref(false)
const previewSrc = ref('')

async function onBeforeUpload(file) {
  try {
    const res = await uploadImage(file)
    const url = res.data.url
    form.images.push(url)
    uploadFileList.value.push({
      uid: file.uid || Date.now().toString(),
      name: file.name,
      status: 'done',
      url,
      thumbUrl: url,
    })
  } catch {
    message.error('图片上传失败')
  }
  return false // 阻止默认上传行为
}

function onRemoveImage(file) {
  const idx = form.images.indexOf(file.url)
  if (idx >= 0) form.images.splice(idx, 1)
}

function onPreviewImage(fileOrList, idx) {
  if (Array.isArray(fileOrList)) {
    // 详情弹窗中的图片
    previewSrc.value = fileOrList[idx]
  } else {
    // 上传列表中的图片
    previewSrc.value = fileOrList.url || fileOrList.thumbUrl
  }
  previewVisible.value = true
}

async function handleSubmit() {
  if (submitting.value) return
  try {
    await formRef.value.validate()
    await onSubmit()
  } catch (err) {
    if (err?.errorFields) {
      message.error('请填写所有必填项：Prompt、AI 平台、分类')
    }
  }
}

async function onSubmit() {
  submitting.value = true
  try {
    await submitCase({
      prompt: form.prompt,
      platform: form.platform,
      model: form.model,
      category: form.category,
      aiAnswer: form.aiAnswer,
      satisfaction: form.satisfaction || 0,
      isGoodCase: form.isGoodCase,
      note: form.note,
      tags: form.tags,
      shareLink: form.shareLink,
      images: form.images,
      annotations: form.annotations,
      sourceMessageId: form.sourceMessageId,
      sourceDiaryId: form.sourceDiaryId,
      revisionOfId: form.revisionOfId,
    })
    message.success('案例已提交，等待管理员审核')
    showSubmitModal.value = false
    resetForm()
    loadCases()
  } catch (err) {
    const msg = err.response?.data?.message || '提交失败，请重试'
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

// 详情 & 评论
const detailVisible = ref(false)
const detailCase = ref(null)
const detailComments = ref([])
const detailPromptCollapsed = ref(true)
const detailAnswerCollapsed = ref(true)
const annotationCreating = ref(false)
const annotationSection = ref(null)

async function openDetail(item, focus = '') {
  detailCase.value = item
  detailVisible.value = true
  detailPromptCollapsed.value = true
  detailAnswerCollapsed.value = Boolean(item.aiAnswer?.length > 100)
  loadDetailComments(item.id)
  await nextTick()
  if (focus) annotationSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function readConversationClipboard() {
  try {
    rawConversation.value = await navigator.clipboard.readText()
    if (!rawConversation.value.trim()) message.warning('剪贴板中没有文本内容')
  } catch {
    message.warning('浏览器未允许读取剪贴板，请直接粘贴对话内容')
  }
}

function applyImportedConversation(data) {
  form.prompt = data.prompt || ''
  form.aiAnswer = data.aiAnswer || ''
  if (data.platform) form.platform = data.platform
  form.model = ''
  form.annotations = []
}

async function onImportConversationText() {
  if (!rawConversation.value.trim()) return
  importingText.value = true
  try {
    const res = await importConversationText({ text: rawConversation.value, platform: form.platform || '' })
    applyImportedConversation(res.data)
    message.success('对话内容已识别，请核对后批注')
  } catch (err) {
    message.error(err.response?.data?.message || '对话内容识别失败，请检查内容后重试')
  } finally { importingText.value = false }
}

function onBeforeScreenshotImport() {
  return false
}

async function onImportScreenshots() {
  if (!screenshotFileList.value.length) return
  recognizingScreenshots.value = true
  try {
    const res = await importConversationScreenshots(screenshotFileList.value, form.platform || '')
    applyImportedConversation(res.data)
    for (const [index, url] of (res.data.images || []).entries()) {
      if (!form.images.includes(url)) form.images.push(url)
      uploadFileList.value.push({ uid: `recognized-${Date.now()}-${index}`, name: `对话截图 ${index + 1}`, status: 'done', url, thumbUrl: url })
    }
    screenshotFileList.value = []
    message.success('截图内容已识别，请核对后批注')
  } catch (err) {
    message.error(err.response?.data?.message || '截图识别失败，请重试')
  } finally { recognizingScreenshots.value = false }
}

async function loadDetailComments(caseId) {
  try {
    const res = await getComments(caseId)
    detailComments.value = res.data || []
  } catch { detailComments.value = [] }
}

async function onCreateDetailAnnotation(annotation) {
  annotationCreating.value = true
  try {
    const res = await addCaseAnnotation(detailCase.value.id, annotation)
    detailCase.value.annotations = [...(detailCase.value.annotations || []), res.data]
    detailCase.value.annotationCount = Number(detailCase.value.annotationCount || 0) + 1
    message.success('批注已添加')
  } catch (err) {
    message.error(err.response?.data?.message || '批注添加失败，请重试')
  } finally { annotationCreating.value = false }
}

async function onVoteAnnotation(annotation, vote) {
  if (annotation.isOwn) return
  const previousAgree = Number(annotation.agreeCount || 0)
  const previousDisagree = Number(annotation.disagreeCount || 0)
  try {
    const res = await voteCaseAnnotation(detailCase.value.id, annotation.id, vote)
    annotation.userVote = res.data.userVote
    annotation.agreeCount = res.data.agreeCount
    annotation.disagreeCount = res.data.disagreeCount
    detailCase.value.annotationAgreeCount = Math.max(0, Number(detailCase.value.annotationAgreeCount || 0) + res.data.agreeCount - previousAgree)
    detailCase.value.annotationDisagreeCount = Math.max(0, Number(detailCase.value.annotationDisagreeCount || 0) + res.data.disagreeCount - previousDisagree)
  } catch (err) {
    message.error(err.response?.data?.message || '投票失败，请重试')
  }
}

function onAnnotationCommentCountChange(annotation, delta) {
  annotation.commentCount = Math.max(0, Number(annotation.commentCount || 0) + delta)
  detailCase.value.annotationCommentCount = Math.max(0, Number(detailCase.value.annotationCommentCount || 0) + delta)
}

async function onWithdrawAnnotation(annotation) {
  try {
    await withdrawCaseAnnotation(detailCase.value.id, annotation.id)
    detailCase.value.annotations = detailCase.value.annotations.filter(item => item.id !== annotation.id)
    detailCase.value.annotationCount = Math.max(0, Number(detailCase.value.annotationCount || 0) - 1)
    message.success('批注已撤回，历史记录仍由系统保留')
  } catch (err) {
    message.error(err.response?.data?.message || '批注撤回失败，请重试')
  }
}

// 工具函数
function categoryColor(c) {
  const m = { factual_error: 'red', missing_information: 'gold', image_understanding_failure: 'purple', irrelevant_answer: 'volcano', reasoning_error: 'geekblue', misleading_expression: 'orange', capability_limitation: 'cyan', campus_info: 'green', news: 'cyan', domain_knowledge: 'geekblue', unreliable_source: 'orange', unverifiable: 'orange', no_source: 'orange', image_understanding: 'purple', database_query: 'purple', login_required: 'purple', interaction_unsatisfied: 'red', workflow: 'red' }
  return m[c] || 'default'
}
function renderMd(text) {
  return DOMPurify.sanitize(marked(text || ''))
}

function categoryLabel(c) {
  return optionLabel(CASE_CATEGORIES, c)
}
function errorTypeLabel(value) {
  const label = optionLabel(ERROR_TYPE_OPTIONS, value)
  return label === value ? categoryLabel(value) : label
}
function taxonomyValues(values, fallback) {
  return Array.isArray(values) && values.length ? values : fallback ? [fallback] : []
}
function taxonomyLabel(options, value, otherText = '') {
  if (value === 'other' && otherText) return `其他：${otherText}`
  return optionLabel(options, value)
}
function displayPlatform(item) {
  return platformLabel(item.platform, item.platformOther)
}
</script>

<style scoped>
.gallery-page {
  display: flex;
  height: 100vh;
  background: var(--hib-paper);
}

/* 主区 */
.main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.workspace-header { min-height: 84px; display: flex; align-items: end; justify-content: space-between; margin-bottom: 20px; padding-bottom: 18px; border-bottom: 1px solid var(--hib-line); }
.workspace-header span { color: var(--hib-red); font-size: 11px; }
.workspace-header h1 { margin: 5px 0 0; font-size: 25px; line-height: 1.2; }
.workspace-header small { color: var(--hib-muted); }

.field-note { margin-top: 4px; color: #6b7280; font-size: 12px; }
.draft-picker-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--hib-line); }
.draft-picker-head p { margin: 5px 0 0; color: var(--hib-muted); font-size: 13px; }
.draft-list { display: grid; gap: 8px; max-height: 430px; margin-top: 14px; overflow: auto; }
.draft-row { display: grid; grid-template-columns: minmax(0, 1fr) 36px; align-items: center; gap: 8px; padding: 8px 8px 8px 14px; border: 1px solid var(--hib-line); background: #fff; }
.draft-row:hover { border-color: #d7c3c5; background: #fdfafa; }
.draft-content { min-width: 0; padding: 0; border: 0; background: transparent; text-align: left; cursor: pointer; }
.draft-content strong, .draft-content span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.draft-content strong { color: var(--hib-text); font-size: 14px; }
.draft-content span { margin-top: 4px; color: var(--hib-muted); font-size: 12px; }
.import-panel { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--hib-line); background: #fbfaf9; }
.import-actions { display: flex; justify-content: space-between; gap: 8px; }
.import-actions.end { justify-content: flex-end; }
.screenshot-import-icon { margin-bottom: 8px; color: var(--hib-red); font-size: 30px; }

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

/* 上传卡片 */
.upload-card {
  position: relative;
  height: 100%;
  min-height: 200px;
  border: 2px dashed var(--hib-line);
  border-radius: 7px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: #999;
  transition: all 0.2s;
}

.upload-card:hover {
  border-color: var(--hib-red);
  color: var(--hib-red);
  background: var(--hib-red-soft);
}

.upload-icon {
  font-size: 36px;
}

.draft-dot {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  color: #fff;
  background: #ff4d4f;
  border-radius: 10px;
  box-shadow: 0 0 0 2px #fff;
  z-index: 1;
}

.upload-card.has-draft {
  border-color: var(--hib-red);
  border-style: solid;
  background: rgba(173, 70, 82, 0.03);
}

/* 案例卡片 */
.case-card {
  border: 1px solid var(--hib-line);
  border-radius: 7px;
  padding: 20px;
  background: #fff;
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}

.case-card:hover { border-color: #d8cdca; box-shadow: 0 8px 22px rgba(55,39,42,.07); }

.case-card-top { margin-bottom: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

.card-img-badge {
  font-size: 12px;
  color: #999;
  margin-left: auto;
}

.case-prompt {
  font-size: 15px;
  line-height: 1.6;
  color: #222;
  cursor: pointer;
  margin-bottom: 8px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-answer {
  font-size: 13px;
  color: #888;
  line-height: 1.5;
  cursor: pointer;
  margin-bottom: 4px;
}

.case-tags { margin-bottom: 8px; }

.case-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
  font-size: 13px;
}

.case-author { color: #999; }

.action-btn {
  cursor: pointer;
  color: #999;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.action-btn:hover { color: var(--hib-red); }

.embedded-thread { margin-top: 11px; padding: 11px 12px 12px; border-left: 2px solid #eadcde; background: #fbf9f9; }
.embedded-comments { display: grid; gap: 8px; }
.embedded-comment { padding: 9px 10px; border-bottom: 1px solid #eee7e8; background: #fff; }
.embedded-comment header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.embedded-comment header strong { font-size: 12px; color: #62585a; }
.embedded-comment header :deep(.ant-btn) { width: 26px; height: 26px; padding: 0; }
.embedded-comment p { margin: 5px 0 0; color: #4b4547; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.comment-expand { height: 24px; padding: 0; font-size: 12px; }
.no-comments { padding: 5px 2px 2px; color: var(--hib-muted); font-size: 12px; }
.thread-edit-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.thread-composer { display: grid; grid-template-columns: minmax(0, 1fr) 40px; align-items: end; gap: 8px; margin-top: 10px; }
.thread-composer :deep(.ant-btn) { width: 40px; height: 40px; padding: 0; }
.legacy-discussion { margin-top: 8px; border-top: 1px solid var(--hib-line); }

.pagination {
  margin-top: 32px;
  text-align: center;
}

.detail-section {
  margin-bottom: 16px;
}

.annotation-compose-section { margin-top: 26px; padding-top: 22px; border-top: 2px solid var(--hib-text); }
.annotation-discussion-section { margin-top: 34px; }
.section-heading-line { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 13px; }
.section-heading-line span { color: var(--hib-red); font-size: 10px; }
.section-heading-line h3 { margin: 3px 0 0; font-size: 20px; }
.section-heading-line p { margin: 0; color: var(--hib-muted); font-size: 13px; }

.detail-section-title {
  font-size: 13px;
  color: #999;
  margin-bottom: 4px;
}

.detail-answer {
  line-height: 1.5;
  white-space: normal;
}

.detail-images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-img {
  width: 180px;
  height: 180px;
  object-fit: cover;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #eee;
}

.detail-img:hover { border-color: var(--hib-red); }

.collapsed {
  max-height: 120px;
  overflow: hidden;
  position: relative;
}

.collapsed::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  background: rgba(255,255,255,.94);
}

.collapse-btn {
  padding: 0;
  font-size: 12px;
  margin-top: 4px;
}

/* Markdown */
.markdown-body :deep(h1) { font-size: 1.3em; margin: 0.5em 0 0.25em; }
.markdown-body :deep(h2) { font-size: 1.15em; margin: 0.5em 0 0.25em; }
.markdown-body :deep(h3) { font-size: 1.05em; margin: 0.4em 0 0.2em; }
.markdown-body :deep(p) { margin: 0.3em 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; margin: 0.25em 0; }
.markdown-body :deep(li) { margin: 0.1em 0; }
.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}
.markdown-body :deep(pre) {
  background: #1e1e1e;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}
.markdown-body :deep(strong) { font-weight: 600; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid var(--hib-red);
  padding-left: 12px;
  margin: 0.5em 0;
  color: #666;
}
.markdown-body :deep(table) { border-collapse: collapse; margin: 0.5em 0; }
.markdown-body :deep(th), .markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 6px 12px;
  text-align: left;
}
.markdown-body :deep(th) { background: #f5f5f5; font-weight: 600; }

@media (max-width: 760px) {
  .main { padding: 72px 14px 28px; }
  .workspace-header { min-height: 72px; margin-bottom: 16px; padding-bottom: 14px; }
  .workspace-header h1 { font-size: 21px; }
  .toolbar, .toolbar-left { align-items: stretch; flex-direction: column; }
  .card-grid { grid-template-columns: minmax(0, 1fr); }
  .case-card { padding: 16px; }
  .draft-picker-head { flex-direction: column; }
  .detail-meta { width: 100%; margin-left: 0; }
}
.detail-taxonomy { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.taxonomy-label { margin-left: 5px; color: var(--hib-muted); font-size: 12px; }
.taxonomy-label:first-child { margin-left: 0; }
.detail-meta { margin-left: auto; color: var(--hib-muted); font-size: 12px; }
.detail-section-title small { margin-left: 8px; color: var(--hib-muted); font-weight: 400; }
@media (max-width: 760px) {
  .detail-meta { width: 100%; margin-left: 0; }
  .section-heading-line { align-items: flex-start; flex-direction: column; }
}
</style>
