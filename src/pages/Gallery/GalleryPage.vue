<template>
  <AppLayout>
    <div class="gallery-page">
      <a-card :bordered="false" class="gallery-header">
        <a-row justify="space-between" align="middle">
          <a-col>
            <h3>案例展示广场</h3>
            <span class="subtitle">浏览所有同学提交的 AI 未满足信息需求案例</span>
          </a-col>
          <a-col>
            <a-space>
              <a-input-search
                v-model:value="search"
                placeholder="搜索案例..."
                style="width: 240px"
                @search="onSearch"
              />
              <a-select v-model:value="filterCategory" placeholder="按分类筛选" style="width: 160px" allow-clear @change="onFilter">
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
              <a-radio-group v-model:value="sortBy" @change="onSort">
                <a-radio-button value="latest">最新</a-radio-button>
                <a-radio-button value="hot">最热</a-radio-button>
              </a-radio-group>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <div class="gallery-grid">
        <a-card
          v-for="item in cases"
          :key="item.id"
          :bordered="false"
          hoverable
          class="case-card"
        >
          <template #title>
            <a-space>
              <a-tag :color="categoryColor(item.category)">{{ categoryLabel(item.category) }}</a-tag>
              <a-tag>{{ item.platform }}</a-tag>
            </a-space>
          </template>

          <div class="case-prompt">{{ item.prompt }}</div>

          <div class="case-answer" v-if="item.aiAnswer">
            <a-typography-paragraph :ellipsis="{ rows: 3, expandable: true }">
              {{ item.aiAnswer }}
            </a-typography-paragraph>
          </div>

          <div class="case-tags" v-if="item.tags?.length">
            <a-tag v-for="tag in item.tags" :key="tag" color="default">{{ tag }}</a-tag>
          </div>

          <template #actions>
            <a-space>
              <a-button type="text" @click="onLike(item)">
                <like-outlined :style="{ color: item.liked ? '#1677ff' : '' }" />
                {{ item.likeCount || 0 }}
              </a-button>
              <a-button type="text" @click="onComment(item)">
                <comment-outlined />
                {{ item.commentCount || 0 }}
              </a-button>
            </a-space>
          </template>
        </a-card>
      </div>

      <a-empty v-if="!loading && cases.length === 0" description="暂无案例" style="margin-top: 48px" />

      <div class="pagination" v-if="total > pageSize">
        <a-pagination
          v-model:current="page"
          :total="total"
          :page-size="pageSize"
          @change="loadCases"
          show-size-changer
        />
      </div>

      <a-modal v-model:open="commentVisible" title="评论" @ok="onSendComment">
        <a-list :data-source="currentComments" size="small" v-if="currentComments.length">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :title="item.author" :description="item.content" />
            </a-list-item>
          </template>
        </a-list>
        <a-empty v-else description="暂无评论，抢个沙发吧" />
        <a-textarea
          v-model:value="commentText"
          :rows="2"
          placeholder="写下你的评论..."
          style="margin-top: 12px"
        />
      </a-modal>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { LikeOutlined, CommentOutlined } from '@ant-design/icons-vue'
import AppLayout from '../../components/layout/AppLayout.vue'
import { getCases, likeCase, getComments, addComment } from '../../api/submission'

const search = ref('')
const filterCategory = ref(undefined)
const sortBy = ref('latest')
const loading = ref(false)
const cases = ref([])
const page = ref(1)
const pageSize = ref(12)
const total = ref(0)

const commentVisible = ref(false)
const commentText = ref('')
const currentComments = ref([])
const currentCase = ref(null)

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
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  loadCases()
}

function onFilter() {
  page.value = 1
  loadCases()
}

function onSort() {
  page.value = 1
  loadCases()
}

async function onLike(item) {
  try {
    await likeCase(item.id)
    item.liked = !item.liked
    item.likeCount += item.liked ? 1 : -1
    message.success(item.liked ? '已点赞' : '已取消点赞')
  } catch {
    // handled by interceptor
  }
}

function onComment(item) {
  currentCase.value = item
  commentVisible.value = true
  commentText.value = ''
  loadComments(item.id)
}

async function loadComments(caseId) {
  try {
    const res = await getComments(caseId)
    currentComments.value = res.data || []
  } catch {
    currentComments.value = []
  }
}

async function onSendComment() {
  if (!commentText.value.trim()) return
  try {
    await addComment(currentCase.value.id, { content: commentText.value })
    commentText.value = ''
    message.success('评论成功')
    loadComments(currentCase.value.id)
    currentCase.value.commentCount++
  } catch {
    // handled by interceptor
  }
}

function categoryColor(category) {
  const map = {
    campus_info: 'green',
    news: 'cyan',
    domain_knowledge: 'geekblue',
    unreliable_source: 'orange',
    unverifiable: 'orange',
    no_source: 'orange',
    image_understanding: 'purple',
    database_query: 'purple',
    login_required: 'purple',
    interaction_unsatisfied: 'red',
    workflow: 'red',
  }
  return map[category] || 'default'
}

function categoryLabel(category) {
  const map = {
    campus_info: '校园信息缺失',
    news: '最新新闻/时事',
    domain_knowledge: '特定领域知识',
    unreliable_source: '参考来源不可信',
    unverifiable: '信息来源不可验证',
    no_source: '无法提供参考来源',
    image_understanding: '图片理解失败',
    database_query: '特定数据库查询',
    login_required: '需要登录网站',
    interaction_unsatisfied: '对交互不满意',
    workflow: '工作流不匹配',
  }
  return map[category] || category
}
</script>

<style scoped>
.gallery-header {
  margin-bottom: 16px;
}

.subtitle {
  color: #999;
  font-size: 14px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
  gap: 16px;
}

.case-card {
  display: flex;
  flex-direction: column;
}

.case-prompt {
  font-size: 15px;
  line-height: 1.6;
  color: #333;
  margin: 8px 0;
}

.case-answer {
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.case-tags {
  margin-top: 8px;
}

.pagination {
  margin-top: 24px;
  text-align: center;
}
</style>
