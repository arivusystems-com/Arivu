<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.skillsBadges')" :subtitle="t('learning.skillsBadgesBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
          @click="skillOpen = true"
        >
          {{ t('learning.createSkill') }}
        </button>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          @click="openBadge"
        >
          {{ t('learning.createBadge') }}
        </button>
      </template>
    </LearningPageHeader>

    <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
      {{ t('learning.myBadges') }}
    </h2>
    <div v-if="loadingMine" class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!myBadges.length" class="mb-8 text-sm text-gray-500">{{ t('learning.emptyMyBadges') }}</p>
    <div v-else class="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="row in myBadges"
        :key="row._id"
        class="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"
      >
        <h3 class="font-semibold text-gray-900 dark:text-white">{{ row.badge?.title || '—' }}</h3>
        <p v-if="row.skill?.title" class="mt-1 text-xs text-amber-800 dark:text-amber-200">
          {{ row.skill.title }}
        </p>
        <p class="mt-2 text-xs text-gray-500">{{ formatDate(row.awardedAt) }}</p>
      </article>
    </div>

    <template v-if="canAuthor">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {{ t('learning.skillsCatalog') }}
      </h2>
      <div class="mb-6 flex flex-wrap gap-2">
        <span
          v-for="skill in skills"
          :key="skill._id"
          class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {{ skill.title }}
        </span>
        <p v-if="!skills.length" class="text-sm text-gray-500">{{ t('learning.emptySkills') }}</p>
      </div>

      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {{ t('learning.badgesCatalog') }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="badge in badges"
          :key="badge._id"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <h3 class="font-semibold text-gray-900 dark:text-white">{{ badge.title }}</h3>
          <p class="mt-1 text-sm text-gray-500">{{ badge.description || '—' }}</p>
          <p v-if="badge.courseId" class="mt-2 text-xs text-indigo-600 dark:text-indigo-300">
            {{ t('learning.badgeAutoCourse') }}
          </p>
        </article>
        <p v-if="!badges.length" class="text-sm text-gray-500">{{ t('learning.emptyBadges') }}</p>
      </div>
    </template>

    <LearningDialog
      :open="skillOpen"
      :title="t('learning.createSkill')"
      :confirm-label="t('learning.createSkill')"
      :cancel-label="t('learning.cancel')"
      :disabled="!skillTitle.trim() || savingSkill"
      @close="skillOpen = false"
      @confirm="createSkill"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.skillTitlePrompt') }}
        <input
          v-model="skillTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
    </LearningDialog>

    <LearningDialog
      :open="badgeOpen"
      :title="t('learning.createBadge')"
      :confirm-label="t('learning.createBadge')"
      :cancel-label="t('learning.cancel')"
      :disabled="!badgeTitle.trim() || savingBadge"
      @close="badgeOpen = false"
      @confirm="createBadge"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.badgeTitlePrompt') }}
        <input
          v-model="badgeTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <label class="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.linkSkill') }}
        <select
          v-model="badgeSkillId"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{{ t('learning.optionalNone') }}</option>
          <option v-for="s in skills" :key="s._id" :value="String(s._id)">{{ s.title }}</option>
        </select>
      </label>
      <label class="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.linkCourse') }}
        <select
          v-model="badgeCourseId"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{{ t('learning.optionalNone') }}</option>
          <option v-for="c in courses" :key="c._id" :value="String(c._id)">{{ c.title }}</option>
        </select>
      </label>
    </LearningDialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningDialog from './components/LearningDialog.vue';
import { captureLearningModuleVisited } from '@/config/posthogLearning';

const { t, d } = useI18n();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loadingMine = ref(true);
const myBadges = ref([]);
const skills = ref([]);
const badges = ref([]);
const courses = ref([]);
const skillOpen = ref(false);
const skillTitle = ref('');
const savingSkill = ref(false);
const badgeOpen = ref(false);
const badgeTitle = ref('');
const badgeSkillId = ref('');
const badgeCourseId = ref('');
const savingBadge = ref(false);

function formatDate(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'short');
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

async function loadMine() {
  loadingMine.value = true;
  try {
    const res = await apiClient.get('/lms/my-badges', { cache: 'no-store' });
    const list = res?.data || res || [];
    myBadges.value = Array.isArray(list) ? list : [];
  } catch {
    myBadges.value = [];
  } finally {
    loadingMine.value = false;
  }
}

async function loadCatalog() {
  try {
    const res = await apiClient.get('/lms/skills', { cache: 'no-store' });
    const data = res?.data || res || {};
    skills.value = data.skills || [];
    badges.value = data.badges || [];
  } catch {
    skills.value = [];
    badges.value = [];
  }
}

async function loadCourses() {
  if (!canAuthor.value) return;
  try {
    const res = await apiClient.get('/lms/courses', { cache: 'no-store' });
    const list = res?.data || res || [];
    courses.value = Array.isArray(list) ? list : [];
  } catch {
    courses.value = [];
  }
}

async function createSkill() {
  if (!skillTitle.value.trim() || savingSkill.value) return;
  savingSkill.value = true;
  try {
    await apiClient.post('/lms/skills', { title: skillTitle.value.trim() });
    success(t('learning.createSkill'));
    skillOpen.value = false;
    skillTitle.value = '';
    await loadCatalog();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    savingSkill.value = false;
  }
}

function openBadge() {
  badgeTitle.value = '';
  badgeSkillId.value = '';
  badgeCourseId.value = '';
  badgeOpen.value = true;
  loadCourses();
}

async function createBadge() {
  if (!badgeTitle.value.trim() || savingBadge.value) return;
  savingBadge.value = true;
  try {
    await apiClient.post('/lms/badges', {
      title: badgeTitle.value.trim(),
      skillId: badgeSkillId.value || undefined,
      courseId: badgeCourseId.value || undefined,
    });
    success(t('learning.createBadge'));
    badgeOpen.value = false;
    await loadCatalog();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    savingBadge.value = false;
  }
}

onMounted(() => {
  captureLearningModuleVisited('learning_skills');
  loadMine();
  loadCatalog();
});
</script>
