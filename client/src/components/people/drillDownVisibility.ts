/**
 * ============================================================================
 * DRILL-DOWN VISIBILITY HELPERS
 * ============================================================================
 * 
 * Determines whether drill-down links should be shown based on actual
 * relationships between a Person and modules.
 * 
 * Rules:
 * - Return TRUE only if person has active participation OR historical evidence
 * - Do NOT return true based on module existence or user permissions alone
 * - Do NOT return true based on "might be useful" assumptions
 * 
 * ============================================================================
 */

export interface ProfileData {
  core?: {
    fields?: {
      [key: string]: unknown;
    };
  };
  apps?: {
    [appKey: string]: {
      fields?: {
        sales_type?: string;
        type?: string;
        [key: string]: unknown;
      };
    };
  };
}

/**
 * Check if person can view deals
 * 
 * Returns TRUE if:
 * - Person has SALES participation (Lead or Contact)
 */
export function canViewDeals(profileData: ProfileData | null): boolean {
  if (!profileData?.apps) return false;
  
  const salesApp = profileData.apps.SALES;
  if (!salesApp?.fields) return false;
  
  // SALES participation (Lead or Contact) implies deals relationship
  const role = salesApp.fields.sales_type;
  return role === 'Lead' || role === 'Contact';
}

/**
 * Check if person can view tasks
 * 
 * Returns TRUE if:
 * - Person has PROJECTS participation (Stakeholder or Member)
 * - OR person has any participation (tasks can be assigned to anyone)
 * 
 * Note: Tasks are generally assignable to any person, so we allow
 * viewing if person exists in the system (has any participation).
 */
export function canViewTasks(profileData: ProfileData | null): boolean {
  if (!profileData?.apps) return false;
  
  // Check for PROJECTS participation
  const projectsApp = profileData.apps.PROJECTS;
  if (projectsApp?.fields) {
    const type = projectsApp.fields.type;
    if (type === 'Stakeholder' || type === 'Member') {
      return true;
    }
  }
  
  // Tasks can be assigned to any person in the system
  // If person has any participation, they can potentially have tasks
  return Object.keys(profileData.apps).length > 0;
}

/**
 * Check if person can view meetings/events
 * 
 * Returns TRUE if:
 * - Person has any participation (meetings can involve anyone)
 * 
 * Note: Events/meetings can involve any person, so we allow
 * viewing if person exists in the system.
 */
export function canViewMeetings(profileData: ProfileData | null): boolean {
  if (!profileData?.apps) return false;
  
  // Meetings/events can involve any person in the system
  // If person has any participation, they can potentially be in meetings
  return Object.keys(profileData.apps).length > 0;
}

/**
 * Check if person can view cases
 * 
 * Returns TRUE if:
 * - Person has HELPDESK participation (Requester or Contact)
 */
export function canViewCases(profileData: ProfileData | null): boolean {
  if (!profileData?.apps) return false;
  
  const helpdeskApp = profileData.apps.HELPDESK;
  if (!helpdeskApp?.fields) return false;
  
  // HELPDESK participation (Requester or Contact) implies cases relationship
  const type = helpdeskApp.fields.type;
  return type === 'Requester' || type === 'Contact';
}

