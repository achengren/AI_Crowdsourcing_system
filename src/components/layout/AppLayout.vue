<template>
  <a-layout class="layout">
    <a-layout-header class="header">
      <div class="logo">AI 众包系统</div>
      <a-menu
        v-model:selectedKeys="selectedKeys"
        mode="horizontal"
        theme="dark"
        :items="menuItems"
        @click="onMenuClick"
      />
      <div class="user-area">
        <a class="username" @click="goProfile">{{ auth.user?.name || '未登录' }}</a>
        <a-button type="link" @click="onLogout" v-if="auth.isLoggedIn && !auth.isGuest">退出</a-button>
        <a-button type="link" @click="onLogout" v-if="auth.isGuest">退出游客</a-button>
      </div>
    </a-layout-header>

    <a-layout-content class="content">
      <div class="page-container">
        <slot />
      </div>
    </a-layout-content>

    <a-layout-footer class="footer">
      AI 众包系统 —— 信息行为导论课程平台
    </a-layout-footer>
  </a-layout>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../../store/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const selectedKeys = computed(() => {
  const path = route.path
  if (path.startsWith('/chat')) return ['chat']
  if (path.startsWith('/gallery')) return ['gallery']
  return ['chat']
})

const menuItems = [
  { key: 'chat', label: 'AI 对话' },
  { key: 'gallery', label: '案例' },
]

function onMenuClick({ key }) {
  router.push(`/${key}`)
}

function goProfile() {
  router.push('/profile')
}

function onLogout() {
  auth.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  padding: 0 24px;
}

.logo {
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  margin-right: 48px;
  white-space: nowrap;
}

.user-area {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.username {
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
}

.username:hover {
  color: #fff;
}

.content {
  padding: 24px;
  background: #f5f5f5;
  min-height: calc(100vh - 64px - 70px);
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.footer {
  text-align: center;
  background: #fff;
}
</style>
