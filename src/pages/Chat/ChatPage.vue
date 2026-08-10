<template>
  <div class="chat-page">
    <ConversationSidebar />

    <div class="chat-main">
      <header class="workspace-header">
        <div><span>AI CONVERSATION</span><h1>AI 对话</h1></div>
      </header>
      <div class="message-list" ref="messageList">
        <div v-if="!messages.length && !sending" class="welcome">
          <h2>有什么可以帮助你的？</h2>
        </div>

        <div
          v-for="(msg, i) in messages"
          :key="msg.id || i"
          :class="['message', msg.role === 'user' ? 'message-user' : 'message-ai']"
        >
          <div class="message-body">
            <div class="message-text" v-if="msg.role === 'user'">
              <img v-if="msg.imageUrl" :src="msg.imageUrl" class="msg-image" @click="previewImage = msg.imageUrl" />
              <div v-if="msg.content">{{ msg.content }}</div>
            </div>
            <div class="message-text markdown-body" v-else v-html="renderMd(msg.content)"></div>
            <div class="message-actions" v-if="msg.role === 'ai' && msg.id">
              <a-tag v-if="msg.model" color="default">{{ msg.model }}</a-tag>
              <span class="rating-label">回答满意度</span>
              <a-tooltip title="1 星表示非常不满意，5 星表示非常满意。评分只用于课程分析，不影响案例提交。">
                <QuestionCircleOutlined class="rating-help" />
              </a-tooltip>
              <a-rate v-model:value="msg.rating" :count="5" :allow-clear="false" :disabled="msg.ratingSaving" size="small" @change="onRate(msg, $event)" />
              <template v-if="msg.qualityFlag && msg.qualityFlag.isLowQuality">
                <a-tag color="warning" class="quality-tag">
                  <ExclamationCircleOutlined /> 可能存在信息缺失
                </a-tag>
                <a-button size="small" type="primary" ghost @click="onSubmitCase(msg, i)">
                  <UploadOutlined /> 标注并提交
                </a-button>
                <a-popover title="改进建议" trigger="click" placement="bottomLeft">
                  <template #content>
                    <div v-if="msg.solutionLoading" style="padding: 12px; text-align: center;">
                      <a-spin size="small" /> 生成中...
                    </div>
                    <div v-else-if="msg.solutionSuggestion" class="solution-popover-md" style="max-width: 360px; font-size: 13px;" v-html="renderMd(msg.solutionSuggestion)"></div>
                    <div v-else style="color: #999;">点击加载改进建议</div>
                  </template>
                  <a-button size="small" type="link" :loading="msg.solutionLoading" @click="onGetSuggestion(msg, i)">
                    <BulbOutlined /> 如何改进
                  </a-button>
                </a-popover>
              </template>
              <template v-else>
                <a-button size="small" type="link" @click="onSubmitCase(msg, i)">标注并提交</a-button>
              </template>
            </div>
          </div>
        </div>

        <div v-if="sending" class="message message-ai">
          <div class="message-body">
            <a-spin size="small" /> {{ requestStage === 'vision' ? '正在读取图片…' : '正在生成回答…' }}
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
            @compositionstart="isComposing = true"
            @compositionend="isComposing = false"
            @paste="onPaste"
          />
          <a-button type="primary" :loading="sending" @click="onSend" class="send-btn">
            <SendOutlined />
          </a-button>
        </div>
      </div>
    </div>
  </div>

  <!-- 图片预览 -->
  <a-modal
    :open="!!previewImage"
    :footer="null"
    :title="null"
    width="auto"
    centered
    @cancel="previewImage = ''"
  >
    <img :src="previewImage" style="max-width: 80vw; max-height: 80vh; display: block" />
  </a-modal>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, onActivated, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { SendOutlined, PictureOutlined, CloseOutlined, ExclamationCircleOutlined, UploadOutlined, BulbOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
import ConversationSidebar from '../../components/common/ConversationSidebar.vue'
import { sendMessage, getConversations, getMessages, getSolutionSuggestion, rateMessage } from '../../api/chat'
import { uploadImage } from '../../api/submission'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github-dark.css'

const router = useRouter()
const route = useRoute()
const input = ref('')
const sending = ref(false)
const requestStage = ref('answer')
let stageTimer = null
const uploading = ref(false)
const imageUrl = ref('')
const previewImage = ref('')
const messages = ref([])
const messageList = ref(null)
const activeConvId = ref(null)
const fileInput = ref(null)
const isComposing = ref(false)
let loadToken = 0
let conversationGeneration = 0

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
  if (stageTimer) clearTimeout(stageTimer)
})

