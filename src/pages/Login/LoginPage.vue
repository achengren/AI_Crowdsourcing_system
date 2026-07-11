<template>
  <div class="login-page">
    <div class="login-card">
      <h1>AI 众包系统</h1>
      <p class="subtitle">信息行为导论课程平台</p>

      <a-form :model="form" layout="vertical" @finish="onLogin">
        <a-form-item label="学号" name="studentId" :rules="[{ required: true, message: '请输入学号' }]">
          <a-input v-model:value="form.studentId" placeholder="请输入学号" size="large" />
        </a-form-item>

        <a-form-item label="密码" name="password" :rules="[{ required: true, message: '请输入密码' }]">
          <a-input-password v-model:value="form.password" placeholder="请输入密码" size="large" />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit" size="large" block :loading="loading">
            登录
          </a-button>
        </a-form-item>
      </a-form>

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
import { login } from '../../api/auth'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const form = reactive({ studentId: '', password: '' })

async function onLogin() {
  loading.value = true
  try {
    const res = await login({ studentId: form.studentId, password: form.password })
    auth.login(res.data.token, res.data.user)
    message.success('登录成功')
    router.push('/chat')
  } catch {
    // error handled by interceptor
  } finally {
    loading.value = false
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
  width: 420px;
  padding: 48px 40px;
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
  margin-bottom: 32px;
}
</style>
