/**
 * ============================================================================
 * PEOPLE HISTORY EVENT MAPPING — CANONICAL DEFINITION
 * ============================================================================
 * 
 * Maps backend activity log action strings to human-readable, app-scoped
 * history entries.
 * 
 * This is a frontend-only mapping layer. No backend changes required.
 * 
 * PRINCIPLES:
 * - Neutral, factual tone
 * - App context always visible
 * - Clear "what happened" descriptions
 * - No opinions or judgments
 * 
 * ============================================================================
 */

export interface PeopleHistoryMetadata {
  appKey?: string;
  peopleType?: string;
  updatedFields?: string[];
  appContext?: string;
  to?: string;
  subject?: string;
  from?: string;
}

export interface HistoryEventMapping {
  action: string;
  displayText: (metadata: PeopleHistoryMetadata | null | undefined, appContext?: string) => string;
  appContext?: string; // If action is app-specific
}

/**
 * Format app name for display
 */
function formatAppName(appKey: string | null | undefined): string {
  if (!appKey) return 'Core';
  
  const appNames: Record<string, string> = {
    'SALES': 'Sales',
    'MARKETING': 'Marketing',
    'HELPDESK': 'Helpdesk',
    'AUDIT': 'Audit',
    'PORTAL': 'Portal',
    'PROJECTS': 'Projects',
    'LMS': 'LMS'
  };
  
  return appNames[appKey.toUpperCase()] || appKey;
}

/**
 * Format participation type for display
 */
function formatParticipationType(type: string | null | undefined): string {
  if (!type) return '';
  
  const typeMap: Record<string, string> = {
    'LEAD': 'Lead',
    'lead': 'Lead',
    'CONTACT': 'Contact',
    'contact': 'Contact',
    'MEMBER': 'Member',
    'member': 'Member',
    'USER': 'User',
    'user': 'User'
  };
  
  return typeMap[type.toUpperCase()] || type;
}

/**
 * Canonical event mappings
 */
export const PEOPLE_HISTORY_EVENTS: Record<string, HistoryEventMapping> = {
  // Person created
  'created this record': {
    action: 'created this record',
    displayText: (metadata) => {
      const appKey = metadata?.appKey;
      const peopleType = metadata?.peopleType;
      
      if (appKey && peopleType) {
        const appName = formatAppName(appKey);
        const type = formatParticipationType(peopleType);
        return `Created and attached to ${appName} as ${type}`;
      }
      
      return 'Created this person';
    }
  },
  
  // Core identity updated
  'updated core information': {
    action: 'updated core information',
    displayText: (metadata) => {
      const fields = metadata?.updatedFields;
      if (fields && Array.isArray(fields) && fields.length > 0) {
        return `Updated core information (${fields.join(', ')})`;
      }
      return 'Updated core information';
    },
    appContext: 'Core'
  },
  
  // Attached to app
  'app_context_attached': {
    action: 'app_context_attached',
    displayText: (metadata) => {
      const appKey = metadata?.appKey;
      const appName = formatAppName(appKey);
      return `Attached to ${appName}`;
    }
  },
  
  // Added to app as type (from attach endpoint)
  'added_to_sales_as_lead': {
    action: 'added_to_sales_as_lead',
    displayText: () => 'Attached to Sales as Lead',
    appContext: 'SALES'
  },
  
  'added_to_sales_as_contact': {
    action: 'added_to_sales_as_contact',
    displayText: () => 'Attached to Sales as Contact',
    appContext: 'SALES'
  },
  
  'added_to_marketing_as_contact': {
    action: 'added_to_marketing_as_contact',
    displayText: () => 'Attached to Marketing as Contact',
    appContext: 'MARKETING'
  },
  
  'added_to_helpdesk_as_contact': {
    action: 'added_to_helpdesk_as_contact',
    displayText: () => 'Attached to Helpdesk as Contact',
    appContext: 'HELPDESK'
  },
  
  'added_to_audit_as_member': {
    action: 'added_to_audit_as_member',
    displayText: () => 'Attached to Audit as Member',
    appContext: 'AUDIT'
  },
  
  'added_to_portal_as_user': {
    action: 'added_to_portal_as_user',
    displayText: () => 'Attached to Portal as User',
    appContext: 'PORTAL'
  },
  
  'added_to_projects_as_member': {
    action: 'added_to_projects_as_member',
    displayText: () => 'Attached to Projects as Member',
    appContext: 'PROJECTS'
  },
  
  // Participation details updated
  'updated sales app-specific fields': {
    action: 'updated sales app-specific fields',
    displayText: (metadata) => {
      const fields = metadata?.updatedFields;
      if (fields && Array.isArray(fields) && fields.length > 0) {
        return `Updated Sales details (${fields.join(', ')})`;
      }
      return 'Updated Sales details';
    },
    appContext: 'SALES'
  },
  
  'updated marketing app-specific fields': {
    action: 'updated marketing app-specific fields',
    displayText: (metadata) => {
      const fields = metadata?.updatedFields;
      if (fields && Array.isArray(fields) && fields.length > 0) {
        return `Updated Marketing details (${fields.join(', ')})`;
      }
      return 'Updated Marketing details';
    },
    appContext: 'MARKETING'
  },
  
  'updated helpdesk app-specific fields': {
    action: 'updated helpdesk app-specific fields',
    displayText: (metadata) => {
      const fields = metadata?.updatedFields;
      if (fields && Array.isArray(fields) && fields.length > 0) {
        return `Updated Helpdesk details (${fields.join(', ')})`;
      }
      return 'Updated Helpdesk details';
    },
    appContext: 'HELPDESK'
  },
  
  // Convert Lead to Contact
  'converted_sales_lead_to_contact': {
    action: 'converted_sales_lead_to_contact',
    displayText: () => 'Converted Lead → Contact (Sales)',
    appContext: 'SALES'
  },
  
  // Detached from app
  'detached_from_app': {
    action: 'detached_from_app',
    displayText: (metadata) => {
      const appKey = metadata?.appKey;
      const appName = formatAppName(appKey);
      return `Detached from ${appName}`;
    }
  },
  
  // Activity added (task, note, meeting)
  'added_task': {
    action: 'added_task',
    displayText: (metadata) => {
      const appContext = metadata?.appContext;
      const appName = formatAppName(appContext);
      return appContext ? `Added task (${appName})` : 'Added task';
    }
  },
  
  'added_note': {
    action: 'added_note',
    displayText: (metadata) => {
      const appContext = metadata?.appContext;
      const appName = formatAppName(appContext);
      return appContext ? `Added note (${appName})` : 'Added note';
    }
  },
  
  'scheduled_meeting': {
    action: 'scheduled_meeting',
    displayText: (metadata) => {
      const appContext = metadata?.appContext;
      const appName = formatAppName(appContext);
      return appContext ? `Scheduled meeting (${appName})` : 'Scheduled meeting';
    }
  },

  'email_sending': {
    action: 'email_sending',
    displayText: (metadata) => {
      const to = metadata?.to;
      const subj = metadata?.subject;
      if (to && subj) return `Email to ${to} (sending…)`;
      if (to) return `Email to ${to} (sending…)`;
      return 'Email (sending…)';
    }
  },

  'email_failed': {
    action: 'email_failed',
    displayText: (metadata) => {
      const to = metadata?.to;
      if (to) return `Email to ${to} (failed — retry?)`;
      return 'Email (failed — retry?)';
    }
  },

  'email_sent': {
    action: 'email_sent',
    displayText: (metadata) => {
      const subj = metadata?.subject;
      const to = metadata?.to;
      if (subj && to) return `Sent email to ${to}: "${subj}"`;
      if (to) return `Sent email to ${to}`;
      return 'Sent email';
    }
  },

  'email_received': {
    action: 'email_received',
    displayText: (metadata) => {
      const from = metadata?.from;
      const subj = metadata?.subject;
      if (from && subj) return `Received email from ${from}: "${subj}"`;
      if (from) return `Received email from ${from}`;
      return 'Received email';
    }
  }
};

