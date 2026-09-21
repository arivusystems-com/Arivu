<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.courses')" :subtitle="t('learning.coursesBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="createOpen = true"
        >
          {{ t('learning.createCourse') }}
        </button>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 6" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!courses.length" class="text-sm text-gray-500">
      <template v-if="showFirstTimeEmpty">
        <span class="block text-base font-semibold text-gray-900 dark:text-white">
          {{ t('onboarding.firstTimeLearningCoursesTitle') }}
        </span>
        <span class="mt-1 block">{{ t('onboarding.firstTimeLearningCoursesDescription') }}</span>
        <button
          v-if="canAuthor"
          type="button"
          class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          @click="createOpen = true"
        >
          {{ t('onboarding.firstTimeLearningCoursesAction') }}
        </button>
      </template>
      <template v-else>
        {{ t('learning.emptyCourses') }}
      </template>
    </p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <LearningCourseCard
        v-for="c in courses"
        :key="learningCourseId(c) || c.title"
        :to="`/learning/courses/${learningCourseId(c)}`"
        :title="c.title"
        :meta="c.description || ''"
        :status-label="c.status === 'published' ? t('learning.published') : t('learning.draft')"
      />
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
                  {{ t('learning.createCourse') }}
                </DialogTitle>
                <label class="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('learning.courseTitleLabel') }}
                  <input
                    v-model="newTitle"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    @keydown.enter.prevent="createCourse"
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
                    @click="createCourse"
                  >
                    {{ t('learning.createCourse') }}
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
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAuthStore } from '@/stores/auth';
import { useOnboarding } from '@/composables/useOnboarding';
import { captureLearningModuleVisited } from '@/config/posthogLearning';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningCourseCard from './components/LearningCourseCard.vue';
import { isLearningCourseId, learningCourseId } from '@/utils/learningIds';
import { useLearningRole } from '@/composables/useLearningRole';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();
const { success, error } = useNotifications();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const courses = ref([]);
const createOpen = ref(false);
const newTitle = ref('');
const creating = ref(false);
const isFirstVisit = ref(false);

const showFirstTimeEmpty = computed(
  () => isFirstVisit.value && !(courses.value || []).length
);

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/courses', { cache: 'no-store' });
    courses.value = res?.data || res || [];
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createCourse() {
  const title = newTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    const res = await apiClient.post('/lms/courses', { title });
    const course = res?.data || res;
    const id = learningCourseId(course);
    success(t('learning.createCourse'));
    createOpen.value = false;
    newTitle.value = '';
    if (!isLearningCourseId(id)) {
      await load();
      return;
    }
    await router.push(`/learning/courses/${id}`);
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    creating.value = false;
  }
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('learning_courses', 'LMS');
  captureLearningModuleVisited('learning_courses');
  if (isFirstVisit.value) {
    captureFirstTimeEmptyStateSeen('learning_courses', 'LMS', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: authStore.user?.organizationId,
    });
  }
  void recordModuleVisit('learning_courses', 'LMS');
  await load();
});
</script>
