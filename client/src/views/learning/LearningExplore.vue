<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.explore')" :subtitle="t('learning.exploreBlurb')" />
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!courses.length" class="text-sm text-gray-500">{{ t('learning.emptyExplore') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <LearningCourseCard
        v-for="c in courses"
        :key="learningCourseId(c) || c.title"
        :to="`/learning/courses/${learningCourseId(c)}`"
        :title="c.title"
        :meta="c.description || t('learning.published')"
        :status-label="t('learning.published')"
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
const courses = ref([]);

onMounted(async () => {
  captureLearningModuleVisited('learning_explore');
  void recordModuleVisit('learning_explore', 'LMS');
  try {
    const res = await apiClient.get('/lms/explore', { cache: 'no-store' });
    courses.value = res?.data || res || [];
  } finally {
    loading.value = false;
  }
});
</script>