watch(() => route.query.conv, async (convId) => {
  if (convId && convId !== activeConvId.value) await loadConversation(convId)
})

onActivated(() => {
  const convId = route.query.conv
  if (!convId && activeConvId.value) {
    onNewChat()
  }
})

async function loadConversation(convId) {
  const token = ++loadToken
  conversationGeneration += 1
  activeConvId.value = convId
  try {
    const res = await getMessages(convId)
    if (token !== loadToken) return
    messages.value = res.data.map(m => {
      const parsed = parseMsgContent(m.content)
      return {
        id: m.id,
        role: m.role === 'assistant' ? 'ai' : 'user',
        content: parsed.text,
        imageUrl: parsed.imageUrl,
        rating: Number(m.rating || 0),
        savedRating: Number(m.rating || 0),
        qualityFlag: m.qualityFlag || null,
        provider: m.provider,
        model: m.model,
        modality: m.modality,
      }
    })
  } catch {
    messages.value = []
  }
  await scrollToBottom()
}

function onNewChat() {
  loadToken += 1
  conversationGeneration += 1
  activeConvId.value = null
  messages.value = []
  input.value = ''
  router.replace({ query: {} })
}

function onEnterPress(e) {
  if (!e.shiftKey && !isComposing.value) {
    e.preventDefault()
    onSend()
  }
}

async function onSend() {
  const text = input.value.trim()
  const img = imageUrl.value
  if ((!text && !img) || sending.value) return

  const targetConvId = activeConvId.value
  const targetGeneration = conversationGeneration
  messages.value.push({ role: 'user', content: text, imageUrl: img })
  input.value = ''
  imageUrl.value = ''
  sending.value = true
  requestStage.value = img ? 'vision' : 'answer'
  if (stageTimer) clearTimeout(stageTimer)
  if (img) stageTimer = setTimeout(() => { requestStage.value = 'answer' }, 2500)
  await scrollToBottom()

  try {
    const res = await sendMessage({ prompt: text, conversationId: targetConvId, imageUrl: img })
    if (targetGeneration !== conversationGeneration || activeConvId.value !== targetConvId) return
    messages.value.push({
      id: res.data.messageId,
      role: 'ai',
      content: res.data.reply,
      rating: 0,
      savedRating: 0,
      provider: res.data.provider,
      model: res.data.model,
      modality: res.data.modality,
    })

    if (!targetConvId) {
      activeConvId.value = res.data.conversationId
      router.replace({ query: { conv: res.data.conversationId } })
    }
  } catch (error) {
    if (targetGeneration !== conversationGeneration || activeConvId.value !== targetConvId) return
    const stage = error.response?.data?.stage
    messages.value.push({ role: 'ai', content: stage === 'vision' ? '图片识别失败，请重试' : '回答生成失败，请重试', rating: 0 })
  } finally {
    if (stageTimer) clearTimeout(stageTimer)
    stageTimer = null
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

async function onPaste(e) {
  const file = e.clipboardData?.files?.[0]
  if (!file?.type?.startsWith('image/')) return
  e.preventDefault()
  uploading.value = true
  try {
    const res = await uploadImage(file)
    imageUrl.value = res.data.url
    message.success('图片已粘贴')
  } catch {
    message.error('图片上传失败')
  } finally {
    uploading.value = false
  }
}

function parseMsgContent(raw) {
  const m = raw.match(/^\[image:(.+?)\]\n/)
  if (m) {
    return { imageUrl: m[1], text: raw.slice(m[0].length) }
  }
  return { imageUrl: '', text: raw }
}

async function onRate(msg, value) {
  const previous = Number(msg.savedRating || 0)
  msg.rating = value
  msg.ratingSaving = true
  try {
    await rateMessage(activeConvId.value, msg.id, value)
    msg.savedRating = value
    message.success('满意度已保存')
  } catch (error) {
    msg.rating = previous
    message.error(error.response?.data?.message || '评分保存失败')
  } finally {
    msg.ratingSaving = false
  }
}

function onSubmitCase(aiMsg, aiIndex) {
  let userContent = ''
  let userImageUrl = ''
  for (let i = aiIndex - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userContent = messages.value[i].content
      userImageUrl = messages.value[i].imageUrl || ''
      break
    }
  }
  const query = aiMsg.id
    ? { messageId: aiMsg.id }
    : { prompt: userContent, aiAnswer: aiMsg.content }
  if (userImageUrl) query.imageUrl = userImageUrl
  router.push({ path: '/cases/new', query })
}

async function onGetSuggestion(aiMsg, aiIndex) {
  let userContent = ''
  for (let i = aiIndex - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      userContent = messages.value[i].content
      break
    }
  }
  messages.value[aiIndex] = { ...aiMsg, solutionLoading: true }
  try {
    const res = await getSolutionSuggestion(userContent, aiMsg.content)
    messages.value[aiIndex] = { ...aiMsg, solutionSuggestion: res.data.suggestion, solutionLoading: false }
  } catch {
    messages.value[aiIndex] = { ...aiMsg, solutionSuggestion: '生成失败，请重试', solutionLoading: false }
  }
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
  background: var(--hib-paper);
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--hib-paper);
}

