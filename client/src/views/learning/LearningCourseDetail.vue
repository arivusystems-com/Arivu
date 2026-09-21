<template>
  <div class="mx-auto max-w-6xl">
    <div v-if="loading" class="h-96 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800" />

    <template v-else-if="course">
      <TabGroup :selected-index="tabIndex" @change="onTabChange">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <router-link
              to="/learning/courses"
              class="text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
            >
              ← {{ t('learning.courses') }}
            </router-link>
            <h1 class="mt-1 truncate text-2xl font-semibold text-gray-900 dark:text-white">
              {{ course.title }}
            </h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ course.description }}</p>
            <div v-if="isEnrolled" class="mt-3 max-w-sm">
              <div class="flex items-center justify-between text-xs text-gray-500">
                <span>{{ t('learning.progress', { percent: percentComplete }) }}</span>
                <span v-if="hasCertificate" class="font-medium text-emerald-600 dark:text-emerald-400">
                  {{ t('learning.certificateEarned') }}
                </span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  class="h-full rounded-full bg-indigo-600 transition-all"
                  :style="{ width: `${percentComplete}%` }"
                />
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              v-if="canAuthor && !isDraft"
              type="button"
              class="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-200 dark:hover:bg-indigo-950/40"
              @click="assignOpen = true"
            >
              {{ t('learning.assign') }}
            </button>
            <button
              v-if="!isDraft && !isEnrolled"
              type="button"
              class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              @click="enrollSelf"
            >
              {{ t('learning.enroll') }}
            </button>
            <button
              v-else-if="canClaimCertificate"
              type="button"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              @click="claimCertificate"
            >
              {{ t('learning.claimCertificate') }}
            </button>
            <TabList class="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              <Tab
                v-slot="{ selected }"
                as="template"
              >
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none"
                  :class="selected
                    ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'"
                >
                  {{ t('learning.tabLearn') }}
                </button>
              </Tab>
              <Tab
                v-if="isDraft && canAuthor"
                v-slot="{ selected }"
                as="template"
              >
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none"
                  :class="selected
                    ? 'bg-white text-gray-900 shadow dark:bg-gray-700 dark:text-white'
                    : 'text-gray-600 hover:text-gray-900 dark:text-gray-300'"
                >
                  {{ t('learning.tabBuild') }}
                </button>
              </Tab>
            </TabList>

            <Menu as="div" class="relative">
              <MenuButton
                class="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                {{ t('learning.actions') }}
                <ChevronDownIcon class="h-4 w-4" />
              </MenuButton>
              <transition
                enter-active-class="transition duration-100 ease-out"
                enter-from-class="transform scale-95 opacity-0"
                enter-to-class="transform scale-100 opacity-100"
                leave-active-class="transition duration-75 ease-in"
                leave-from-class="transform scale-100 opacity-100"
                leave-to-class="transform scale-95 opacity-0"
              >
                <MenuItems
                  class="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-lg border border-gray-200 bg-white py-1 shadow-lg focus:outline-none dark:border-gray-700 dark:bg-gray-900"
                >
                  <MenuItem v-if="!isEnrolled" v-slot="{ active }">
                    <button
                      type="button"
                      class="block w-full px-4 py-2 text-left text-sm"
                      :class="active ? 'bg-gray-100 dark:bg-gray-800' : ''"
                      @click="enrollSelf"
                    >
                      {{ t('learning.enroll') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canAuthor && isDraft" v-slot="{ active }">
                    <button
                      type="button"
                      class="block w-full px-4 py-2 text-left text-sm"
                      :class="active ? 'bg-gray-100 dark:bg-gray-800' : ''"
                      @click="publish"
                    >
                      {{ t('learning.publish') }}
                    </button>
                  </MenuItem>
                  <MenuItem v-if="canAuthor || canClaimCertificate" v-slot="{ active }">
                    <button
                      type="button"
                      class="block w-full px-4 py-2 text-left text-sm"
                      :class="active ? 'bg-gray-100 dark:bg-gray-800' : ''"
                      @click="claimCertificate"
                    >
                      {{ t('learning.issueCertificate') }}
                    </button>
                  </MenuItem>
                </MenuItems>
              </transition>
            </Menu>
          </div>
        </div>

        <TabPanels>
          <!-- Learn / player -->
          <TabPanel class="focus:outline-none">
            <div class="grid gap-6 lg:grid-cols-12">
              <aside class="lg:col-span-4 xl:col-span-3">
                <div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
                  <div class="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                    <p class="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {{ t('learning.outline') }}
                    </p>
                  </div>
                  <Disclosure
                    v-for="mod in course.modules || []"
                    :key="mod._id"
                    v-slot="{ open }"
                    :default-open="true"
                    as="div"
                    class="border-b border-gray-100 last:border-0 dark:border-gray-800"
                  >
                    <DisclosureButton
                      class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 dark:text-white dark:hover:bg-gray-800/60"
                    >
                      <span>{{ mod.title }}</span>
                      <ChevronUpIcon
                        class="h-4 w-4 text-gray-400 transition"
                        :class="open ? '' : 'rotate-180'"
                      />
                    </DisclosureButton>
                    <DisclosurePanel class="px-2 pb-2">
                      <button
                        v-for="obj in mod.learningObjects || []"
                        :key="obj._id"
                        type="button"
                        class="mb-1 flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm"
                        :class="activeObjectId === obj._id
                          ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'"
                        @click="selectObject(mod, obj)"
                      >
                        <span
                          class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]"
                          :class="isObjectComplete(obj._id)
                            ? 'bg-emerald-500 text-white'
                            : activeObjectId === obj._id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-200 text-transparent dark:bg-gray-600'"
                        >
                          ✓
                        </span>
                        <span class="min-w-0">
                          <span class="block font-medium">{{ obj.title }}</span>
                          <span class="text-xs text-gray-500">{{ obj.type }}</span>
                        </span>
                      </button>
                    </DisclosurePanel>
                  </Disclosure>
                  <p
                    v-if="!(course.modules || []).length"
                    class="px-4 py-6 text-sm text-gray-500"
                  >
                    {{ t('learning.emptyOutline') }}
                  </p>
                </div>
              </aside>

              <main class="lg:col-span-8 xl:col-span-9">
                <div class="min-h-[28rem] rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900 sm:p-8">
                  <template v-if="activeObject">
                    <p class="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                      {{ activeModule?.title }}
                    </p>
                    <h2 class="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                      {{ activeObject.title }}
                    </h2>
                    <p class="mt-1 text-xs text-gray-500">{{ activeObject.type }}</p>

                    <div
                      v-if="activeObject.type === 'VIDEO' && activeObject.mediaUrl"
                      class="mt-6 overflow-hidden rounded-lg bg-black"
                    >
                      <video
                        v-if="isDirectVideoUrl(activeObject.mediaUrl)"
                        class="aspect-video w-full"
                        controls
                        :src="activeObject.mediaUrl"
                      />
                      <iframe
                        v-else
                        class="aspect-video w-full"
                        :src="embedVideoUrl(activeObject.mediaUrl)"
                        title="Lesson video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                      />
                    </div>

                    <div
                      v-else-if="activeObject.type === 'DOCUMENT' && activeObject.mediaUrl"
                      class="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <a
                        :href="activeObject.mediaUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-sm font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
                      >
                        {{ t('learning.openDocument') }}
                      </a>
                      <iframe
                        v-if="isPdfUrl(activeObject.mediaUrl)"
                        class="mt-3 h-80 w-full rounded border border-gray-200 dark:border-gray-700"
                        :src="activeObject.mediaUrl"
                        title="Lesson document"
                      />
                    </div>

                    <div
                      v-else-if="activeObject.type === 'SCORM' || activeObject.type === 'LTI'"
                      class="mt-6 space-y-3"
                    >
                      <p class="text-sm text-gray-600 dark:text-gray-300">
                        {{ activeObject.type === 'SCORM' ? t('learning.scormHint') : t('learning.ltiHint') }}
                      </p>
                      <button
                        type="button"
                        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        :disabled="launching || (!isEnrolled && !isDraft)"
                        @click="launchInterop(activeObject)"
                      >
                        {{ launching ? t('learning.launching') : t('learning.launchContent') }}
                      </button>
                      <iframe
                        v-if="scormFrameUrl"
                        class="mt-3 h-[28rem] w-full rounded-lg border border-gray-200 dark:border-gray-700"
                        :src="scormFrameUrl"
                        title="SCORM content"
                        allow="fullscreen"
                      />
                    </div>

                    <div class="prose prose-sm mt-6 max-w-none dark:prose-invert">
                      <p class="whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                        {{ activeObject.body || t('learning.noLessonBody') }}
                      </p>
                    </div>
                    <div class="mt-8 flex flex-wrap gap-3 border-t border-gray-100 pt-6 dark:border-gray-800">
                      <button
                        v-if="!isObjectComplete(activeObject._id)"
                        type="button"
                        class="inline-flex rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                        :disabled="!isEnrolled && !isDraft"
                        @click="completeLesson(activeModule._id, activeObject._id)"
                      >
                        {{ t('learning.completeLesson') }}
                      </button>
                      <span
                        v-else
                        class="inline-flex items-center rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      >
                        {{ t('learning.lessonComplete') }}
                      </span>
                      <button
                        v-if="canClaimCertificate"
                        type="button"
                        class="inline-flex rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                        @click="claimCertificate"
                      >
                        {{ t('learning.claimCertificate') }}
                      </button>
                      <router-link
                        v-if="courseAssessments.length"
                        to="/learning/assessments"
                        class="inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {{ t('learning.takeAssessment') }}
                      </router-link>
                    </div>
                    <p
                      v-if="!isEnrolled && !isDraft"
                      class="mt-3 text-xs text-amber-700 dark:text-amber-300"
                    >
                      {{ t('learning.enrollToProgress') }}
                    </p>
                  </template>
                  <div v-else class="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
                    <BookOpenIcon class="h-10 w-10 text-gray-300" />
                    <p class="mt-3 text-sm text-gray-500">{{ t('learning.selectLesson') }}</p>
                  </div>
                </div>
              </main>
            </div>
          </TabPanel>

          <!-- Build (draft only) -->
          <TabPanel v-if="isDraft && canAuthor" class="focus:outline-none">
            <div class="mb-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
                @click="openModuleDialog"
              >
                {{ t('learning.addModule') }}
              </button>
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                @click="publish"
              >
                {{ t('learning.publish') }}
              </button>
            </div>
            <div
              v-for="mod in course.modules || []"
              :key="mod._id"
              class="mb-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div class="mb-3 flex items-center justify-between">
                <h3 class="font-medium text-gray-900 dark:text-white">{{ mod.title }}</h3>
                <button
                  type="button"
                  class="text-xs font-medium text-indigo-600"
                  @click="openObjectDialog(mod._id)"
                >
                  {{ t('learning.addObject') }}
                </button>
              </div>
              <ul class="space-y-2">
                <li
                  v-for="obj in mod.learningObjects || []"
                  :key="obj._id"
                  class="rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800/60"
                >
                  <p class="font-medium text-gray-900 dark:text-white">{{ obj.title }}</p>
                  <p class="text-xs text-gray-500">{{ obj.type }}</p>
                </li>
              </ul>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>

      <div
        v-if="canAuthor"
        class="mt-6 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">
          {{ t('learning.contextAppsHeading') }}
        </h3>
        <p class="mt-1 text-xs text-gray-500">{{ t('learning.contextAppsHint') }}</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <label
            v-for="app in contextAppOptions"
            :key="app.key"
            class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
          >
            <input
              v-model="selectedContextApps"
              type="checkbox"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              :value="app.key"
            >
            {{ app.label }}
          </label>
        </div>
        <button
          type="button"
          class="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          :disabled="savingContext"
          @click="saveContextApps"
        >
          {{ t('learning.saveContextApps') }}
        </button>
      </div>
    </template>

    <LearningDialog
      :open="moduleDialogOpen"
      :title="t('learning.addModule')"
      :confirm-label="t('learning.addModule')"
      :cancel-label="t('learning.cancel')"
      :disabled="!moduleTitle.trim() || savingModule"
      @close="moduleDialogOpen = false"
      @confirm="submitModule"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.moduleTitlePrompt') }}
        <input
          v-model="moduleTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          @keydown.enter.prevent="submitModule"
        >
      </label>
    </LearningDialog>

    <LearningDialog
      :open="objectDialogOpen"
      :title="t('learning.addObject')"
      :confirm-label="t('learning.addObject')"
      :cancel-label="t('learning.cancel')"
      :disabled="!objectTitle.trim() || !objectType || savingObject || uploadingMedia || (needsMediaUrl && !objectMediaUrl.trim()) || (objectType === 'LTI' && (!ltiConsumerKey.trim() || !ltiSharedSecret.trim()))"
      @close="objectDialogOpen = false"
      @confirm="submitObject"
    >
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.objectTitlePrompt') }}
        <input
          v-model="objectTitle"
          type="text"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
      </label>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ t('learning.objectTypeLabel') }}
        <select
          v-model="objectType"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          <option value="TEXT">TEXT</option>
          <option value="VIDEO">VIDEO</option>
          <option value="DOCUMENT">DOCUMENT</option>
          <option value="SCORM">SCORM</option>
          <option value="LTI">LTI</option>
        </select>
      </label>
      <label
        v-if="needsMediaUrl"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {{ mediaUrlLabel }}
        <input
          v-model="objectMediaUrl"
          type="url"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          :placeholder="mediaUrlPlaceholder"
        >
      </label>
      <div v-if="needsFileUpload" class="space-y-2">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('learning.uploadMedia') }}
          <input
            type="file"
            class="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 dark:text-gray-300 dark:file:bg-indigo-950/40 dark:file:text-indigo-200"
            :accept="objectType === 'VIDEO' ? 'video/mp4,video/webm,video/quicktime' : '.pdf,.doc,.docx,.ppt,.pptx,.txt'"
            :disabled="uploadingMedia"
            @change="onMediaFileSelected"
          >
        </label>
        <p v-if="uploadingMedia" class="text-xs text-gray-500">{{ t('learning.uploadingMedia') }}</p>
        <p v-else-if="objectMediaUrl" class="truncate text-xs text-emerald-700 dark:text-emerald-300">
          {{ t('learning.mediaReady') }}
        </p>
      </div>
      <template v-if="objectType === 'LTI'">
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('learning.ltiConsumerKey') }}
          <input
            v-model="ltiConsumerKey"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
        </label>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ t('learning.ltiSharedSecret') }}
          <input
            v-model="ltiSharedSecret"
            type="password"
            autocomplete="new-password"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
        </label>
      </template>
      <label
        v-if="objectType === 'TEXT'"
        class="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {{ t('learning.objectBodyPrompt') }}
        <textarea
          v-model="objectBody"
          rows="4"
          class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
      </label>
    </LearningDialog>

    <LearningAssignDialog
      :open="assignOpen"
      :title="t('learning.assignCourse')"
      :endpoint="`/lms/courses/${courseId}/assign`"
      @close="assignOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/vue';
import { BookOpenIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { isLearningCourseId } from '@/utils/learningIds';
import { useLearningRole } from '@/composables/useLearningRole';
import LearningDialog from './components/LearningDialog.vue';
import LearningAssignDialog from './components/LearningAssignDialog.vue';
import { uploadLearningMedia } from '@/utils/learningMediaUpload';
import {
  captureLearningCertificateClaimed,
  captureLearningCoursePublished,
  captureLearningEnrolled,
  captureLearningLessonCompleted,
  captureLearningModuleVisited,
} from '@/config/posthogLearning';

const { t } = useI18n();
const route = useRoute();
const { success, error } = useNotifications();
const { canAuthor } = useLearningRole();
const loading = ref(true);
const course = ref(null);
const learner = ref(null);
const tabIndex = ref(0);
const activeModuleId = ref(null);
const activeObjectId = ref(null);
const assignOpen = ref(false);
const uploadingMedia = ref(false);
const selectedContextApps = ref([]);
const savingContext = ref(false);

const contextAppOptions = [
  { key: 'HELPDESK', label: 'Helpdesk' },
  { key: 'SALES', label: 'Sales' },
  { key: 'MARKETING', label: 'Marketing' },
];

const moduleDialogOpen = ref(false);
const moduleTitle = ref('');
const savingModule = ref(false);

const objectDialogOpen = ref(false);
const objectModuleId = ref(null);
const objectTitle = ref('');
const objectType = ref('TEXT');
const objectBody = ref('');
const objectMediaUrl = ref('');
const ltiConsumerKey = ref('');
const ltiSharedSecret = ref('');
const savingObject = ref(false);
const launching = ref(false);
const scormFrameUrl = ref('');

const needsMediaUrl = computed(
  () =>
    objectType.value === 'VIDEO'
    || objectType.value === 'DOCUMENT'
    || objectType.value === 'SCORM'
    || objectType.value === 'LTI'
);
const needsFileUpload = computed(
  () => objectType.value === 'VIDEO' || objectType.value === 'DOCUMENT'
);
const mediaUrlLabel = computed(() => {
  if (objectType.value === 'VIDEO') return t('learning.videoUrlLabel');
  if (objectType.value === 'DOCUMENT') return t('learning.documentUrlLabel');
  if (objectType.value === 'SCORM') return t('learning.scormUrlLabel');
  if (objectType.value === 'LTI') return t('learning.ltiToolUrlLabel');
  return t('learning.videoUrlLabel');
});
const mediaUrlPlaceholder = computed(() => {
  if (objectType.value === 'VIDEO') return 'https://…';
  if (objectType.value === 'DOCUMENT') return 'https://…/file.pdf';
  if (objectType.value === 'SCORM') return 'https://…/index.html';
  if (objectType.value === 'LTI') return 'https://tool.example.com/lti/launch';
  return 'https://…';
});

const courseId = computed(() => String(route.params.id || ''));
const isDraft = computed(() => course.value?.status !== 'published');
const isEnrolled = computed(() => Boolean(learner.value?.enrollment));
const percentComplete = computed(() => Number(learner.value?.progress?.percentComplete || 0));
const completedIds = computed(() => {
  const ids = learner.value?.progress?.completedObjectIds || [];
  return new Set(ids.map((id) => String(id)));
});
const hasCertificate = computed(() => Boolean(learner.value?.certificate));
const canClaimCertificate = computed(
  () => isEnrolled.value && percentComplete.value >= 100 && !hasCertificate.value
);
const courseAssessments = computed(() => learner.value?.assessments || []);

const activeModule = computed(() =>
  (course.value?.modules || []).find((m) => m._id === activeModuleId.value)
);
const activeObject = computed(() =>
  (activeModule.value?.learningObjects || []).find((o) => o._id === activeObjectId.value)
);

function isObjectComplete(objectId) {
  return completedIds.value.has(String(objectId));
}

function selectObject(mod, obj) {
  activeModuleId.value = mod._id;
  activeObjectId.value = obj._id;
}

function selectFirstIncompleteLesson() {
  for (const mod of course.value?.modules || []) {
    for (const obj of mod.learningObjects || []) {
      if (!isObjectComplete(obj._id)) {
        selectObject(mod, obj);
        return;
      }
    }
  }
  selectFirstLesson();
}

function selectFirstLesson() {
  const mod = (course.value?.modules || [])[0];
  const obj = mod?.learningObjects?.[0];
  if (mod && obj) selectObject(mod, obj);
}

function selectNextLesson(moduleId, objectId) {
  const modules = course.value?.modules || [];
  let found = false;
  for (const mod of modules) {
    for (const obj of mod.learningObjects || []) {
      if (found) {
        selectObject(mod, obj);
        return;
      }
      if (String(mod._id) === String(moduleId) && String(obj._id) === String(objectId)) {
        found = true;
      }
    }
  }
}

function onTabChange(index) {
  tabIndex.value = index;
}

async function load() {
  if (!isLearningCourseId(courseId.value)) {
    course.value = null;
    learner.value = null;
    loading.value = false;
    error(t('learning.invalidCourse'));
    return;
  }
  loading.value = true;
  try {
    const res = await apiClient.get(`/lms/courses/${courseId.value}`, { cache: 'no-store' });
    const data = res?.data || res;
    learner.value = data?.learner || null;
    const { learner: _learner, ...courseData } = data || {};
    course.value = courseData;
    selectedContextApps.value = [...(courseData.contextAppKeys || [])].map((k) =>
      String(k).toUpperCase()
    );
    if (!activeObjectId.value) {
      selectFirstIncompleteLesson();
    }
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    loading.value = false;
  }
}

function isDirectVideoUrl(url) {
  return /\.(mp4|webm|ogg)(\?|$)/i.test(String(url || ''));
}

function isPdfUrl(url) {
  return /\.pdf(\?|$)/i.test(String(url || ''));
}

function embedVideoUrl(url) {
  const raw = String(url || '').trim();
  const yt = raw.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = raw.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return raw;
}

function openModuleDialog() {
  moduleTitle.value = '';
  moduleDialogOpen.value = true;
}

function openObjectDialog(moduleId) {
  objectModuleId.value = moduleId;
  objectTitle.value = '';
  objectType.value = 'TEXT';
  objectBody.value = '';
  objectMediaUrl.value = '';
  ltiConsumerKey.value = '';
  ltiSharedSecret.value = '';
  objectDialogOpen.value = true;
}

async function onMediaFileSelected(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;
  uploadingMedia.value = true;
  try {
    const uploaded = await uploadLearningMedia(file);
    objectMediaUrl.value = uploaded.url;
    success(t('learning.mediaReady'));
  } catch (e) {
    error(e?.message || t('learning.uploadFailed'));
  } finally {
    uploadingMedia.value = false;
    if (input) input.value = '';
  }
}

async function submitModule() {
  const title = moduleTitle.value.trim();
  if (!title || savingModule.value) return;
  savingModule.value = true;
  try {
    await apiClient.post(`/lms/courses/${courseId.value}/modules`, { title });
    moduleDialogOpen.value = false;
    await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    savingModule.value = false;
  }
}

async function submitObject() {
  const title = objectTitle.value.trim();
  const moduleId = objectModuleId.value;
  if (!title || !moduleId || savingObject.value) return;
  if (needsMediaUrl.value && !objectMediaUrl.value.trim()) return;
  if (
    objectType.value === 'LTI'
    && (!ltiConsumerKey.value.trim() || !ltiSharedSecret.value.trim())
  ) {
    return;
  }
  savingObject.value = true;
  try {
    const payload = {
      type: objectType.value,
      title,
      body: objectBody.value || '',
      mediaUrl: objectMediaUrl.value.trim() || null,
    };
    if (objectType.value === 'LTI') {
      payload.metadata = {
        ltiConsumerKey: ltiConsumerKey.value.trim(),
        ltiSharedSecret: ltiSharedSecret.value.trim(),
      };
    }
    await apiClient.post(`/lms/courses/${courseId.value}/modules/${moduleId}/objects`, payload);
    objectDialogOpen.value = false;
    await load();
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  } finally {
    savingObject.value = false;
  }
}

async function launchInterop(object) {
  if (!object?._id || launching.value) return;
  launching.value = true;
  scormFrameUrl.value = '';
  try {
    const res = await apiClient.post(
      `/lms/courses/${courseId.value}/objects/${object._id}/launch`,
      { returnUrl: window.location.href }
    );
    const data = res?.data || res;
    if (data?.mode === 'iframe' && data.url) {
      scormFrameUrl.value = data.url;
      success(t('learning.launchContent'));
      return;
    }
    if (data?.mode === 'lti_form_post' && data.url && data.params) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.url;
      form.target = '_blank';
      form.style.display = 'none';
      Object.entries(data.params).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value ?? '');
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      form.remove();
      success(t('learning.launchContent'));
      return;
    }
    error(t('learning.launchFailed'));
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.launchFailed'));
  } finally {
    launching.value = false;
  }
}

