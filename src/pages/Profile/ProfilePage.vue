<template>
  <div class="profile-page">
    <ConversationSidebar />
    <main class="profile-main">
      <header class="profile-header">
        <div class="identity">
          <a-avatar :size="58">{{ auth.user?.name?.[0] || 'U' }}</a-avatar>
          <div>
            <span class="eyebrow">STUDENT OVERVIEW</span>
            <h1>{{ auth.user?.name || '用户' }}</h1>
            <div class="identity-meta">
              <span>{{ auth.user?.studentId }}</span>
              <span v-if="auth.user?.className">{{ auth.user.className }}</span>
              <a-tag v-if="auth.isAdmin" color="green">管理员</a-tag>
            </div>
          </div>
        </div>
        <a-button @click="passwordVisible = true"><LockOutlined />修改密码</a-button>
      </header>

      <section class="stat-strip">
        <div><span>案例总数</span><strong>{{ caseTotal }}</strong><small>条</small></div>
        <div><span>本周案例</span><strong>{{ weekCaseTotal }}</strong><small>条</small></div>
        <div><span>信息需求记录</span><strong>{{ diaries.length }}</strong><small>条</small></div>
        <div><span>今日已提交</span><strong>{{ todaySubmitted }}</strong><small>/3</small></div>
      </section>

      <section class="overview-section diary-overview">
        <div class="section-index">01</div>
        <div class="overview-copy">
          <span class="section-label">每日作业</span>
          <h2>信息需求记录</h2>
          <p>今天已提交 {{ todaySubmitted }} 条<span v-if="todayDrafts">，另有 {{ todayDrafts }} 条草稿</span></p>
        </div>
        <div class="progress-block">
          <div class="progress-label"><span>今日进度</span><strong>{{ todaySubmitted }}/3</strong></div>
          <div class="progress-track"><span v-for="index in 3" :key="index" :class="{ complete: index <= todaySubmitted }"></span></div>
          <small>{{ todaySubmitted >= 3 ? '今日作业已完成' : `还需提交 ${3 - todaySubmitted} 条` }}</small>
        </div>
        <a-button type="primary" @click="router.push('/diaries')">管理信息需求<ArrowRightOutlined /></a-button>
      </section>

      <section class="overview-section case-overview">
        <div class="section-index">02</div>
        <div class="overview-copy">
          <span class="section-label">课程案例</span>
          <h2>我的案例</h2>
          <p>已发布 {{ caseTotal }} 条<span v-if="caseDraftCount">，另有 {{ caseDraftCount }} 份草稿</span></p>
        </div>
        <div class="case-metrics">
          <div><strong>{{ caseTotal }}</strong><span>累计案例</span></div>
          <div><strong>{{ weekCaseTotal }}</strong><span>本周新增</span></div>
          <div><strong>{{ caseDraftCount }}</strong><span>待完成草稿</span></div>
        </div>
        <a-button @click="router.push({ path: '/gallery', query: { mine: '1' } })">查看我的案例<ArrowRightOutlined /></a-button>
      </section>

      <footer class="profile-footnote">
        <span>信息需求明细与案例详情分别在对应功能页面中查看</span>
        <span>数据更新时间：{{ updatedAt }}</span>
      </footer>
    </main>

    <a-modal v-model:open="passwordVisible" title="修改密码" :footer="null" width="420px">
      <a-form layout="vertical" @finish="savePassword">
        <a-form-item label="当前密码" name="currentPassword" :rules="[{ required: true }]">
          <a-input-password v-model:value="passwordForm.currentPassword" />
        </a-form-item>
        <a-form-item label="新密码" name="newPassword" :rules="[{ required: true, min: 8, message: '至少 8 位' }]">
          <a-input-password v-model:value="passwordForm.newPassword" />
        </a-form-item>
        <a-button type="primary" html-type="submit" block>更新密码</a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onActivated, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { ArrowRightOutlined, LockOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { useAuthStore } from '../../store/auth'
import { getMySubmissions, getSavedCaseDrafts } from '../../api/submission'
import { getDiaries } from '../../api/diary'
import { changePassword } from '../../api/auth'

const auth = useAuthStore()
const router = useRouter()
const diaries = ref([])
const caseTotal = ref(0)
const weekCaseTotal = ref(0)
const caseDraftCount = ref(0)
const updatedAt = ref('尚未更新')
const today = dayjs().format('YYYY-MM-DD')

const todayRecords = computed(() => diaries.value.filter(item => item.logDate === today))
const todaySubmitted = computed(() => todayRecords.value.filter(item => item.status === 'submitted').length)
const todayDrafts = computed(() => todayRecords.value.filter(item => item.status === 'draft').length)

onActivated(loadOverview)

async function loadOverview() {
  const [caseResult, draftResult, diaryResult] = await Promise.allSettled([
    getMySubmissions(),
    getSavedCaseDrafts(),
    getDiaries(),
  ])
  if (caseResult.status === 'fulfilled') {
    caseTotal.value = Number(caseResult.value.data.stats?.publishedCount || 0)
    weekCaseTotal.value = Number(caseResult.value.data.stats?.publishedWeekCount || 0)
  }
  if (draftResult.status === 'fulfilled') caseDraftCount.value = (draftResult.value.data || []).length
  if (diaryResult.status === 'fulfilled') diaries.value = diaryResult.value.data.list || []
  updatedAt.value = dayjs().format('HH:mm')
  if ([caseResult, draftResult, diaryResult].some(item => item.status === 'rejected')) {
    message.warning('部分概览数据加载失败，请稍后刷新')
  }
}

const passwordVisible = ref(false)
const passwordForm = reactive({ currentPassword: '', newPassword: '' })
async function savePassword() {
  try {
    await changePassword(passwordForm)
    passwordVisible.value = false
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    message.success('密码已更新')
  } catch (error) {
    message.error(error.response?.data?.message || '密码修改失败，请重试')
  }
}
</script>

<style scoped>
.profile-page { display: flex; height: 100vh; background: var(--hib-paper); color: var(--hib-text); }
.profile-main { flex: 1; min-width: 0; overflow: auto; padding: 30px 40px 50px; }
.profile-header { display: flex; align-items: center; justify-content: space-between; max-width: 1280px; margin: 0 auto; padding: 0 0 26px; border-bottom: 1px solid var(--hib-line); }
.identity { display: flex; align-items: center; gap: 18px; }
.identity :deep(.ant-avatar) { flex: 0 0 auto; color: #fff; background: var(--hib-red); box-shadow: 0 0 0 4px var(--hib-red-soft); }
.eyebrow { color: var(--hib-red); font: 10px/1.2 Georgia, serif; letter-spacing: 1.3px; }
.identity h1 { margin: 3px 0 4px; font-size: 25px; }
.identity-meta { display: flex; align-items: center; gap: 10px; color: var(--hib-muted); }
.stat-strip { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); max-width: 1280px; margin: 0 auto 10px; border-bottom: 1px solid var(--hib-line); }
.stat-strip > div { padding: 24px 18px 22px 0; }
.stat-strip span { display: block; color: var(--hib-muted); font-size: 12px; }
.stat-strip strong { margin-right: 4px; font: 30px/1.5 Georgia, serif; }
.stat-strip small { color: var(--hib-muted); }
.overview-section { display: grid; grid-template-columns: 54px minmax(220px, 1fr) minmax(300px, 1.2fr) auto; align-items: center; gap: 28px; max-width: 1280px; min-height: 176px; margin: 0 auto; padding: 26px 0; border-bottom: 1px solid var(--hib-line); }
.section-index { align-self: start; padding-top: 4px; color: var(--hib-red); font: 14px Georgia, serif; }
.section-label { color: var(--hib-muted); font-size: 11px; }
.overview-copy h2 { margin: 5px 0 8px; font-size: 21px; }
.overview-copy p { margin: 0; color: var(--hib-muted); }
.progress-label { display: flex; justify-content: space-between; margin-bottom: 9px; font-size: 12px; }
.progress-label span, .progress-block small { color: var(--hib-muted); }
.progress-track { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-bottom: 8px; }
.progress-track span { height: 9px; background: #eadfdd; }
.progress-track span.complete { background: var(--hib-red); }
.case-metrics { display: grid; grid-template-columns: repeat(3, 1fr); }
.case-metrics > div { border-left: 1px solid var(--hib-line); padding-left: 18px; }
.case-metrics strong, .case-metrics span { display: block; }
.case-metrics strong { font: 26px/1.2 Georgia, serif; }
.case-metrics span { margin-top: 4px; color: var(--hib-muted); font-size: 11px; }
.profile-footnote { display: flex; justify-content: space-between; max-width: 1280px; margin: 22px auto 0; color: var(--hib-muted); font-size: 11px; }
@media (max-width: 980px) { .overview-section { grid-template-columns: 44px 1fr auto; } .overview-section > :nth-child(3) { grid-column: 2 / 4; grid-row: 2; } .stat-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .profile-main { padding: 72px 14px 34px; } .profile-header { align-items: stretch; flex-direction: column; gap: 14px; } .profile-header > :deep(.ant-btn) { align-self: flex-end; } .identity { min-width: 0; } .identity h1 { font-size: 21px; } .identity-meta { align-items: flex-start; flex-direction: column; gap: 3px; } .overview-section { grid-template-columns: 32px 1fr; gap: 14px; } .overview-section > :nth-child(3), .overview-section > :nth-child(4) { grid-column: 2; } .case-metrics { grid-template-columns: 1fr; gap: 12px; } .profile-footnote { flex-direction: column; gap: 6px; } }
</style>
