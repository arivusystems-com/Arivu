<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.paths')" :subtitle="t('learning.pathsBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="createOpen = true"
        >
          {{ t('learning.createPath') }}
        </button>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-36 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('learning.emptyPaths') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="row in rows"
        :key="row._id"
        class="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:hover:border-indigo-600"
        @click="$router.push(`/learning/paths/${row._id}`)"
      >
        <div class="h-20 bg-gradient-to-br from-violet-600 via-indigo-600 to-indigo-500 px-4 py-3">
          <MapIcon class="h-6 w-6 text-white/80" />
        </div>
        <div class="flex flex-1 flex-col p-4">
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ row.title }}</h3>
          <p class="mt-1 line-clamp-2 text-sm text-gray-500">
            {{ row.description || t('learning.pathDefaultDesc') }}
          </p>
          <p class="mt-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">
            {{ t('learning.pathItems', { count: (row.items || []).length }) }}
            · {{ row.status || t('learning.draft') }}
          </p>
        </div>
      </article>
    </div>

    <TransitionRoot appear :show="createOpen" as="template">
      <Dialog class="relative z-50" @close="createOpen = false">
        <TransitionChild
          as="template"
          enter="duration-200 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-150 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild
              as="template"
              enter="duration-200 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-150 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel
                class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
              >
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('learning.createPath') }}
                </DialogTitle>
                <label class="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('learning.pathTitlePrompt') }}
                  <input
                    v-model="newTitle"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    @keydown.enter.prevent="createPath"
                  >
                </label>
                <div class="mt-6 flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    @click="createOpen = false"
                  >
                    {{ t('learning.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    :disabled="!newTitle.trim() || creating"
                    @click="createPath"
                  >
                    {{ t('learning.createPath') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { MapIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import LearningPageHeader from './components/LearningPageHeader.vue';
import { useLearningRole } from '@/composables/useLearningRole';

const { t } = useI18n();
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
    const res = await apiClient.get('/lms/paths', { cache: 'no-store' });
    rows.value = res?.data || res || [];
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createPath() {
  const title = newTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    const coursesRes = await apiClient.get('/lms/courses?status=published', { cache: 'no-store' });
    const courses = coursesRes?.data || coursesRes || [];
    const items = courses.slice(0, 5).map((c, i) => ({
      courseId: c._id,
      required: true,
      sortOrder: i,
    }));
    await apiClient.post('/lms/paths', {
      title,
      description: t('learning.pathDefaultDesc'),
      sequential: true,
      items,
    });
    success(t('learning.createPath'));
    createOpen.value = false;
    newTitle.value = '';
    await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>