async function publish() {
  try {
    await apiClient.post(`/lms/courses/${courseId.value}/publish`);
    success(t('learning.publish'));
    captureLearningCoursePublished({ course_id: courseId.value });
    await load();
    tabIndex.value = 0;
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  }
}

async function saveContextApps() {
  if (savingContext.value) return;
  savingContext.value = true;
  try {
    await apiClient.patch(`/lms/courses/${courseId.value}/context`, {
      contextAppKeys: selectedContextApps.value,
    });
    success(t('learning.saveContextApps'));
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    savingContext.value = false;
  }
}

async function enrollSelf() {
  try {
    await apiClient.post(`/lms/courses/${courseId.value}/enroll`);
    success(t('learning.enroll'));
    captureLearningEnrolled({ course_id: courseId.value });
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.capacityReached'));
  }
}

async function completeLesson(moduleId, learningObjectId) {
  if (!isEnrolled.value && !isDraft.value) {
    error(t('learning.enrollToProgress'));
    return;
  }
  try {
    const res = await apiClient.post(`/lms/courses/${courseId.value}/complete-lesson`, {
      moduleId,
      learningObjectId,
      enrollmentId: learner.value?.enrollment?._id,
    });
    const progress = res?.data || res;
    if (progress && learner.value) {
      learner.value = {
        ...learner.value,
        progress,
      };
    } else {
      await load();
    }
    success(t('learning.completeLesson'));
    captureLearningLessonCompleted({
      course_id: courseId.value,
      learning_object_id: learningObjectId,
      percent_complete: progress?.percentComplete,
    });
    selectNextLesson(moduleId, learningObjectId);
    if (Number(progress?.percentComplete || learner.value?.progress?.percentComplete || 0) >= 100) {
      await load();
    }
  } catch (e) {
    error(e?.message || t('learning.loadFailed'));
  }
}

async function claimCertificate() {
  try {
    await apiClient.post('/lms/certificates', {
      courseId: courseId.value,
      title: `${course.value?.title || 'Course'} Certificate`,
    });
    success(t('learning.claimCertificate'));
    captureLearningCertificateClaimed({ course_id: courseId.value });
    await load();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  }
}

watch(activeObjectId, () => {
  scormFrameUrl.value = '';
});

watch(courseId, (id, prev) => {
  if (id && id !== prev) load();
});
onMounted(() => {
  captureLearningModuleVisited('learning_course_detail');
  load();
});
</script>
