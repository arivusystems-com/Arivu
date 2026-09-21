<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('navigation.appLearning')" :subtitle="t('learning.homeBlurb')" />

    <div v-if="loading" class="space-y-4">
      <div class="h-44 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="i in 3" :key="i" class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>

    <template v-else>
      <!-- Continue hero -->
      <section
        v-if="continueItem"
        class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 p-6 text-white shadow-lg sm:p-8"
      >
        <div
          class="pointer-events-none absolute inset-0 opacity-30"
          style="background-image: radial-gradient(circle at 10% 20%, white 0, transparent 35%), radial-gradient(circle at 90% 80%, white 0, transparent 40%)"
        />
        <div class="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wider text-indigo-100">
              {{ t('learning.continueLearning') }}
            </p>
            <h2 class="mt-2 text-xl font-semibold sm:text-2xl">
              {{ continueItem.course?.title || '—' }}
            </h2>
            <p class="mt-2 text-sm text-indigo-100">
              {{ t('learning.progress', { percent: continueItem.progress?.percentComplete ?? 0 }) }}
              <template v-if="continueItem.enrollment?.dueAt">
                · {{ continueItem.overdue
                  ? t('learning.dueOverdue', { date: formatHomeDue(continueItem.enrollment.dueAt) })
                  : t('learning.dueOn', { date: formatHomeDue(continueItem.enrollment.dueAt) }) }}
              </template>
            </p>
            <div class="mt-4 h-1.5 max-w-md overflow-hidden rounded-full bg-white/25">
              <div
                class="h-full rounded-full bg-white transition-all"
                :style="{ width: `${continueItem.progress?.percentComplete ?? 0}%` }"
              />
            </div>
          </div>
          <div class="flex items-center gap-4">
            <router-link
              :to="`/learning/courses/${learningCourseId(continueItem.course)}`"
              class="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50"
            >
              {{ t('learning.continueLearning') }}
            </router-link>
          </div>
        </div>
      </section>

      <section
        v-else
        class="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center dark:border-gray-600 dark:bg-gray-900/40"
      >
        <AcademicCapIcon class="mx-auto h-10 w-10 text-indigo-500" />
        <h2 class="mt-3 text-lg font-semibold text-gray-900 dark:text-white">
          {{ showFirstTimeEmpty ? t('onboarding.firstTimeLearningTitle') : t('learning.emptyMyLearning') }}
        </h2>
        <p v-if="showFirstTimeEmpty" class="mx-auto mt-2 max-w-md text-sm text-gray-500">
          {{ t('onboarding.firstTimeLearningDescription') }}
        </p>
        <router-link
          to="/learning/explore"
          class="mt-4 inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          {{ showFirstTimeEmpty ? t('onboarding.firstTimeLearningAction') : t('learning.explore') }}
        </router-link>
      </section>

      <!-- Assigned -->
      <section v-if="restItems.length" class="mt-10">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('learning.myLearning') }}
          </h3>
          <router-link
            to="/learning/my"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
          >
            {{ t('learning.viewAll') }}
          </router-link>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LearningCourseCard
            v-for="row in restItems"
            :key="row.enrollment?._id"
            :to="`/learning/courses/${learningCourseId(row.course)}`"
            :title="row.course?.title || '—'"
            :percent="row.progress?.percentComplete ?? 0"
            :meta="homeCardMeta(row)"
            :status-label="row.overdue ? t('learning.overdue') : (row.assigned ? t('learning.assigned') : '')"
          />
        </div>
      </section>

      <!-- AI recommend -->
      <section v-if="aiRecommendations.length" class="mt-10">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('learning.aiRecommended') }}
          </h3>
          <router-link
            v-if="aiSuiteEntitled"
            :to="{ path: '/astra', query: { prompt: t('learning.aiAskAstraPrompt') } }"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
          >
            {{ t('learning.askAstra') }}
          </router-link>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LearningCourseCard
            v-for="row in aiRecommendations"
            :key="row.courseId || row.title"
            :to="row.route || `/learning/courses/${row.courseId}`"
            :title="row.title"
            :meta="aiRecommendMeta(row)"
            :status-label="row.kind === 'continue' ? t('learning.continueLearning') : t('learning.explore')"
          />
        </div>
      </section>

      <!-- Explore strip -->
      <section v-if="exploreCourses.length" class="mt-10">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">
            {{ t('learning.explore') }}
          </h3>
          <router-link
            to="/learning/explore"
            class="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
          >
            {{ t('learning.viewAll') }}
          </router-link>
        </div>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <LearningCourseCard
            v-for="c in exploreCourses"
            :key="learningCourseId(c) || c.title"
            :to="`/learning/courses/${learningCourseId(c)}`"
            :title="c.title"
            :meta="c.description || t('learning.published')"
            :status-label="t('learning.published')"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { AcademicCapIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useAuthStore } from '@/stores/auth';
