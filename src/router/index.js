import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../pages/Login/LoginPage.vue'), meta: { public: true } },
  { path: '/', redirect: '/chat' },
  { path: '/chat', name: 'Chat', component: () => import('../pages/Chat/ChatPage.vue') },
  { path: '/submit', redirect: '/cases/new' },
  { path: '/cases/new', name: 'CaseEditor', component: () => import('../pages/Cases/CaseEditorPage.vue') },
  { path: '/diaries', name: 'Diaries', component: () => import('../pages/Diaries/DiaryListPage.vue') },
  { path: '/diaries/new', name: 'DiaryEditor', component: () => import('../pages/Diaries/DiaryEditorPage.vue') },
  { path: '/diaries/:id/edit', name: 'DiaryEdit', component: () => import('../pages/Diaries/DiaryEditorPage.vue') },
  { path: '/profile', name: 'Profile', component: () => import('../pages/Profile/ProfilePage.vue') },
  { path: '/gallery', name: 'Gallery', component: () => import('../pages/Gallery/GalleryPage.vue') },
  { path: '/admin', name: 'Admin', component: () => import('../pages/Admin/AdminPage.vue'), meta: { requiresAdmin: true } },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(to => {
  const token = localStorage.getItem('token')
  let user = null
  try { user = JSON.parse(localStorage.getItem('user')) } catch {}
  if (!token && !to.meta.public) return '/login'
  if (token && to.path === '/login') return user?.role === 'admin' ? '/admin' : '/chat'
  if (to.meta.requiresAdmin && user?.role !== 'admin') return '/chat'
})

export default router
