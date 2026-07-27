<template>
  <div class="gallery-page">
    <ConversationSidebar />

    <!-- 右侧主区 -->
    <div class="main">
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
        </a-radio-group>
      </div>

      <div class="card-grid">
        <!-- + 上传卡片 -->
        <div class="upload-card" @click="showSubmitModal = true">
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
              <span class="action-btn" @click.stop="onLike(item)">
                <LikeOutlined :style="{ color: item.liked ? '#1677ff' : '' }" />
                {{ item.likeCount || 0 }}
              </span>
              <span class="action-btn" @click.stop="openDetail(item)">
                <CommentOutlined />
                {{ item.commentCount || 0 }}
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
      width="680px"
      :footer="null"
      :destroy-on-close="true"
    >
      <a-form :model="form" layout="vertical" ref="formRef">
        <a-form-item label="输入链接" v-if="!isFromChat">
          <a-input-search
            v-model:value="linkUrl"
            placeholder="粘贴 AI 对话分享链接，如 https://chat.deepseek.com/share/..."
            enter-button="解析"
            :loading="parsing"
            @search="onParseLink"
          />
          <div style="font-size: 12px; color: #999; margin-top: 4px">
            支持 DeepSeek、ChatGPT、Claude、Kimi、通义千问等平台的分享链接，自动提取对话内容
          </div>
        </a-form-item>

        <a-form-item label="Prompt（必填）" name="prompt" :rules="[{ required: true, message: '请输入你的 Prompt' }]">
          <a-textarea v-model:value="form.prompt" :rows="3" placeholder="描述你的信息需求和给 AI 的提示词..." />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="AI 平台" name="platform" :rules="[{ required: true, message: '请选择' }]">
              <a-select v-model:value="form.platform" placeholder="选择平台">
                <a-select-option value="deepseek">DeepSeek</a-select-option>
                <a-select-option value="glm">GLM</a-select-option>
                <a-select-option value="kimi">Kimi</a-select-option>
                <a-select-option value="qwen">通义千问</a-select-option>
                <a-select-option value="doubao">豆包</a-select-option>
                <a-select-option value="chatgpt">ChatGPT</a-select-option>
                <a-select-option value="other">其他</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="分类" name="category" :rules="[{ required: true, message: '请选择' }]">
              <a-select v-model:value="form.category" placeholder="未满足原因">
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
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="AI 回答">
          <a-textarea v-model:value="form.aiAnswer" :rows="3" placeholder="粘贴 AI 的完整回答..." />
        </a-form-item>

        <a-form-item label="相关截图">
          <div v-if="parsedFiles.length" style="font-size: 12px; color: #1677ff; margin-bottom: 8px">
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

        <a-form-item label="补充说明">
          <a-textarea v-model:value="form.note" :rows="2" placeholder="为什么 AI 未满足需求？" />
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
      width="640px"
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
        <a-divider>评论</a-divider>
        <a-list :data-source="detailComments" size="small" v-if="detailComments.length">
          <template #renderItem="{ item: c }">
            <a-list-item>
              <a-list-item-meta :title="c.author" :description="c.content" />
            </a-list-item>
          </template>
        </a-list>
        <a-empty v-else description="暂无评论" />
        <div style="display: flex; gap: 8px; margin-top: 12px">
          <a-textarea v-model:value="detailCommentText" :rows="2" placeholder="写评论..." style="flex:1" />
          <a-button type="primary" @click="onSendDetailComment" style="align-self: flex-end">发送</a-button>
        </div>
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
import { PlusOutlined, LikeOutlined, CommentOutlined, DownOutlined, UpOutlined, PictureOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { getCases, likeCase, getComments, addComment, submitCase, parseLink, uploadImage } from '../../api/submission'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const router = useRouter()
const route = useRoute()

// 从 URL query 参数打开提交案例弹窗
function openSubmitFromQuery() {
  if (route.query.submit === '1') {
    form.prompt = route.query.prompt || ''
    form.aiAnswer = route.query.aiAnswer || ''
    form.platform = undefined
    form.category = undefined
    form.images = []
    parsedFiles.value = []
    uploadFileList.value = []
    linkUrl.value = ''
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

async function onLike(item) {
  try {
    await likeCase(item.id)
    item.liked = !item.liked
    item.likeCount += item.liked ? 1 : -1
  } catch { /* ignore */ }
}

// 提交
const showSubmitModal = ref(false)
const submitting = ref(false)
const parsing = ref(false)
const linkUrl = ref('')
const formRef = ref()
const form = reactive({
  prompt: '', platform: undefined, category: undefined,
  aiAnswer: '', satisfaction: 0, isGoodCase: false,
  note: '', tags: [], shareLink: '', images: [],
})

const isFromChat = ref(false)

function resetForm() {
  Object.assign(form, {
    prompt: '', platform: undefined, category: undefined,
    aiAnswer: '', satisfaction: 0, isGoodCase: false,
    note: '', tags: [], shareLink: '', images: [],
  })
  linkUrl.value = ''
  parsedFiles.value = []
  uploadFileList.value = []
  formRef.value?.resetFields()
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
      category: form.category,
      aiAnswer: form.aiAnswer,
      satisfaction: form.satisfaction || 0,
      isGoodCase: form.isGoodCase,
      note: form.note,
      tags: form.tags,
      shareLink: form.shareLink,
      images: form.images,
    })
    message.success('案例提交成功！')
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
const detailCommentText = ref('')
const detailPromptCollapsed = ref(true)
const detailAnswerCollapsed = ref(true)

function openDetail(item) {
  detailCase.value = item
  detailVisible.value = true
  detailCommentText.value = ''
  detailPromptCollapsed.value = true
  detailAnswerCollapsed.value = true
  loadDetailComments(item.id)
}

async function loadDetailComments(caseId) {
  try {
    const res = await getComments(caseId)
    detailComments.value = res.data || []
  } catch { detailComments.value = [] }
}

async function onSendDetailComment() {
  if (!detailCommentText.value.trim()) return
  try {
    await addComment(detailCase.value.id, { content: detailCommentText.value })
    detailCommentText.value = ''
    loadDetailComments(detailCase.value.id)
    detailCase.value.commentCount++
  } catch { /* ignore */ }
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
  const m = { campus_info: '校园信息缺失', news: '最新新闻/时事', domain_knowledge: '特定领域知识', unreliable_source: '参考来源不可信', unverifiable: '信息来源不可验证', no_source: '无法提供参考来源', image_understanding: '图片理解失败', database_query: '特定数据库查询', login_required: '需要登录网站', interaction_unsatisfied: '对交互不满意', workflow: '工作流不匹配' }
  return m[c] || c
}
</script>

<style scoped>
.gallery-page {
  display: flex;
  height: 100vh;
  background: #fff;
}

/* 主区 */
.main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

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
  border: 2px dashed #d1d5db;
  border-radius: 12px;
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
  border-color: #1677ff;
  color: #1677ff;
  background: #f0f5ff;
}

.upload-icon {
  font-size: 36px;
}

/* 案例卡片 */
.case-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 20px;
  background: #fff;
  transition: box-shadow 0.2s;
  display: flex;
  flex-direction: column;
}

.case-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

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

.action-btn:hover { color: #1677ff; }

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

.detail-img:hover { border-color: #1677ff; }

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
  background: linear-gradient(transparent, #fff);
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
  border-left: 3px solid #1677ff;
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
</style>
