<template>
  <div class="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
    <header class="sticky top-0 z-40 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 lg:px-6">
        <div class="flex min-w-0 items-center gap-3">
          <img
            v-if="branding?.logoUrl"
            :src="branding.logoUrl"
            alt=""
            class="h-8 w-auto max-w-[140px] object-contain"
          >
          <span
            class="truncate text-lg font-semibold"
            :style="{ color: branding?.primaryColor || '#3a1f8a' }"
          >
            {{ branding?.name || t('learning.academyNameFallback') }}
          </span>
        </div>
        <nav class="hidden items-center gap-1 sm:flex">
          <router-link
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            :class="isActive(item.to) ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : ''"
          >
            {{ item.label }}
          </router-link>
        </nav>
        <div class="flex shrink-0 items-center gap-2">
          <router-link
            v-if="showPortalLink"
            to="/portal/dashboard"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {{ t('navigation.goToPortal') }}
          </router-link>
          <router-link
            v-if="showAuditLink"
            to="/audit"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {{ t('navigation.goToAudit') }}
          </router-link>
          <button
            type="button"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            @click="logout"
          >
            {{ t('navigation.signOut') }}
          </button>
        </div>
      </div>
      <nav class="flex gap-1 overflow-x-auto border-t border-gray-100 px-2 py-2 sm:hidden dark:border-gray-800">
        <router-link
          v-for="item in nav"
          :key="`m-${item.to}`"
          :to="item.to"
          class="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300"
          :class="isActive(item.to) ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : ''"
        >
          {{ item.label }}
        </router-link>
        <router-link
          v-if="showPortalLink"
          to="/portal/dashboard"
          class="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          {{ t('navigation.goToPortal') }}
        </router-link>
        <router-link
          v-if="showAuditLink"
          to="/audit"
          class="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
        >
          {{ t('navigation.goToAudit') }}
        </router-link>
      </nav>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-6">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/authRegistry';
import { useAcademyBranding } from '@/composables/useAcademyBranding';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { branding, loadBranding } = useAcademyBranding();

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
