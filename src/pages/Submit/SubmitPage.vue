<template>
  <AppLayout>
    <div class="submit-page">
      <a-card title="提交 AI 未满足信息需求案例" :bordered="false">
        <template #extra>
          <a-space>
            <a-tag color="orange">今日已提交: {{ todayCount }} / 5</a-tag>
            <a-tag color="blue">本周: {{ weekCount }} / 10~20</a-tag>
          </a-space>
        </template>

        <a-form :model="form" layout="vertical" @finish="onSubmit" ref="formRef">
          <a-form-item label="Prompt（必填）" name="prompt" :rules="[{ required: true, message: '请输入你的 Prompt' }]">
            <a-textarea
              v-model:value="form.prompt"
              :rows="4"
              placeholder="描述你的信息需求和给 AI 的提示词..."
            />
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="AI 平台" name="platform" :rules="[{ required: true, message: '请选择 AI 平台' }]">
                <a-select v-model:value="form.platform" placeholder="选择使用的 AI 平台">
                  <a-select-option value="deepseek">DeepSeek</a-select-option>
                  <a-select-option value="glm">GLM (智谱清言)</a-select-option>
                  <a-select-option value="kimi">Kimi (月之暗面)</a-select-option>
                  <a-select-option value="qwen">通义千问</a-select-option>
                  <a-select-option value="doubao">豆包</a-select-option>
                  <a-select-option value="chatgpt">ChatGPT</a-select-option>
                  <a-select-option value="other">其他</a-select-option>
                </a-select>
              </a-form-item>
            </a-col>

            <a-col :span="12">
              <a-form-item label="分类（必填）" name="category" :rules="[{ required: true, message: '请选择分类' }]">
                <a-select v-model:value="form.category" placeholder="选择信息未满足的原因">
                  <a-select-opt-group label="知识缺失">
                    <a-select-option value="campus_info">校园信息缺失</a-select-option>
                    <a-select-option value="news">最新新闻/时事</a-select-option>
                    <a-select-option value="domain_knowledge">特定领域知识</a-select-option>
                  </a-select-opt-group>
                  <a-select-opt-group label="参考来源问题">
                    <a-select-option value="unreliable_source">参考来源不可信/错误</a-select-option>
                    <a-select-option value="unverifiable">信息来源不可验证</a-select-option>
                    <a-select-option value="no_source">无法提供参考来源</a-select-option>
                  </a-select-opt-group>
                  <a-select-opt-group label="模型能力限制">
                    <a-select-option value="image_understanding">图片理解失败</a-select-option>
                    <a-select-option value="database_query">特定数据库查询</a-select-option>
                    <a-select-option value="login_required">需要登录网站</a-select-option>
                  </a-select-opt-group>
                  <a-select-opt-group label="交互体验">
                    <a-select-option value="interaction_unsatisfied">对交互不满意</a-select-option>
                    <a-select-option value="workflow">工作流不匹配</a-select-option>
                  </a-select-opt-group>
                </a-select>
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="AI 回答">
            <a-textarea
              v-model:value="form.aiAnswer"
              :rows="4"
              placeholder="粘贴 AI 的完整回答，或提供分享链接..."
            />
          </a-form-item>

          <a-form-item label="分享链接">
            <a-input v-model:value="form.shareLink" placeholder="AI 对话的分享链接（可选）" />
          </a-form-item>

          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item label="满意度">
                <a-rate v-model:value="form.satisfaction" :count="5" />
              </a-form-item>
            </a-col>

            <a-col :span="12">
              <a-form-item label="是否优质案例">
                <a-switch v-model:checked="form.isGoodCase" checked-children="是" un-checked-children="否" />
              </a-form-item>
            </a-col>
          </a-row>

          <a-form-item label="补充说明">
            <a-textarea
              v-model:value="form.note"
              :rows="3"
              placeholder="补充说明：为什么 AI 未能满足你的需求？你有什么改进建议？"
            />
          </a-form-item>

          <a-form-item label="自定义标签">
            <a-select
              v-model:value="form.tags"
              mode="tags"
              placeholder="输入自定义标签，按回车添加"
              :max-tag-count="5"
            />
          </a-form-item>

          <a-form-item>
            <a-button type="primary" html-type="submit" size="large" :loading="submitting" block>
              提交案例
            </a-button>
          </a-form-item>
        </a-form>
      </a-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import AppLayout from '../../components/layout/AppLayout.vue'
import { submitCase } from '../../api/submission'

const route = useRoute()
const router = useRouter()
const formRef = ref()
const submitting = ref(false)

const form = reactive({
  prompt: route.query.prompt || '',
  platform: route.query.model || undefined,
  category: undefined,
  aiAnswer: route.query.aiAnswer || '',
  shareLink: '',
  satisfaction: 0,
  isGoodCase: false,
  note: '',
  tags: [],
})

const todayCount = ref(0)
const weekCount = ref(0)

async function onSubmit() {
  submitting.value = true
  try {
    await submitCase({
      ...form,
      satisfaction: form.satisfaction || 0,
    })
    message.success('案例提交成功！')
    if (form.isGoodCase) {
      message.success('优质案例标记成功，将展示在案例广场！')
    }
    Object.assign(form, {
      prompt: '',
      platform: undefined,
      category: undefined,
      aiAnswer: '',
      shareLink: '',
      satisfaction: 0,
      isGoodCase: false,
      note: '',
      tags: [],
    })
    formRef.value?.resetFields()
    todayCount.value++
    weekCount.value++
  } catch {
    // handled by interceptor
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.submit-page {
  padding: 0;
}
</style>
