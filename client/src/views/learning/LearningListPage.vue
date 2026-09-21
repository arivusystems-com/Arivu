<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t(titleKey)" :subtitle="subtitle ? t(subtitle) : ''" />
    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!items.length" class="text-sm text-gray-500">{{ t(emptyKey) }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="(item, idx) in items"
        :key="item._id || idx"
        class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <p class="font-semibold text-gray-900 dark:text-white">
          {{ item.title || item.course?.title || item.enrollment?.courseId || item.credentialId || item.type || item._id }}
        </p>
        <p v-if="item.description || item.status" class="mt-1 text-xs text-gray-500">
          {{ item.description || item.status }}
        </p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import LearningPageHeader from './components/LearningPageHeader.vue';

const props = defineProps({
  titleKey: { type: String, required: true },
  endpoint: { type: String, required: true },
  emptyKey: { type: String, default: 'learning.emptyMyLearning' },
  subtitle: { type: String, default: 'learning.contentLibraryBlurb' },
});

const { t } = useI18n();
const loading = ref(true);
const items = ref([]);

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get(props.endpoint, { cache: 'no-store' });
    const data = res?.data || res || [];
    items.value = Array.isArray(data) ? data : (data.items || []);
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

watch(() => props.endpoint, load);
onMounted(load);
</script>
