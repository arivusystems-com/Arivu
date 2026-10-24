/**
 * ============================================================================
 * PLATFORM REGISTRY VALIDATION: App Registry Validation Layer
 * ============================================================================
 * 
 * Validates app registry structure and configuration.
 * 
 * Rules:
 * - Runs at startup (dev)
 * - On app install (marketplace)
 * - On CI (optional)
 * - Throws descriptive errors (not silent failures)
 * 
 * ============================================================================
 */

import type { AppRegistry } from '@/types/sidebar.types';
import {
  createRegistryError,
  createValidationError,
  type PlatformContractError,
} from '@/types/platform-errors.types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: PlatformContractError[];
  warnings: string[];
}

/**
 * Validate app registry structure
 * 
 * @param appRegistry - App registry to validate
 * @returns Validation result
 */
export function validateAppRegistry(appRegistry: AppRegistry): ValidationResult {
  const errors: PlatformContractError[] = [];
  const warnings: string[] = [];

  // 1. Validate registry is an object
  if (!appRegistry || typeof appRegistry !== 'object') {
    errors.push(
      createRegistryError('App registry must be an object', {
        received: typeof appRegistry,
      })
    );
    return { valid: false, errors, warnings };
  }

  // 2. Validate each app entry
  const appKeys = Object.keys(appRegistry);
  const seenRoutes = new Set<string>();

  for (const appKey of appKeys) {
    const app = appRegistry[appKey];

    // 2.1. Validate app structure
    if (!app) {
      errors.push(
        createRegistryError(`App entry for ${appKey} is null or undefined`)
      );
      continue;
    }

    if (!app.appKey || app.appKey !== appKey) {
      errors.push(
        createRegistryError(`App key mismatch for ${appKey}`, {
          expected: appKey,
          received: app.appKey,
        })
      );
    }

    if (!app.label || typeof app.label !== 'string') {
      errors.push(
        createRegistryError(`App ${appKey} missing or invalid label`, {
          received: app.label,
        })
      );
    }

    if (!app.dashboardRoute || typeof app.dashboardRoute !== 'string') {
      errors.push(
        createRegistryError(`App ${appKey} missing or invalid dashboardRoute`, {
          received: app.dashboardRoute,
        })
      );
    } else {
      // Check for duplicate routes
      if (seenRoutes.has(app.dashboardRoute)) {
        warnings.push(
          `App ${appKey} has duplicate dashboard route: ${app.dashboardRoute}`
        );
      }
      seenRoutes.add(app.dashboardRoute);
    }

    // 2.2. Validate modules (moduleKey may repeat across apps — e.g. cases in HELPDESK vs AUDIT)
    if (app.modules && Array.isArray(app.modules)) {
      const seenModuleKeysInApp = new Set<string>();
      for (const module of app.modules) {
        if (!module.moduleKey || typeof module.moduleKey !== 'string') {
          errors.push(
            createRegistryError(`Module in app ${appKey} missing moduleKey`, {
              module,
            })
          );
          continue;
        }

        if (seenModuleKeysInApp.has(module.moduleKey)) {
          errors.push(
            createRegistryError(
              `Duplicate moduleKey ${module.moduleKey} in app ${appKey}`,
              { module }
            )
          );
        }
        seenModuleKeysInApp.add(module.moduleKey);

        if (!module.label || typeof module.label !== 'string') {
          errors.push(
            createRegistryError(
              `Module ${module.moduleKey} in app ${appKey} missing label`,
              { module }
            )
          );
        }

        if (!module.route || typeof module.route !== 'string') {
          errors.push(
            createRegistryError(
              `Module ${module.moduleKey} in app ${appKey} missing route`,
              { module }
            )
          );
        } else {
          // Validate route format (should start with /)
          if (!module.route.startsWith('/')) {
            errors.push(
              createRegistryError(
                `Module ${module.moduleKey} in app ${appKey} has invalid route (must start with /)`,
                { route: module.route }
              )
            );
          }
        }

        // Validate navigation intent flags
        // Rule: navigationEntity and appKey cannot both be set (except 'platform' which is special)
        if (module.navigationEntity === true && module.appKey && module.appKey.toLowerCase() !== 'platform') {
          errors.push(
            createValidationError(
              `Module ${module.moduleKey} in app ${appKey} has navigationEntity: true but also has appKey (${module.appKey}). Modules marked for Entities section cannot belong to a business app (only 'platform' is allowed).`,
              { module }
            )
          );
        }

        // Rule: navigationCore and appKey cannot both be set (except 'platform' which is special)
        if (module.navigationCore === true && module.appKey && module.appKey.toLowerCase() !== 'platform') {
          errors.push(
            createValidationError(
              `Module ${module.moduleKey} in app ${appKey} has navigationCore: true but also has appKey (${module.appKey}). Core items are virtual and cannot belong to a business app (only 'platform' is allowed).`,
              { module }
            )
          );
        }

        // Rule: excludeFromApps should not be set without navigationEntity
        if (module.excludeFromApps === true && module.navigationEntity !== true) {
          warnings.push(
            `Module ${module.moduleKey} in app ${appKey} has excludeFromApps: true but navigationEntity is not set. This may be intentional, but consider setting navigationEntity: true for core entities.`
          );
        }

        // Validate list configuration if present
        if (module.list) {
          // Validate columns
          if (module.list.columns && Array.isArray(module.list.columns)) {
            const columnKeys = new Set<string>();
            for (const column of module.list.columns) {
              if (!column.key || typeof column.key !== 'string') {
                errors.push(
                  createValidationError(
                    `Column in module ${module.moduleKey} missing key`,
                    { column }
                  )
                );
                continue;
              }

              if (columnKeys.has(column.key)) {
                errors.push(
                  createValidationError(
                    `Duplicate column key ${column.key} in module ${module.moduleKey}`,
                    { column }
                  )
                );
              }
              columnKeys.add(column.key);

              if (!column.label || typeof column.label !== 'string') {
                errors.push(
                  createValidationError(
                    `Column ${column.key} in module ${module.moduleKey} missing label`,
                    { column }
                  )
                );
              }

              if (!column.dataType || typeof column.dataType !== 'string') {
                errors.push(
                  createValidationError(
                    `Column ${column.key} in module ${module.moduleKey} missing dataType`,
                    { column }
                  )
                );
              }

              // Validate fieldPath if provided
              if (column.fieldPath && typeof column.fieldPath !== 'string') {
                errors.push(
                  createValidationError(
                    `Column ${column.key} in module ${module.moduleKey} has invalid fieldPath`,
                    { column }
                  )
                );
              }
            }
          }

          // Validate actions
          const validateActions = (
            actions: Array<{ key?: unknown; label?: unknown }> | undefined,
            actionType: string
          ) => {
            if (!actions || !Array.isArray(actions)) return;

            const actionKeys = new Set<string>();
            for (const action of actions) {
              if (!action.key || typeof action.key !== 'string') {
                errors.push(
                  createValidationError(
                    `${actionType} action in module ${module.moduleKey} missing key`,
                    { action }
                  )
                );
                continue;
              }

              if (actionKeys.has(action.key)) {
                errors.push(
                  createValidationError(
                    `Duplicate ${actionType} action key ${action.key} in module ${module.moduleKey}`,
                    { action }
                  )
                );
              }
              actionKeys.add(action.key);

              if (!action.label || typeof action.label !== 'string') {
                errors.push(
                  createValidationError(
                    `${actionType} action ${action.key} in module ${module.moduleKey} missing label`,
                    { action }
                  )
                );
              }
            }
          };

          validateActions(module.list.primaryActions, 'Primary');
          validateActions(module.list.bulkActions, 'Bulk');
          validateActions(module.list.rowActions, 'Row');

          // Validate filters
          if (module.list.filters && Array.isArray(module.list.filters)) {
            const filterKeys = new Set<string>();
            for (const filter of module.list.filters) {
              if (!filter.key || typeof filter.key !== 'string') {
                errors.push(
                  createValidationError(
                    `Filter in module ${module.moduleKey} missing key`,
                    { filter }
                  )
                );
                continue;
              }

              if (filterKeys.has(filter.key)) {
                errors.push(
                  createValidationError(
                    `Duplicate filter key ${filter.key} in module ${module.moduleKey}`,
                    { filter }
                  )
                );
              }
              filterKeys.add(filter.key);

              if (!filter.fieldPath || typeof filter.fieldPath !== 'string') {
                errors.push(
                  createValidationError(
                    `Filter ${filter.key} in module ${module.moduleKey} missing fieldPath`,
                    { filter }
                  )
                );
              }
            }
          }
        }
      }
    }

    // 2.3. Validate dashboard configuration if present
    if (app.dashboard) {
      const dashboard = app.dashboard;

      // Validate dashboard actions
      if (dashboard.actions && Array.isArray(dashboard.actions)) {
        const actionKeys = new Set<string>();
        for (const action of dashboard.actions) {
          if (!action.key || typeof action.key !== 'string') {
            errors.push(
              createValidationError(
                `Dashboard action in app ${appKey} missing key`,
                { action }
              )
            );
            continue;
          }

          if (actionKeys.has(action.key)) {
            errors.push(
              createValidationError(
                `Duplicate dashboard action key ${action.key} in app ${appKey}`,
                { action }
              )
            );
          }
          actionKeys.add(action.key);
        }
      }

      // Validate dashboard KPIs
      if (dashboard.kpis && Array.isArray(dashboard.kpis)) {
        const kpiKeys = new Set<string>();
        for (const kpi of dashboard.kpis) {
          if (!kpi.key || typeof kpi.key !== 'string') {
            errors.push(
              createValidationError(
                `Dashboard KPI in app ${appKey} missing key`,
                { kpi }
              )
            );
            continue;
          }

          if (kpiKeys.has(kpi.key)) {
            errors.push(
              createValidationError(
                `Duplicate dashboard KPI key ${kpi.key} in app ${appKey}`,
                { kpi }
              )
            );
          }
          kpiKeys.add(kpi.key);
        }

        // Warn if KPI count is outside recommended range
        if (dashboard.kpis.length < 3 || dashboard.kpis.length > 6) {
          warnings.push(
            `App ${appKey} has ${dashboard.kpis.length} KPIs. Recommended: 3-6 KPIs.`
          );
        }
      }

      // Validate dashboard widgets
      if (dashboard.widgets && Array.isArray(dashboard.widgets)) {
        const widgetKeys = new Set<string>();
        for (const widget of dashboard.widgets) {
          if (!widget.key || typeof widget.key !== 'string') {
            errors.push(
              createValidationError(
                `Dashboard widget in app ${appKey} missing key`,
                { widget }
              )
            );
            continue;
          }

          if (widgetKeys.has(widget.key)) {
            errors.push(
              createValidationError(
                `Duplicate dashboard widget key ${widget.key} in app ${appKey}`,
                { widget }
              )
            );
          }
          widgetKeys.add(widget.key);
        }
      }
    }
  }

  // 3. Check for orphan modules (modules referenced in dashboard but not in sidebar)
  // This is a warning, not an error, as it might be intentional
  for (const appKey of appKeys) {
    const app = appRegistry[appKey];
    if (!app) continue;

    if (app.dashboard?.kpis) {
      for (const kpi of app.dashboard.kpis) {
        if (kpi.linkTo) {
          // Check if linkTo references a valid module
          const moduleExists = app.modules?.some(
            (m) => m.route === kpi.linkTo || m.moduleKey === kpi.linkTo
          );
          if (!moduleExists) {
            warnings.push(
              `Dashboard KPI ${kpi.key} in app ${appKey} links to ${kpi.linkTo}, but no matching module found`
            );
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw if invalid
 * 
 * @param appRegistry - App registry to validate
 * @throws PlatformContractError if validation fails
 */
export function validateAppRegistryOrThrow(appRegistry: AppRegistry): void {
  const result = validateAppRegistry(appRegistry);
  
  if (!result.valid) {
    const errorMessages = result.errors.map((e) => e.message).join('\n');
    throw createRegistryError(
      `App registry validation failed:\n${errorMessages}`,
      {
        errors: result.errors.map((e) => e.toJSON()),
        warnings: result.warnings,
      }
    );
  }
  
  // Log warnings in development
  if (import.meta.env.DEV && result.warnings.length > 0) {
    console.warn('App registry validation warnings:', result.warnings);
  }
}