.workspace-header { min-height: 92px; display: flex; align-items: end; padding: 24px 34px 18px; border-bottom: 1px solid var(--hib-line); background: rgba(255,255,255,.55); }
.workspace-header span { color: var(--hib-red); font-size: 11px; }
.workspace-header h1 { margin: 5px 0 0; font-size: 25px; line-height: 1.2; }

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
  background: var(--hib-red-soft);
  color: var(--hib-text);
  white-space: pre-wrap;
}

.message-ai .message-text {
  background: var(--hib-surface);
  color: var(--hib-text);
  border: 1px solid var(--hib-line);
  line-height: 1.5;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.quality-tag {
  font-size: 12px;
  line-height: 20px;
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
  border: 1px solid var(--hib-line);
  border-radius: 7px;
  padding: 8px 16px;
  background: #fff;
  box-shadow: 0 5px 18px rgba(55, 39, 42, .05);
  transition: border-color 0.2s;
}

.chat-input-inner:focus-within {
  border-color: var(--hib-red);
  box-shadow: 0 0 0 3px rgba(173, 70, 82, 0.1), 0 7px 20px rgba(55, 39, 42, .06);
}
.rating-label { margin-left: 2px; color: var(--hib-muted); font-size: 12px; }
.rating-help { color: #9aa09c; cursor: help; }

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
  border-left: 3px solid var(--hib-red);
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

.img-btn:hover { color: var(--hib-red); }

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

@media (max-width: 760px) {
  .chat-main { padding-top: 56px; }
  .workspace-header { min-height: 74px; padding: 16px 14px 14px; }
  .workspace-header h1 { font-size: 21px; }
  .message-list { padding-top: 16px; }
  .message { padding: 0 14px; }
  .chat-input-area { padding: 10px 12px 14px; }
  .chat-input-inner { padding-inline: 12px; }
}
</style>

<style>
.solution-popover-md h1 { font-size: 1.1em; margin: 0.4em 0 0.2em; }
.solution-popover-md h2 { font-size: 1em; margin: 0.3em 0 0.15em; }
.solution-popover-md h3 { font-size: 0.95em; margin: 0.25em 0 0.1em; }
.solution-popover-md p { margin: 0.2em 0; }
.solution-popover-md ul, .solution-popover-md ol { padding-left: 1.2em; margin: 0.15em 0; }
.solution-popover-md li { margin: 0.05em 0; }
.solution-popover-md code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
.solution-popover-md strong { font-weight: 600; }
</style>
