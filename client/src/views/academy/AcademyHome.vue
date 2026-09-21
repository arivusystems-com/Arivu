<template>
  <div class="academy-home space-y-10">
    <div
      v-if="needsAccept"
      class="rounded-2xl border border-amber-200/80 bg-amber-50/90 p-5 shadow-sm backdrop-blur-sm dark:border-amber-900 dark:bg-amber-950/40"
    >
      <p class="text-sm font-medium text-amber-900 dark:text-amber-100">
        {{ t('learning.academyInvitePending') }}
      </p>
      <button
        type="button"
        class="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
        :style="{ background: brandColor }"
        :disabled="accepting"
        @click="acceptInvite"
      >
        {{ accepting ? t('learning.academyAccepting') : t('learning.academyAcceptInvite') }}
      </button>
    </div>

    <section class="academy-home__hero relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur-sm sm:p-8 lg:p-10 dark:border-slate-700/60 dark:bg-slate-900/60">
      <div class="academy-home__hero-mesh pointer-events-none absolute inset-0" aria-hidden="true" />
      <div class="relative max-w-2xl">
        <p
          class="text-xs font-semibold uppercase tracking-[0.16em]"
          :style="{ color: brandColor }"
        >
          {{ branding?.name || t('learning.academyNameFallback') }}
        </p>
        <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {{ t('learning.academyHomeTitle', { name: branding?.name || t('learning.academyNameFallback') }) }}
        </h1>
        <p class="mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
          {{ t('learning.academyHomeBlurb') }}
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <router-link
            :to="primaryCta.to"
            class="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
            :style="{ background: brandColor }"
          >
            <PlayCircleIcon class="h-5 w-5" />
            {{ primaryCta.label }}
          </router-link>
          <router-link
            to="/academy/catalog"
            class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-5 py-2.5 text-sm font-semibold text-slate-800 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <BookOpenIcon class="h-5 w-5" />
            {{ t('learning.academyBrowseCatalog') }}
          </router-link>
        </div>
      </div>
    </section>

    <section v-if="loading" class="space-y-4" aria-busy="true">
      <div class="h-6 w-48 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800" />
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
        <div class="h-28 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
      </div>
    </section>

    <section v-else-if="inProgress.length" class="space-y-4">
      <div class="flex items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('learning.academyContinueLearning') }}
          </h2>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {{ t('learning.academyContinueBlurb') }}
          </p>
        </div>
        <router-link
          to="/academy/my"
          class="shrink-0 text-sm font-semibold transition hover:opacity-80"
          :style="{ color: brandColor }"
        >
          {{ t('learning.academyViewAllLearning') }}
        </router-link>
      </div>
      <ul class="grid gap-4 sm:grid-cols-2">
        <li
          v-for="(row, idx) in inProgress"
          :key="row.enrollment?._id || row.course?._id"
        >
          <router-link
            :to="`/academy/courses/${row.course?._id}`"
            class="academy-home__card group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70"
            :style="{ animationDelay: `${idx * 60}ms` }"
          >
            <div class="flex items-start justify-between gap-3">
              <h3 class="font-semibold text-slate-900 transition group-hover:opacity-90 dark:text-white">
                {{ row.course?.title || t('learning.untitledCourse') }}
              </h3>
              <span
                v-if="row.overdue"
                class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300"
              >
                {{ t('learning.overdue') }}
              </span>
            </div>
            <div class="mt-4">
              <div class="mb-1.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>{{ t('learning.academyResume') }}</span>
                <span>{{ Math.round(row.progress?.percentComplete || 0) }}%</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{
                    width: `${Math.min(100, Math.round(row.progress?.percentComplete || 0))}%`,
                    background: brandColor,
                  }"
                />
              </div>
            </div>
          </router-link>
        </li>
      </ul>
    </section>

    <section class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
          {{ t('learning.academyExplore') }}
        </h2>
        <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {{ t('learning.academyExploreBlurb') }}
        </p>
      </div>
      <div class="grid gap-4 sm:grid-cols-3">
        <router-link
          v-for="dest in destinations"
          :key="dest.to"
          :to="dest.to"
          class="academy-home__card group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70"
        >
          <span
            class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition duration-300 group-hover:scale-105"
            :style="{ background: brandColor }"
          >
            <component :is="dest.icon" class="h-5 w-5" />
          </span>
          <h3 class="mt-4 font-semibold text-slate-900 dark:text-white">{{ dest.title }}</h3>
          <p class="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{{ dest.blurb }}</p>
          <ArrowRightIcon
            class="mt-4 h-4 w-4 text-slate-400 transition duration-300 group-hover:translate-x-1"
            :style="{ color: brandColor }"
          />
        </router-link>
      </div>
    </section>

    <section v-if="!loading && featuredCourses.length" class="space-y-4">
      <div class="flex items-end justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            {{ t('learning.academyFeatured') }}
          </h2>
          <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {{ t('learning.academyFeaturedBlurb') }}
          </p>
        </div>
        <router-link
          to="/academy/catalog"
          class="shrink-0 text-sm font-semibold transition hover:opacity-80"
          :style="{ color: brandColor }"
        >
          {{ t('learning.academyViewCatalog') }}
        </router-link>
      </div>
      <ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <li
          v-for="(course, idx) in featuredCourses"
          :key="course._id"
        >
          <router-link
            :to="`/academy/courses/${course._id}`"
            class="academy-home__card group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/70"
            :style="{ animationDelay: `${idx * 70}ms` }"
          >
            <div
              class="mb-4 h-1.5 w-12 rounded-full transition duration-300 group-hover:w-16"
              :style="{ background: brandColor }"
              aria-hidden="true"
            />
            <h3 class="font-semibold text-slate-900 dark:text-white">{{ course.title }}</h3>
            <p class="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {{ course.description || t('learning.academyCourseNoDescription') }}
            </p>
            <span
              class="mt-4 inline-flex items-center gap-1 text-sm font-semibold"
              :style="{ color: brandColor }"
            >
              {{ t('learning.academyOpenCourse') }}
              <ArrowRightIcon class="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </router-link>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  AcademicCapIcon,
  ArrowRightIcon,
  BookOpenIcon,
  PlayCircleIcon,
  RectangleStackIcon,
} from '@heroicons/vue/24/outline';
import apiClient from '@/utils/apiClient';
import { useNotifications } from '@/composables/useNotifications';
import { useAcademyBranding, ACADEMY_DEFAULT_PRIMARY_COLOR } from '@/composables/useAcademyBranding';

