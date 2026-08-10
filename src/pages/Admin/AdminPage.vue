<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <div class="admin-brand"><span>HIB</span><strong>课程管理</strong></div>
      <nav>
        <button v-for="item in navItems" :key="item.key" :title="item.label" :aria-label="item.label" :class="{ active: activeView === item.key }" @click="switchView(item.key)">
          <component :is="item.icon" /> <span class="nav-label">{{ item.label }}</span>
        </button>
      </nav>
      <div class="admin-user">
        <span>{{ auth.user?.name }}</span>
        <a-button type="text" title="学生端" aria-label="学生端" @click="backToStudent"><SwapOutlined /><span class="admin-action-label">学生端</span></a-button>
        <a-button type="text" title="退出" aria-label="退出" @click="logout"><LogoutOutlined /><span class="admin-action-label">退出</span></a-button>
      </div>
    </aside>

    <main class="admin-main">
      <header class="admin-header">
        <div><span class="eyebrow">COURSE OPERATIONS</span><h1>{{ currentTitle }}</h1></div>
        <span class="date-label">{{ currentDate }}</span>
      </header>

      <section v-if="activeView === 'overview'">
        <div class="metrics">
          <div v-for="metric in metrics" :key="metric.label" class="metric">
            <span>{{ metric.label }}</span><strong>{{ metric.value }}</strong><small>{{ metric.note }}</small>
          </div>
        </div>
        <div class="overview-note">
          <h2>待处理事项</h2>
          <div class="task-line"><span>已发布案例</span><strong>{{ overview.cases?.published || 0 }}</strong></div>
          <div class="task-line"><span>已撤回案例</span><strong>{{ overview.cases?.withdrawn || 0 }}</strong></div>
          <div class="task-line"><span>今日已提交日记</span><strong>{{ overview.diaries?.today || 0 }}</strong></div>
          <div class="task-line"><span>已记录消息</span><strong>{{ overview.messages?.total || 0 }}</strong></div>
        </div>
      </section>

      <section v-else-if="activeView === 'users'">
        <div class="table-toolbar">
          <a-input-search v-model:value="filters.users" placeholder="搜索账号或姓名" style="width:300px" @search="loadUsers" />
          <a-space>
            <a-upload :show-upload-list="false" accept=".csv,.xlsx" :before-upload="importUsers"><a-button><UploadOutlined /> 批量导入</a-button></a-upload>
            <a-button type="primary" @click="openUser()"><UserAddOutlined /> 新增账号</a-button>
          </a-space>
        </div>
        <a-table :columns="userColumns" :data-source="users" row-key="id" :pagination="false" :scroll="{ x: 1050 }" size="middle">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'identity'"><strong>{{ record.name }}</strong><div class="subtext">{{ record.studentId }}</div></template>
            <template v-else-if="column.key === 'role'"><a-tag :color="record.role === 'admin' ? 'green' : 'blue'">{{ record.role === 'admin' ? '管理员' : '学生' }}</a-tag></template>
            <template v-else-if="column.key === 'status'"><a-badge :status="record.status === 'active' ? 'success' : 'default'" :text="record.status === 'active' ? '启用' : '停用'" /></template>
            <template v-else-if="column.key === 'actions'"><a-space><a-button type="link" size="small" @click="openUser(record)">编辑</a-button><a-button type="link" size="small" @click="openReset(record)">重置密码</a-button><a-popconfirm title="停用该账号？" @confirm="disableUser(record)"><a-button type="link" danger size="small">停用</a-button></a-popconfirm></a-space></template>
          </template>
        </a-table>
        <a-pagination class="pager" v-model:current="pages.users" :total="totals.users" :page-size="20" @change="loadUsers" />
      </section>

      <section v-else-if="activeView === 'conversations'">
        <div class="table-toolbar"><a-input-search v-model:value="filters.conversations" placeholder="搜索学生或会话" style="width:320px" @search="loadConversations" /></div>
        <a-table :columns="conversationColumns" :data-source="conversations" row-key="id" :pagination="false" :scroll="{ x: 900 }" size="middle">
          <template #bodyCell="{ column, record }"><template v-if="column.key === 'user'"><strong>{{ record.name }}</strong><div class="subtext">{{ record.studentId }}</div></template><template v-else-if="column.key === 'actions'"><a-button type="link" @click="viewConversation(record)">查看对话</a-button></template></template>
        </a-table>
        <a-pagination class="pager" v-model:current="pages.conversations" :total="totals.conversations" :page-size="20" @change="loadConversations" />
      </section>

      <section v-else-if="activeView === 'cases'">
        <div class="table-toolbar">
          <a-input-search v-model:value="filters.cases" placeholder="搜索学生或案例" style="width:300px" @search="onCaseSearch" />
          <a-space wrap>
            <a-select v-model:value="caseErrorType" allow-clear placeholder="错误类型" style="width:170px" @change="onCaseStatusChange"><a-select-option v-for="item in ERROR_TYPE_OPTIONS" :key="item.value" :value="item.value">{{ item.label }}</a-select-option></a-select>
            <a-select v-model:value="caseStatus" style="width:150px" @change="onCaseStatusChange"><a-select-option value="">全部状态</a-select-option><a-select-option value="published">已发布</a-select-option><a-select-option value="withdrawn">已撤回</a-select-option><a-select-option value="submitted">旧待审核记录</a-select-option><a-select-option value="rejected">旧退回记录</a-select-option></a-select>
          </a-space>
        </div>
        <a-table :columns="caseColumns" :data-source="cases" row-key="id" :pagination="false" :scroll="{ x: 1150 }" size="middle">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'prompt'"><div class="truncate">{{ record.prompt }}</div><div class="subtext">{{ displayPlatform(record) }} · {{ record.model || '未知模型' }}</div></template>
            <template v-else-if="column.key === 'user'"><strong>{{ record.name }}</strong><div class="subtext">{{ record.studentId }}</div></template>
            <template v-else-if="column.dataIndex === 'errorType'">{{ taxonomyText(record.errorTypes, record.errorType || record.category, ERROR_TYPE_OPTIONS, record.errorTypeOther) }}</template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'actions'"><a-space><a-button size="small" @click="viewCase(record)">查看</a-button><a-button v-if="record.status === 'withdrawn' || record.status === 'submitted' || record.status === 'rejected'" size="small" type="primary" ghost @click="setCaseStatus(record, 'published')">{{ record.status === 'withdrawn' ? '恢复' : '发布旧记录' }}</a-button><a-button v-if="record.status === 'published'" size="small" danger @click="openWithdraw(record)">撤回</a-button></a-space></template>
          </template>
        </a-table>
        <a-pagination class="pager" v-model:current="pages.cases" :total="totals.cases" :page-size="20" @change="loadCases" />
      </section>

      <section v-else-if="activeView === 'diaries'">
        <div class="completion-panel">
          <div><span class="eyebrow">DAILY COMPLETION</span><h2>每日作业完成度</h2><p>{{ completionIncomplete }} 人未达到每日 {{ completionRequired }} 条要求</p></div>
          <a-date-picker v-model:value="completionDate" :allow-clear="false" @change="loadDiaryCompletion" />
        </div>
        <a-table :columns="completionColumns" :data-source="diaryCompletion" row-key="id" :pagination="{ pageSize: 10 }" size="small" class="completion-table" :row-class-name="record => record.complete ? '' : 'incomplete-row'">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'student'"><strong>{{ record.name }}</strong><div class="subtext">{{ record.studentId }}<span v-if="record.className"> · {{ record.className }}</span></div></template>
            <template v-else-if="column.key === 'progress'"><a-tag :color="record.complete ? 'green' : 'red'">{{ record.submittedCount }}/{{ completionRequired }}</a-tag></template>
          </template>
        </a-table>
        <div class="table-toolbar"><a-input-search v-model:value="filters.diaries" placeholder="搜索学生或信息需求" style="width:340px" @search="loadDiaries" /></div>
        <a-table :columns="diaryColumns" :data-source="adminDiaries" row-key="id" :pagination="false" :scroll="{ x: 900 }" size="middle">
          <template #bodyCell="{ column, record }"><template v-if="column.key === 'user'"><strong>{{ record.name }}</strong><div class="subtext">{{ record.studentId }}</div></template><template v-else-if="column.key === 'need'"><div class="truncate">{{ record.needDescription }}</div><div class="subtext">{{ record.channels }}</div></template><template v-else-if="column.key === 'genai'"><a-tag :color="record.isGenaiRelated ? 'blue' : 'default'">{{ record.isGenaiRelated ? record.genaiPlatform : '否' }}</a-tag></template><template v-else-if="column.key === 'actions'"><a-button type="link" size="small" @click="viewDiary(record)">查看详情</a-button></template></template>
        </a-table>
        <a-pagination class="pager" v-model:current="pages.diaries" :total="totals.diaries" :page-size="20" @change="loadDiaries" />
      </section>

      <section v-else-if="activeView === 'exports'" class="export-section">
        <p>按业务主题导出 XLSX，首行已冻结并启用筛选。</p>
        <div class="export-list"><button v-for="item in exportItems" :key="item.type" @click="runExport(item.type)"><FileExcelOutlined /><span><strong>{{ item.label }}</strong><small>{{ item.note }}</small></span><DownloadOutlined /></button></div>
      </section>
    </main>

    <a-modal v-model:open="userVisible" :title="editingUserId ? '编辑账号' : '新增账号'" :footer="null" width="520px">
      <a-form ref="userFormRef" :model="userForm" layout="vertical">
        <a-form-item label="账号/学号" name="studentId" :rules="[{ required: true }]" v-if="!editingUserId"><a-input v-model:value="userForm.studentId" /></a-form-item>
        <a-form-item label="姓名" name="name" :rules="[{ required: true }]"><a-input v-model:value="userForm.name" /></a-form-item>
        <a-form-item v-if="!editingUserId" label="初始密码" name="password" :rules="[{ required: true, min: 8, message: '至少 8 位' }]"><a-input-password v-model:value="userForm.password" /></a-form-item>
        <a-row :gutter="16"><a-col :span="12"><a-form-item label="角色"><a-select v-model:value="userForm.role"><a-select-option value="student">学生</a-select-option><a-select-option value="admin">管理员</a-select-option></a-select></a-form-item></a-col><a-col :span="12"><a-form-item label="班级"><a-input v-model:value="userForm.className" /></a-form-item></a-col></a-row>
        <a-form-item v-if="editingUserId" label="状态"><a-radio-group v-model:value="userForm.status"><a-radio value="active">启用</a-radio><a-radio value="disabled">停用</a-radio></a-radio-group></a-form-item>
        <div class="modal-actions"><a-button @click="userVisible = false">取消</a-button><a-button type="primary" :loading="savingUser" @click="saveUser">保存</a-button></div>
      </a-form>
    </a-modal>

    <a-modal v-model:open="resetVisible" title="重置密码" :footer="null" width="400px"><a-input-password v-model:value="resetPassword" placeholder="至少 8 位" /><a-button type="primary" block class="reset-button" @click="saveReset">确认重置</a-button></a-modal>
    <a-drawer v-model:open="conversationVisible" width="min(760px, 92vw)" :title="selectedConversation?.title">
      <div v-for="item in conversationMessages" :key="item.id" :class="['admin-message', item.role]">
        <div class="message-meta">{{ item.role === 'assistant' ? `${item.provider} · ${item.model}` : selectedConversation?.name }}</div>
        <div v-if="item.role === 'assistant' && item.rating" class="message-rating">回答满意度：{{ item.rating }}/5</div>
        <a-image v-if="item.imageUrl" class="conversation-image" :src="item.imageUrl" :width="240" :height="160" alt="用户上传的原图" />
        <div v-if="item.content" class="admin-message-content">{{ item.content }}</div>
        <a-collapse v-if="item.visionContext" ghost size="small" class="vision-context">
          <a-collapse-panel key="vision" header="Qwen 图片解析">
            <p>{{ item.visionContext }}</p>
          </a-collapse-panel>
        </a-collapse>
      </div>
    </a-drawer>

    <a-drawer v-model:open="caseDetailVisible" width="min(920px, 96vw)" title="案例管理详情">
      <template #extra>
        <a-space v-if="selectedCase">
          <a-button v-if="selectedCase.status === 'withdrawn'" type="primary" ghost @click="setCaseStatus(selectedCase, 'published')">恢复发布</a-button>
          <a-button v-if="selectedCase.status === 'published'" danger @click="openWithdraw(selectedCase)">撤回案例</a-button>
        </a-space>
      </template>
      <div v-if="selectedCase" class="admin-detail">
        <div class="detail-heading"><div><strong>{{ selectedCase.name }}</strong><span>{{ selectedCase.studentId }}</span></div><a-tag :color="statusColor(selectedCase.status)">{{ statusLabel(selectedCase.status) }}</a-tag></div>
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="平台">{{ displayPlatform(selectedCase) }}</a-descriptions-item>
          <a-descriptions-item label="模型">{{ selectedCase.model || '未记录' }}</a-descriptions-item>
          <a-descriptions-item label="错误类型">{{ taxonomyText(selectedCase.errorTypes, selectedCase.errorType || selectedCase.category, ERROR_TYPE_OPTIONS, selectedCase.errorTypeOther) }}</a-descriptions-item>
          <a-descriptions-item label="来源问题">{{ taxonomyText(selectedCase.sourceIssues, '', SOURCE_ISSUE_OPTIONS, selectedCase.sourceIssueOther) }}</a-descriptions-item>
          <a-descriptions-item label="知识场景" :span="2">{{ taxonomyText(selectedCase.knowledgeScenarios, '', KNOWLEDGE_SCENARIO_OPTIONS, selectedCase.knowledgeScenarioOther) }}</a-descriptions-item>
        </a-descriptions>
        <section class="detail-block"><h3>AI 提问（Prompt）</h3><p>{{ selectedCase.prompt }}</p></section>
        <section v-if="selectedCase.images?.length" class="detail-block">
          <h3>用户上传的原图</h3>
          <a-image-preview-group>
            <div class="admin-image-grid">
              <a-image v-for="(url, index) in selectedCase.images" :key="url" :src="url" :width="168" :height="118" :alt="`案例原图 ${index + 1}`" />
            </div>
          </a-image-preview-group>
        </section>
        <a-alert v-if="selectedCase.withdrawnReason" type="warning" show-icon message="撤回原因" :description="selectedCase.withdrawnReason" />
        <section class="detail-block"><h3>AI 回复与片段批注</h3><AnnotationEditor :text="selectedCase.aiAnswer" :model-value="selectedCase.annotations || []" readonly allow-withdraw @withdraw="onAdminWithdrawAnnotation" /></section>
        <section v-if="selectedCase.note" class="detail-block"><h3>整体说明</h3><p>{{ selectedCase.note }}</p></section>
        <section v-if="selectedCase.tags?.length" class="detail-block"><h3>标签</h3><a-space wrap><a-tag v-for="tag in selectedCase.tags" :key="tag">{{ tag }}</a-tag></a-space></section>
      </div>
    </a-drawer>

    <a-modal v-model:open="withdrawVisible" title="撤回案例" ok-text="确认撤回" cancel-text="取消" :confirm-loading="withdrawing" @ok="confirmWithdraw">
      <a-alert type="warning" show-icon message="撤回后案例不再在广场展示，已有批注、投票和评论将完整保留。" />
      <a-textarea v-model:value="withdrawReason" :rows="4" :maxlength="4000" show-count placeholder="请填写撤回原因，作者可以在个人主页查看" class="reject-input" />
    </a-modal>

    <a-drawer v-model:open="diaryDetailVisible" width="min(760px, 96vw)" title="信息需求记录详情">
      <div v-if="selectedDiary" class="admin-detail">
        <div class="detail-heading"><div><strong>{{ selectedDiary.name }}</strong><span>{{ selectedDiary.studentId }}<template v-if="selectedDiary.className"> · {{ selectedDiary.className }}</template></span></div><a-tag :color="selectedDiary.status === 'submitted' ? 'green' : 'orange'">{{ selectedDiary.status === 'submitted' ? '已提交' : '草稿' }}</a-tag></div>
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="日期">{{ selectedDiary.logDate }}</a-descriptions-item>
          <a-descriptions-item label="时间">{{ selectedDiary.occurredAt || '未填写' }}</a-descriptions-item>
          <a-descriptions-item label="GenAI">{{ selectedDiary.isGenaiRelated ? selectedDiary.genaiPlatform || '是' : '否' }}</a-descriptions-item>
          <a-descriptions-item label="记录状态">{{ selectedDiary.status === 'submitted' ? '已提交' : '草稿' }}</a-descriptions-item>
        </a-descriptions>
        <section class="detail-block"><h3>发生情境</h3><p>{{ selectedDiary.contextText }}</p></section>
        <section class="detail-block"><h3>信息需求</h3><p>{{ selectedDiary.needDescription }}</p></section>
        <section class="detail-block"><h3>渠道和工具</h3><p>{{ selectedDiary.channels }}</p></section>
        <section class="detail-block"><h3>搜寻与获取过程</h3><p>{{ selectedDiary.searchProcess }}</p></section>
        <section class="detail-block"><h3>获取结果</h3><p>{{ selectedDiary.outcome }}</p></section>
        <section class="detail-block"><h3>反思</h3><p>{{ selectedDiary.reflection }}</p></section>
      </div>
    </a-drawer>
  </div>
