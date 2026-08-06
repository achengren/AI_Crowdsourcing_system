<template>
  <section class="discussion-board">
    <header class="board-heading">
      <div>
        <span>ANNOTATION DISCUSSION</span>
        <h3>批注讨论</h3>
        <p>每条批注都是一项独立观点，可以投票、评论或回复评论。</p>
      </div>
      <strong>{{ annotations.length }} 条批注</strong>
    </header>

    <a-empty v-if="!annotations.length" description="暂无批注，先在上方选择原文补充第一条批注" />

    <div v-else class="annotation-feed">
      <article v-for="(annotation, index) in annotations" :key="annotation.id" class="annotation-post">
        <header class="post-heading">
          <div class="post-identity">
            <span class="post-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <div><strong>{{ annotation.author || '案例作者' }}</strong><small>提出了一条批注</small></div>
          </div>
          <a-tag color="red">{{ optionLabel(ERROR_TYPE_OPTIONS, annotation.issueType) }}</a-tag>
        </header>

        <blockquote>“{{ annotation.selectedText }}”</blockquote>
        <p class="annotation-body">{{ annotation.comment }}</p>

        <div class="post-actions">
          <a-button type="text" :disabled="annotation.isOwn" :class="{ selected: annotation.userVote === 'agree' }" @click="$emit('vote', annotation, 'agree')">
            <CheckOutlined />赞成 {{ annotation.agreeCount || 0 }}
          </a-button>
          <a-button type="text" :disabled="annotation.isOwn" :class="{ selected: annotation.userVote === 'disagree' }" @click="$emit('vote', annotation, 'disagree')">
            <CloseOutlined />反对 {{ annotation.disagreeCount || 0 }}
          </a-button>
          <span><CommentOutlined />讨论 {{ annotation.commentCount || 0 }}</span>
          <a-popconfirm v-if="annotation.isOwn" title="撤回后将不再公开展示，但保留历史记录。确定撤回？" ok-text="撤回" cancel-text="取消" @confirm="$emit('withdraw', annotation)">
            <a-button type="text" danger><StopOutlined />撤回批注</a-button>
          </a-popconfirm>
        </div>

        <section class="comment-thread">
          <a-spin :spinning="threadFor(annotation).loading">
            <div v-if="threadFor(annotation).comments.length" class="comment-groups">
              <div v-for="comment in threadFor(annotation).comments" :key="comment.id" class="comment-group">
                <article class="comment-row root-comment" :class="{ deleted: comment.deleted }">
                  <div class="comment-main">
                    <header><strong>{{ comment.author }}</strong><time>{{ formatTime(comment.createdAt) }}</time></header>
                    <template v-if="editingCommentId === comment.id">
                      <a-textarea v-model:value="editingCommentText" :rows="2" :maxlength="4000" />
                      <div class="edit-actions"><a-button size="small" @click="cancelEdit">取消</a-button><a-button type="primary" size="small" :loading="mutating" @click="saveComment(annotation, comment)">保存</a-button></div>
                    </template>
                    <template v-else>
                      <p v-if="comment.deleted" class="deleted-copy">该评论已删除</p>
                      <p v-else>{{ visibleComment(comment) }}</p>
                      <div v-if="!comment.deleted" class="comment-actions">
                        <a-button type="link" size="small" @click="startReply(annotation, comment)"><CommentOutlined />回复</a-button>
                        <a-button v-if="String(comment.content || '').length > collapseLength" type="link" size="small" @click="toggleComment(comment.id)">{{ expandedComments.has(comment.id) ? '收起' : '展开全文' }}</a-button>
                        <a-button v-if="comment.canManage" type="link" size="small" @click="startEdit(comment)">编辑</a-button>
                        <a-popconfirm v-if="comment.canManage" title="确定删除这条评论？" ok-text="删除" cancel-text="取消" @confirm="removeComment(annotation, comment)"><a-button type="link" danger size="small">删除</a-button></a-popconfirm>
                      </div>
                    </template>
                  </div>
                </article>

                <div v-if="comment.replies?.length" class="reply-list">
                  <article v-for="reply in comment.replies" :key="reply.id" class="comment-row reply-comment" :class="{ deleted: reply.deleted }">
                    <div class="reply-line" aria-hidden="true"></div>
                    <div class="comment-main">
                      <header><strong>{{ reply.author }}</strong><span v-if="reply.replyToAuthor">回复 {{ reply.replyToAuthor }}</span><time>{{ formatTime(reply.createdAt) }}</time></header>
                      <template v-if="editingCommentId === reply.id">
                        <a-textarea v-model:value="editingCommentText" :rows="2" :maxlength="4000" />
                        <div class="edit-actions"><a-button size="small" @click="cancelEdit">取消</a-button><a-button type="primary" size="small" :loading="mutating" @click="saveComment(annotation, reply)">保存</a-button></div>
                      </template>
                      <template v-else>
                        <p v-if="reply.deleted" class="deleted-copy">该评论已删除</p>
                        <p v-else>{{ visibleComment(reply) }}</p>
                        <div v-if="!reply.deleted" class="comment-actions">
                          <a-button type="link" size="small" @click="startReply(annotation, reply)"><CommentOutlined />回复</a-button>
                          <a-button v-if="String(reply.content || '').length > collapseLength" type="link" size="small" @click="toggleComment(reply.id)">{{ expandedComments.has(reply.id) ? '收起' : '展开全文' }}</a-button>
                          <a-button v-if="reply.canManage" type="link" size="small" @click="startEdit(reply)">编辑</a-button>
                          <a-popconfirm v-if="reply.canManage" title="确定删除这条回复？" ok-text="删除" cancel-text="取消" @confirm="removeComment(annotation, reply)"><a-button type="link" danger size="small">删除</a-button></a-popconfirm>
                        </div>
                      </template>
                    </div>
                  </article>
                </div>

                <div v-if="threadFor(annotation).replyingTo && replyRootId(threadFor(annotation).replyingTo) === comment.id" class="reply-composer">
                  <div class="replying-label">回复 {{ threadFor(annotation).replyingTo.author }}<a-button type="link" size="small" @click="cancelReply(annotation)">取消</a-button></div>
                  <div class="composer-row"><a-textarea v-model:value="threadFor(annotation).replyDraft" :rows="2" :maxlength="4000" :placeholder="`回复 ${threadFor(annotation).replyingTo.author}`" /><a-button type="primary" :loading="threadFor(annotation).replySending" @click="sendReply(annotation)"><SendOutlined /></a-button></div>
                </div>
              </div>
            </div>
            <div v-else-if="!threadFor(annotation).loading" class="empty-thread">暂无评论，欢迎补充你的判断</div>
          </a-spin>

          <div class="root-composer">
            <a-textarea v-model:value="threadFor(annotation).draft" :rows="2" :maxlength="4000" placeholder="评论这条批注" />
            <a-button type="primary" :loading="threadFor(annotation).sending" title="发送评论" @click="sendComment(annotation)"><SendOutlined /></a-button>
          </div>
        </section>
      </article>
    </div>
  </section>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined, CommentOutlined, SendOutlined, StopOutlined } from '@ant-design/icons-vue'