const { t } = useI18n();
const { success, error } = useNotifications();
const { branding } = useAcademyBranding();

const me = ref(null);
const accepting = ref(false);
const loading = ref(true);
const myLearning = ref([]);
const catalog = ref([]);

const brandColor = computed(() => branding.value?.primaryColor || ACADEMY_DEFAULT_PRIMARY_COLOR);
const needsAccept = computed(() => me.value?.access?.status === 'invited');

const inProgress = computed(() =>
  (myLearning.value || [])
    .filter((row) => {
      const pct = Number(row?.progress?.percentComplete || 0);
      return pct > 0 && pct < 100;
    })
    .slice(0, 4)
);

const featuredCourses = computed(() => (catalog.value || []).slice(0, 3));

const primaryCta = computed(() => {
  if (inProgress.value.length) {
    const first = inProgress.value[0];
    return {
      to: `/academy/courses/${first.course?._id}`,
      label: t('learning.academyContinueCta'),
    };
  }
  return {
    to: '/academy/catalog',
    label: t('learning.academyStartLearning'),
  };
});

const destinations = computed(() => [
  {
    to: '/academy/catalog',
    title: t('learning.academyCatalog'),
    blurb: t('learning.academyCatalogBlurb'),
    icon: BookOpenIcon,
  },
  {
    to: '/academy/my',
    title: t('learning.academyMyLearning'),
    blurb: t('learning.academyMyLearningBlurb'),
    icon: RectangleStackIcon,
  },
  {
    to: '/academy/certificates',
    title: t('learning.academyCertificates'),
    blurb: t('learning.academyCertificatesHomeBlurb'),
    icon: AcademicCapIcon,
  },
]);

async function loadMe() {
  try {
    const res = await apiClient.get('/lms/academy/me', { cache: 'no-store' });
    me.value = res?.data || res;
  } catch (e) {
    if (e?.response?.data?.code === 'ACADEMY_ACCESS_REQUIRED') {
      me.value = { access: { status: 'invited' } };
    }
  }
}

async function loadHomeData() {
  loading.value = true;
  try {
    const [myRes, catalogRes] = await Promise.all([
      apiClient.get('/lms/academy/my-learning', { cache: 'no-store' }).catch(() => null),
      apiClient.get('/lms/academy/catalog', { cache: 'no-store' }).catch(() => null),
    ]);
    myLearning.value = myRes?.data || myRes || [];
    catalog.value = catalogRes?.data || catalogRes || [];
  } finally {
    loading.value = false;
  }
}

async function acceptInvite() {
  accepting.value = true;
  try {
    await apiClient.post('/lms/academy/accept');
    success(t('learning.academyAccepted'));
    await loadMe();
  } catch (e) {
    error(e?.response?.data?.message || e?.message || t('learning.loadFailed'));
  } finally {
    accepting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadMe(), loadHomeData()]);
});
</script>

<style scoped>
.academy-home__hero-mesh {
  background:
    radial-gradient(ellipse 80% 60% at 100% 0%, color-mix(in srgb, var(--academy-brand-primary, #3a1f8a) 18%, transparent), transparent 55%),
    radial-gradient(ellipse 50% 40% at 0% 100%, color-mix(in srgb, var(--academy-brand-primary, #3a1f8a) 10%, transparent), transparent 50%);
}

.academy-home__card {
  animation: academy-rise 0.55s ease both;
}

@keyframes academy-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .academy-home__card {
    animation: none;
  }
}
</style>
