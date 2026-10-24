/**
 * ============================================================================
 * MOMENTUM SIGNAL DERIVATION
 * ============================================================================
 * 
 * Derives momentum signals from profile data.
 * 
 * This module contains ALL signal derivation logic, separated from presentation.
 * 
 * ARCHITECTURE:
 * - Derivation: Facts → Signal candidates (this module)
 * - Interpretation: Signal type → Severity, category, intent (momentumTypes.ts)
 * - Presentation: Signals → UI (MomentumLayer.vue)
 * 
 * API EVOLUTION:
 * - Currently: deriveMomentumSignals() is the local fallback
 * - Future: GET /people/{id}/momentum will replace this
 * - UI should not care where signals come from
 * - This function can become a fallback when API is unavailable
 * 
 * RULES:
 * - No UI concerns (no components, no rendering)
 * - No API calls (uses existing profileData only)
 * - Returns normalized MomentumSignal objects
 * - Uses MomentumSignalType definitions for interpretation
 * - Preserves existing temporary signal logic exactly as-is
 * 
 * ============================================================================
 */

import type { MomentumSignal } from './momentumSignal';
import { createMomentumSignal } from './momentumSignal';
import { PEOPLE_FIELD_METADATA } from '@/platform/fields/peopleFieldModel';

export interface ProfileData {
  core?: {
    fields?: {
      do_not_contact?: boolean;
      updatedAt?: string | Date;
      [key: string]: unknown;
    };
  };
  apps?: {
    [appKey: string]: {
      fields?: {
        sales_type?: string;
        type?: string;
        lead_status?: string;
        contact_status?: string;
        status?: string;
        updatedAt?: string | Date;
        [key: string]: unknown;
      };
      metadata?: {
        detachedAt?: string | Date;
        [key: string]: unknown;
      };
    };
  };
}

export interface SuppressionContext {
  /** Suppress attach-related signals when Attach-to-App modal is open */
  attachModalOpen?: boolean;
  /** Suppress conversion signal when Convert modal is open */
  convertModalOpen?: boolean;
  /** Suppress stale participation signals for these appKeys (after activity in current session) */
  staleSuppressedApps?: Set<string>;
}

/**
 * Derive momentum signals from profile data
 * 
 * @param profileData - Profile data to derive signals from
 * @param personId - Optional person ID for action handlers that need to reference the person
 * @param suppressionContext - Optional suppression context to hide signals when user is actively resolving them
 */
