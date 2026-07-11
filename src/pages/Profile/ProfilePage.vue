<template>
  <AppLayout>
    <div class="profile-page">
      <a-card :bordered="false" class="profile-header">
        <a-row align="middle" :gutter="24">
          <a-col>
            <a-avatar :size="72">{{ auth.user?.name?.[0] || 'U' }}</a-avatar>
          </a-col>
          <a-col :flex="1">
            <h2>{{ auth.user?.name || '用户' }}</h2>
            <a-space>
              <a-tag v-if="auth.isGuest" color="orange">游客模式</a-tag>
              <a-tag v-else color="blue">{{ auth.user?.studentId }}</a-tag>
            </a-space>
          </a-col>
        </a-row>
      </a-card>

      <a-row :gutter="16" style="margin-top: 16px">
        <a-col :span="6" v-for="stat in stats" :key="stat.label">
          <a-card :bordered="false">
            <a-statistic :title="stat.label" :value="stat.value" :suffix="stat.suffix" />
          </a-card>
        </a-col>
      </a-row>

      <a-card title="我的提交记录" :bordered="false" style="margin-top: 16px">
        <a-list :loading="loading" item-layout="horizontal" :data-source="submissions">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <a-space>
                    <a-tag :color="categoryColor(item.category)">{{ item.category }}</a-tag>
                    <a-tag>{{ item.platform }}</a-tag>
                    <span>{{ item.prompt?.slice(0, 60) }}{{ item.prompt?.length > 60 ? '...' : '' }}</span>
                  </a-space>
                </template>
                <template #description>
                  <a-space>
                    <span>提交于 {{ item.createdAt }}</span>
                    <a-rate :value="item.satisfaction" :count="5" disabled style="font-size: 14px" />
                  </a-space>
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
        <a-empty v-if="!loading && submissions.length === 0" description="暂无提交记录" />
      </a-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppLayout from '../../components/layout/AppLayout.vue'
import { useAuthStore } from '../../store/auth'
import { getMySubmissions } from '../../api/submission'

const auth = useAuthStore()
const loading = ref(false)
const submissions = ref([])

const stats = [
  { label: '总提交', value: 0, suffix: '条' },
  { label: '本周提交', value: 0, suffix: '条' },
  { label: '优质案例', value: 0, suffix: '个' },
  { label: '平均满意度', value: 0, suffix: '分' },
]

onMounted(async () => {
  loading.value = true
  try {
    const res = await getMySubmissions()
    submissions.value = res.data.list || []
    if (res.data.stats) {
      stats[0].value = res.data.stats.total || 0
      stats[1].value = res.data.stats.weekCount || 0
      stats[2].value = res.data.stats.goodCases || 0
      stats[3].value = res.data.stats.avgSatisfaction || 0
    }
  } catch {
    // handled by interceptor
  } finally {
    loading.value = false
  }
})

function categoryColor(category) {
  const map = {
    campus_info: 'green',
    news: 'cyan',
    domain_knowledge: 'geekblue',
    unreliable_source: 'orange',
    unverifiable: 'orange',
    no_source: 'orange',
    image_understanding: 'purple',
    database_query: 'purple',
    login_required: 'purple',
    interaction_unsatisfied: 'red',
    workflow: 'red',
  }
  return map[category] || 'default'
}
</script>

<style scoped>
.profile-header {
  margin-bottom: 0;
}
</style>
