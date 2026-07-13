<template>
  <div class="chat-page">
    <ConversationSidebar />

    <div class="chat-main">
      <div class="message-list" ref="messageList">
        <div v-if="!messages.length && !sending" class="welcome">
          <h2>有什么可以帮助你的？</h2>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="i"
          :class="['message', msg.role === 'user' ? 'message-user' : 'message-ai']"
        >
          <div class="message-body">
            <div class="message-text" v-if="msg.role === 'user'">
              <img v-if="msg.imageUrl" :src="msg.imageUrl" class="msg-image" @click="previewImage = msg.imageUrl" />
              <div v-if="msg.content">{{ msg.content }}</div>
            </div>
            <div class="message-text markdown-body" v-else v-html="renderMd(msg.content)"></div>
            <div class="message-actions" v-if="msg.role === 'ai'">
              <a-rate v-model:value="msg.rating" :count="5" size="small" @change="onRate(msg, $event)" />
              <a-button size="small" type="link" @click="onSubmitCase(msg, i)">提交为案例</a-button>
            </div>
          </div>
        </div>

        <div v-if="sending" class="message message-ai">
          <div class="message-body">
            <a-spin size="small" /> 思考中...
          </div>
        </div>
      </div>

      <div class="chat-input-area">
        <div class="image-preview-bar" v-if="imageUrl">
          <div class="preview-thumb">
            <img :src="imageUrl" />
            <CloseOutlined class="remove-btn" @click="imageUrl = ''" />
          </div>
        </div>
        <div class="chat-input-inner">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            style="display:none"
            @change="onFileChange"
          />
          <a-button
            type="text"
            :loading="uploading"
            @click="fileInput.click()"
            class="img-btn"
          >
            <PictureOutlined />
          </a-button>
          <a-textarea
            v-model:value="input"
            :rows="1"
            placeholder="发送消息..."
            :auto-size="{ minRows: 1, maxRows: 6 }"
            @press-enter="onEnterPress"
          />
          <a-button type="primary" :loading="sending" @click="onSend" class="send-btn">
            <SendOutlined />
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { SendOutlined, PictureOutlined, CloseOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { sendMessage, getConversations, getMessages } from '../../api/chat'
import { uploadImage } from '../../api/submission'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

const router = useRouter()
const route = useRoute()
const input = ref('')
const sending = ref(false)
const uploading = ref(false)
const imageUrl = ref('')
const previewImage = ref('')
const messages = ref([])
const messageList = ref(null)
const activeConvId = ref(null)
const fileInput = ref(null)

onMounted(async () => {
  // 监听侧边栏的"新建对话"事件
  window.addEventListener('new-chat', onNewChat)

  // 从 query 加载指定会话
  const convId = route.query.conv
  if (convId) {
    await loadConversation(convId)
  } else {
    try {
      const res = await getConversations()
      if (res.data.length > 0) {
        await loadConversation(res.data[0].id)
      }
    } catch { /* ignore */ }
  }
})

onUnmounted(() => {
  window.removeEventListener('new-chat', onNewChat)
})

watch(() => route.query.conv, async (convId) => {
  if (convId) await loadConversation(convId)
})

async function loadConversation(convId) {
  activeConvId.value = convId
  try {
    const res = await getMessages(convId)
    messages.value = res.data.map(m => {
      const parsed = parseMsgContent(m.content)
      return {
        role: m.role === 'assistant' ? 'ai' : 'user',
        content: parsed.text,
        imageUrl: parsed.imageUrl,
        rating: 0,
      }
    })
  } catch {
    messages.value = []
  }
  await scrollToBottom()
}

function onNewChat() {
  activeConvId.value = null
  messages.value = []
  input.value = ''
  router.replace({ query: {} })
}

function onEnterPress(e) {
  if (!e.shiftKey) {
    e.preventDefault()
    onSend()
  }
}

async function onSend() {
  const text = input.value.trim()
  const img = imageUrl.value
  if ((!text && !img) || sending.value) return

  messages.value.push({ role: 'user', content: text, imageUrl: img })
  input.value = ''
  imageUrl.value = ''
  sending.value = true
  await scrollToBottom()

  try {
    const res = await sendMessage({ prompt: text, conversationId: activeConvId.value, imageUrl: img })
    messages.value.push({ role: 'ai', content: res.data.reply, rating: 0 })

    if (!activeConvId.value) {
      activeConvId.value = res.data.conversationId
      router.replace({ query: { conv: res.data.conversationId } })
    }
  } catch {
    messages.value.push({ role: 'ai', content: '请求失败，请重试', rating: 0 })
  } finally {
    sending.value = false
    await scrollToBottom()
  }
}

async function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const res = await uploadImage(file)
    imageUrl.value = res.data.url
  } catch {
    message.error('图片上传失败')
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

function parseMsgContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: '', text: raw }
}

