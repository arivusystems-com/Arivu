/**
 * ============================================================================
 * PLATFORM CORE: Derived Status Composable
 * ============================================================================
 * 
 * Composable for checking if status fields should be read-only.
 * 
 * When derivedStatus exists, status fields are system-owned and should be
 * displayed as read-only badges/labels.
 * 
 * Usage:
 *   const { isStatusReadOnly, hasConfig } = useDerivedStatus(record, entity);
 *   if (isStatusReadOnly.value) {
 *     // Display as badge, not editable
 *   }
 * 
 * ============================================================================
 */

import { computed, ref, type Ref } from 'vue';
import apiClient from '@/utils/apiClient';

/**
 * Check if status field should be read-only for a record
 * 
 * @param record - Record object (People, Organization, or Deal)
 * @param entity - Entity name ('people', 'organization', 'deal')
 * @param appKey - Optional app key (defaults to 'SALES')
 * @returns {Object} - { isStatusReadOnly, hasConfig, isLoading }
 */
export function useDerivedStatus(
  record: Ref<{ derivedStatus?: unknown } | null | undefined>,
  entity: 'people' | 'organization' | 'deal',
  appKey: string = 'SALES'
) {
  const isLoading = ref(false);
  const configExists = ref<boolean | null>(null);

  // Check if derivedStatus exists on the record
  const hasDerivedStatus = computed(() => {
    if (!record.value) return false;
    return record.value.derivedStatus != null && record.value.derivedStatus !== '';
  });

  // Check if config exists (cached, non-blocking)
  const checkConfig = async () => {
    if (configExists.value !== null) {
      return configExists.value;
    }

    try {
      isLoading.value = true;
      const response = await apiClient.get(`/config-registry/entity-types/${entity}`, {
        params: { appKey }
      });
      configExists.value = response.success && response.data && response.data.length > 0;
    } catch (error) {
      console.error(`[useDerivedStatus] Error checking config for ${entity}:`, error);
      configExists.value = false; // Fail-open for backward compatibility
    } finally {
      isLoading.value = false;
    }

    return configExists.value;
  };

  // Status is read-only if derivedStatus exists
  const isStatusReadOnly = computed(() => {
    return hasDerivedStatus.value;
  });

  // Legacy mode: no derivedStatus, allow editing
  const isLegacyMode = computed(() => {
    return !hasDerivedStatus.value;
  });

  // Initialize config check (non-blocking)
  if (record.value) {
    checkConfig();
  }

  return {
    isStatusReadOnly,
    isLegacyMode,
    hasDerivedStatus,
    hasConfig: computed(() => configExists.value === true),
    isLoading,
    checkConfig
  };
}