/**
 * Get display text for an activity
 */
export function getHistoryDisplayText(
  action: string,
  metadata: PeopleHistoryMetadata | null | undefined = {},
  appContext?: string | null
): string {
  // Check for exact match first
  if (PEOPLE_HISTORY_EVENTS[action]) {
    return PEOPLE_HISTORY_EVENTS[action].displayText(metadata, appContext || undefined);
  }
  
  // Check for pattern matches (e.g., 'added_to_{app}_as_{type}')
  if (action.startsWith('added_to_')) {
    const parts = action.split('_');
    if (parts.length >= 4) {
      const rawAppKey = parts[2];
      if (!rawAppKey) {
        return action
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase()
          .replace(/^\w/, c => c.toUpperCase());
      }

      const appKey = rawAppKey.toUpperCase();
      const type = parts.slice(4).join('_');
      const appName = formatAppName(appKey);
      const typeDisplay = formatParticipationType(type);
      return `Attached to ${appName} as ${typeDisplay}`;
    }
  }
  
  // Check for 'updated {app} app-specific fields' pattern
  if (action.startsWith('updated ') && action.includes(' app-specific fields')) {
    const appKey = action.replace('updated ', '').replace(' app-specific fields', '').toUpperCase();
    const appName = formatAppName(appKey);
    const fields = metadata?.updatedFields;
    if (fields && Array.isArray(fields) && fields.length > 0) {
      return `Updated ${appName} details (${fields.join(', ')})`;
    }
    return `Updated ${appName} details`;
  }
  
  // Fallback: format action string
  return action
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * Get app context for an activity
 */
export function getHistoryAppContext(
  action: string,
  activityAppContext?: string | null
): string | null {
  // Use activity's appContext if available
  if (activityAppContext) {
    return activityAppContext;
  }
  
  // Check mapping for app-specific actions
  if (PEOPLE_HISTORY_EVENTS[action]?.appContext) {
    return PEOPLE_HISTORY_EVENTS[action].appContext || null;
  }
  
  // Extract from action pattern
  if (action.startsWith('added_to_')) {
    const parts = action.split('_');
    if (parts.length >= 3) {
      const rawAppKey = parts[2];
      return rawAppKey ? rawAppKey.toUpperCase() : null;
    }
  }
  
  if (action.includes('sales')) {
    return 'SALES';
  }
  if (action.includes('marketing')) {
    return 'MARKETING';
  }
  if (action.includes('helpdesk')) {
    return 'HELPDESK';
  }
  
  // Default to null (Core)
  return null;
}
