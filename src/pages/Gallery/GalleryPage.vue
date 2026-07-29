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
          <a-select
            v-model:value="filterCategory"
            placeholder="按分类筛选"
            style="width: 180px"
            allow-clear
            @change="onFilter"
          >
            <a-select-option value="campus_info">校园信息缺失</a-select-option>
            <a-select-option value="news">最新新闻/时事</a-select-option>
            <a-select-option value="domain_knowledge">特定领域知识</a-select-option>
            <a-select-option value="unreliable_source">参考来源不可信</a-select-option>
            <a-select-option value="unverifiable">信息来源不可验证</a-select-option>
            <a-select-option value="no_source">无法提供参考来源</a-select-option>
            <a-select-option value="image_understanding">图片理解失败</a-select-option>
            <a-select-option value="database_query">特定数据库查询</a-select-option>
            <a-select-option value="login_required">需要登录网站</a-select-option>
            <a-select-option value="interaction_unsatisfied">对交互不满意</a-select-option>
            <a-select-option value="workflow">工作流不匹配</a-select-option>
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
        <div class="upload-card" @click="openManualSubmit">
          <PlusOutlined class="upload-icon" />
          <span>提交案例</span>
        </div>

        <!-- 案例卡片 -->
        <div
          v-for="item in cases"
          :key="item.id"
          class="case-card"
        >
          <div class="case-card-top">
            <a-tag :color="categoryColor(item.category)">{{ categoryLabel(item.category) }}</a-tag>
            <a-tag>{{ item.platform }}</a-tag>
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
              <span class="action-btn" title="片段批注" @click.stop="openDetail(item)">
                <HighlightOutlined />
                {{ item.annotationCount || 0 }}
              </span>
              <span class="action-btn" title="批注赞成票" @click.stop="openDetail(item)">
                <CheckOutlined />
                {{ item.annotationAgreeCount || 0 }}
              </span>
              <span class="action-btn" title="批注反对票" @click.stop="openDetail(item)">
                <CloseOutlined />
                {{ item.annotationDisagreeCount || 0 }}
              </span>
              <span class="action-btn" title="批注评论" @click.stop="openDetail(item)">
                <CommentOutlined />
                {{ item.annotationCommentCount || 0 }}
              </span>
            </a-space>
          </div>
        </div>
      </div>

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
      width="min(980px, 94vw)"
      :footer="null"
      @cancel="detailVisible = false"
    >
      <div v-if="detailCase">
        <div style="margin-bottom: 12px">
          <a-tag :color="categoryColor(detailCase.category)">{{ categoryLabel(detailCase.category) }}</a-tag>
          <a-tag>{{ detailCase.platform }}</a-tag>
          <span style="color: #999; margin-left: 8px">{{ detailCase.author }} · {{ detailCase.createdAt }}</span>
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
        <div class="detail-section">
          <div class="detail-section-title">片段批注与讨论</div>
          <AnnotationEditor
            :text="detailCase.aiAnswer"
            :model-value="detailCase.annotations || []"
            :creating="annotationCreating"
            :active-annotation-id="selectedAnnotation?.id || ''"
            readonly
            collaborative
            discussion
            @create-annotation="onCreateDetailAnnotation"
            @vote="onVoteAnnotation"
            @withdraw="onWithdrawAnnotation"
            @select-annotation="onSelectAnnotation"
          />
        </div>
        <section v-if="selectedAnnotation" class="annotation-thread">
          <header>
            <div><span>批注讨论</span><strong>{{ selectedAnnotation.issueType }}</strong></div>
            <small>{{ selectedAnnotation.author }}</small>
          </header>
          <blockquote>“{{ selectedAnnotation.selectedText }}”</blockquote>
          <a-list v-if="annotationComments.length || annotationCommentsLoading" :data-source="annotationComments" size="small" :loading="annotationCommentsLoading">
            <template #renderItem="{ item: c }">
              <a-list-item class="thread-comment">
                <div class="thread-comment-body">
                  <div class="thread-comment-head">
                    <strong>{{ c.author }}</strong>
                    <a-space v-if="c.canManage && editingCommentId !== c.id" size="small">
                      <a-button type="text" size="small" aria-label="编辑评论" title="编辑评论" @click="startEditComment(c)"><EditOutlined /></a-button>
                      <a-popconfirm title="确定删除这条评论？" ok-text="删除" cancel-text="取消" @confirm="onDeleteAnnotationComment(c)">
                        <a-button type="text" danger size="small" aria-label="删除评论" title="删除评论"><DeleteOutlined /></a-button>
                      </a-popconfirm>
                    </a-space>
                  </div>
                  <template v-if="editingCommentId === c.id">
                    <a-textarea v-model:value="editingCommentText" :rows="2" :maxlength="4000" />
                    <a-space class="thread-edit-actions">
                      <a-button size="small" @click="cancelEditComment">取消</a-button>
                      <a-button type="primary" size="small" :loading="commentMutating" @click="onSaveAnnotationComment(c)">保存</a-button>
                    </a-space>
                  </template>
                  <p v-else>{{ c.content }}</p>
                </div>
              </a-list-item>
            </template>
          </a-list>
          <a-empty v-else description="暂无评论" />
          <div class="thread-composer">
            <a-textarea v-model:value="annotationCommentText" :rows="2" placeholder="围绕这条批注发表评论" />
            <a-button type="primary" :loading="annotationCommentSending" aria-label="发送批注评论" title="发送批注评论" @click="onSendAnnotationComment"><SendOutlined /></a-button>
          </div>
        </section>
        <div class="detail-section" v-if="detailCase.images?.length">
          <div class="detail-section-title">相关截图</div>
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
import { reactive, ref, onMounted, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined, CommentOutlined, CopyOutlined, DeleteOutlined, DownOutlined, EditOutlined, FileTextOutlined, HighlightOutlined, InboxOutlined, PictureOutlined, PlusOutlined, ScanOutlined, SendOutlined, UpOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import AnnotationEditor from '../../components/cases/AnnotationEditor.vue'
import { addAnnotationComment, addCaseAnnotation, deleteAnnotationComment, getAnnotationComments, getCaseDraftFromDiary, getCaseDraftFromMessage, getCaseDraftFromRevision, getCases, getComments, importConversationScreenshots, importConversationText, parseLink, submitCase, updateAnnotationComment, uploadImage, voteCaseAnnotation, withdrawCaseAnnotation } from '../../api/submission'
import { CASE_CATEGORIES, PLATFORM_OPTIONS, optionLabel } from '../../constants/options'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const router = useRouter()
const route = useRoute()

// 从 URL query 参数打开提交案例弹窗
async function openSubmitFromQuery() {
  if (route.query.submit === '1') {
    resetForm()
    if (route.query.messageId) {
      const res = await getCaseDraftFromMessage(route.query.messageId)
      Object.assign(form, res.data)
      platformLocked.value = true
    } else if (route.query.diaryId) {
      const res = await getCaseDraftFromDiary(route.query.diaryId)
      Object.assign(form, res.data)
      platformLocked.value = Boolean(res.data.platformLocked)
    } else if (route.query.revisionId) {
      const res = await getCaseDraftFromRevision(route.query.revisionId)
      Object.assign(form, res.data)
      platformLocked.value = Boolean(res.data.platformLocked)
    } else {
      form.prompt = route.query.prompt || ''
      form.aiAnswer = route.query.aiAnswer || ''
    }
    form.satisfaction = Number(route.query.satisfaction || 0)
    form.category = undefined
    parsedFiles.value = []
    uploadFileList.value = []
    linkUrl.value = ''
    for (const [index, url] of form.images.entries()) {
      uploadFileList.value.push({ uid: `source-${index}`, name: '对话图片', status: 'done', url, thumbUrl: url })
    }
    if (route.query.imageUrl) {
      form.images.push(route.query.imageUrl)
      uploadFileList.value.push({
        uid: 'chat-img',
        name: '对话图片',
        status: 'done',
        url: route.query.imageUrl,
        thumbUrl: route.query.imageUrl,
      })
    }
    isFromChat.value = true
    showSubmitModal.value = true
    router.replace({ query: {} })
  }
}

// keep-alive 激活时检查（覆盖首次挂载和从 Chat 页切回）
onActivated(() => {
  openSubmitFromQuery()
})

// 已在 Gallery 页面时 query 变化
watch(() => route.query.submit, (val) => {
  if (val === '1') openSubmitFromQuery()
})

// 列表
const search = ref('')
const filterCategory = ref(undefined)
const sortBy = ref('latest')
const loading = ref(false)
const cases = ref([])
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

onMounted(() => loadCases())

async function loadCases() {
  loading.value = true
  try {
    const res = await getCases({
      page: page.value,
      pageSize: pageSize.value,
      category: filterCategory.value,
      keyword: search.value,
      sortBy: sortBy.value,
    })
    cases.value = res.data.list || []
    total.value = res.data.total || 0
  } catch { /* ignore */ } finally {
    loading.value = false
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

function openManualSubmit() {
  resetForm()
  showSubmitModal.value = true
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
const selectedAnnotation = ref(null)
const annotationComments = ref([])
const annotationCommentText = ref('')
const annotationCreating = ref(false)
const annotationCommentsLoading = ref(false)
const annotationCommentSending = ref(false)
const editingCommentId = ref('')
const editingCommentText = ref('')
const commentMutating = ref(false)

function openDetail(item) {
  detailCase.value = item
  detailVisible.value = true
  detailPromptCollapsed.value = true
  detailAnswerCollapsed.value = Boolean(item.aiAnswer?.length > 100)
  selectedAnnotation.value = null
  annotationComments.value = []
  annotationCommentText.value = ''
  cancelEditComment()
  loadDetailComments(item.id)
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
    await onSelectAnnotation(res.data)
  } finally { annotationCreating.value = false }
}

async function onVoteAnnotation(annotation, vote) {
  if (annotation.isOwn) return
  const previousAgree = Number(annotation.agreeCount || 0)
  const previousDisagree = Number(annotation.disagreeCount || 0)
  const res = await voteCaseAnnotation(detailCase.value.id, annotation.id, vote)
  annotation.userVote = res.data.userVote
  annotation.agreeCount = res.data.agreeCount
  annotation.disagreeCount = res.data.disagreeCount
  detailCase.value.annotationAgreeCount = Math.max(0, Number(detailCase.value.annotationAgreeCount || 0) + res.data.agreeCount - previousAgree)
  detailCase.value.annotationDisagreeCount = Math.max(0, Number(detailCase.value.annotationDisagreeCount || 0) + res.data.disagreeCount - previousDisagree)
}

async function onWithdrawAnnotation(annotation) {
  await withdrawCaseAnnotation(detailCase.value.id, annotation.id)
  detailCase.value.annotations = detailCase.value.annotations.filter(item => item.id !== annotation.id)
  detailCase.value.annotationCount = Math.max(0, Number(detailCase.value.annotationCount || 0) - 1)
  if (selectedAnnotation.value?.id === annotation.id) selectedAnnotation.value = null
  message.success('批注已撤回，历史记录仍由系统保留')
}

async function onSelectAnnotation(annotation) {
  selectedAnnotation.value = annotation
  annotationCommentText.value = ''
  cancelEditComment()
  annotationCommentsLoading.value = true
  try {
    annotationComments.value = (await getAnnotationComments(detailCase.value.id, annotation.id)).data || []
  } finally { annotationCommentsLoading.value = false }
}

async function onSendAnnotationComment() {
  const content = annotationCommentText.value.trim()
  if (!content || !selectedAnnotation.value) return
  annotationCommentSending.value = true
  try {
    const res = await addAnnotationComment(detailCase.value.id, selectedAnnotation.value.id, { content })
    annotationComments.value.push(res.data)
    selectedAnnotation.value.commentCount = Number(selectedAnnotation.value.commentCount || 0) + 1
    detailCase.value.annotationCommentCount = Number(detailCase.value.annotationCommentCount || 0) + 1
    annotationCommentText.value = ''
  } finally { annotationCommentSending.value = false }
}

function startEditComment(comment) {
  editingCommentId.value = comment.id
  editingCommentText.value = comment.content
}

function cancelEditComment() {
  editingCommentId.value = ''
  editingCommentText.value = ''
}

async function onSaveAnnotationComment(comment) {
  const content = editingCommentText.value.trim()
  if (!content) return message.warning('评论内容不能为空')
  commentMutating.value = true
  try {
    const res = await updateAnnotationComment(detailCase.value.id, selectedAnnotation.value.id, comment.id, { content })
    comment.content = res.data.content
    cancelEditComment()
    message.success('评论已更新')
  } finally { commentMutating.value = false }
}

async function onDeleteAnnotationComment(comment) {
  commentMutating.value = true
  try {
    await deleteAnnotationComment(detailCase.value.id, selectedAnnotation.value.id, comment.id)
    annotationComments.value = annotationComments.value.filter(item => item.id !== comment.id)
    selectedAnnotation.value.commentCount = Math.max(0, Number(selectedAnnotation.value.commentCount || 0) - 1)
    detailCase.value.annotationCommentCount = Math.max(0, Number(detailCase.value.annotationCommentCount || 0) - 1)
    if (editingCommentId.value === comment.id) cancelEditComment()
    message.success('评论已删除')
  } finally { commentMutating.value = false }
}

// 工具函数
function categoryColor(c) {
  const m = { campus_info: 'green', news: 'cyan', domain_knowledge: 'geekblue', unreliable_source: 'orange', unverifiable: 'orange', no_source: 'orange', image_understanding: 'purple', database_query: 'purple', login_required: 'purple', interaction_unsatisfied: 'red', workflow: 'red' }
  return m[c] || 'default'
}
function renderMd(text) {
  return DOMPurify.sanitize(marked(text || ''))
}

function categoryLabel(c) {
  return optionLabel(CASE_CATEGORIES, c)
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

.annotation-thread {
  margin: 4px 0 18px;
  padding: 16px 18px;
  border: 1px solid var(--hib-line);
  border-left: 3px solid var(--hib-red);
  background: #fff;
}
.annotation-thread header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.annotation-thread header div { display: flex; align-items: center; gap: 10px; }
.annotation-thread header span, .annotation-thread header small { color: var(--hib-muted); font-size: 12px; }
.annotation-thread blockquote { margin: 12px 0 4px; padding-left: 12px; border-left: 2px solid var(--hib-line); color: #655e60; font-size: 13px; }
.annotation-thread :deep(.ant-list-empty-text) { padding-block: 14px; }
.thread-comment-body { width: 100%; min-width: 0; }
.thread-comment-head { min-height: 30px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.thread-comment-head :deep(.ant-btn) { width: 28px; height: 28px; padding: 0; }
.thread-comment-body p { margin: 4px 0 0; color: #4b4547; line-height: 1.6; white-space: pre-wrap; }
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
  width: 120px;
  height: 120px;
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
}
</style>
