<template>
  <div class="sidebar-shell">
    <header class="mobile-bar">
      <a-button type="text" aria-label="打开导航" title="打开导航" @click="mobileOpen = true"><MenuOutlined /></a-button>
      <span class="mobile-brand-mark">HIB</span>
      <strong>课程管理系统</strong>
    </header>
    <button v-if="mobileOpen" class="sidebar-backdrop" aria-label="关闭导航" @click="mobileOpen = false"></button>
    <aside class="sidebar" :class="{ open: mobileOpen }">
    <div class="sidebar-top">
      <div class="sidebar-title-row">
        <button class="sidebar-logo" aria-label="返回新对话" @click="onNewChat"><span class="brand-mark">HIB</span><span class="brand-name">课程管理系统</span></button>
        <a-button class="mobile-close" type="text" aria-label="关闭导航" title="关闭导航" @click="mobileOpen = false"><CloseOutlined /></a-button>
      </div>
      <a-button block @click="onNewChat" class="new-chat-btn"><PlusOutlined />新建对话</a-button>
    </div>

    <div class="conversation-list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conv-item', { active: conv.id === activeConvId }]"
        @click="onSelectConv(conv)"
      >
        <a-input
          v-if="editingId === conv.id"
          v-model:value="editingTitle"
          class="conv-title-input"
          size="small"
          :maxlength="50"
          @click.stop
          @press-enter.stop="saveTitle(conv)"
          @keydown.esc.stop="cancelRename"
          @blur="saveTitle(conv)"
        />
        <template v-else>
          <span class="conv-title">{{ conv.title }}</span>
          <a-button type="text" size="small" class="rename-btn" title="重命名对话" aria-label="重命名对话" @click.stop="startRename(conv)"><EditOutlined /></a-button>
        </template>
      </div>
      <div v-if="!conversations.length" class="conv-empty">暂无对话</div>
    </div>

    <div class="sidebar-bottom">
      <div class="sidebar-divider"></div>
      <div
        :class="['sidebar-nav-item', { active: currentRoute === '/gallery' }]"
        @click="navigate('/gallery')"
      >
        <FolderOutlined />
        <span class="nav-label">案例<span v-if="draftCount > 0" class="nav-dot"></span></span>
      </div>
      <div
        :class="['sidebar-nav-item', { active: currentRoute === '/profile' }]"
        @click="navigate('/profile')"
      >
        <UserOutlined />
        <span>{{ auth.user?.name || '个人主页' }}</span>
        <a-button type="link" size="small" @click.stop="onLogout" class="logout-btn">退出</a-button>
      </div>
      <div
        v-if="auth.isAdmin"
        :class="['sidebar-nav-item', { active: currentRoute === '/admin' }]"
        @click="navigate('/admin')"
      >
        <SettingOutlined />
        <span>管理后台</span>
      </div>
    </div>
    </aside>
  </div>

</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CloseOutlined, EditOutlined, FolderOutlined, MenuOutlined, PlusOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'
import { getConversations, updateConversationTitle } from '../../api/chat'
import { getSavedCaseDrafts } from '../../api/submission'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const conversations = ref([])
const mobileOpen = ref(false)
const editingId = ref('')
const editingTitle = ref('')
const renaming = ref(false)
const draftCount = ref(0)

const currentRoute = computed(() => route.path)
const activeConvId = computed(() => route.query.conv || null)

onMounted(() => { fetchConversations(); loadDraftCount() })

watch(activeConvId, () => fetchConversations())
watch(() => route.fullPath, () => { mobileOpen.value = false; loadDraftCount() })

async function fetchConversations() {
  try {
    const res = await getConversations()
    conversations.value = res.data
  } catch { /* ignore */ }
}

async function loadDraftCount() {
  try {
    const res = await getSavedCaseDrafts()
    draftCount.value = (res.data || []).length
  } catch { /* ignore */ }
}

async function onNewChat() {
  mobileOpen.value = false
  if (currentRoute.value !== '/chat') {
    router.push('/chat')
  } else {
    // 在 ChatPage 中触发新建
    window.dispatchEvent(new CustomEvent('new-chat'))
  }
}

function onSelectConv(conv) {
  if (editingId.value) return
  mobileOpen.value = false
  router.push({ path: '/chat', query: { conv: conv.id } })
}

function startRename(conv) {
  editingId.value = conv.id
  editingTitle.value = conv.title
}

function cancelRename() {
  editingId.value = ''
  editingTitle.value = ''
}

