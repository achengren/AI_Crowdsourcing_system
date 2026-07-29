<template>
  <main class="login-page">
    <section class="identity-panel">
      <div class="brand-lockup">
        <div class="brand-mark">HIB</div>
        <div class="brand-copy">
          <span>HUMAN INFORMATION BEHAVIOR</span>
          <h1>HIB课程管理系统</h1>
        </div>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-form-wrap">
        <div class="form-heading">
          <span class="eyebrow">COURSE ACCESS</span>
          <h2>账号登录</h2>
        </div>
        <a-form :model="loginForm" layout="vertical" @finish="onLogin">
          <a-form-item label="账号" name="studentId" :rules="[{ required: true, message: '请输入账号' }]">
            <a-input v-model:value="loginForm.studentId" placeholder="学号或管理员账号" size="large">
              <template #prefix><IdcardOutlined /></template>
            </a-input>
          </a-form-item>
          <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
            <a-input-password v-model:value="loginForm.password" placeholder="请输入密码" size="large">
              <template #prefix><LockOutlined /></template>
            </a-input-password>
          </a-form-item>
          <a-button type="primary" html-type="submit" size="large" block :loading="loggingIn">登录</a-button>
        </a-form>
      </div>
    </section>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { IdcardOutlined, LockOutlined } from '@ant-design/icons-vue'
import { useAuthStore } from '../../store/auth'
import { login } from '../../api/auth'

const router = useRouter()
const auth = useAuthStore()
const loggingIn = ref(false)
const loginForm = reactive({ studentId: '', password: '' })

async function onLogin() {
  loggingIn.value = true
  try {
    const res = await login(loginForm)
    auth.login(res.data.token, res.data.user)
    message.success('登录成功')
    router.push(res.data.user.role === 'admin' ? '/admin' : '/chat')
  } finally {
    loggingIn.value = false
  }
}
</script>

<style scoped>
.login-page { min-height: 100vh; display: grid; grid-template-columns: minmax(400px, 0.8fr) minmax(480px, 1.2fr); background: var(--hib-paper); color: var(--hib-text); }
.identity-panel { padding: 64px; display: grid; place-items: center; background: var(--hib-red-dark); color: #fff; position: relative; overflow: hidden; }
.identity-panel::before { content: ''; position: absolute; inset: 28px; border: 1px solid rgba(255,255,255,.18); pointer-events: none; }
.identity-panel::after { content: 'HIB'; position: absolute; right: -34px; bottom: -54px; color: rgba(255,255,255,.045); font-family: Georgia, serif; font-size: 250px; line-height: 1; pointer-events: none; }
.brand-lockup { width: min(560px, 100%); display: flex; align-items: center; gap: 26px; position: relative; z-index: 1; }
.brand-mark { width: 82px; height: 82px; flex: 0 0 82px; border: 1px solid rgba(255,255,255,.38); background: rgba(255,255,255,.07); display: grid; place-items: center; font-family: Georgia, serif; font-size: 25px; }
.brand-copy span { display: block; margin-bottom: 10px; color: #f1dfe1; font-size: 12px; letter-spacing: 0; }
.brand-copy h1 { margin: 0; color: #fff; font-family: "Noto Serif SC", "Songti SC", serif; font-size: 38px; font-weight: 600; letter-spacing: 0; line-height: 1.35; }
.login-panel { display: grid; place-items: center; padding: 56px; background: #fbfaf9; }
.login-form-wrap { width: min(420px, 100%); }
.form-heading { margin-bottom: 32px; }
.eyebrow { color: var(--hib-red); font-size: 12px; letter-spacing: 0; }
.form-heading h2 { margin: 8px 0 0; font-size: 28px; }
.login-form-wrap :deep(.ant-input-affix-wrapper) { border-radius: 4px; }
.login-form-wrap :deep(.ant-btn) { border-radius: 4px; }
.login-form-wrap :deep(.ant-input-affix-wrapper) { min-height: 44px; background: #fff; }
.login-form-wrap :deep(.ant-btn-primary) { height: 44px; box-shadow: 0 4px 12px rgba(153,65,75,.16); }
@media (max-width: 760px) { .login-page { grid-template-columns: 1fr; } .identity-panel { min-height: 220px; padding: 38px 30px; } .identity-panel::before { inset: 16px; } .identity-panel::after { right: -18px; bottom: -24px; font-size: 132px; } .brand-lockup { gap: 16px; } .brand-mark { width: 62px; height: 62px; flex-basis: 62px; font-size: 20px; } .brand-copy span { margin-bottom: 6px; font-size: 11px; } .brand-copy h1 { font-size: 28px; } .login-panel { padding: 36px 24px; } }
</style>
