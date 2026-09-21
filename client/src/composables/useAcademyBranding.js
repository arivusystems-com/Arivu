import { ref } from 'vue';
import apiClient from '@/utils/apiClient';

export const ACADEMY_DEFAULT_PRIMARY_COLOR = '#3a1f8a';

const branding = ref(null);
const loading = ref(false);
let loadPromise = null;

function applyCssVariables(data) {
  const color = data?.primaryColor || ACADEMY_DEFAULT_PRIMARY_COLOR;
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--academy-brand-primary', color);
  document.documentElement.style.setProperty('--portal-brand-primary', color);
}

export function useAcademyBranding() {
  async function loadBranding(force = false) {
    if (branding.value && !force) return branding.value;
    if (loadPromise && !force) return loadPromise;

    loading.value = true;
    loadPromise = apiClient
      .get('/lms/academy/branding', { cache: 'no-store' })
      .then((res) => {
        const data = res?.data || res;
        branding.value = {
          enabled: Boolean(data?.enabled),
          name: data?.name || 'Academy',
          logoUrl: data?.logoUrl || null,
          primaryColor: data?.primaryColor || ACADEMY_DEFAULT_PRIMARY_COLOR,
          secondaryColor: data?.secondaryColor || null,
          faviconUrl: data?.faviconUrl || null,
        };
        applyCssVariables(branding.value);
        return branding.value;
      })
      .catch(() => branding.value)
      .finally(() => {
        loading.value = false;
        loadPromise = null;
      });

    return loadPromise;
  }

  return { branding, loading, loadBranding };
}
