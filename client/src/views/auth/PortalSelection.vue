<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/authRegistry';

const { t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const selectedRoleId = ref(null);
const rememberDefault = ref(false);
const localError = ref('');
const loadingPortals = ref(false);
const submitting = ref(false);

const portals = computed(() => authStore.user?.portals || []);
const organizationName = computed(() => authStore.organization?.name || '');

const submit = async () => {
  if (!selectedRoleId.value || submitting.value) {
    if (!selectedRoleId.value) {
      localError.value = t('auth.portalSelectionRequired');
    }
    return;
  }
  localError.value = '';
  submitting.value = true;
  try {
    const ok = await authStore.selectPortal(selectedRoleId.value);
    if (!ok) {
      localError.value = authStore.error || t('auth.portalSelectionFailed');
      return;
    }
    if (rememberDefault.value) {
      try {
        await authStore.setDefaultExternalRole(selectedRoleId.value);
      } catch (_err) {
        /* non-blocking */
      }
    }
    const nextRoute = authStore.resolvePostLoginRoute();
    const nextName = typeof nextRoute === 'string' ? null : nextRoute?.name;
    if (nextName === 'portal-select' || nextName === 'login') {
      const hasPortal = authStore.hasAssignedAppAccess('PORTAL');
      const hasLms = authStore.hasAssignedAppAccess('LMS') || authStore.hasAppAccess('LMS');
      if (!hasPortal && hasLms) {
        await router.replace({ name: 'academy-home' });
        return;
      }
      localError.value = hasPortal
        ? t('auth.portalSelectionFailed')
        : t('auth.portalSelectionEmpty');
      return;
    }
    await router.replace(nextRoute);
  } finally {
    submitting.value = false;
  }
};

onMounted(async () => {
  if (!authStore.isAuthenticated) {
    await router.replace({ name: 'login' });
    return;
  }
  if (!authStore.isExternalUser) {
    await router.replace(authStore.resolvePostLoginRoute());
    return;
  }
  loadingPortals.value = true;
  try {
    await authStore.refreshPortals();
  } catch (err) {
    localError.value = err.message || t('auth.portalSelectionLoadFailed');
    loadingPortals.value = false;
    return;
  } finally {
    loadingPortals.value = false;
  }

  // Selection not required (single portal / default already resolved) — leave this page.
  if (!authStore.needsPortalSelection) {
    await router.replace(authStore.resolvePostLoginRoute());
    return;
  }
  if (!portals.value.length) {
    localError.value = t('auth.portalSelectionEmpty');
    return;
  }

  const defaultId = authStore.user?.defaultExternalRoleId;
  if (defaultId && portals.value.some((p) => String(p.roleId) === String(defaultId))) {
    selectedRoleId.value = defaultId;
  } else if (portals.value.length === 1) {
    selectedRoleId.value = portals.value[0].roleId;
  }

  // One role: select immediately — no dead-end Continue + surfaces race.
  if (portals.value.length === 1 && selectedRoleId.value) {
    await submit();
  }
});
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-900">
    <div class="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <div class="w-full space-y-8">
        <div class="text-center">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            {{ t('auth.portalSelectionTitle') }}
          </h1>
          <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {{ t('auth.portalSelectionSubtitle', { organization: organizationName }) }}
          </p>
        </div>

        <div
          v-if="localError || authStore.error"
          class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200"
        >
          {{ localError || authStore.error }}
        </div>

        <p
          v-if="loadingPortals"
          class="text-center text-sm text-gray-600 dark:text-gray-400"
        >
          {{ t('auth.portalSelectionLoading') }}
        </p>
        <p
          v-else-if="!portals.length && !localError && !authStore.error"
          class="text-center text-sm text-gray-600 dark:text-gray-400"
        >
          {{ t('auth.portalSelectionEmpty') }}
        </p>

        <form
          v-if="portals.length"
          class="space-y-4"
          @submit.prevent="submit"
        >
          <button
            v-for="portal in portals"
            :key="String(portal.roleId)"
            type="button"
            class="flex w-full items-start gap-4 rounded-xl border p-4 text-left transition-colors"
            :class="String(selectedRoleId) === String(portal.roleId)
              ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-900/20'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'"
            @click="selectedRoleId = portal.roleId"
          >
            <span
              class="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
              :style="{ backgroundColor: portal.color || '#6366f1' }"
            >
              {{ (portal.name || '?').slice(0, 1).toUpperCase() }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-base font-semibold text-gray-900 dark:text-white">
                {{ portal.name }}
              </span>
              <span
                v-if="portal.description"
                class="mt-1 block text-sm text-gray-600 dark:text-gray-400"
              >
                {{ portal.description }}
              </span>
            </span>
          </button>

          <label
            v-if="portals.length > 1"
            class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
          >
            <input
              v-model="rememberDefault"
              type="checkbox"
              class="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            {{ t('auth.portalSelectionRememberDefault') }}
          </label>

          <button
            type="submit"
            :disabled="authStore.loading || submitting || !selectedRoleId"
            class="flex w-full justify-center rounded-md bg-indigo-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ authStore.loading || submitting ? t('auth.portalSelectionSubmitting') : t('auth.portalSelectionContinue') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
