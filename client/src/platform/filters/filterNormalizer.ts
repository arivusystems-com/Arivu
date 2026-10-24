/**
 * Generic Filter Normalizer
 * 
 * Normalizes filter values based on filterType from schema.
 * Works for all modules without hardcoding field names.
 */

export type FilterType = 'text' | 'select' | 'multi-select' | 'boolean' | 'user' | 'entity' | 'date';

export type FilterValue = string | number | boolean | null | string[];

export interface FilterConfig {
  key: string;
  filterType: FilterType;
  [key: string]: unknown;
}

/**
 * Normalize filters for API requests
 * Converts UI filter values to API-compatible values
 */
export function normalizeFiltersForAPI(
  filters: Record<string, FilterValue | undefined>,
  filterConfigs: FilterConfig[],
  currentUserId?: string
): Record<string, FilterValue | undefined> {
  const normalized = { ...filters };

  filterConfigs.forEach(filterConfig => {
    const key = filterConfig.key;
    const filterType = filterConfig.filterType;
    const value = normalized[key];

    if (value === undefined || value === '') {
      return; // Skip undefined/empty values
    }

    // Normalize based on filterType
    switch (filterType) {
      case 'user':
        // Convert 'me' to userId; use literal 'null' for unassigned (survives query serialization)
        if (value === 'me' && currentUserId) {
          normalized[key] = currentUserId;
        } else if (value === 'unassigned') {
          normalized[key] = 'null';
        }
        break;

      case 'boolean':
        // Convert string booleans to actual booleans if needed
        if (value === 'true') {
          normalized[key] = true;
        } else if (value === 'false') {
          normalized[key] = false;
        }
        // Special handling for do_not_contact
        if (key === 'do_not_contact' || key === 'doNotContact') {
          if (value === 'doNotContact') {
            normalized[key] = true;
          } else if (value === 'allowed') {
            normalized[key] = false;
          }
        }
        break;

      case 'entity':
        // Entity filters might need special handling
        // For now, pass through as-is
        break;

      case 'select':
      case 'multi-select':
        // Select filters pass through as-is
        break;

      case 'date':
        // Date filters might need formatting
        // For now, pass through as-is
        break;

      case 'text':
        // Text filters pass through as-is
        break;
    }
  });

  return normalized;
}

/**
 * Normalize filters from saved views for UI display
 * Converts API values back to UI-friendly values
 */
export function normalizeFiltersForUI(
  filters: Record<string, FilterValue | undefined>,
  filterConfigs: FilterConfig[],
  currentUserId?: string
): Record<string, FilterValue | undefined> {
  const normalized = { ...filters };

  filterConfigs.forEach(filterConfig => {
    const key = filterConfig.key;
    const filterType = filterConfig.filterType;
    const value = normalized[key];

    if (value === undefined) {
      return; // Skip undefined values
    }

    // Normalize based on filterType
    switch (filterType) {
      case 'user':
        // Convert userId to 'me', null to 'unassigned'
        if (value === currentUserId) {
          normalized[key] = 'me';
        } else if (value === null) {
          normalized[key] = 'unassigned';
        }
        break;

      case 'boolean':
        // Convert booleans to string values for UI
        if (value === true) {
          // Special handling for do_not_contact
          if (key === 'do_not_contact' || key === 'doNotContact') {
            normalized[key] = 'doNotContact';
          } else {
            normalized[key] = 'true';
          }
        } else if (value === false) {
          if (key === 'do_not_contact' || key === 'doNotContact') {
            normalized[key] = 'allowed';
          } else {
            normalized[key] = 'false';
          }
        }
        break;

      case 'entity':
      case 'select':
      case 'multi-select':
      case 'date':
      case 'text':
        // These pass through as-is
        break;
    }
  });

  return normalized;
}
