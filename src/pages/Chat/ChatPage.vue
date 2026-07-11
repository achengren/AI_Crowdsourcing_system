<template>
  <AppLayout>
    <div class="chat-page">
      <div class="chat-container">
        <div class="chat-header">
          <a-select v-model:value="model" style="width: 200px">
            <a-select-option value="deepseek">DeepSeek</a-select-option>
            <a-select-option value="glm">GLM (智谱清言)</a-select-option>
            <a-select-option value="kimi">Kimi (月之暗面)</a-select-option>
            <a-select-option value="qwen">通义千问</a-select-option>
          </a-select>
          <a-tag color="blue">AI 对话</a-tag>
        </div>

        <div class="message-list" ref="messageList">
          <div
            v-for="(msg, i) in messages"
            :key="i"
            :class="['message', msg.role === 'user' ? 'message-user' : 'message-ai']"
          >
            <div class="message-avatar">
              <a-avatar :size="36" v-if="msg.role === 'user'">我</a-avatar>
              <a-avatar :size="36" v-else :style="{ background: '#1677ff' }">AI</a-avatar>
            </div>
            <div class="message-bubble">
              <div class="message-text">{{ msg.content }}</div>
              <div class="message-actions" v-if="msg.role === 'ai'">
                <a-rate v-model:value="msg.rating" :count="5" size="small" @change="onRate(msg, $event)" />
                <a-button size="small" type="link" @click="onSubmitCase(msg)">提交为案例</a-button>
              </div>
            </div>
          </div>

          <div v-if="sending" class="message message-ai">
            <a-avatar :size="36" :style="{ background: '#1677ff' }">AI</a-avatar>
            <div class="message-bubble">
              <a-spin size="small" /> 思考中...
            </div>
          </div>
        </div>

        <div class="chat-input">
          <a-textarea
            v-model:value="input"
            :rows="3"
            placeholder="输入你的问题，试试 AI 能不能回答..."
            @press-enter.prevent="onSend"
          />
          <a-button type="primary" :loading="sending" @click="onSend" style="margin-top: 8px">
            发送
          </a-button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AppLayout from '../../components/layout/AppLayout.vue'
import { sendMessage } from '../../api/chat'

const router = useRouter()
const model = ref('deepseek')
const input = ref('')
const sending = ref(false)
const messages = ref([])
const messageList = ref(null)

async function onSend() {
  const text = input.value.trim()
  if (!text || sending.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  sending.value = true
  await scrollToBottom()

  try {
    const res = await sendMessage({ model: model.value, prompt: text })
    messages.value.push({ role: 'ai', content: res.data.reply, rating: 0 })
  } catch {
    messages.value.push({ role: 'ai', content: '请求失败，请重试', rating: 0 })
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

function onRate(msg, value) {
  msg.rating = value
  if (value <= 3) {
    message.info('已标记为低满意度回答，可在"提交案例"中记录')
  }
}

function onSubmitCase(msg) {
  router.push({
    path: '/submit',
    query: {
      prompt: messages.value.find(m => m.role === 'user' && messages.value.indexOf(m) < messages.value.indexOf(msg))?.content || '',
      aiAnswer: msg.content,
      model: model.value,
    },
  })
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-page {
  height: 100%;
}

.chat-container {
  max-width: 900px;
  margin: 0 auto;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px - 70px - 48px);
}

.chat-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.message-user {
  flex-direction: row-reverse;
}

.message-bubble {
  max-width: 70%;
}

.message-text {
  padding: 12px 16px;
  border-radius: 8px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.message-user .message-text {
  background: #1677ff;
  color: #fff;
}

.message-ai .message-text {
  background: #f0f2f5;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.chat-input {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  text-align: right;
}
</style>
