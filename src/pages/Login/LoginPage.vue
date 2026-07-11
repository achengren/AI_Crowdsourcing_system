<template>
  <div class="login-page">
    <div class="login-card">
      <h1>AI 众包系统</h1>
      <p class="subtitle">信息行为导论课程平台</p>

      <a-tabs v-model:activeKey="tab" centered>
        <a-tab-pane key="login" tab="登录">
          <a-form :model="loginForm" layout="vertical" @finish="onLogin">
            <a-form-item label="学号" name="studentId" :rules="[{ required: true, message: '请输入学号' }]">
              <a-input v-model:value="loginForm.studentId" placeholder="请输入学号" size="large" />
            </a-form-item>

            <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
              <a-input-password v-model:value="loginForm.password" placeholder="请输入密码" size="large" />
            </a-form-item>

            <a-form-item>
              <a-button type="primary" html-type="submit" size="large" block :loading="loggingIn">
                登录
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>

        <a-tab-pane key="register" tab="注册">
          <a-form :model="registerForm" layout="vertical" @finish="onRegister">
            <a-form-item label="学号" name="studentId" :rules="[{ required: true, message: '请输入学号' }]">
              <a-input v-model:value="registerForm.studentId" placeholder="请输入学号" size="large" />
            </a-form-item>

            <a-form-item label="姓名" name="name" :rules="[{ required: true, message: '请输入姓名' }]">
              <a-input v-model:value="registerForm.name" placeholder="请输入你的姓名" size="large" />
            </a-form-item>

            <a-form-item label="密码" name="password" :rules="[{ required: true, min: 6, message: '密码至少6位' }]">
              <a-input-password v-model:value="registerForm.password" placeholder="设置密码（至少6位）" size="large" />
            </a-form-item>

            <a-form-item label="确认密码" name="confirmPwd" :rules="[{ required: true, validator: validateConfirmPwd }]">
              <a-input-password v-model:value="registerForm.confirmPwd" placeholder="再次输入密码" size="large" />
            </a-form-item>

            <a-form-item>
              <a-button type="primary" html-type="submit" size="large" block :loading="registering">
                注册
              </a-button>
            </a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>

      <a-divider>或</a-divider>

      <a-button block size="large" @click="onGuestLogin">游客模式</a-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { useAuthStore } from '../../store/auth'
import { login, register } from '../../api/auth'

const router = useRouter()
const auth = useAuthStore()
const tab = ref('login')
const loggingIn = ref(false)
const registering = ref(false)

const loginForm = reactive({ studentId: '', password: '' })
const registerForm = reactive({ studentId: '', name: '', password: '', confirmPwd: '' })

function validateConfirmPwd(_rule, value) {
  if (value !== registerForm.password) {
    return Promise.reject('两次密码不一致')
  }
  return Promise.resolve()
}

async function onLogin() {
  loggingIn.value = true
  try {
    const res = await login({ studentId: loginForm.studentId, password: loginForm.password })
    auth.login(res.data.token, res.data.user)
    message.success('登录成功')
    router.push('/chat')
  } catch {
    // handled by interceptor
  } finally {
    loggingIn.value = false
  }
}

async function onRegister() {
  registering.value = true
  try {
    const res = await register({
      studentId: registerForm.studentId,
      name: registerForm.name,
      password: registerForm.password,
    })
    auth.login(res.data.token, res.data.user)
    message.success('注册成功，已自动登录')
    router.push('/chat')
  } catch {
    // handled by interceptor
  } finally {
    registering.value = false
  }
}

function onGuestLogin() {
  auth.loginAsGuest()
  message.success('已进入游客模式')
  router.push('/chat')
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-card {
  width: 440px;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-card h1 {
  text-align: center;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #999;
  margin-bottom: 24px;
}
</style>
