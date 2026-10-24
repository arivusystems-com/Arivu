/**
 * ============================================================================
 * PLATFORM CORE: Config-Aware Field Visibility
 * ============================================================================
 * 
 * Utility for determining which fields should be visible based on Config Registry.
 * 
 * When Config Registry defines entity types and lifecycles, only show fields
 * relevant to the selected type/lifecycle.
 * 
 * Usage:
 *   const { getVisibleFields } = useConfigAwareFields();
 *   const visibleFields = await getVisibleFields('people', 'Lead', 'SALES');
 * 
 * ============================================================================
 */

import apiClient from '@/utils/apiClient';

interface ConfigStatusMapping {
  sourceStatusField?: string;
}

interface ConfigLifecycle {
  statusMappings?: ConfigStatusMapping[];
}

interface ConfigEntityType {
  key?: string;
  lifecycles?: ConfigLifecycle[];
}

/**
 * Get visible fields for an entity based on config registry
 * 
 * @param entity - Entity name ('people', 'organization', 'deal')
 * @param type - Entity type (e.g., 'Lead', 'Contact', 'Customer')
 * @param appKey - App key (defaults to 'SALES')
 * @returns Promise<Array<string>> - Array of field keys that should be visible
 */
export async function getVisibleFieldsForEntity(
  entity: 'people' | 'organization' | 'deal',
  type: string | null,
  appKey: string = 'SALES'
): Promise<string[]> {
  try {
    const response = await apiClient.get(`/config-registry/configuration/${entity}`, {
      params: { appKey }
    });
    
    if (!response.success || !response.data || !response.data.entityTypes || response.data.entityTypes.length === 0) {
      // No config exists - return empty array (all fields visible, no filtering)
      return [];
    }
    
    // Find matching entity type
    const entityTypes: ConfigEntityType[] = Array.isArray(response.data.entityTypes)
      ? response.data.entityTypes
      : [];
    const entityType = entityTypes.find((et) => et.key === type?.toLowerCase());
    
    if (!entityType || !entityType.lifecycles || entityType.lifecycles.length === 0) {
      return [];
    }
    
    // Get fields from lifecycle status mappings
    const visibleFields: string[] = [];
    
    for (const lifecycle of entityType.lifecycles) {
      if (lifecycle.statusMappings && Array.isArray(lifecycle.statusMappings)) {
        for (const mapping of lifecycle.statusMappings) {
          if (mapping.sourceStatusField && !visibleFields.includes(mapping.sourceStatusField)) {
            visibleFields.push(mapping.sourceStatusField);
          }
        }
      }
    }
    
    return visibleFields;
  } catch (error) {
    console.error(`[configAwareFields] Error fetching config for ${entity}:`, error);
    // Fail-open: return empty array (all fields visible)
    return [];
  }
}

/**
 * Check if a field should be visible based on config
 * 
 * @param entity - Entity name
 * @param fieldKey - Field key to check
 * @param type - Entity type
 * @param appKey - App key
 * @returns Promise<boolean> - Whether field should be visible
 */
export async function shouldShowField(
  entity: 'people' | 'organization' | 'deal',
  fieldKey: string,
  type: string | null,
  appKey: string = 'SALES'
): Promise<boolean> {
  const visibleFields = await getVisibleFieldsForEntity(entity, type, appKey);
  
  // If no config exists (empty array), show all fields (backward compatible)
  if (visibleFields.length === 0) {
    return true;
  }
  
  // If config exists, only show fields in the visibleFields list
  return visibleFields.includes(fieldKey);
}
