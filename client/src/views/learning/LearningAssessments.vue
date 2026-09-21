<template>
  <div class="mx-auto max-w-6xl">
    <LearningPageHeader :title="t('learning.assessments')" :subtitle="t('learning.assessmentsBlurb')">
      <template v-if="canAuthor" #actions>
        <button
          type="button"
          class="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          @click="createOpen = true"
        >
          {{ t('learning.createAssessment') }}
        </button>
      </template>
    </LearningPageHeader>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in 3" :key="i" class="h-36 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-800" />
    </div>
    <p v-else-if="!rows.length" class="text-sm text-gray-500">{{ t('learning.emptyAssessments') }}</p>
    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="row in rows"
        :key="row._id"
        class="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900"
      >
        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-950/40">
            <ClipboardDocumentCheckIcon class="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-gray-900 dark:text-white">{{ row.title }}</h3>
            <p class="mt-1 text-xs text-gray-500">
              {{ t('learning.questionCount', { count: (row.questions || []).length }) }}
              · {{ t('learning.passScore', { score: row.passScorePercent ?? 70 }) }}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="mt-4 inline-flex justify-center rounded-lg border border-indigo-600 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
          @click="takeAssessment(row)"
        >
          {{ t('learning.takeAssessment') }}
        </button>
      </article>
    </div>

    <!-- Create dialog -->
    <TransitionRoot appear :show="createOpen" as="template">
      <Dialog class="relative z-50" @close="createOpen = false">
        <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="duration-150 ease-in" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('learning.createAssessment') }}
                </DialogTitle>
                <label class="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ t('learning.assessmentTitlePrompt') }}
                  <input
                    v-model="newTitle"
                    type="text"
                    class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    @keydown.enter.prevent="createAssessment"
                  >
                </label>
                <div class="mt-6 flex justify-end gap-2">
                  <button type="button" class="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800" @click="createOpen = false">
                    {{ t('learning.cancel') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                    :disabled="!newTitle.trim() || creating"
                    @click="createAssessment"
                  >
                    {{ t('learning.createAssessment') }}
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Take assessment dialog -->
    <TransitionRoot appear :show="Boolean(active)" as="template">
      <Dialog class="relative z-50" @close="active = null">
        <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-black/40" />
        </TransitionChild>
        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4">
            <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100" leave="duration-150 ease-in" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95">
              <DialogPanel
                v-if="active"
                class="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900"
              >
                <DialogTitle class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ active.title }}
                </DialogTitle>
                <div v-for="q in active.questions || []" :key="q._id" class="mt-5 space-y-3">
                  <p class="text-sm font-medium text-gray-900 dark:text-white">{{ q.prompt }}</p>
                  <RadioGroup
                    v-if="q.type !== 'multiple_answer'"
                    :model-value="answers[q._id]"
                    @update:model-value="(v) => { answers[q._id] = v; }"
                  >
                    <div class="space-y-2">
                      <RadioGroupOption
                        v-for="opt in q.options || []"
                        :key="opt.id"
                        v-slot="{ checked }"
                        :value="opt.id"
                        as="template"
                      >
                        <button
                          type="button"
                          class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm"
                          :class="checked
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100'
                            : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'"
                        >
                          <span
                            class="h-3.5 w-3.5 rounded-full border-2"
                            :class="checked ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'"
                          />
                          {{ opt.label }}
                        </button>
                      </RadioGroupOption>
                    </div>
                  </RadioGroup>
                  <div v-else class="space-y-2">
                    <label
                      v-for="opt in q.options || []"
                      :key="opt.id"
                      class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                    >
                      <input
                        type="checkbox"
                        :value="opt.id"
                        :checked="(answers[q._id] || []).includes(opt.id)"
                        class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        @change="toggleMulti(q._id, opt.id, $event.target.checked)"
                      >
                      {{ opt.label }}
                    </label>
                  </div>
                </div>
                <div class="mt-6 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                    @click="submit"
                  >
                    {{ t('learning.submitAssessment') }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                    @click="active = null"
                  >
                    {{ t('learning.cancel') }}
                  </button>
                </div>
                <p
                  v-if="result"
                  class="mt-4 rounded-lg px-3 py-2 text-sm font-medium"
                  :class="result.passed
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'"
                >
                  {{ result.passed ? t('learning.assessmentPassed') : t('learning.assessmentFailed') }}
                  — {{ result.scorePercent }}%
                </p>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </TransitionRoot>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  RadioGroup,
  RadioGroupOption,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { ClipboardDocumentCheckIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import LearningPageHeader from './components/LearningPageHeader.vue';
import { useLearningRole } from '@/composables/useLearningRole';
import { captureLearningAssessmentSubmitted } from '@/config/posthogLearning';

const { t } = useI18n();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const rows = ref([]);
const active = ref(null);
const answers = reactive({});
const result = ref(null);
const createOpen = ref(false);
const newTitle = ref('');
const creating = ref(false);

async function load() {
  loading.value = true;
  try {
    const res = await apiClient.get('/lms/assessments', { cache: 'no-store' });
    rows.value = res?.data || res || [];
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

async function createAssessment() {
  const title = newTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    let courseId = null;
    try {
      const coursesRes = await apiClient.get('/lms/courses?status=published', { cache: 'no-store' });
      const courses = coursesRes?.data || coursesRes || [];
      courseId = courses[0]?._id || null;
    } catch {
      courseId = null;
    }
    await apiClient.post('/lms/assessments', {
      title,
      courseId,
      passScorePercent: 70,
      questions: [
        {
          prompt: 'Arivu Learning is a first-class app (not an add-on).',
          type: 'true_false',
          points: 1,
          options: [
            { id: 't', label: 'True', correct: true },
            { id: 'f', label: 'False', correct: false },
          ],
        },
        {
          prompt: 'Learning is billed by:',
          type: 'multiple_choice',
          points: 1,
          options: [
            { id: 'a', label: 'Every Arivu user', correct: false },
            { id: 'b', label: 'Learner seats', correct: true },
            { id: 'c', label: 'MAU only', correct: false },
          ],
        },
      ],
    });
    success(t('learning.createAssessment'));
    createOpen.value = false;
    newTitle.value = '';
    await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    creating.value = false;
  }
}

function takeAssessment(row) {
  active.value = row;
  result.value = null;
  Object.keys(answers).forEach((k) => delete answers[k]);
}

function toggleMulti(qid, oid, checked) {
  const cur = Array.isArray(answers[qid]) ? [...answers[qid]] : [];
  if (checked) {
    if (!cur.includes(oid)) cur.push(oid);
  } else {
    const i = cur.indexOf(oid);
    if (i >= 0) cur.splice(i, 1);
  }
  answers[qid] = cur;
}

async function submit() {
  if (!active.value) return;
  const payload = (active.value.questions || []).map((q) => {
    if (q.type === 'multiple_answer') {
      return { questionId: q._id, optionIds: answers[q._id] || [] };
    }
    return { questionId: q._id, optionId: answers[q._id] };
  });
  try {
    const res = await apiClient.post(`/lms/assessments/${active.value._id}/submit`, { answers: payload });
    result.value = res?.data || res;
    captureLearningAssessmentSubmitted({
      assessment_id: active.value._id,
      passed: result.value?.passed,
      score_percent: result.value?.scorePercent,
    });
    success(result.value?.passed ? t('learning.assessmentPassed') : t('learning.assessmentFailed'));
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  }
}

onMounted(load);
</script>
