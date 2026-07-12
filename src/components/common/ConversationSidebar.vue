<template>
  <div class="sidebar">
    <div class="sidebar-top">
      <div class="sidebar-logo" @click="onNewChat">AI 众包系统</div>
      <a-button block @click="onNewChat" class="new-chat-btn">+ 新建对话</a-button>
    </div>

    <div class="conversation-list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        :class="['conv-item', { active: conv.id === activeConvId }]"
        @click="onSelectConv(conv)"
      >
        <span class="conv-title">{{ conv.title }}</span>
        <a-popconfirm
          title="确定删除该对话？"
          ok-text="删除"
          cancel-text="取消"
          @confirm.stop="onDeleteConv(conv.id)"
        >
          <a-button type="link" size="small" class="conv-delete" @click.stop>
            <DeleteOutlined />
          </a-button>
        </a-popconfirm>
      </div>
      <div v-if="!conversations.length" class="conv-empty">暂无对话</div>
    </div>

    <div class="sidebar-bottom">
      <div class="sidebar-divider"></div>
      <div
        :class="['sidebar-nav-item', { active: currentRoute === '/gallery' }]"
        @click="$router.push('/gallery')"
      >
        <FolderOutlined />
        <span>案例</span>
      </div>
      <div class="sidebar-nav-item" @click="showProfile = true">
        <UserOutlined />
        <span>{{ auth.user?.name || '个人主页' }}</span>
        <a-button type="link" size="small" @click.stop="onLogout" class="logout-btn">退出</a-button>
      </div>
    </div>
  </div>

  <ProfileModal :visible="showProfile" @close="showProfile = false" />
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { DeleteOutlined, UserOutlined, FolderOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'
import { getConversations, deleteConversation } from '../../api/chat'
import ProfileModal from './ProfileModal.vue'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const conversations = ref([])
const showProfile = ref(false)

const currentRoute = computed(() => route.path)
const activeConvId = computed(() => route.query.conv || null)

onMounted(() => fetchConversations())

watch(activeConvId, () => fetchConversations())

async function fetchConversations() {
  try {
    const res = await getConversations()
    conversations.value = res.data
  } catch { /* ignore */ }
}

async function onNewChat() {
  if (currentRoute.value !== '/chat') {
    router.push('/chat')
  } else {
    // 在 ChatPage 中触发新建
    window.dispatchEvent(new CustomEvent('new-chat'))
  }
}

function onSelectConv(conv) {
  router.push({ path: '/chat', query: { conv: conv.id } })
}

async function onDeleteConv(id) {
  try {
    await deleteConversation(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
  } catch { /* ignore */ }
}

function onLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.sidebar {
  width: 260px;
  min-width: 260px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  height: 100vh;
}

.sidebar-top {
  padding: 12px;
}

.sidebar-logo {
  font-size: 16px;
  font-weight: 700;
  padding: 8px 12px;
  cursor: pointer;
  color: #111;
}

.new-chat-btn {
  margin-top: 8px;
  border-radius: 18px;
  height: 36px;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.conv-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 2px;
  transition: background 0.15s, box-shadow 0.15s;
  border: 1px solid transparent;
}

.conv-item:hover {
  background: #e5e7eb;
}

.conv-item.active {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  border-color: #e5e7eb;
}

.conv-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  color: #333;
}

.conv-delete {
  opacity: 0;
  transition: opacity 0.15s;
}

.conv-item:hover .conv-delete {
  opacity: 1;
}

.conv-empty {
  text-align: center;
  color: #999;
  font-size: 13px;
  padding: 24px 0;
}

.sidebar-bottom {
  padding: 8px;
}

.sidebar-divider {
  height: 1px;
  background: #e5e7eb;
  margin: 4px 8px 8px;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #444;
  transition: background 0.15s;
}

.sidebar-nav-item:hover {
  background: #e5e7eb;
}

.sidebar-nav-item.active {
  background: #dbeafe;
  color: #1677ff;
}

.logout-btn {
  margin-left: auto;
  font-size: 12px;
  color: #999;
  padding: 0 4px;
}

.logout-btn:hover { color: #ff4d4f; }
</style>
