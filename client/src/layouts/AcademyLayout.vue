<template>
  <div class="academy-shell relative flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div class="academy-shell__glow academy-shell__glow--a" />
      <div class="academy-shell__glow academy-shell__glow--b" />
    </div>

    <header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      <div
        class="h-0.5 w-full"
        :style="{ background: brandColor }"
        aria-hidden="true"
      />
      <div class="relative mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 lg:px-6">
        <router-link to="/academy" class="group flex min-w-0 items-center gap-3">
          <img
            v-if="branding?.logoUrl"
            :src="branding.logoUrl"
            alt=""
            class="h-9 w-auto max-w-[148px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
          >
          <span
            v-else
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
            :style="{ background: brandColor }"
          >
            {{ brandInitial }}
          </span>
          <span
            class="truncate text-lg font-semibold tracking-tight"
            :style="{ color: brandColor }"
          >
            {{ branding?.name || t('learning.academyNameFallback') }}
          </span>
        </router-link>

        <nav class="hidden items-center gap-0.5 md:flex">
          <router-link
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="relative rounded-full px-3.5 py-1.5 text-sm font-medium text-slate-600 transition-colors duration-200 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            :class="isActive(item.to) ? 'text-slate-900 dark:text-white' : ''"
            :style="isActive(item.to) ? { background: `${brandColor}1f` } : undefined"
          >
            {{ item.label }}
          </router-link>
        </nav>

        <div class="flex shrink-0 items-center gap-2">
          <router-link
            v-if="showPortalLink"
            to="/portal/dashboard"
            class="hidden rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {{ t('navigation.goToPortal') }}
          </router-link>
          <router-link
            v-if="showAuditLink"
            to="/audit"
            class="hidden rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {{ t('navigation.goToAudit') }}
          </router-link>
          <button
            type="button"
            class="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="logout"
          >
            {{ t('navigation.signOut') }}
          </button>
        </div>
      </div>

      <nav class="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2 md:hidden dark:border-slate-800">
        <router-link
          v-for="item in nav"
          :key="`m-${item.to}`"
          :to="item.to"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition dark:text-slate-300"
          :class="isActive(item.to) ? 'text-slate-900 dark:text-white' : ''"
          :style="isActive(item.to) ? { background: `${brandColor}1f` } : undefined"
        >
          {{ item.label }}
        </router-link>
        <router-link
          v-if="showPortalLink"
          to="/portal/dashboard"
          class="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          {{ t('navigation.goToPortal') }}
        </router-link>
        <router-link
          v-if="showAuditLink"
          to="/audit"
          class="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          {{ t('navigation.goToAudit') }}
        </router-link>
      </nav>
    </header>

    <main class="relative mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-6 lg:py-10">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useAcademyBranding, ACADEMY_DEFAULT_PRIMARY_COLOR } from '@/composables/useAcademyBranding';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { branding, loadBranding } = useAcademyBranding();

const brandColor = computed(() => branding.value?.primaryColor || ACADEMY_DEFAULT_PRIMARY_COLOR);
const brandInitial = computed(() => {
  const name = branding.value?.name || t('learning.academyNameFallback');
  return String(name).trim().charAt(0).toUpperCase() || 'A';
});

/** Dual-entitled EXTERNAL: explicit switch back (locked Portal↔Academy invariant). */
const showPortalLink = computed(() => authStore.hasAssignedAppAccess('PORTAL'));
const showAuditLink = computed(() => authStore.hasAssignedAppAccess('AUDIT'));

const nav = computed(() => [
  { to: '/academy', label: t('learning.academyHome') },
  { to: '/academy/catalog', label: t('learning.academyCatalog') },
  { to: '/academy/my', label: t('learning.academyMyLearning') },
  { to: '/academy/certificates', label: t('learning.academyCertificates') },
  { to: '/academy/profile', label: t('learning.academyProfile') },
]);

function isActive(to) {
  const p = route.path;
  if (to === '/academy') return p === '/academy' || p === '/academy/';
  return p === to || p.startsWith(`${to}/`);
}

async function logout() {
  await authStore.logout?.();
  router.push('/login');
}

onMounted(() => {
  loadBranding();
});
</script>

<style scoped>
.academy-shell {
  background-image:
    linear-gradient(180deg, rgb(248 250 252) 0%, rgb(241 245 249) 45%, rgb(248 250 252) 100%);
}

:global(html.dark) .academy-shell {
  background-image:
    linear-gradient(180deg, rgb(2 6 23) 0%, rgb(15 23 42) 50%, rgb(2 6 23) 100%);
}

.academy-shell__glow {
  position: absolute;
  border-radius: 9999px;
  filter: blur(72px);
  opacity: 0.35;
  will-change: transform;
  animation: academy-drift 18s ease-in-out infinite alternate;
}

.academy-shell__glow--a {
  top: -8rem;
  right: -4rem;
  width: 28rem;
  height: 28rem;
  background: color-mix(in srgb, var(--academy-brand-primary, #3a1f8a) 28%, transparent);
}

.academy-shell__glow--b {
  bottom: 10%;
  left: -6rem;
  width: 22rem;
  height: 22rem;
  background: color-mix(in srgb, var(--academy-brand-primary, #3a1f8a) 16%, transparent);
  animation-delay: -6s;
  animation-duration: 22s;
}

@keyframes academy-drift {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(2%, 3%, 0) scale(1.06); }
}

@media (prefers-reduced-motion: reduce) {
  .academy-shell__glow {
    animation: none;
  }
}
</style>
