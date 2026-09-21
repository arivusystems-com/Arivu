<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.myLearning')" :subtitle="t('learning.myLearningBlurb')" />
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!items.length" class="text-sm text-gray-500">{{ t('learning.emptyMyLearning') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <LearningCourseCard
        v-for="row in items"
        :key="row.enrollment?._id"
        :to="`/learning/courses/${learningCourseId(row.course)}`"
        :title="row.course?.title || '—'"
        :percent="row.progress?.percentComplete ?? 0"
        :meta="cardMeta(row)"
        :status-label="cardStatus(row)"
      />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureLearningModuleVisited } from '@/config/posthogLearning';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningCourseCard from './components/LearningCourseCard.vue';
import { learningCourseId } from '@/utils/learningIds';

const { t } = useI18n();
const { recordModuleVisit } = useOnboarding();
const loading = ref(true);
const items = ref([]);

function formatDue(dueAt) {
  if (!dueAt) return '';
  const d = new Date(dueAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString();
}

function cardMeta(row) {
  const parts = [
    t('learning.progress', { percent: row.progress?.percentComplete ?? 0 }),
  ];
  if (row.enrollment?.dueAt) {
    parts.push(
      row.overdue
        ? t('learning.dueOverdue', { date: formatDue(row.enrollment.dueAt) })
        : t('learning.dueOn', { date: formatDue(row.enrollment.dueAt) })
    );
  }
  return parts.join(' · ');
}

function cardStatus(row) {
  if (row.overdue) return t('learning.overdue');
  if (row.assigned) return t('learning.assigned');
  return '';
}

onMounted(async () => {
  captureLearningModuleVisited('learning_my');
  void recordModuleVisit('learning_my', 'LMS');
  try {
    const res = await apiClient.get('/lms/my-learning', { cache: 'no-store' });
    items.value = res?.data || res || [];
  } finally {
    loading.value = false;
  }
});
</script>
