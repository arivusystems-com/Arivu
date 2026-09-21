<template>
  <div class="mx-auto max-w-3xl">
    <div v-if="loading" class="space-y-4">
      <div class="h-8 w-64 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
      <div class="h-40 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <template v-else-if="program">
      <LearningPageHeader
        :title="program.title"
        :subtitle="program.description || t('learning.programDefaultDesc')"
      >
        <template #actions>
          <button
            v-if="canAuthor && program.status !== 'published'"
            type="button"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
            @click="publish"
          >
            {{ t('learning.publishProgram') }}
          </button>
          <button
            v-if="canAuthor"
            type="button"
            class="rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200"
            @click="openAddPath"
          >
            {{ t('learning.addPath') }}
          </button>
          <button
            v-if="canAuthor && program.status === 'published'"
            type="button"
            class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            @click="openCohort"
          >
            {{ t('learning.createCohort') }}
          </button>
        </template>
      </LearningPageHeader>

      <p class="mb-4 text-sm capitalize text-gray-600 dark:text-gray-300">
        {{ program.status || t('learning.draft') }}
      </p>

      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {{ t('learning.programPathsHeading') }}
      </h2>
      <ol class="mb-8 space-y-3">
        <li v-if="!(program.items || []).length" class="text-sm text-gray-500">
          {{ t('learning.programNoPaths') }}
        </li>
        <li
          v-for="(item, index) in program.items || []"
          :key="String(item.pathId) + index"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <p class="text-xs font-semibold uppercase tracking-wide text-gray-400">
            {{ t('learning.pathStep', { n: index + 1 }) }}
          </p>
          <RouterLink
            v-if="item.path?._id"
            :to="`/learning/paths/${item.path._id}`"
            class="mt-1 block font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {{ item.path.title }}
          </RouterLink>
          <p v-else class="mt-1 font-semibold text-gray-900 dark:text-white">
            {{ t('learning.pathUnavailable') }}
          </p>
        </li>
      </ol>

      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        {{ t('learning.cohortsHeading') }}
      </h2>
      <div class="space-y-3">
        <p v-if="!(program.cohorts || []).length" class="text-sm text-gray-500">
          {{ t('learning.emptyCohorts') }}
        </p>
        <article
          v-for="cohort in program.cohorts || []"
          :key="cohort._id"
          class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white">{{ cohort.title }}</h3>
              <p class="mt-1 text-xs text-gray-500">
                {{ t('learning.cohortMembers', { count: (cohort.memberUserIds || []).length }) }}
                · {{ cohort.status }}
                <template v-if="cohort.endAt">
                  · {{ t('learning.complianceDue') }} {{ formatDate(cohort.endAt) }}
                </template>
              </p>
            </div>
            <button
              v-if="canAuthor && cohort.status === 'draft'"
              type="button"
              class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              :disabled="launchingId === String(cohort._id)"
              @click="launch(cohort)"
            >
              {{ t('learning.launchCohort') }}
            </button>
          </div>
        </article>
      </div>
    </template>
    <p v-else class="text-sm text-gray-500">{{ t('learning.loadFailed') }}</p>

    <LearningDialog
      :open="addPathOpen"
      :title="t('learning.addPath')"
      :confirm-label="t('learning.addPath')"
      :cancel-label="t('learning.cancel')"
      :disabled="!selectedPathId || addingPath"
      @close="addPathOpen = false"
      @confirm="addPath"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.selectPath') }}
        <select
          v-model="selectedPathId"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="">{{ t('learning.selectPathPlaceholder') }}</option>
          <option v-for="p in availablePaths" :key="p._id" :value="String(p._id)">
            {{ p.title }}
          </option>
        </select>
      </label>
    </LearningDialog>

    <LearningDialog
      :open="cohortOpen"
      :title="t('learning.createCohort')"
      :confirm-label="t('learning.createCohort')"
      :cancel-label="t('learning.cancel')"
      :disabled="!cohortTitle.trim() || !selectedMemberIds.length || creatingCohort"
      @close="cohortOpen = false"
      @confirm="createCohort"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.cohortTitlePrompt') }}
        <input
          v-model="cohortTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <label class="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.assignDueDate') }}
        <input
          v-model="cohortEndAt"
          type="date"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <div class="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
        <p v-if="loadingUsers" class="px-2 py-2 text-sm text-gray-500">{{ t('learning.loadingUsers') }}</p>
        <label
          v-for="u in users"
          :key="u._id"
          class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <input
            v-model="selectedMemberIds"
            type="checkbox"
            class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            :value="String(u._id)"
          >
          <span class="truncate">{{ displayName(u) }}</span>
        </label>
      </div>
    </LearningDialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningPageHeader from './components/LearningPageHeader.vue';
