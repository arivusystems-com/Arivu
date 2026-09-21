<template>
  <div v-if="visible" class="related-learning">
    <div
      v-if="showHeader"
      class="record-context-panel__header flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 class="text-base font-semibold text-gray-900 dark:text-white">
        {{ t('learning.relatedLearning') }}
      </h2>
      <RouterLink
        to="/learning/explore"
        class="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        {{ t('learning.explore') }}
      </RouterLink>
    </div>
    <div :class="showHeader ? 'min-h-0 flex-1 overflow-y-auto p-4' : ''">
      <div v-if="loading" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
      <p v-else-if="!courses.length" class="text-sm text-gray-500">
        {{ t('learning.relatedLearningEmpty') }}
      </p>
      <ul v-else class="space-y-2">
        <li
          v-for="course in courses"
          :key="course._id"
        >
          <RouterLink
            :to="`/learning/courses/${course._id}`"
            class="block rounded-lg border border-gray-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/50 dark:border-gray-700 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/30"
          >
            <p class="text-sm font-medium text-gray-900 dark:text-white">{{ course.title }}</p>
            <p v-if="course.description" class="mt-0.5 line-clamp-2 text-xs text-gray-500">
              {{ course.description }}
            </p>
          </RouterLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  appKey: { type: String, required: true },
  showHeader: { type: Boolean, default: true },
  limit: { type: Number, default: 6 },
});

const { t } = useI18n();
const authStore = useAuthStore();
const loading = ref(true);
const courses = ref([]);

const visible = computed(() => authStore.hasAppAccess('LMS'));

async function load() {
  if (!visible.value) {
    courses.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const res = await apiClient.get(
      `/lms/contextual?appKey=${encodeURIComponent(props.appKey)}&limit=${props.limit}`,
      { cache: 'no-store' }
    );
    const data = res?.data || res || {};
    courses.value = Array.isArray(data.courses) ? data.courses : [];
  } catch {
    courses.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.appKey, load);
onMounted(load);

defineExpose({ visible });
</script>