import { useOnboarding } from '@/composables/useOnboarding';
import { isAiSuiteEntitled } from '@/utils/aiSuiteEntitlement';
import {
  captureLearningAppOpened,
  captureLearningHomeViewed,
  captureLearningModuleVisited,
} from '@/config/posthogLearning';
import { captureFirstTimeEmptyStateSeen } from '@/config/posthogOnboarding';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningCourseCard from './components/LearningCourseCard.vue';
import { learningCourseId } from '@/utils/learningIds';

const { t } = useI18n();
const authStore = useAuthStore();
const { hasModuleVisit, recordModuleVisit } = useOnboarding();
const loading = ref(true);
const myItems = ref([]);
const exploreCourses = ref([]);
const aiRecommendations = ref([]);
const isFirstVisit = ref(false);

const aiSuiteEntitled = computed(() => isAiSuiteEntitled(authStore.user));

const showFirstTimeEmpty = computed(
  () => isFirstVisit.value && !(myItems.value || []).length
);

const continueItem = computed(() => {
  const list = myItems.value || [];
  if (!list.length) return null;
  return [...list].sort(
    (a, b) => (b.progress?.percentComplete ?? 0) - (a.progress?.percentComplete ?? 0)
  )[0];
});

const restItems = computed(() => {
  const contId = continueItem.value?.enrollment?._id;
  return (myItems.value || []).filter((r) => r.enrollment?._id !== contId).slice(0, 6);
});

function homeCardMeta(row) {
  const parts = [
    t('learning.progress', { percent: row.progress?.percentComplete ?? 0 }),
  ];
  if (row.enrollment?.dueAt) {
    const d = new Date(row.enrollment.dueAt);
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        row.overdue
          ? t('learning.dueOverdue', { date: d.toLocaleDateString() })
          : t('learning.dueOn', { date: d.toLocaleDateString() })
      );
    }
  }
  return parts.join(' · ');
}

function formatHomeDue(dueAt) {
  const d = new Date(dueAt);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

function aiRecommendMeta(row) {
  if (row.kind === 'continue') {
    return t('learning.progress', { percent: row.percentComplete ?? 0 });
  }
  if (row.estimatedMinutes) {
    return t('learning.estimatedMinutes', { minutes: row.estimatedMinutes });
  }
  return row.description || t('learning.published');
}

onMounted(async () => {
  isFirstVisit.value = !hasModuleVisit('learning_home', 'LMS');
  const orgId = authStore.user?.organizationId;
  captureLearningAppOpened({ organization_id: orgId });
  captureLearningHomeViewed({ organization_id: orgId });
  captureLearningModuleVisited('learning_home', { organization_id: orgId });

  try {
    const [mine, explore, ai] = await Promise.all([
      apiClient.get('/lms/my-learning', { cache: 'no-store' }),
      apiClient.get('/lms/explore', { cache: 'no-store' }),
      apiClient.get('/lms/ai/recommend?limit=6', { cache: 'no-store' }).catch(() => null),
    ]);
    myItems.value = mine?.data || mine || [];
    if (!Array.isArray(myItems.value)) myItems.value = [];
    exploreCourses.value = (explore?.data || explore || []).slice(0, 6);
    if (!Array.isArray(exploreCourses.value)) exploreCourses.value = [];
    const aiData = ai?.data || ai || {};
    aiRecommendations.value = Array.isArray(aiData.recommendations) ? aiData.recommendations : [];
  } catch {
    myItems.value = [];
    exploreCourses.value = [];
    aiRecommendations.value = [];
  } finally {
    loading.value = false;
  }

  void recordModuleVisit('learning_home', 'LMS');
  if (showFirstTimeEmpty.value) {
    captureFirstTimeEmptyStateSeen('learning_home', 'LMS', {
      persona: authStore.user?.onboarding?.persona,
      origin: authStore.user?.onboarding?.origin,
      organizationId: orgId,
    });
  }
});
</script>
