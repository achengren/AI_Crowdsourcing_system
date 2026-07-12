<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="profile-overlay" @click.self="$emit('close')">
        <div class="profile-panel">
          <div class="profile-panel-header">
            <h3>个人主页</h3>
            <a-button type="text" @click="$emit('close')" class="close-btn">✕</a-button>
          </div>

          <div class="profile-panel-body">
            <!-- 用户信息 -->
            <div class="user-info">
              <a-avatar :size="64">{{ auth.user?.name?.[0] || 'U' }}</a-avatar>
              <div class="user-detail">
                <h2>{{ auth.user?.name || '用户' }}</h2>
                <a-space>
                  <a-tag v-if="auth.isGuest" color="orange">游客模式</a-tag>
                  <a-tag v-else color="blue">{{ auth.user?.studentId }}</a-tag>
                </a-space>
              </div>
            </div>

            <!-- 数据统计 -->
            <a-row :gutter="12" style="margin-top: 24px">
              <a-col :span="6" v-for="stat in stats" :key="stat.label">
                <div class="stat-card">
                  <div class="stat-value">{{ stat.value }}<span class="stat-unit">{{ stat.suffix }}</span></div>
                  <div class="stat-label">{{ stat.label }}</div>
                </div>
              </a-col>
            </a-row>

            <!-- 提交记录 -->
            <div class="submission-section">
              <h4>我的提交记录</h4>
              <a-list :loading="loading" :data-source="submissions" size="small" v-if="submissions.length">
                <template #renderItem="{ item }">
                  <a-list-item>
                    <a-list-item-meta>
                      <template #title>
                        <a-space>
                          <a-tag :color="categoryColor(item.category)" size="small">{{ categoryLabel(item.category) }}</a-tag>
                          <a-tag size="small">{{ item.platform }}</a-tag>
                          <span>{{ item.prompt?.slice(0, 40) }}{{ item.prompt?.length > 40 ? '...' : '' }}</span>
                        </a-space>
                      </template>
                      <template #description>
                        <span>{{ item.createdAt }}</span>
                        <a-rate :value="item.satisfaction" :count="5" disabled style="font-size: 12px; margin-left: 8px" />
                      </template>
                    </a-list-item-meta>
                  </a-list-item>
                </template>
              </a-list>
              <a-empty v-if="!loading && submissions.length === 0" description="暂无提交记录" :image-style="{ height: '40px' }" />

              <div style="margin-top: 16px; text-align: right">
                <a-button type="link" danger @click="onLogout">退出登录</a-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../store/auth'
import { getMySubmissions } from '../../api/submission'

defineProps({ visible: Boolean })
defineEmits(['close'])

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const submissions = ref([])

const stats = [
  { label: '总提交', value: 0, suffix: '条' },
  { label: '本周', value: 0, suffix: '条' },
  { label: '优质案例', value: 0, suffix: '个' },
  { label: '均满意度', value: 0, suffix: '分' },
]

watch(() => auth.user, (user) => {
  if (user) fetchData()
}, { immediate: true })

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
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

function onLogout() {
  auth.logout()
  router.push('/login')
}

function categoryColor(c) {
  const m = { campus_info: 'green', news: 'cyan', domain_knowledge: 'geekblue', unreliable_source: 'orange', unverifiable: 'orange', no_source: 'orange', image_understanding: 'purple', database_query: 'purple', login_required: 'purple', interaction_unsatisfied: 'red', workflow: 'red' }
  return m[c] || 'default'
}
function categoryLabel(c) {
  const m = { campus_info: '校园信息缺失', news: '最新新闻/时事', domain_knowledge: '特定领域知识', unreliable_source: '参考来源不可信', unverifiable: '信息来源不可验证', no_source: '无法提供参考来源', image_understanding: '图片理解失败', database_query: '特定数据库查询', login_required: '需要登录网站', interaction_unsatisfied: '对交互不满意', workflow: '工作流不匹配' }
  return m[c] || c
}
</script>

<style scoped>
.profile-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.profile-panel {
  width: 600px;
  max-height: 80vh;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.profile-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}

.profile-panel-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  font-size: 18px;
  color: #999;
}

.profile-panel-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 20px;
}

.user-detail h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.stat-card {
  text-align: center;
  padding: 12px 8px;
  background: #f9fafb;
  border-radius: 10px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #1677ff;
}

.stat-unit {
  font-size: 12px;
  font-weight: 400;
  color: #999;
  margin-left: 2px;
}

.stat-label {
  font-size: 12px;
  color: #888;
  margin-top: 4px;
}

.submission-section {
  margin-top: 24px;
}

.submission-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

/* 过渡动画 */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