async function saveTitle(conv) {
  if (editingId.value !== conv.id || renaming.value) return
  const title = editingTitle.value.trim()
  if (!title) {
    message.warning('标题不能为空')
    return
  }
  if (title === conv.title) return cancelRename()
  renaming.value = true
  try {
    await updateConversationTitle(conv.id, title)
    conv.title = title
    cancelRename()
  } catch (error) {
    message.error(error.response?.data?.message || '标题保存失败')
  } finally { renaming.value = false }
}

function navigate(path) {
  mobileOpen.value = false
  router.push(path)
}

function onLogout() {
  mobileOpen.value = false
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.sidebar-shell {
  width: 236px;
  min-width: 236px;
}

.sidebar {
  width: 100%;
  background: var(--hib-red-dark);
  color: #fff;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(83,24,31,.18);
  height: 100vh;
}

.mobile-bar, .mobile-close, .sidebar-backdrop { display: none; }
.sidebar-title-row { display: flex; align-items: center; }

.sidebar-top {
  padding: 16px 14px 13px;
  border-bottom: 1px solid rgba(255,255,255,.12);
}

.sidebar-logo {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 6px 12px;
  border: 0;
  background: transparent;
  cursor: pointer;
  color: #fff;
  text-align: left;
}
.brand-mark { width: 34px; height: 34px; flex: 0 0 34px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.32); background: rgba(255,255,255,.08); font: 14px Georgia, serif; }
.brand-name { font-size: 15px; font-weight: 600; line-height: 1.25; }

.new-chat-btn {
  border-color: rgba(255,255,255,.24);
  border-radius: 4px;
  height: 40px;
  background: rgba(255,255,255,.1);
  color: #fff;
}
.new-chat-btn:hover { border-color: rgba(255,255,255,.45) !important; color: #fff !important; background: rgba(255,255,255,.16) !important; }

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}

.conv-item:hover {
  background: rgba(255,255,255,.08);
}

.conv-item.active {
  background: rgba(255,255,255,.16);
  border-color: rgba(255,255,255,.18);
  border-left-color: rgba(255,255,255,.78);
}

.conv-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  color: #f6eeec;
}

.conv-empty {
  text-align: center;
  color: #d8c4c1;
  font-size: 13px;
  padding: 24px 0;
}

.sidebar-bottom {
  padding: 8px;
}

.sidebar-divider {
  height: 1px;
  background: rgba(255,255,255,.13);
  margin: 4px 8px 8px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  color: #dfcfcc;
  transition: background 0.15s;
}

.sidebar-nav-item:hover {
  background: rgba(255,255,255,.08);
}
.rename-btn { width: 26px; min-width: 26px; height: 26px; padding: 0; color: #d8c4c1; opacity: 0; }
.conv-item:hover .rename-btn, .conv-item.active .rename-btn { opacity: 1; }
.rename-btn:hover { color: #fff !important; background: rgba(255,255,255,.1) !important; }
.conv-title-input { min-width: 0; }

.sidebar-nav-item.active {
  background: rgba(255,255,255,.16);
  color: #fff;
  box-shadow: inset 3px 0 0 rgba(255,255,255,.78);
}

.logout-btn {
  margin-left: auto;
  font-size: 12px;
  color: #d6c0bd;
  padding: 0 4px;
}

.logout-btn:hover { color: #fff; }

.nav-label {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.nav-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  margin-left: 6px;
  flex-shrink: 0;
}

@media (max-width: 760px) {
  .sidebar-shell { width: 0; min-width: 0; }
  .mobile-bar { position: fixed; inset: 0 0 auto; z-index: 90; height: 56px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-bottom: 2px solid var(--hib-red); background: rgba(255,255,255,.98); }
  .mobile-brand-mark { width: 28px; height: 28px; display: grid; place-items: center; color: #fff; background: var(--hib-red); font: 11px Georgia, serif; }
  .mobile-bar strong { font-size: 15px; }
  .mobile-bar :deep(.ant-btn) { width: 36px; height: 36px; padding: 0; }
  .sidebar { position: fixed; inset: 0 auto 0 0; z-index: 100; width: min(280px, 84vw); min-width: 0; transform: translateX(-101%); box-shadow: 12px 0 32px rgba(37, 11, 14, .22); transition: transform .2s ease; }
  .sidebar.open { transform: translateX(0); }
  .sidebar-backdrop { position: fixed; inset: 0; z-index: 95; display: block; width: 100%; height: 100%; padding: 0; border: 0; background: rgba(35, 18, 20, .38); }
  .mobile-close { display: inline-flex; align-items: center; justify-content: center; }
}
</style>
