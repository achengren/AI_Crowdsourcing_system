import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../pages/Login/LoginPage.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    redirect: '/chat',
  },
  {
    path: '/chat',
    name: 'Chat',
    component: () => import('../pages/Chat/ChatPage.vue'),
  },
  {
    path: '/submit',
    redirect: '/gallery',
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../pages/Profile/ProfilePage.vue'),
  },
  {
    path: '/gallery',
    name: 'Gallery',
    component: () => import('../pages/Gallery/GalleryPage.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to) => {
  const token = localStorage.getItem('token')
  if (!token && !to.meta.guest) {
    return '/login'
  }
  if (token && to.path === '/login') {
    return '/chat'
  }
})

export default router