</template>

<script setup>
import { computed, markRaw, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { DashboardOutlined, TeamOutlined, MessageOutlined, AuditOutlined, ReadOutlined, ExportOutlined, SwapOutlined, LogoutOutlined, UploadOutlined, UserAddOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'
import AnnotationEditor from '../../components/cases/AnnotationEditor.vue'
import { getAdminOverview, getAdminUsers, createAdminUser, updateAdminUser, disableAdminUser, resetAdminUserPassword, importAdminUsers, getAdminConversations, getAdminMessages, getAdminCases, getAdminCase, updateAdminCaseStatus, getAdminDiaries, getAdminDiary, getAdminDiaryCompletion, exportAdminData } from '../../api/admin'
import { withdrawCaseAnnotation } from '../../api/submission'
import { ERROR_TYPE_OPTIONS, KNOWLEDGE_SCENARIO_OPTIONS, SOURCE_ISSUE_OPTIONS, optionLabel, platformLabel } from '../../constants/options'

const router = useRouter()
const auth = useAuthStore()
const activeView = ref('overview')
const navItems = [
  { key: 'overview', label: '概览', icon: markRaw(DashboardOutlined) },
  { key: 'users', label: '账号管理', icon: markRaw(TeamOutlined) },
  { key: 'conversations', label: '对话数据', icon: markRaw(MessageOutlined) },
  { key: 'cases', label: '案例管理', icon: markRaw(AuditOutlined) },
  { key: 'diaries', label: '作业记录', icon: markRaw(ReadOutlined) },
  { key: 'exports', label: '数据导出', icon: markRaw(ExportOutlined) },
]
const currentTitle = computed(() => navItems.find(item => item.key === activeView.value)?.label)
const currentDate = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(new Date())
const overview = ref({})
const metrics = computed(() => [
  { label: '学生账号', value: overview.value.users?.total || 0, note: `${overview.value.users?.active || 0} 个启用` },
  { label: '案例总数', value: overview.value.cases?.total || 0, note: `${overview.value.cases?.published || 0} 条已发布` },
  { label: '日记记录', value: overview.value.diaries?.total || 0, note: `${overview.value.diaries?.today || 0} 条今日提交` },
  { label: '对话消息', value: overview.value.messages?.total || 0, note: '累计记录' },
  { label: '回复满意度', value: overview.value.ratings?.average || '-', note: `${overview.value.ratings?.total || 0} 条评分` },
])
const filters = reactive({ users: '', conversations: '', cases: '', diaries: '' })
const pages = reactive({ users: 1, conversations: 1, cases: 1, diaries: 1 })
const totals = reactive({ users: 0, conversations: 0, cases: 0, diaries: 0 })
const users = ref([]), conversations = ref([]), cases = ref([]), adminDiaries = ref([])
const caseStatus = ref('')
const caseErrorType = ref(undefined)
const completionDate = ref(dayjs())
const diaryCompletion = ref([])
const completionRequired = ref(3)
const completionIncomplete = computed(() => diaryCompletion.value.filter(item => !item.complete).length)

const userColumns = [{ title: '姓名/账号', key: 'identity' }, { title: '班级', dataIndex: 'className' }, { title: '角色', key: 'role' }, { title: '状态', key: 'status' }, { title: '最后登录', dataIndex: 'lastLoginAt' }, { title: '操作', key: 'actions', width: 230 }]
const conversationColumns = [{ title: '学生', key: 'user', width: 180 }, { title: '会话标题', dataIndex: 'title' }, { title: '消息数', dataIndex: 'messageCount', width: 90 }, { title: '更新时间', dataIndex: 'updatedAt', width: 180 }, { title: '操作', key: 'actions', width: 100 }]
const caseColumns = [{ title: '案例', key: 'prompt' }, { title: '学生', key: 'user', width: 160 }, { title: '错误类型', dataIndex: 'errorType', width: 170 }, { title: '批注数', dataIndex: 'annotationCount', width: 80 }, { title: '状态', key: 'status', width: 110 }, { title: '操作', key: 'actions', width: 250 }]
const diaryColumns = [{ title: '日期', dataIndex: 'logDate', width: 110 }, { title: '学生', key: 'user', width: 160 }, { title: '信息需求', key: 'need' }, { title: 'GenAI', key: 'genai', width: 110 }, { title: '状态', dataIndex: 'status', width: 90 }, { title: '操作', key: 'actions', width: 100 }]
const completionColumns = [{ title: '学生', key: 'student' }, { title: '已提交', key: 'progress', width: 110 }]
const exportItems = [{ type: 'users', label: '账号清单', note: '账号、角色、班级与登录状态' }, { type: 'conversations', label: '全部对话', note: '逐条消息、模型、评分与时间' }, { type: 'ratings', label: '回复满意度', note: '逐条 AI 回复的评分和更新时间' }, { type: 'cases', label: '案例数据', note: '案例主体、三维分类与发布状态' }, { type: 'annotations', label: '片段批注', note: '原句、问题类型与批注内容' }, { type: 'diaries', label: '信息需求日记', note: '完整作业记录与 GenAI 标记' }]

async function switchView(key) { activeView.value = key; await ({ overview: loadOverview, users: loadUsers, conversations: loadConversations, cases: loadCases, diaries: loadDiaries }[key]?.()) }
async function loadOverview() { overview.value = (await getAdminOverview()).data }
async function loadUsers() { const r = await getAdminUsers({ page: pages.users, keyword: filters.users }); users.value = r.data.list; totals.users = r.data.total }
async function loadConversations() { const r = await getAdminConversations({ page: pages.conversations, keyword: filters.conversations }); conversations.value = r.data.list; totals.conversations = r.data.total }
async function loadCases() { const r = await getAdminCases({ page: pages.cases, keyword: filters.cases, status: caseStatus.value, errorType: caseErrorType.value }); cases.value = r.data.list; totals.cases = r.data.total }
function onCaseSearch() { pages.cases = 1; loadCases() }
function onCaseStatusChange() { pages.cases = 1; loadCases() }
async function loadDiaries() { const [r] = await Promise.all([getAdminDiaries({ page: pages.diaries, keyword: filters.diaries }), loadDiaryCompletion()]); adminDiaries.value = r.data.list; totals.diaries = r.data.total }
async function loadDiaryCompletion() { const r = await getAdminDiaryCompletion(completionDate.value.format('YYYY-MM-DD')); diaryCompletion.value = r.data.list || []; completionRequired.value = r.data.requiredCount || 3 }
onMounted(loadOverview)

const userVisible = ref(false), editingUserId = ref(null), userFormRef = ref(), savingUser = ref(false)
const disableUserId = ref(null)
const userForm = reactive({ studentId: '', name: '', password: '', role: 'student', status: 'active', className: '' })
function openUser(record = null) { editingUserId.value = record?.id || null; Object.assign(userForm, record || { studentId: '', name: '', password: '', role: 'student', status: 'active', className: '' }); userVisible.value = true }
async function saveUser() {
  if (savingUser.value) return
  try {
    await userFormRef.value.validate()
  } catch { return } // 校验失败，表单已展示错误提示
  savingUser.value = true
  try {
    if (editingUserId.value) await updateAdminUser(editingUserId.value, userForm)
    else await createAdminUser(userForm)
    userVisible.value = false
    message.success('账号已保存')
    await Promise.all([loadUsers(), loadOverview()])
  } catch (err) {
    message.error(err.response?.data?.message || '账号保存失败，请重试')
  } finally { savingUser.value = false }
}
async function disableUser(record) {
  if (disableUserId.value) return
  disableUserId.value = record.id
  try {
    await disableAdminUser(record.id)
    message.success('账号已停用')
    await Promise.all([loadUsers(), loadOverview()])
  } catch (err) {
    message.error(err.response?.data?.message || '账号停用失败，请重试')
  } finally { disableUserId.value = null }
}
async function importUsers(file) { const r = await importAdminUsers(file); message.success(`导入 ${r.data.created} 个账号，跳过 ${r.data.skipped} 个`); await Promise.all([loadUsers(), loadOverview()]); return false }
const resetVisible = ref(false), resetTarget = ref(null), resetPassword = ref('')
function openReset(record) { resetTarget.value = record; resetPassword.value = ''; resetVisible.value = true }
async function saveReset() { if (resetPassword.value.length < 8) return message.warning('密码至少 8 位'); await resetAdminUserPassword(resetTarget.value.id, resetPassword.value); resetVisible.value = false; message.success('密码已重置') }

const conversationVisible = ref(false), selectedConversation = ref(null), conversationMessages = ref([])
async function viewConversation(record) { selectedConversation.value = record; conversationMessages.value = (await getAdminMessages(record.id)).data; conversationVisible.value = true }
const caseDetailVisible = ref(false), selectedCase = ref(null)
async function viewCase(record) { selectedCase.value = (await getAdminCase(record.id)).data; caseDetailVisible.value = true }
const diaryDetailVisible = ref(false), selectedDiary = ref(null)
async function viewDiary(record) { selectedDiary.value = (await getAdminDiary(record.id)).data; diaryDetailVisible.value = true }
function taxonomyText(values, fallback, options, otherText = '') {
  const selected = Array.isArray(values) && values.length ? values : fallback ? [fallback] : []
  return selected.map(value => value === 'other' && otherText ? `其他：${otherText}` : optionLabel(options, value)).join('、') || '未标注'
}
const settingCaseStatus = ref(false)
async function setCaseStatus(record, status) {
  if (settingCaseStatus.value) return
  settingCaseStatus.value = true
  try {
    await updateAdminCaseStatus(record.id, status)
    if (selectedCase.value?.id === record.id) { selectedCase.value.status = status; selectedCase.value.withdrawnReason = '' }
    message.success(status === 'published' ? '案例已发布' : '状态已更新')
    await loadCases(); await loadOverview()
  } catch (err) {
    message.error(err.response?.data?.message || '状态更新失败，请重试')
  } finally { settingCaseStatus.value = false }
}
const withdrawVisible = ref(false), withdrawTarget = ref(null), withdrawReason = ref(''), withdrawing = ref(false)
function openWithdraw(record) { withdrawTarget.value = record; withdrawReason.value = ''; withdrawVisible.value = true }
async function confirmWithdraw() { if (!withdrawReason.value.trim()) return message.warning('请填写撤回原因'); withdrawing.value = true; try { await updateAdminCaseStatus(withdrawTarget.value.id, 'withdrawn', withdrawReason.value.trim()); withdrawVisible.value = false; if (selectedCase.value?.id === withdrawTarget.value.id) { selectedCase.value.status = 'withdrawn'; selectedCase.value.withdrawnReason = withdrawReason.value.trim() }; message.success('案例已撤回并保留历史记录'); await loadCases(); await loadOverview() } finally { withdrawing.value = false } }
async function onAdminWithdrawAnnotation(annotation) { await withdrawCaseAnnotation(selectedCase.value.id, annotation.id); annotation.status = 'withdrawn'; annotation.withdrawnAt = new Date().toISOString(); message.success('批注已撤回并保留审计记录') }
async function runExport(type) { await exportAdminData(type); message.success('导出已开始下载') }
function statusLabel(value) { return ({ draft: '草稿', submitted: '旧待审核记录', published: '已发布', rejected: '旧退回记录', withdrawn: '已撤回' })[value] || value }
function statusColor(value) { return ({ draft: 'default', submitted: 'orange', published: 'green', rejected: 'red', withdrawn: 'default' })[value] }
function displayPlatform(record) { return platformLabel(record.platform, record.platformOther) }
function backToStudent() { router.push('/chat') }
async function logout() { await auth.logout(); await router.push('/login') }
</script>

<style scoped>
.admin-shell { min-height: 100vh; display: grid; grid-template-columns: 224px minmax(0, 1fr); background: var(--hib-paper); color: var(--hib-text); }
.admin-sidebar { position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; padding: 20px 14px; background: var(--hib-red-dark); color: #f7e9eb; border-right: 1px solid rgba(83,24,31,.18); }
.admin-brand { height: 62px; display: flex; align-items: center; gap: 12px; padding: 0 10px 20px; border-bottom: 1px solid rgba(255,255,255,.13); }
.admin-brand > span { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.32); background: rgba(255,255,255,.08); font-family: Georgia, serif; font-size: 13px; }
.admin-brand strong { color: #fff; }
.admin-sidebar nav { display: grid; gap: 3px; padding-top: 18px; }
.admin-sidebar nav button { height: 42px; display: flex; align-items: center; gap: 11px; padding: 0 12px; color: #eddbdd; background: transparent; border: 0; border-left: 3px solid transparent; cursor: pointer; text-align: left; }
.admin-sidebar nav button:hover { color: #fff; background: rgba(255,255,255,.08); }
.admin-sidebar nav button.active { color: #fff; background: rgba(255,255,255,.16); border-left-color: rgba(255,255,255,.78); }
.admin-user { margin-top: auto; display: grid; gap: 2px; padding: 14px 8px 0; border-top: 1px solid rgba(255,255,255,.13); }
.admin-user :deep(.ant-btn) { color: #eddbdd; text-align: left; justify-content: flex-start; padding-left: 0; }
.admin-user :deep(.ant-btn:hover) { color: #fff; }
.admin-main { min-width: 0; padding: 28px 34px 48px; overflow: auto; }
.completion-panel { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 18px 0 12px; }
.completion-panel h2 { margin: 4px 0; font-size: 18px; }
.completion-panel p { margin: 0; color: var(--hib-muted); }
.completion-table { margin-bottom: 18px; }
.completion-table :deep(.incomplete-row td) { background: #fff4f4; }
.reject-input { margin-top: 16px; }
.admin-header { display: flex; justify-content: space-between; align-items: end; min-height: 72px; padding-bottom: 20px; border-bottom: 1px solid var(--hib-line); }
.admin-header h1 { margin: 6px 0 0; font-size: 25px; }
.eyebrow { color: var(--hib-red); font-size: 11px; letter-spacing: 0; }
.date-label, .subtext { color: #748078; font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(5, 1fr); border-bottom: 1px solid var(--hib-line); }
.metric { padding: 28px 24px 25px 0; }
.metric + .metric { padding-left: 24px; border-left: 1px solid var(--hib-line); }
.metric span, .metric small { display: block; color: #738078; }
.metric strong { display: block; margin: 3px 0; font: 34px Georgia, serif; }
.overview-note { width: min(560px, 100%); margin-top: 34px; }
.overview-note h2 { font-size: 17px; }
.task-line { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #dfe4e1; }
.table-toolbar { min-height: 76px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.truncate { max-width: 520px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pager { margin-top: 20px; text-align: right; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 22px; }
.reset-button { margin-top: 16px; }
.admin-message { width: 86%; margin-bottom: 16px; padding: 12px 14px; white-space: pre-wrap; background: #f0eeec; }
.admin-message.user { margin-left: auto; background: var(--hib-red-soft); }
.message-rating { margin: 3px 0 7px; color: var(--hib-red); font-size: 12px; }
.message-meta { color: #6d7871; font-size: 11px; margin-bottom: 6px; }
.admin-message-content { margin-top: 8px; line-height: 1.65; }
.conversation-image { display: block; margin-top: 8px; }
.conversation-image :deep(img), .admin-image-grid :deep(img) { object-fit: cover; border: 1px solid var(--hib-line); }
.vision-context { margin-top: 8px; border-top: 1px solid rgba(117, 93, 96, .16); }
.vision-context :deep(.ant-collapse-header) { padding: 8px 0 2px !important; color: #776b6e; font-size: 12px; }
.vision-context p { margin: 0; color: #5d5557; font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
.admin-detail { display: grid; gap: 20px; }
.detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-bottom: 16px; border-bottom: 1px solid #dce2de; }
.detail-heading strong, .detail-heading span { display: block; }
.detail-heading span { margin-top: 3px; color: #748078; font-size: 12px; }
.detail-block { padding-top: 4px; }
.detail-block h3 { margin: 0 0 8px; color: #657169; font-size: 12px; font-weight: 600; }
.detail-block p { margin: 0; color: #202a24; line-height: 1.75; white-space: pre-wrap; }
.admin-image-grid { display: grid; grid-template-columns: repeat(auto-fill, 168px); gap: 10px; }
.export-section > p { color: #707b74; margin: 24px 0; }
.export-list { display: grid; max-width: 760px; border-top: 1px solid #d8ded9; }
.export-list button { min-height: 76px; display: grid; grid-template-columns: 28px 1fr 24px; align-items: center; gap: 14px; padding: 0 16px; border: 0; border-bottom: 1px solid #d8ded9; background: transparent; text-align: left; cursor: pointer; }
.export-list button:hover { background: var(--hib-red-soft); }
.export-list strong, .export-list small { display: block; }
.export-list small { color: #758078; margin-top: 3px; }
@media (max-width: 900px) { .admin-shell { grid-template-columns: 72px 1fr; } .admin-brand strong, .nav-label, .admin-user > span, .admin-action-label { display:none; } .admin-sidebar nav button { justify-content: center; padding: 0; } .admin-user { padding-inline: 0; } .admin-user :deep(.ant-btn) { width: 44px; min-width: 44px; display: flex; align-items: center; justify-content: center; padding: 0; overflow: hidden; text-align: center; } .admin-user :deep(.anticon) { margin: 0; } .metrics { grid-template-columns: repeat(2, 1fr); } .admin-main { padding: 22px 18px; } .table-toolbar { align-items: stretch; flex-direction: column; padding: 14px 0; } }
</style>
