<template>
  <div class="annotation-editor" :class="{ readonly, discussion, 'composer-only': composerOnly }">
    <div class="annotation-layout">
      <div class="answer-pane">
        <div class="pane-heading">
          <span>AI 回复原文</span>
          <span v-if="canAnnotate" class="selection-state">{{ selectionText ? '已选择文本' : '选择有问题的语句' }}</span>
        </div>
        <div ref="textRef" class="answer-text" @mouseup="captureSelection">
          <template v-for="(segment, index) in segments" :key="index">
            <mark
              v-if="segment.annotation"
              :class="['highlight', segment.annotation.source, { interactive: discussion, active: segment.annotation.id === activeAnnotationId }]"
              :title="segment.annotation.comment"
              @click.stop="selectAnnotation(segment.annotation)"
            >
              {{ segment.text }}
            </mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </div>
      </div>

      <aside class="comment-pane">
        <div class="pane-heading">
          <span>{{ composerOnly ? '添加批注' : '批注' }}</span>
          <a-badge v-if="!composerOnly" :count="modelValue.length" show-zero />
        </div>

        <div v-if="canAnnotate" :class="['comment-form', { empty: !selectionText }]">
          <blockquote>{{ selectionText || '尚未选择片段' }}</blockquote>
          <a-select v-model:value="draft.issueType" placeholder="本条批注的错误类型" style="width: 100%" :disabled="!selectionText">
            <a-select-option v-for="type in ISSUE_TYPES" :key="type.value" :value="type.value">{{ type.label }}</a-select-option>
          </a-select>
          <a-textarea v-model:value="draft.comment" :rows="3" placeholder="说明这段内容存在什么问题" :disabled="!selectionText" />
          <a-alert
            :type="collaborative ? 'warning' : 'info'"
            show-icon
            :message="collaborative
              ? '批注提交后立即公开且不可修改，请确认所选原文、错误类型和说明准确。'
              : '发布前可删除并重新添加批注；案例发布后不可修改，请在发布前核对。'"
          />
          <a-space>
            <a-button type="primary" size="small" :loading="creating" :disabled="!selectionText" @click="addAnnotation">添加批注</a-button>
            <a-button size="small" :disabled="!selectionText" @click="clearSelection">取消</a-button>
          </a-space>
        </div>

        <div v-if="!composerOnly" class="comment-list">
          <div v-for="(item, index) in sortedAnnotations" :key="item.id || `${item.startOffset}-${index}`" class="comment-item">
            <div class="comment-meta">
              <a-tag :color="item.source === 'ai' ? 'gold' : 'blue'">{{ item.source === 'ai' ? 'AI 候选' : '人工批注' }}</a-tag>
              <strong>{{ issueTypeLabel(item.issueType) }}</strong>
              <a-tag v-if="item.status === 'withdrawn'">已撤回</a-tag>
              <span v-if="item.author" class="author">{{ item.author }}</span>
              <a-button v-if="!readonly && !collaborative" type="text" danger size="small" @click="removeAnnotation(item)">
                <DeleteOutlined />
              </a-button>
            </div>
            <div class="quote">“{{ item.selectedText }}”</div>
            <div class="comment">{{ item.comment }}</div>
            <div v-if="discussion || (allowWithdraw && item.status !== 'withdrawn')" class="annotation-actions">
              <a-button v-if="discussion" type="text" size="small" :disabled="item.isOwn" :title="item.isOwn ? '不能为自己的批注投票' : '赞成这条批注'" :class="{ agree: item.userVote === 'agree' }" @click="vote(item, 'agree')">
                <CheckOutlined />赞成 {{ item.agreeCount || 0 }}
              </a-button>
              <a-button v-if="discussion" type="text" size="small" :disabled="item.isOwn" :title="item.isOwn ? '不能为自己的批注投票' : '反对这条批注'" :class="{ disagree: item.userVote === 'disagree' }" @click="vote(item, 'disagree')">
                <CloseOutlined />反对 {{ item.disagreeCount || 0 }}
              </a-button>
              <span v-if="discussion" class="comment-count"><CommentOutlined />评论 {{ item.commentCount || 0 }}</span>
              <a-popconfirm v-if="item.isOwn || allowWithdraw" title="撤回后将不再公开展示，且保留历史记录。确定撤回？" ok-text="撤回" cancel-text="取消" @confirm="withdraw(item)">
                <a-button type="text" danger size="small"><StopOutlined />撤回</a-button>
              </a-popconfirm>
            </div>
            <slot v-if="discussion" name="discussion" :annotation="item"></slot>
          </div>
          <a-empty v-if="!modelValue.length" :description="canAnnotate ? '选择左侧文本开始批注' : '暂无片段批注'" />
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { CheckOutlined, CloseOutlined, CommentOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons-vue'
import { ISSUE_TYPES } from '../../constants/options'
import { optionLabel } from '../../constants/options'

const props = defineProps({
  text: { type: String, default: '' },
  modelValue: { type: Array, default: () => [] },
  readonly: { type: Boolean, default: false },
  collaborative: { type: Boolean, default: false },
  discussion: { type: Boolean, default: false },
  composerOnly: { type: Boolean, default: false },
  creating: { type: Boolean, default: false },
  activeAnnotationId: { type: String, default: '' },
  allowWithdraw: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue', 'create-annotation', 'vote', 'withdraw', 'select-annotation', 'selection-change'])
const textRef = ref()
const selectionText = ref('')
const selectionRange = ref(null)
const draft = reactive({ issueType: undefined, comment: '' })
const canAnnotate = computed(() => !props.readonly || props.collaborative)
const issueTypeLabel = value => optionLabel(ISSUE_TYPES, value)

const sortedAnnotations = computed(() => [...props.modelValue].sort((a, b) => a.startOffset - b.startOffset))
const segments = computed(() => {
  const output = []
  let cursor = 0
  for (const item of sortedAnnotations.value) {
    const start = Math.max(cursor, item.startOffset)
    const end = Math.min(props.text.length, item.endOffset)
    if (start > cursor) output.push({ text: props.text.slice(cursor, start) })
    if (end > start) output.push({ text: props.text.slice(start, end), annotation: item })
    cursor = Math.max(cursor, end)
  }
  if (cursor < props.text.length) output.push({ text: props.text.slice(cursor) })
  return output
})

function captureSelection() {
  if (!canAnnotate.value) return
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!textRef.value?.contains(range.commonAncestorContainer)) return
  const before = document.createRange()
  before.selectNodeContents(textRef.value)
  before.setEnd(range.startContainer, range.startOffset)
  const startOffset = before.toString().length
  const selectedText = range.toString()
  if (!selectedText.trim()) return
  selectionText.value = selectedText
  selectionRange.value = { startOffset, endOffset: startOffset + selectedText.length }
  emit('selection-change', { selectedText, ...selectionRange.value })
}

function addAnnotation() {
  if (!draft.issueType || !draft.comment.trim() || !selectionRange.value) {
    message.warning('请选择问题类型并填写批注')
    return
  }
  const { startOffset, endOffset } = selectionRange.value
  const overlaps = props.modelValue.some(item => startOffset < item.endOffset && endOffset > item.startOffset)
  if (overlaps) {
    message.warning('该片段与已有批注重叠，请重新选择')
    return
  }
  const annotation = {
    selectedText: props.text.slice(startOffset, endOffset),
    startOffset,
    endOffset,
    prefixText: props.text.slice(Math.max(0, startOffset - 40), startOffset),
    suffixText: props.text.slice(endOffset, endOffset + 40),
    issueType: draft.issueType,
    comment: draft.comment.trim(),
    source: 'user',
    confidence: null,
  }
  if (props.collaborative) emit('create-annotation', annotation)
  else emit('update:modelValue', [...props.modelValue, annotation])
  clearSelection()
}

function removeAnnotation(target) {
  emit('update:modelValue', props.modelValue.filter(item => item !== target))
}

function selectAnnotation(item) {
  if (props.discussion) emit('select-annotation', item)
}

function vote(item, value) {
  if (item.isOwn) return
  emit('vote', item, value)
}

function withdraw(item) {
  emit('withdraw', item)
}

function clearSelection() {
  selectionText.value = ''
  selectionRange.value = null
  draft.issueType = undefined
  draft.comment = ''
  window.getSelection()?.removeAllRanges()
  emit('selection-change', null)
}

defineExpose({ clearSelection })
</script>

<style scoped>
.annotation-editor { border: 1px solid #d9d9d9; background: #fff; }
.annotation-layout { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr); min-height: 360px; }
.annotation-editor.composer-only .annotation-layout { grid-template-columns: minmax(0, 1.45fr) minmax(340px, .75fr); }
.annotation-editor.composer-only .comment-pane { background: #fbf9f9; }
.answer-pane { min-width: 0; border-right: 1px solid #e8e8e8; }
.pane-heading { height: 44px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; font-weight: 600; background: #fafafa; }
.selection-state { color: var(--hib-red); font-size: 12px; font-weight: 400; }
.answer-text { min-height: 314px; max-height: 480px; overflow: auto; padding: 18px; white-space: pre-wrap; line-height: 1.8; user-select: text; font-family: "Noto Serif SC", "Songti SC", serif; }
.highlight { padding: 1px 0; background: #fff1b8; border-bottom: 2px solid #faad14; }
.highlight.user { background: var(--hib-red-soft); border-bottom-color: var(--hib-red); }
.comment-pane { min-width: 0; display: flex; flex-direction: column; }
.comment-form { padding: 14px; display: grid; gap: 10px; border-bottom: 1px solid #eee; background: #fbf7f6; }
.comment-form blockquote { margin: 0; padding-left: 10px; border-left: 3px solid var(--hib-red); color: #555; font-size: 13px; max-height: 70px; overflow: auto; }
.comment-form.empty blockquote { border-left-color: var(--hib-line); color: var(--hib-muted); }
.comment-list { padding: 12px; overflow: auto; max-height: 480px; }
.comment-item { padding: 12px 0; border-bottom: 1px solid #eee; }
.comment-meta { display: flex; align-items: center; gap: 6px; }
.comment-meta .ant-btn { margin-left: auto; }
.author { margin-left: auto; color: var(--hib-muted); font-size: 12px; }
.quote { margin-top: 8px; color: #555; font-size: 13px; }
.comment { margin-top: 6px; color: #222; line-height: 1.55; }
.highlight.interactive { cursor: pointer; }
.highlight.active { box-shadow: 0 0 0 2px rgba(173,70,82,.2); }
.annotation-actions { display: flex; gap: 2px; margin-top: 8px; }
.annotation-actions :deep(.ant-btn) { height: 28px; padding: 0 7px; color: var(--hib-muted); }
.annotation-actions :deep(.ant-btn:hover), .annotation-actions :deep(.ant-btn.agree), .annotation-actions :deep(.ant-btn.active) { color: var(--hib-red); background: var(--hib-red-soft); }
.annotation-actions :deep(.ant-btn.disagree) { color: #4b5563; background: #eef0f2; }
.comment-count { display: inline-flex; align-items: center; gap: 4px; padding: 4px 7px; color: var(--hib-muted); font-size: 12px; }
@media (max-width: 760px) { .annotation-layout { grid-template-columns: 1fr; } .answer-pane { border-right: 0; border-bottom: 1px solid #e8e8e8; } }
</style>