export function deriveMomentumSignals(
  profileData: ProfileData | null, 
  personId?: string | null,
  suppressionContext?: SuppressionContext
): MomentumSignal[] {
  const result: MomentumSignal[] = [];
  
  if (!profileData) return result;
  
  const coreFields = profileData.core?.fields || {};
  const apps = profileData.apps || {};
  const suppression = suppressionContext || {};
  const salesAppFields = apps.SALES?.fields;
  const salesRoleTop = salesAppFields?.sales_type;

  // Signal 1: Do Not Contact flag (critical)
  // Type: DO_NOT_CONTACT_FLAG
  if (coreFields.do_not_contact === true) {
    result.push(createMomentumSignal(
      'DO_NOT_CONTACT_FLAG',
      'This person has requested not to be contacted.',
      'Compliance',
      'Review'
    ));
  }
  
  // Signal 2: No activity in X days (warning)
  // Type: NO_ACTIVITY_STALE
  // Check if we have updatedAt field
  if (coreFields.updatedAt) {
    const updatedAt = new Date(coreFields.updatedAt);
    const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceUpdate > 30) {
      result.push(createMomentumSignal(
        'NO_ACTIVITY_STALE',
        `No activity recorded in ${daysSinceUpdate} days.`,
        'Activity',
        'Add Note'
      ));
    }
  }
  
  // Signal 3: SALES Lead without status (info)
  // Type: LEAD_STATUS_MISSING
  if (salesRoleTop === 'Lead' && salesAppFields && !salesAppFields.lead_status) {
    result.push(createMomentumSignal(
      'LEAD_STATUS_MISSING',
      'Lead status has not been set.',
      'SALES',
      'Set Status',
      {
        actionIntent: 'update',
        handler: personId ? () => {
          // Scroll to status badge and open dropdown
          const badgeId = `status-badge-SALES-${personId}`;
          const badgeElement = document.getElementById(badgeId);
          if (badgeElement) {
            badgeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // Trigger click to open dropdown after scroll
            setTimeout(() => {
              badgeElement.click();
            }, 300);
          }
        } : null
      }
    ));
  }
  
  // Signal 4: SALES Contact with DoNotContact status (warning)
  // Type: CONTACT_DO_NOT_CONTACT_STATUS
  if (salesRoleTop === 'Contact' && salesAppFields?.contact_status === 'DoNotContact') {
    result.push(createMomentumSignal(
      'CONTACT_DO_NOT_CONTACT_STATUS',
      'Contact status is set to Do Not Contact.',
      'SALES',
      'Review'
    ));
  }
  
  // Signal 5: Missing required participation fields (critical)
  // Type: MISSING_REQUIRED_FIELDS
  // Check each app participation for missing required fields
  Object.entries(apps).forEach(([appKey, appSection]) => {
    const appFields = appSection.fields || {};
    const appSalesRole = appFields.sales_type;

    // Only check if person actually participates in this app
    if (appKey === 'SALES' && !appSalesRole) {
      return; // Not participating in SALES
    }
    
    // Get all participation fields for this app that are required
    const participationFields = Object.entries(PEOPLE_FIELD_METADATA).filter(
      ([_, metadata]) => 
        metadata.owner === 'participation' && 
        metadata.fieldScope === appKey &&
        metadata.requiredFor?.includes(appKey)
    );
    
    // Check for missing required fields
    // IMPORTANT: Only check fields that are visible (present in appFields)
    // Hidden fields are not included in profileData, so they won't be in appFields
    // This ensures we only flag missing fields that the user can actually see/edit
    const missingFields: string[] = [];
    participationFields.forEach(([fieldName, _metadata]) => {
      // For SALES app, check type-specific requirements:
      // - lead_status is only required when type === 'Lead'
      // - contact_status is only required when type === 'Contact'
      if (appKey === 'SALES') {
        if (fieldName === 'lead_status' && appSalesRole !== 'Lead') {
          return; // Skip lead_status check for Contacts
        }
        if (fieldName === 'contact_status' && appSalesRole !== 'Contact') {
          return; // Skip contact_status check for Leads
        }
      }
      
      // Field is considered visible if it exists in appFields (even if empty)
      // If field is not in appFields at all, it's hidden and should be ignored
      const fieldExists = fieldName in appFields;
      if (!fieldExists) {
        // Field is hidden - skip it
        return;
      }
      
      // Field is visible - check if value is empty
      const fieldValue = appFields[fieldName];
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        missingFields.push(fieldName);
      }
    });
    
    if (missingFields.length > 0) {
      // Suppress if attach modal is open (user is actively resolving)
      if (suppression.attachModalOpen) {
        return;
      }
      
      // Determine app name based on type (for SALES)
      let appName: string;
      if (appKey === 'SALES') {
        const participationType = appSalesRole;
        if (participationType === 'Contact') {
          appName = 'Sales Contact';
        } else if (participationType === 'Lead') {
          appName = 'Sales Lead';
        } else {
          appName = 'Sales participation';
        }
      } else {
        appName = `${appKey} participation`;
      }
      
      result.push(createMomentumSignal(
        'MISSING_REQUIRED_FIELDS',
        `${appName} is missing required information to move forward.`,
        appKey,
        'Fix Now',
        {
          severity: 'critical', // Explicitly set to critical
          handler: personId ? () => {
            // Open Participation Edit Modal to fix missing fields
            const event = new CustomEvent('momentum-action', {
              detail: {
                action: 'edit-details',
                appKey,
                personId
              }
            });
            window.dispatchEvent(event);
          } : null
        }
      ));
    }
  });
  
  // Signal 6: Lead ready for conversion (info)
  // Type: LEAD_READY_FOR_CONVERSION
  // Condition: appKey === SALES, type === 'Lead', lead_status === 'Qualified'
  // Suppress if convert modal is open (user is actively resolving)
  if (salesRoleTop === 'Lead' && salesAppFields?.lead_status === 'Qualified') {
    if (!suppression.convertModalOpen) {
      result.push(createMomentumSignal(
        'LEAD_READY_FOR_CONVERSION',
        'This Lead is qualified and ready to be converted to a Contact.',
        'SALES',
        'Convert to Contact',
        {
          handler: personId ? () => {
            // Open Convert to Contact modal
            const event = new CustomEvent('momentum-action', {
              detail: {
                action: 'convert-lead',
                appKey: 'SALES',
                personId
              }
            });
            window.dispatchEvent(event);
          } : null
        }
      ));
    }
  }
  
  // Signal 7: Stale participation (warning)
  // Type: STALE_PARTICIPATION
  // Condition: Participation exists, no activity in last N days (30)
  Object.entries(apps).forEach(([appKey, appSection]) => {
    const appFields = appSection.fields || {};
    const appSalesRole = appFields.sales_type;

    // Only check if person actually participates in this app
    if (appKey === 'SALES' && !appSalesRole) {
      return; // Not participating in SALES
    }
    
    // Check for last activity date
    // IMPORTANT: Only use app-level updatedAt - do NOT fall back to core updatedAt
    // Identity-level activity (e.g., updating name) should NOT reset participation staleness
    // This ensures signals reflect actual participation activity, not general profile updates
    const lastActivityDate = appFields.updatedAt;
    if (lastActivityDate) {
      const activityDate = new Date(lastActivityDate);
      const daysSinceActivity = Math.floor((Date.now() - activityDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceActivity > 30) {
        // Suppress if this app's stale signal was suppressed (user added activity in current session)
        if (suppression.staleSuppressedApps?.has(appKey)) {
          return;
        }
        
        const appName = appKey === 'SALES' ? 'Sales' : appKey;
        result.push(createMomentumSignal(
          'STALE_PARTICIPATION',
          `No recent ${appName} activity in the last 30 days.`,
          appKey,
          'Add Activity',
          {
            handler: personId ? () => {
              // Open Activity / Add Note / Schedule Task
              const event = new CustomEvent('momentum-action', {
                detail: {
                  action: 'add-activity',
                  appKey,
                  personId
                }
              });
              window.dispatchEvent(event);
            } : null
          }
        ));
      }
    }
  });
  
  // Signal 8: Detached but re-attachable (info)
  // Type: DETACHED_REATTACHABLE
  // Condition: App allows detachment, participation was detached
  // Note: This requires metadata about detachment history, which may not be available
  // For now, we'll skip this signal if we don't have detachment metadata
  Object.entries(apps).forEach(([appKey, appSection]) => {
    // Check if app allows detachment (import from detachPolicy)
    // For now, we'll check if MARKETING app has detachedAt metadata
    if (appKey === 'MARKETING' && appSection.metadata?.detachedAt) {
      // Suppress if attach modal is open (user is actively resolving)
      if (suppression.attachModalOpen) {
        return;
      }
      
      result.push(createMomentumSignal(
        'DETACHED_REATTACHABLE',
        'Previously removed from Marketing — can be re-attached if needed.',
        appKey,
        'Attach to App',
        {
          handler: personId ? () => {
            // Open Attach to App modal
            const event = new CustomEvent('momentum-action', {
              detail: {
                action: 'attach-to-app',
                appKey,
                personId
              }
            });
            window.dispatchEvent(event);
          } : null
        }
      ));
    }
  });
  
  // Signal 9: Recently updated (info) - only if no other signals
  // Type: RECENTLY_UPDATED
  if (result.length === 0 && coreFields.updatedAt) {
    const updatedAt = new Date(coreFields.updatedAt);
    const daysSinceUpdate = Math.floor((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceUpdate <= 7) {
      const timeLabel = daysSinceUpdate === 0 
        ? 'today' 
        : daysSinceUpdate === 1 
        ? 'yesterday' 
        : `${daysSinceUpdate} days ago`;
      
      result.push(createMomentumSignal(
        'RECENTLY_UPDATED',
        `Updated ${timeLabel}.`,
        'Activity',
        'View History'
      ));
    }
  }
  
  return result;
}

/**
 * Sort signals by severity (critical → warning → info)
 */
export function sortSignalsBySeverity(signals: MomentumSignal[]): MomentumSignal[] {
  const severityOrder = {
    critical: 3,
    warning: 2,
    info: 1
  };
  
  return [...signals].sort((a, b) => {
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

