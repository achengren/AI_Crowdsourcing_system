<template>
  <div class="diary-page">
    <ConversationSidebar />
    <main class="diary-main">
      <header class="page-header">
        <div>
          <span class="eyebrow">INFORMATION NEED LOG</span>
          <h1>信息需求记录</h1>
          <p>查看每日信息行为、提交进度和历史作业</p>
        </div>
        <a-button type="primary" size="large" @click="router.push('/diaries/new')"><PlusOutlined />新建记录</a-button>
      </header>

      <section class="today-band">
        <div class="today-copy">
          <span>{{ todayLabel }}</span>
          <strong>今日已提交 {{ todaySubmitted }}/3 条</strong>
          <small v-if="todayDrafts">另有 {{ todayDrafts }} 条草稿尚未提交</small>
          <small v-else>{{ todaySubmitted >= 3 ? '今日作业已完成' : `还需提交 ${3 - todaySubmitted} 条` }}</small>
        </div>
        <div class="progress-track" aria-label="今日作业进度">
          <span v-for="index in 3" :key="index" :class="{ complete: index <= todaySubmitted }"></span>
        </div>
        <div class="today-count"><strong>{{ todaySubmitted }}</strong><span>/ 3</span></div>
      </section>

      <section class="summary-strip">
        <div><span>全部记录</span><strong>{{ diaries.length }}</strong></div>
        <div><span>已提交</span><strong>{{ submittedTotal }}</strong></div>
        <div><span>草稿</span><strong>{{ draftTotal }}</strong></div>
        <div><span>与 GenAI 有关</span><strong>{{ genaiTotal }}</strong></div>
      </section>

      <section class="record-section">
        <div class="section-heading">
          <div><h2>全部记录</h2><p>当天记录可继续编辑，历史记录保留为只读档案</p></div>
          <div class="filters">
            <a-input-search v-model:value="keyword" allow-clear placeholder="搜索需求、情境或渠道" style="width: 260px" />
            <a-select v-model:value="statusFilter" style="width: 130px">
              <a-select-option value="all">全部状态</a-select-option>
              <a-select-option value="submitted">已提交</a-select-option>
              <a-select-option value="draft">草稿</a-select-option>
            </a-select>
          </div>
        </div>

        <a-table
          :loading="loading"
          :data-source="filteredDiaries"
          :columns="columns"
          row-key="id"
          size="middle"
          :pagination="{ pageSize: 12, showSizeChanger: false }"
          :scroll="{ x: 980 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'date'">
              <div class="date-cell"><strong>{{ formatDay(record.logDate) }}</strong><span>{{ formatYearMonth(record.logDate) }}</span></div>
            </template>
            <template v-else-if="column.key === 'need'">
              <button class="need-button" type="button" @click="openDetail(record)">
                <strong>{{ record.needDescription || '未填写信息需求' }}</strong>
                <span>{{ record.contextText || '未填写发生情境' }}</span>
              </button>
            </template>
            <template v-else-if="column.key === 'genai'">
              <a-tag :color="record.isGenaiRelated ? 'blue' : 'default'">{{ record.isGenaiRelated ? platformName(record.genaiPlatform) : '非 GenAI' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.status === 'submitted' ? 'green' : 'orange'">{{ record.status === 'submitted' ? '已提交' : '草稿' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space :size="4">
                <a-button type="link" size="small" @click="openDetail(record)">查看</a-button>
                <a-button v-if="record.editable" type="link" size="small" @click="editDiary(record)"><EditOutlined />编辑</a-button>
                <span v-else class="readonly-label"><LockOutlined />历史只读</span>
                <a-button
                  v-if="record.status === 'submitted' && record.isGenaiRelated && !record.hasLinkedSubmission"
                  type="link"
                  size="small"
                  @click="submitAsCase(record)"
                >同时提交为案例</a-button>
                <a-button
                  v-else-if="record.linkedSubmissionId"
                  type="link"
                  size="small"
                  @click="openLinkedCase(record.linkedSubmissionId)"
                >查看关联案例</a-button>
                <span v-else-if="record.hasLinkedSubmission" class="readonly-label"><LinkOutlined />案例已关联</span>
              </a-space>
            </template>
          </template>
          <template #emptyText><a-empty description="暂无信息需求记录" /></template>
        </a-table>
      </section>
    </main>

    <a-modal v-model:open="detailVisible" title="信息需求详情" width="min(820px, 94vw)" :footer="null">
      <div v-if="selectedDiary" class="detail-body">
        <div class="detail-head">
          <div><strong>{{ selectedDiary.logDate }}</strong><span v-if="selectedDiary.occurredAt">{{ selectedDiary.occurredAt }}</span></div>
          <a-space>
            <a-tag :color="selectedDiary.status === 'submitted' ? 'green' : 'orange'">{{ selectedDiary.status === 'submitted' ? '已提交' : '草稿' }}</a-tag>
            <a-tag v-if="selectedDiary.isGenaiRelated" color="blue">{{ platformName(selectedDiary.genaiPlatform) }}</a-tag>
          </a-space>
        </div>
        <section v-for="item in detailFields" :key="item.label" class="detail-row">
          <span>{{ item.label }}</span>
          <p>{{ selectedDiary[item.key] || '未填写' }}</p>
        </section>
        <div class="detail-actions">
          <a-button v-if="selectedDiary.linkedSubmissionId" @click="openLinkedCase(selectedDiary.linkedSubmissionId)">查看关联案例</a-button>
          <span v-else-if="selectedDiary.hasLinkedSubmission" class="readonly-label"><LinkOutlined />案例已关联</span>
          <a-button v-if="selectedDiary.editable" type="primary" @click="editDiary(selectedDiary)"><EditOutlined />编辑当天记录</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onActivated, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { EditOutlined, LinkOutlined, LockOutlined, PlusOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { getDiaries } from '../../api/diary'
import { platformLabel } from '../../constants/options'

const router = useRouter()
const loading = ref(false)
const diaries = ref([])
const keyword = ref('')
const statusFilter = ref('all')
const detailVisible = ref(false)
const selectedDiary = ref(null)
const today = dayjs().format('YYYY-MM-DD')

const columns = [
  { title: '日期', key: 'date', width: 105 },
  { title: '信息需求与情境', key: 'need', minWidth: 340 },
  { title: '渠道与工具', dataIndex: 'channels', width: 180, ellipsis: true },
  { title: '关联类型', key: 'genai', width: 130 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'actions', width: 300, fixed: 'right' },
]
const detailFields = [
  { label: '发生情境', key: 'contextText' },
  { label: '信息需求', key: 'needDescription' },
  { label: '渠道和工具', key: 'channels' },
  { label: '搜寻与获取过程', key: 'searchProcess' },
  { label: '获取结果', key: 'outcome' },
  { label: '反思', key: 'reflection' },
]

const todayRecords = computed(() => diaries.value.filter(item => item.logDate === today))
const todaySubmitted = computed(() => todayRecords.value.filter(item => item.status === 'submitted').length)
const todayDrafts = computed(() => todayRecords.value.filter(item => item.status === 'draft').length)
const submittedTotal = computed(() => diaries.value.filter(item => item.status === 'submitted').length)
const draftTotal = computed(() => diaries.value.filter(item => item.status === 'draft').length)
const genaiTotal = computed(() => diaries.value.filter(item => item.isGenaiRelated).length)
const todayLabel = computed(() => dayjs().format('YYYY 年 M 月 D 日'))
const filteredDiaries = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return diaries.value.filter(item => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
    if (!query) return true
    return [item.needDescription, item.contextText, item.channels, item.outcome]
      .some(value => String(value || '').toLowerCase().includes(query))
  })
})

