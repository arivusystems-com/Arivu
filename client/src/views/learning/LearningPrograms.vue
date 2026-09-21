<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.programs')" :subtitle="t('learning.programsBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="createOpen = true"
        >
          {{ t('learning.createProgram') }}
        </button>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-36 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('learning.emptyPrograms') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="row in rows"
        :key="row._id"
        class="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-600"
        @click="$router.push(`/learning/programs/${row._id}`)"
      >
        <div class="h-20 bg-gradient-to-br from-teal-600 via-indigo-600 to-violet-600 px-4 py-3">
          <RectangleStackIcon class="h-6 w-6 text-white/80" />
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ row.title }}</h3>
          <p class="mt-1 line-clamp-2 text-sm text-gray-500">
            {{ row.description || t('learning.programDefaultDesc') }}
          </p>
          <p class="mt-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            {{ t('learning.programPaths', { count: (row.items || []).length }) }}
            · {{ row.status || t('learning.draft') }}
          </p>
        </div>
      </article>
    </div>

    <LearningDialog
      :open="createOpen"
      :title="t('learning.createProgram')"
      :confirm-label="t('learning.createProgram')"
      :cancel-label="t('learning.cancel')"
      :disabled="!newTitle.trim() || creating"
      @close="createOpen = false"
      @confirm="createProgram"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.programTitlePrompt') }}
        <input
          v-model="newTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          @keydown.enter.prevent="createProgram"
        >
      </label>
    </LearningDialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { RectangleStackIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningDialog from './components/LearningDialog.vue';
import { captureLearningModuleVisited } from '@/config/posthogLearning';

const { t } = useI18n();
const router = useRouter();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const rows = ref([]);
const createOpen = ref(false);
const newTitle = ref('');
const creating = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/programs', { cache: 'no-store' });
    rows.value = res?.data || res || [];
    if (!Array.isArray(rows.value)) rows.value = [];
  } catch {
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

async function createProgram() {
  if (!newTitle.value.trim() || creating.value) return;
  creating.value = true;
  try {
    const res = await apiClient.post('/lms/programs', { title: newTitle.value.trim() });
    const program = res?.data || res;
    success(t('learning.createProgram'));
    createOpen.value = false;
    newTitle.value = '';
    if (program?._id) router.push(`/learning/programs/${program._id}`);
    else await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    creating.value = false;
  }
}

onMounted(() => {
  captureLearningModuleVisited('learning_programs');
  load();
});
</script>
