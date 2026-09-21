import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getModuleLabelKey } from '@/utils/navigationLabels';
import {
  buildMergeTagTreeGroups,
  fetchAllModuleOptions
} from '@/utils/templateMergeTagSchema';

/**
 * Merge-tag tree for template builder data panel.
 * @param {import('vue').Ref<string>|import('vue').ComputedRef<string>} moduleScopeRef
 */
export function useTemplateMergeTagSchema(moduleScopeRef) {
  const { t, te } = useI18n();
  const loading = ref(false);
  const treeGroups = ref([]);

  async function reload(scope) {
    loading.value = true;
    try {
      treeGroups.value = await buildMergeTagTreeGroups(scope);
    } catch {
      treeGroups.value = await buildMergeTagTreeGroups('');
    } finally {
      loading.value = false;
    }
  }

  watch(
    moduleScopeRef,
    (scope) => {
      void reload(scope);
    },
    { immediate: true }
  );

  return {
    loading,
    treeGroups,
    reload
  };
}

export function useTemplateModuleOptions() {
  const { t, te } = useI18n();
  const loading = ref(false);
  const moduleOptions = ref([]);

  async function loadModuleOptions() {
    loading.value = true;
    try {
      const options = await fetchAllModuleOptions(t, te, getModuleLabelKey);
      const hasBilling = options.some((o) => o.key === 'billing_invoices');
      moduleOptions.value = hasBilling
        ? options
        : [
          ...options,
          {
            key: 'billing_invoices',
            label: t('platform.commercialAdminPdfSettingsBillingModuleScope')
          }
        ];
    } catch {
      moduleOptions.value = [
        {
          key: 'billing_invoices',
          label: t('platform.commercialAdminPdfSettingsBillingModuleScope')
        }
      ];
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    moduleOptions,
    loadModuleOptions
  };
}
