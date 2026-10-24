/**
 * ============================================================================
 * PARTICIPATION ACTION MAP
 * ============================================================================
 * 
 * Maps appKey + participationType to contextual creation actions.
 * 
 * Rules:
 * - Each Participation has EXACTLY ONE primary CTA
 * - Optional secondary CTAs may exist but must be collapsed
 * - Actions must be role-driven, not record-driven
 * 
 * ============================================================================
 */

export interface ParticipationAction {
  label: string;
  actionType: 'create-deal' | 'create-task' | 'create-case' | 'schedule-meeting' | 'convert' | 'edit' | 'edit-details' | 'view';
  moduleKey?: string; // For navigation-based actions
  prefillData?: Record<string, unknown>; // Data to prefill in creation forms
}

export interface ParticipationActions {
  primary: ParticipationAction | null;
  secondary: ParticipationAction[];
}

/**
 * Participation Action Map
 * 
 * Maps: appKey + participationType → { primary, secondary[] }
 */
export const PARTICIPATION_ACTION_MAP: Record<string, Record<string, ParticipationActions>> = {
  SALES: {
    Lead: {
      primary: {
        label: 'Convert to Contact',
        actionType: 'convert'
      },
      secondary: [
        {
          label: 'Schedule meeting',
          actionType: 'schedule-meeting'
        },
        {
          label: 'Create task',
          actionType: 'create-task'
        }
      ]
    },
    Contact: {
      primary: {
        label: 'Create deal',
        actionType: 'create-deal',
        moduleKey: 'deals'
      },
      secondary: [
        {
          label: 'Schedule meeting',
          actionType: 'schedule-meeting'
        },
        {
          label: 'Create task',
          actionType: 'create-task'
        }
      ]
    }
  },
  HELPDESK: {
    Requester: {
      primary: {
        label: 'Create case',
        actionType: 'create-case',
        moduleKey: 'cases'
      },
      secondary: [
        {
          label: 'Schedule call',
          actionType: 'schedule-meeting'
        },
        {
          label: 'Create task',
          actionType: 'create-task'
        }
      ]
    },
    Contact: {
      primary: {
        label: 'Create case',
        actionType: 'create-case',
        moduleKey: 'cases'
      },
      secondary: [
        {
          label: 'Schedule call',
          actionType: 'schedule-meeting'
        },
        {
          label: 'Create task',
          actionType: 'create-task'
        }
      ]
    }
  },
  PROJECTS: {
    Stakeholder: {
      primary: {
        label: 'Create task',
        actionType: 'create-task',
        moduleKey: 'tasks'
      },
      secondary: [
        {
          label: 'Schedule meeting',
          actionType: 'schedule-meeting'
        }
      ]
    },
    Member: {
      primary: {
        label: 'Create task',
        actionType: 'create-task',
        moduleKey: 'tasks'
      },
      secondary: [
        {
          label: 'Schedule meeting',
          actionType: 'schedule-meeting'
        }
      ]
    }
  }
};

/**
 * Get actions for a participation
 */
export function getParticipationActions(
  appKey: string,
  participationType: string
): ParticipationActions | null {
  const appActions = PARTICIPATION_ACTION_MAP[appKey];
  if (!appActions) return null;
  
  return appActions[participationType] || null;
}

/**
 * Normalize participation type for lookup
 */
export function normalizeParticipationType(type: string | null | undefined): string {
  if (!type) return '';
  
  // Handle common variations
  const normalized = type.trim();
  if (normalized.toLowerCase() === 'lead') return 'Lead';
  if (normalized.toLowerCase() === 'contact') return 'Contact';
  if (normalized.toLowerCase() === 'requester') return 'Requester';
  if (normalized.toLowerCase() === 'stakeholder') return 'Stakeholder';
  if (normalized.toLowerCase() === 'member') return 'Member';
  
  return normalized;
}