import { addAnnotationComment, deleteAnnotationComment, getAnnotationComments, updateAnnotationComment } from '../../api/submission'
import { ERROR_TYPE_OPTIONS, optionLabel } from '../../constants/options'

const props = defineProps({
  caseId: { type: String, required: true },
  annotations: { type: Array, default: () => [] },
})
const emit = defineEmits(['vote', 'withdraw', 'comment-count-change'])
const threads = reactive({})
const expandedComments = reactive(new Set())
const collapseLength = 220
const editingCommentId = ref('')
const editingCommentText = ref('')
const mutating = ref(false)

function threadFor(annotation) {
  if (!threads[annotation.id]) threads[annotation.id] = { comments: [], loading: false, sending: false, draft: '', replyingTo: null, replyDraft: '', replySending: false }
  return threads[annotation.id]
}

async function loadThread(annotation) {
  const caseId = props.caseId
  const thread = threadFor(annotation)
  thread.loading = true
  try {
    const response = await getAnnotationComments(caseId, annotation.id)
    if (props.caseId === caseId) thread.comments = response.data || []
  } catch {
    if (props.caseId === caseId) thread.comments = []
  } finally { thread.loading = false }
}

watch(
  () => `${props.caseId}:${props.annotations.map(item => item.id).join(',')}`,
  async () => {
    Object.keys(threads).forEach(id => { if (!props.annotations.some(item => item.id === id)) delete threads[id] })
    await Promise.allSettled(props.annotations.map(loadThread))
  },
  { immediate: true },
)

function visibleComment(comment) {
  const content = String(comment.content || '')
  return expandedComments.has(comment.id) || content.length <= collapseLength ? content : `${content.slice(0, collapseLength)}...`
}
function toggleComment(id) { expandedComments.has(id) ? expandedComments.delete(id) : expandedComments.add(id) }
function replyRootId(comment) { return comment.rootCommentId || comment.id }
function formatTime(value) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '' }

async function sendComment(annotation) {
  const thread = threadFor(annotation)
  const content = thread.draft.trim()
  if (!content) return
  thread.sending = true
  try {
    await addAnnotationComment(props.caseId, annotation.id, { content })
    thread.draft = ''
    emit('comment-count-change', annotation, 1)
    await loadThread(annotation)
  } finally { thread.sending = false }
}

function startReply(annotation, comment) {
  const thread = threadFor(annotation)
  thread.replyingTo = comment
  thread.replyDraft = ''
  cancelEdit()
}
function cancelReply(annotation) { const thread = threadFor(annotation); thread.replyingTo = null; thread.replyDraft = '' }
async function sendReply(annotation) {
  const thread = threadFor(annotation)
  const content = thread.replyDraft.trim()
  if (!content || !thread.replyingTo) return
  thread.replySending = true
  try {
    await addAnnotationComment(props.caseId, annotation.id, { content, parentCommentId: thread.replyingTo.id })
    thread.replyingTo = null
    thread.replyDraft = ''
    emit('comment-count-change', annotation, 1)
    await loadThread(annotation)
  } finally { thread.replySending = false }
}

