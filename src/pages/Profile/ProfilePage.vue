<template>
  <div class="profile-page">
    <ConversationSidebar />

    <div class="main">
      <a-card :bordered="false" class="profile-header">
        <a-row align="middle" :gutter="24">
          <a-col>
            <a-avatar :size="72">{{ auth.user?.name?.[0] || 'U' }}</a-avatar>
          </a-col>
          <a-col :flex="1">
            <h2>{{ auth.user?.name || '用户' }}</h2>
            <a-space>
              <a-tag v-if="auth.isGuest" color="orange">游客模式</a-tag>
              <a-tag v-else color="blue">{{ auth.user?.studentId }}</a-tag>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :span="6" v-for="stat in stats" :key="stat.label">
          <a-card :bordered="false">
            <a-statistic :title="stat.label" :value="stat.value" :suffix="stat.suffix" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="我的提交记录" :bordered="false" style="margin-top: 16px">
        <div class="card-grid" v-if="submissions.length">
          <div
            v-for="item in submissions"
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
              <span class="case-date">{{ item.createdAt }}</span>
              <a-space>
                <a-rate :value="item.satisfaction" :count="5" disabled style="font-size: 12px" />
                <a-button type="link" danger size="small" @click.stop="onDelete(item)">删除</a-button>
              </a-space>
            </div>
          </div>
        </div>
        <a-empty v-if="!loading && submissions.length === 0" description="暂无提交记录" />
      </a-card>
    </div>

    <!-- 案例详情弹窗 -->
    <a-modal
      v-model:open="detailVisible"
      title="案例详情"
      width="760px"
      :footer="null"
      @cancel="detailVisible = false"
    >
      <div v-if="detailCase">
        <div style="margin-bottom: 12px">
          <a-tag :color="categoryColor(detailCase.category)">{{ categoryLabel(detailCase.category) }}</a-tag>
          <a-tag>{{ detailCase.platform }}</a-tag>
          <span style="color: #999; margin-left: 8px">{{ detailCase.createdAt }}</span>
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
import { ref, onMounted } from 'vue'
import { Modal } from 'ant-design-vue'
import { PictureOutlined, DownOutlined, UpOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { useAuthStore } from '../../store/auth'
import { getMySubmissions, deleteSubmission, getComments, addComment } from '../../api/submission'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const auth = useAuthStore()
const loading = ref(false)
const submissions = ref([])

const stats = [
  { label: '总提交', value: 0, suffix: '条' },
  { label: '本周提交', value: 0, suffix: '条' },
  { label: '优质案例', value: 0, suffix: '个' },
  { label: '平均满意度', value: 0, suffix: '分' },
]

onMounted(() => fetchData())

async function fetchData() {
  loading.value = true
  try {
    const res = await getMySubmissions()
    submissions.value = res.data.list || []
    if (res.data.stats) {
      stats[0].value = res.data.stats.total || 0
      stats[1].value = res.data.stats.weekCount || 0
      stats[2].value = res.data.stats.goodCases || 0
      stats[3].value = res.data.stats.avgSatisfaction || 0
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

async function onDelete(item) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除这条提交吗？"${item.prompt?.slice(0, 40)}..."`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      try {
        await deleteSubmission(item.id)
        fetchData()
      } catch { /* ignore */ }
    },
  })
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

// 图片预览
const previewVisible = ref(false)
const previewSrc = ref('')

function onPreviewImage(images, idx) {
  previewSrc.value = images[idx]
  previewVisible.value = true
}

function categoryColor(c) {
  const m = { campus_info: 'green', news: 'cyan', domain_knowledge: 'geekblue', unreliable_source: 'orange', unverifiable: 'orange', no_source: 'orange', image_understanding: 'purple', database_query: 'purple', login_required: 'purple', interaction_unsatisfied: 'red', workflow: 'red' }
  return m[c] || 'default'
}

function categoryLabel(c) {
  const m = { campus_info: '校园信息缺失', news: '最新新闻/时事', domain_knowledge: '特定领域知识', unreliable_source: '参考来源不可信', unverifiable: '信息来源不可验证', no_source: '无法提供参考来源', image_understanding: '图片理解失败', database_query: '特定数据库查询', login_required: '需要登录网站', interaction_unsatisfied: '对交互不满意', workflow: '工作流不匹配' }
  return m[c] || c
}

function renderMd(text) {
  return DOMPurify.sanitize(marked(text || ''))
}
</script>

<style scoped>
.profile-page {
  display: flex;
  height: 100vh;
  background: #fff;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.profile-header {
  margin-bottom: 0;
}

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 20px;
}

/* 案例卡片 */
.case-card {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
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
  font-size: 16px;
  line-height: 1.7;
  color: #222;
  cursor: pointer;
  margin-bottom: 10px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.case-answer {
  font-size: 14px;
  color: #888;
  line-height: 1.6;
  cursor: pointer;
  margin-bottom: 6px;
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

.case-date { color: #999; }

/* 详情 */
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