onActivated(loadDiaries)

async function loadDiaries() {
  loading.value = true
  try {
    const response = await getDiaries()
    diaries.value = response.data.list || []
  } catch (error) {
    message.error(error.response?.data?.message || '信息需求记录加载失败')
  } finally {
    loading.value = false
  }
}

function formatDay(value) { return dayjs(value).format('DD') }
function formatYearMonth(value) { return dayjs(value).format('YYYY.MM') }
function platformName(value) { return platformLabel(value) || value || 'GenAI' }
function openDetail(record) { selectedDiary.value = record; detailVisible.value = true }
function editDiary(record) { router.push(`/diaries/${record.id}/edit`) }
function submitAsCase(record) { router.push({ path: '/cases/new', query: { diaryId: record.id } }) }
function openLinkedCase(caseId) { router.push({ path: '/gallery', query: { caseId } }) }
</script>

<style scoped>
.diary-page { display: flex; height: 100vh; background: var(--hib-paper); color: var(--hib-text); }
.diary-main { flex: 1; min-width: 0; overflow: auto; padding: 28px 36px 56px; }
.page-header { display: flex; align-items: flex-end; justify-content: space-between; max-width: 1380px; margin: 0 auto; padding: 2px 0 22px; border-bottom: 1px solid var(--hib-line); }
.eyebrow { color: var(--hib-red); font: 11px/1.2 Georgia, serif; letter-spacing: 1.4px; }
.page-header h1 { margin: 7px 0 4px; font-size: 26px; }
.page-header p { margin: 0; color: var(--hib-muted); }
.today-band { display: grid; grid-template-columns: minmax(250px, 1fr) minmax(280px, 2fr) 92px; align-items: center; gap: 30px; max-width: 1380px; min-height: 124px; margin: 22px auto 0; padding: 20px 26px; border-left: 4px solid var(--hib-red); background: #fff; box-shadow: 0 8px 24px rgba(62, 34, 36, .06); }
.today-copy span, .today-copy small { display: block; color: var(--hib-muted); font-size: 12px; }
.today-copy strong { display: block; margin: 5px 0 3px; font-size: 18px; }
.progress-track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.progress-track span { height: 10px; background: #eadfdd; }
.progress-track span.complete { background: var(--hib-red); }
.today-count { display: flex; align-items: baseline; justify-content: flex-end; }
.today-count strong { font: 42px/1 Georgia, serif; color: var(--hib-red); }
.today-count span { margin-left: 4px; color: var(--hib-muted); }
.summary-strip { display: grid; grid-template-columns: repeat(4, 1fr); max-width: 1380px; margin: 0 auto; border-bottom: 1px solid var(--hib-line); }
.summary-strip > div { padding: 22px 0; }
.summary-strip span { display: block; color: var(--hib-muted); font-size: 12px; }
.summary-strip strong { font: 27px/1.4 Georgia, serif; }
.record-section { max-width: 1380px; margin: 26px auto 0; }
.section-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.section-heading h2 { margin: 0 0 3px; font-size: 19px; }
.section-heading p { margin: 0; color: var(--hib-muted); font-size: 13px; }
.filters { display: flex; gap: 10px; }
.date-cell { display: flex; align-items: baseline; gap: 5px; }
.date-cell strong { font: 22px/1 Georgia, serif; }
.date-cell span { color: var(--hib-muted); font-size: 11px; }
.need-button { display: block; width: 100%; padding: 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.need-button strong, .need-button span { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.need-button strong { font-weight: 600; }
.need-button span { max-width: 560px; margin-top: 4px; color: var(--hib-muted); font-size: 12px; }
.need-button:hover strong { color: var(--hib-red); }
.readonly-label { display: inline-flex; align-items: center; gap: 4px; padding: 0 7px; color: var(--hib-muted); font-size: 12px; white-space: nowrap; }
.detail-body { padding: 0 4px 6px; }
.detail-head { display: flex; justify-content: space-between; padding: 10px 0 18px; border-bottom: 1px solid var(--hib-line); }
.detail-head > div { display: flex; gap: 10px; }
.detail-head span { color: var(--hib-muted); }
.detail-row { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 20px; padding: 15px 0; border-bottom: 1px solid var(--hib-line); }
.detail-row > span { color: var(--hib-muted); font-size: 12px; }
.detail-row p { margin: 0; line-height: 1.7; white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
@media (max-width: 980px) { .today-band { grid-template-columns: 1fr 1.5fr; } .today-count { display: none; } .summary-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .diary-main { padding: 72px 14px 36px; } .page-header, .section-heading { align-items: stretch; flex-direction: column; } .page-header :deep(.ant-btn) { align-self: flex-end; } .today-band { grid-template-columns: 1fr; gap: 18px; padding: 18px; } .filters { flex-direction: column; } .filters :deep(.ant-input-search), .filters :deep(.ant-select) { width: 100% !important; } .detail-row { grid-template-columns: 1fr; gap: 5px; } }
</style>
