<template>
  <div class="profile-page">
    <ConversationSidebar />
    <main class="main">
      <header class="profile-header">
        <div class="identity">
          <a-avatar :size="56">{{ auth.user?.name?.[0] || 'U' }}</a-avatar>
          <div>
            <h1>{{ auth.user?.name || '用户' }}</h1>
            <div class="identity-meta">
              <span>{{ auth.user?.studentId }}</span>
              <span v-if="auth.user?.className">{{ auth.user.className }}</span>
              <a-tag v-if="auth.isAdmin" color="green">管理员</a-tag>
            </div>
          </div>
        </div>
        <a-button @click="passwordVisible = true"><LockOutlined /> 修改密码</a-button>
      </header>

      <section class="stat-strip">
        <div v-for="stat in stats" :key="stat.label" class="stat-item">
          <span>{{ stat.label }}</span>
          <strong>{{ stat.value }}</strong>
          <small>{{ stat.suffix }}</small>
        </div>
      </section>

      <a-tabs v-model:activeKey="activeTab" class="workspace-tabs">
        <a-tab-pane key="diaries" tab="信息需求日记">
          <section class="section-toolbar">
            <div>
              <h2>每日信息行为记录</h2>
              <p>今日已提交 {{ todaySubmitted }}/3 条</p>
            </div>
            <div class="toolbar-actions">
              <a-progress type="circle" :percent="todayPercent" :size="46" :show-info="false" />
              <a-button type="primary" @click="openDiary()"><PlusOutlined /> 新建记录</a-button>
            </div>
          </section>

          <a-table :data-source="diaries" :columns="diaryColumns" row-key="id" :pagination="{ pageSize: 10 }" :scroll="{ x: 950 }" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'need'">
                <div class="primary-cell">{{ record.needDescription }}</div>
                <div class="secondary-cell">{{ record.contextText }}</div>
              </template>
              <template v-else-if="column.key === 'genai'">
                <a-tag :color="record.isGenaiRelated ? 'blue' : 'default'">{{ record.isGenaiRelated ? record.genaiPlatform || 'GenAI' : '非 GenAI' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="record.status === 'submitted' ? 'green' : 'orange'">{{ record.status === 'submitted' ? '已提交' : '草稿' }}</a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openDiary(record)">编辑</a-button>
                  <a-button v-if="record.isGenaiRelated" type="link" size="small" @click="convertDiary(record)">转为案例</a-button>
                  <a-popconfirm title="确定删除这条记录？" @confirm="removeDiary(record.id)">
                    <a-button type="link" danger size="small">删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane key="cases" tab="我的案例">
          <section class="section-toolbar">
            <div><h2>案例记录</h2><p>提交后的案例由管理员审核发布</p></div>
          </section>
          <a-table :data-source="submissions" :columns="caseColumns" row-key="id" :pagination="{ pageSize: 10 }" :scroll="{ x: 900 }" size="middle">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'prompt'">
                <div class="primary-cell">{{ record.prompt }}</div>
                <div class="secondary-cell">{{ record.platform }}<span v-if="record.model"> · {{ record.model }}</span> · 第 {{ record.revisionNumber || 1 }} 版</div>
              </template>
              <template v-else-if="column.key === 'category'">{{ categoryLabel(record.category) }}</template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
                <div v-if="record.status === 'rejected' && record.rejectionReason" class="rejection-text">{{ record.rejectionReason }}</div>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button type="link" size="small" @click="openCase(record)">查看</a-button>
                  <a-button v-if="record.status === 'rejected'" type="link" size="small" @click="reviseCase(record)">修改后重提</a-button>
                  <a-popconfirm v-if="!record.revisionOfId && !record.hasNewerRevision" title="确定删除该案例？" @confirm="removeCase(record.id)">
                    <a-button type="link" danger size="small">删除</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </main>

    <a-modal v-model:open="diaryVisible" :title="editingDiaryId ? '编辑信息需求记录' : '新建信息需求记录'" width="760px" :footer="null">
      <a-form ref="diaryFormRef" :model="diaryForm" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="日期" name="logDate" :rules="[{ required: true }]"><a-date-picker v-model:value="diaryDate" style="width:100%" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="发生时间"><a-time-picker v-model:value="diaryTime" format="HH:mm" style="width:100%" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="发生情境" name="contextText" :rules="[{ required: true, message: '请描述发生情境' }]">
          <a-textarea v-model:value="diaryForm.contextText" :rows="2" placeholder="什么情境触发了这次信息需求？" />
        </a-form-item>
        <a-form-item label="信息需求" name="needDescription" :rules="[{ required: true, message: '请描述信息需求' }]">
          <a-textarea v-model:value="diaryForm.needDescription" :rows="2" />
        </a-form-item>
        <a-form-item label="使用的渠道和工具" name="channels" :rules="[{ required: true, message: '请填写渠道' }]">
          <a-input v-model:value="diaryForm.channels" placeholder="搜索引擎、同学、图书馆、AI 等" />
        </a-form-item>
        <a-form-item label="搜寻与获取过程" name="searchProcess" :rules="[{ required: true, message: '请完整记录过程' }]">
          <a-textarea v-model:value="diaryForm.searchProcess" :rows="3" />
        </a-form-item>
        <a-form-item label="获取结果" name="outcome" :rules="[{ required: true, message: '请记录结果' }]">
          <a-textarea v-model:value="diaryForm.outcome" :rows="3" />
        </a-form-item>
        <a-form-item label="反思" name="reflection" :rules="[{ required: true, message: '请填写反思' }]">
          <a-textarea v-model:value="diaryForm.reflection" :rows="2" placeholder="结果是否满足需求？下次会如何改进？" />
        </a-form-item>
        <a-row :gutter="16" align="middle">
          <a-col :span="8"><a-checkbox v-model:checked="diaryForm.isGenaiRelated">与 GenAI 有关</a-checkbox></a-col>
          <a-col :span="8"><a-select v-if="diaryForm.isGenaiRelated" v-model:value="diaryForm.genaiPlatform" placeholder="选择平台" style="width:100%"><a-select-option v-for="item in PLATFORM_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option></a-select></a-col>
          <a-col :span="8"><a-segmented v-model:value="diaryForm.status" :options="[{ label: '草稿', value: 'draft' }, { label: '提交', value: 'submitted' }]" /></a-col>
        </a-row>
        <div class="modal-actions"><a-button @click="diaryVisible = false">取消</a-button><a-button type="primary" :loading="savingDiary" @click="saveDiary">保存记录</a-button></div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="caseVisible" title="案例详情" width="min(960px, 94vw)" :footer="null">
      <div v-if="selectedCase" class="case-detail">
        <div class="detail-label">Prompt</div><p>{{ selectedCase.prompt }}</p>
        <a-alert v-if="selectedCase.status === 'rejected'" type="error" show-icon message="审核退回原因" :description="selectedCase.rejectionReason" />
        <div class="detail-label">版本</div><p>第 {{ selectedCase.revisionNumber || 1 }} 版</p>
        <div class="detail-label">AI 回复与批注</div>
        <AnnotationEditor :text="selectedCase.aiAnswer" :model-value="selectedCase.annotations || []" readonly />
        <div v-if="selectedCase.note" class="overall-note"><strong>整体说明</strong><p>{{ selectedCase.note }}</p></div>
      </div>
    </a-modal>

    <a-modal v-model:open="passwordVisible" title="修改密码" :footer="null" width="420px">
      <a-form layout="vertical" @finish="savePassword">
        <a-form-item label="当前密码" name="currentPassword" :rules="[{ required: true }]"><a-input-password v-model:value="passwordForm.currentPassword" /></a-form-item>
        <a-form-item label="新密码" name="newPassword" :rules="[{ required: true, min: 8, message: '至少 8 位' }]"><a-input-password v-model:value="passwordForm.newPassword" /></a-form-item>
        <a-button type="primary" html-type="submit" block>更新密码</a-button>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { LockOutlined, PlusOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import AnnotationEditor from '../../components/cases/AnnotationEditor.vue'
import { useAuthStore } from '../../store/auth'
import { getMySubmissions, deleteSubmission } from '../../api/submission'
import { getDiaries, createDiary, updateDiary, deleteDiary } from '../../api/diary'
import { changePassword } from '../../api/auth'
import { CASE_CATEGORIES, PLATFORM_OPTIONS, optionLabel } from '../../constants/options'

const auth = useAuthStore()
const router = useRouter()
const activeTab = ref('diaries')
const submissions = ref([])
const diaries = ref([])
const diaryProgress = ref([])
const stats = reactive([
  { label: '案例总数', value: 0, suffix: '条' },
  { label: '本周案例', value: 0, suffix: '条' },
  { label: '日记总数', value: 0, suffix: '条' },
  { label: '今日完成', value: 0, suffix: '/3' },
])

const today = dayjs().format('YYYY-MM-DD')
const todaySubmitted = computed(() => Number(diaryProgress.value.find(item => item.logDate === today)?.submitted || 0))
const todayPercent = computed(() => Math.min(100, Math.round(todaySubmitted.value / 3 * 100)))
const diaryColumns = [
  { title: '日期', dataIndex: 'logDate', width: 110 },
  { title: '信息需求与情境', key: 'need' },
  { title: '渠道', dataIndex: 'channels', width: 160 },
  { title: 'GenAI', key: 'genai', width: 120 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'actions', width: 200 },
]
const caseColumns = [
  { title: '信息需求', key: 'prompt' },
  { title: '分类', key: 'category', width: 170 },
  { title: '批注', dataIndex: 'annotationCount', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '提交时间', dataIndex: 'createdAt', width: 180 },
  { title: '操作', key: 'actions', width: 120 },
]

async function loadData() {
  const [caseRes, diaryRes] = await Promise.all([getMySubmissions(), getDiaries()])
  submissions.value = caseRes.data.list || []
  diaries.value = diaryRes.data.list || []
  diaryProgress.value = diaryRes.data.progress || []
  stats[0].value = caseRes.data.stats?.total || 0
  stats[1].value = caseRes.data.stats?.weekCount || 0
  stats[2].value = diaries.value.length
  stats[3].value = todaySubmitted.value
}
onMounted(loadData)

const diaryVisible = ref(false)
const savingDiary = ref(false)
const editingDiaryId = ref(null)
const diaryFormRef = ref()
const diaryDate = ref(dayjs())
const diaryTime = ref(null)
const emptyDiary = () => ({ contextText: '', needDescription: '', channels: '', searchProcess: '', outcome: '', reflection: '', isGenaiRelated: false, genaiPlatform: undefined, status: 'draft' })
const diaryForm = reactive(emptyDiary())

function openDiary(record = null) {
  editingDiaryId.value = record?.id || null
  Object.assign(diaryForm, record || emptyDiary())
  diaryDate.value = dayjs(record?.logDate || today)
  diaryTime.value = record?.occurredAt ? dayjs(`${record.logDate || today}T${record.occurredAt}`) : null
  diaryVisible.value = true
}

async function saveDiary() {
  await diaryFormRef.value.validate()
  if (diaryForm.isGenaiRelated && !diaryForm.genaiPlatform) return message.warning('请选择 GenAI 平台')
  savingDiary.value = true
  try {
    const payload = { ...diaryForm, logDate: diaryDate.value.format('YYYY-MM-DD'), occurredAt: diaryTime.value?.format('HH:mm') || null }
    if (editingDiaryId.value) await updateDiary(editingDiaryId.value, payload)
    else await createDiary(payload)
    message.success('信息需求记录已保存')
    diaryVisible.value = false
    await loadData()
  } finally { savingDiary.value = false }
}

async function removeDiary(id) { await deleteDiary(id); await loadData() }
function convertDiary(record) { router.push({ path: '/gallery', query: { submit: '1', diaryId: record.id } }) }
async function removeCase(id) { await deleteSubmission(id); await loadData() }

const caseVisible = ref(false)
const selectedCase = ref(null)
function openCase(record) { selectedCase.value = record; caseVisible.value = true }
function reviseCase(record) { router.push({ path: '/gallery', query: { submit: '1', revisionId: record.id } }) }
function categoryLabel(value) { return optionLabel(CASE_CATEGORIES, value) }
function statusLabel(value) { return ({ submitted: '待审核', published: '已发布', rejected: '未通过', draft: '草稿' })[value] || value }
function statusColor(value) { return ({ submitted: 'orange', published: 'green', rejected: 'red', draft: 'default' })[value] }

const passwordVisible = ref(false)
const passwordForm = reactive({ currentPassword: '', newPassword: '' })
async function savePassword() {
  await changePassword(passwordForm)
  passwordVisible.value = false
  passwordForm.currentPassword = ''
  passwordForm.newPassword = ''
  message.success('密码已更新')
}
</script>

<style scoped>
.profile-page { display: flex; height: 100vh; background: var(--hib-paper); color: var(--hib-text); }
.main { flex: 1; min-width: 0; overflow: auto; padding: 28px 36px 48px; }
.profile-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 0 24px; border-bottom: 1px solid var(--hib-line); }
.identity { display: flex; align-items: center; gap: 16px; }
.identity :deep(.ant-avatar) { flex: 0 0 auto; }
.identity :deep(.ant-avatar) { color: #fff; background: var(--hib-red); box-shadow: 0 0 0 4px var(--hib-red-soft); }
.identity h1 { margin: 0 0 4px; font-size: 24px; }
.identity-meta { display: flex; align-items: center; gap: 10px; color: var(--hib-muted); }
.stat-strip { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); border-bottom: 1px solid var(--hib-line); }
.stat-item { padding: 22px 20px 20px 0; }
.stat-item span { display: block; color: var(--hib-muted); font-size: 13px; }
.stat-item strong { font-size: 28px; margin-right: 4px; font-family: Georgia, serif; }
.stat-item small { color: var(--hib-muted); }
.workspace-tabs { margin-top: 16px; }
.section-toolbar { min-height: 72px; display: flex; justify-content: space-between; align-items: center; }
.section-toolbar h2 { margin: 0 0 4px; font-size: 18px; }
.section-toolbar p { margin: 0; color: var(--hib-muted); }
.toolbar-actions { display: flex; align-items: center; gap: 14px; }
.primary-cell { color: var(--hib-text); line-height: 1.5; }
.secondary-cell { color: var(--hib-muted); font-size: 12px; margin-top: 3px; max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 24px; }
.detail-label { color: #6e7872; font-size: 12px; margin: 18px 0 6px; text-transform: uppercase; }
.case-detail > p { white-space: pre-wrap; }
.rejection-text { max-width: 180px; margin-top: 4px; color: #a6404c; font-size: 12px; line-height: 1.4; }
.overall-note { margin-top: 18px; padding: 14px; border-left: 3px solid var(--hib-red); background: var(--hib-red-soft); }
@media (max-width: 900px) { .main { padding: 20px; } .stat-strip { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 760px) { .main { padding: 72px 14px 32px; } .profile-header { align-items: stretch; flex-direction: column; gap: 14px; } .profile-header > :deep(.ant-btn) { align-self: flex-end; } .identity { min-width: 0; } .identity h1 { font-size: 20px; overflow-wrap: anywhere; } .identity-meta { align-items: flex-start; flex-direction: column; gap: 3px; } .stat-item { padding: 16px 8px 14px 0; } .section-toolbar { align-items: flex-start; gap: 12px; } }
</style>