function onRate(msg, value) {
  msg.rating = value
  if (value <= 3) {
    message.info('已标记为低满意度回答，可在"提交案例"中记录')
  }
}

function onSubmitCase(aiMsg, aiIndex) {
  let userContent = ''
  for (let i = aiIndex - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userContent = messages.value[i].content
      break
    }
  }
  router.push({ path: '/gallery', query: { submit: '1', prompt: userContent, aiAnswer: aiMsg.content } })
}

function renderMd(text) {
  return DOMPurify.sanitize(marked(text || ''))
}

async function scrollToBottom() {
  await nextTick()
  if (messageList.value) {
    messageList.value.querySelectorAll('pre code').forEach(el => {
      hljs.highlightElement(el)
    })
    messageList.value.scrollTop = messageList.value.scrollHeight
  }
}
</script>

<style scoped>
.chat-page {
  display: flex;
  height: 100vh;
  background: #fff;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
}

.welcome {
  text-align: center;
  margin-top: 20vh;
}

.welcome h2 {
  font-size: 22px;
  color: #333;
  font-weight: 500;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 0;
}

.message {
  display: flex;
  gap: 12px;
  padding: 0 24px;
  margin-bottom: 24px;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}

.message-user {
  flex-direction: row-reverse;
}

.message-body {
  min-width: 0;
}

.message-text {
  padding: 12px 16px;
  border-radius: 12px;
  line-height: 1.6;
  word-break: break-word;
}

.message-user .message-text {
  background: rgba(82, 196, 26, 0.15);
  color: #333;
  white-space: pre-wrap;
}

.message-ai .message-text {
  background: #f3f4f6;
  color: #111;
  line-height: 1.5;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.chat-input-area {
  padding: 16px 24px 24px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.chat-input-inner {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  padding: 8px 16px;
  transition: border-color 0.2s;
}

.chat-input-inner:focus-within {
  border-color: #1677ff;
  box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1);
}

.chat-input-inner :deep(.ant-input) {
  border: none !important;
  box-shadow: none !important;
  background: transparent !important;
  resize: none;
  font-size: 15px;
  padding: 4px 0;
}

.chat-input-inner :deep(.ant-input):focus {
  box-shadow: none !important;
}

.send-btn {
  flex-shrink: 0;
}

/* Markdown */
.markdown-body :deep(h1) { font-size: 1.3em; margin: 0.5em 0 0.25em; }
.markdown-body :deep(h2) { font-size: 1.15em; margin: 0.5em 0 0.25em; }
.markdown-body :deep(h3) { font-size: 1.05em; margin: 0.4em 0 0.2em; }
.markdown-body :deep(p) { margin: 0.3em 0; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 1.5em; margin: 0.25em 0; }
.markdown-body :deep(li) { margin: 0.1em 0; }
.markdown-body :deep(code) {
  background: rgba(0, 0, 0, 0.06);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}
.markdown-body :deep(pre) {
  background: #1e1e1e;
  padding: 16px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 0.5em 0;
}
.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}
.markdown-body :deep(strong) { font-weight: 600; }
.markdown-body :deep(blockquote) {
  border-left: 3px solid #1677ff;
  padding-left: 12px;
  margin: 0.5em 0;
  color: #666;
}
.markdown-body :deep(table) { border-collapse: collapse; margin: 0.5em 0; }
.markdown-body :deep(th), .markdown-body :deep(td) {
  border: 1px solid #ddd;
  padding: 6px 12px;
  text-align: left;
}
.markdown-body :deep(th) { background: #f5f5f5; font-weight: 600; }

.img-btn {
  flex-shrink: 0;
  font-size: 20px;
  color: #8c8c8c;
  padding: 0 4px;
  height: auto;
}

.img-btn:hover { color: #1677ff; }

.image-preview-bar {
  display: flex;
  padding: 0 16px 8px;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.preview-thumb {
  position: relative;
  display: inline-block;
}

.preview-thumb img {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.preview-thumb .remove-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 12px;
  background: #333;
  color: #fff;
  border-radius: 50%;
  padding: 2px;
  cursor: pointer;
}

.msg-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  display: block;
  border: 1px solid #e5e7eb;
}
</style>