function startEdit(comment) { editingCommentId.value = comment.id; editingCommentText.value = comment.content }
function cancelEdit() { editingCommentId.value = ''; editingCommentText.value = '' }
async function saveComment(annotation, comment) {
  const content = editingCommentText.value.trim()
  if (!content) return message.warning('评论内容不能为空')
  mutating.value = true
  try {
    const response = await updateAnnotationComment(props.caseId, annotation.id, comment.id, { content })
    comment.content = response.data.content
    cancelEdit()
    message.success('评论已更新')
  } finally { mutating.value = false }
}
async function removeComment(annotation, comment) {
  mutating.value = true
  try {
    await deleteAnnotationComment(props.caseId, annotation.id, comment.id)
    expandedComments.delete(comment.id)
    cancelEdit()
    emit('comment-count-change', annotation, -1)
    await loadThread(annotation)
    message.success('评论已删除')
  } finally { mutating.value = false }
}
</script>

<style scoped>
.discussion-board { margin-top: 26px; border-top: 2px solid var(--hib-text); }
.board-heading { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; padding: 18px 2px; border-bottom: 1px solid var(--hib-line); }
.board-heading span { color: var(--hib-red); font-size: 10px; }
.board-heading h3 { margin: 3px 0 2px; font-size: 20px; }
.board-heading p { margin: 0; color: var(--hib-muted); font-size: 13px; }
.board-heading > strong { color: var(--hib-muted); font-size: 13px; font-weight: 500; }
.annotation-feed { display: grid; }
.annotation-post { padding: 24px 2px 28px; border-bottom: 1px solid var(--hib-line); }
.post-heading, .post-identity, .post-actions, .comment-row header, .comment-actions { display: flex; align-items: center; }
.post-heading { justify-content: space-between; gap: 16px; }
.post-identity { gap: 12px; }
.post-index { color: var(--hib-red); font-family: Georgia, serif; font-size: 24px; }
.post-identity strong, .post-identity small { display: block; }
.post-identity small { margin-top: 2px; color: var(--hib-muted); font-size: 11px; }
.annotation-post blockquote { margin: 16px 0 9px; padding: 11px 14px; border-left: 3px solid var(--hib-red); background: #faf6f6; color: #51484a; font-family: "Noto Serif SC", "Songti SC", serif; line-height: 1.7; }
.annotation-body { margin: 0; color: var(--hib-text); line-height: 1.7; }
.post-actions { gap: 3px; margin-top: 12px; }
.post-actions :deep(.ant-btn) { color: var(--hib-muted); }
.post-actions :deep(.ant-btn.selected) { color: var(--hib-red); background: var(--hib-red-soft); }
.post-actions > span { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; color: var(--hib-muted); font-size: 13px; }
.comment-thread { margin: 16px 0 0 42px; padding: 14px 16px 16px; border-left: 2px solid #e4d7d9; background: #faf9f9; }
.comment-groups { display: grid; gap: 11px; }
.comment-group { border-bottom: 1px solid #ebe5e6; padding-bottom: 10px; }
.comment-row { position: relative; gap: 10px; padding: 7px 0; }
.comment-main { min-width: 0; flex: 1; }
.comment-row header { gap: 8px; min-height: 24px; }
.comment-row header strong { font-size: 13px; }
.comment-row header span { color: var(--hib-red); font-size: 12px; }
.comment-row time { margin-left: auto; color: var(--hib-muted); font-size: 11px; }
.comment-row p { margin: 4px 0 0; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.reply-list { margin-left: 28px; }
.reply-comment { padding-left: 16px; }
.reply-line { position: absolute; top: 0; bottom: 0; left: 0; width: 1px; background: #dfd4d6; }
.deleted-copy { color: var(--hib-muted); font-style: italic; }
.comment-actions { gap: 2px; margin-top: 2px; }
.comment-actions :deep(.ant-btn) { height: 25px; padding: 0 5px; font-size: 12px; }
.edit-actions { display: flex; justify-content: flex-end; gap: 7px; margin-top: 7px; }
.root-composer, .composer-row { display: grid; grid-template-columns: minmax(0, 1fr) 40px; align-items: end; gap: 8px; }
.root-composer { margin-top: 12px; }
.root-composer :deep(.ant-btn), .composer-row :deep(.ant-btn) { width: 40px; height: 40px; padding: 0; }
.reply-composer { margin: 8px 0 4px 28px; padding: 9px 10px; border-left: 2px solid var(--hib-red); background: #fff; }
.replying-label { display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px; color: var(--hib-muted); font-size: 12px; }
.empty-thread { padding: 4px 0; color: var(--hib-muted); font-size: 12px; }
@media (max-width: 760px) { .comment-thread { margin-left: 0; } .board-heading { align-items: flex-start; flex-direction: column; } .post-actions { align-items: flex-start; flex-wrap: wrap; } .reply-list, .reply-composer { margin-left: 12px; } }
</style>