import LearningDialog from './components/LearningDialog.vue';

const { t, d } = useI18n();
const route = useRoute();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const program = ref(null);
const paths = ref([]);
const addPathOpen = ref(false);
const selectedPathId = ref('');
const addingPath = ref(false);
const cohortOpen = ref(false);
const cohortTitle = ref('');
const cohortEndAt = ref('');
const users = ref([]);
const loadingUsers = ref(false);
const selectedMemberIds = ref([]);
const creatingCohort = ref(false);
const launchingId = ref('');

const programId = () => String(route.params.id || '');

const availablePaths = computed(() => {
  const used = new Set((program.value?.items || []).map((i) => String(i.pathId)));
  return paths.value.filter((p) => !used.has(String(p._id)));
});

function displayName(u) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || u.email || String(u._id);
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return d(new Date(value), 'short');
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get(`/lms/programs/${programId()}`, { cache: 'no-store' });
    program.value = res?.data || res;
  } catch (e) {
    program.value = null;
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function loadPaths() {
  try {
    const res = await apiClient.get('/lms/paths', { cache: 'no-store' });
    const list = res?.data || res || [];
    paths.value = Array.isArray(list) ? list : [];
  } catch {
    paths.value = [];
  }
}

async function loadUsers() {
  loadingUsers.value = true;
  try {
    const res = await apiClient.get('/users?limit=500&page=1&sortBy=firstName&sortOrder=asc', {
      cache: 'no-store',
    });
    const list = res?.data?.users || res?.data || res?.users || res || [];
    const rows = Array.isArray(list) ? list : [];
    users.value = rows.filter((u) => {
      const access = Array.isArray(u.appAccess) ? u.appAccess : [];
      return access.some(
        (e) =>
          String(e?.appKey || '').toUpperCase() === 'LMS'
          && String(e?.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
      );
    });
  } catch {
    users.value = [];
  } finally {
    loadingUsers.value = false;
  }
}

function openAddPath() {
  selectedPathId.value = '';
  addPathOpen.value = true;
  loadPaths();
}

async function addPath() {
  if (!selectedPathId.value || addingPath.value) return;
  addingPath.value = true;
  try {
    await apiClient.post(`/lms/programs/${programId()}/paths`, { pathId: selectedPathId.value });
    success(t('learning.addPath'));
    addPathOpen.value = false;
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    addingPath.value = false;
  }
}

async function publish() {
  try {
    await apiClient.post(`/lms/programs/${programId()}/publish`);
    success(t('learning.publishProgram'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  }
}

function openCohort() {
  cohortTitle.value = '';
  cohortEndAt.value = '';
  selectedMemberIds.value = [];
  cohortOpen.value = true;
  loadUsers();
}

async function createCohort() {
  if (!cohortTitle.value.trim() || !selectedMemberIds.value.length || creatingCohort.value) return;
  creatingCohort.value = true;
  try {
    const payload = {
      title: cohortTitle.value.trim(),
      memberUserIds: selectedMemberIds.value,
    };
    if (cohortEndAt.value) {
      payload.endAt = new Date(`${cohortEndAt.value}T23:59:59`).toISOString();
    }
    await apiClient.post(`/lms/programs/${programId()}/cohorts`, payload);
    success(t('learning.createCohort'));
    cohortOpen.value = false;
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    creatingCohort.value = false;
  }
}

async function launch(cohort) {
  const id = String(cohort._id);
  launchingId.value = id;
  try {
    await apiClient.post(`/lms/cohorts/${id}/launch`);
    success(t('learning.launchCohortSuccess'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    launchingId.value = '';
  }
}

watch(() => route.params.id, (id, prev) => {
  if (id && id !== prev) load();
});
onMounted(load);
</script>
