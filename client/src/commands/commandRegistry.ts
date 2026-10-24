/**
 * ============================================================================
 * COMMAND REGISTRY
 * ============================================================================
 * 
 * Central registry for all Command Palette commands.
 * 
 * WHY COMMANDS ARE CENTRALLY REGISTERED:
 * 
 * 1. SINGLE SOURCE OF TRUTH:
 *    - All commands defined in one place
 *    - Easy to discover what commands exist
 *    - Prevents command duplication and inconsistency
 * 
 * 2. CONTEXT FILTERING:
 *    - Commands are filtered by context (global vs contextual)
 *    - Context-aware commands only shown when relevant
 *    - Prevents command clutter and maintains "scannable in under 2 seconds"
 * 
 * 3. TYPE SAFETY:
 *    - All commands conform to CommandPaletteItem interface
 *    - TypeScript enforces command contract
 *    - Prevents invalid command definitions
 * 
 * 4. MAINTAINABILITY:
 *    - Easy to add/remove commands
 *    - Clear command organization
 *    - Centralized command documentation
 * 
 * 5. CONSISTENCY:
 *    - All commands follow same patterns
 *    - Consistent labeling and descriptions
 *    - Unified execution model
 * 
 * WHY COMMANDS ARE INTENTIONALLY LIMITED:
 * 
 * Command Palette is NOT a feature discovery mechanism or workflow engine.
 * It's a fast action execution surface for explicit user intent.
 * 
 * LIMITATIONS ENFORCE CLARITY:
 * 
 * 1. NO ENTITY-SPECIFIC COMMANDS WITHOUT CONTEXT:
 *    - "Create Task for Person X" requires Person context
 *    - "Add Person to Organization Y" requires Organization context
 *    - Entity-specific actions belong in context surfaces, not global commands
 * 
 * 2. NO CONDITIONAL COMMANDS:
 *    - Commands don't change based on hidden state
 *    - Commands are stateless and predictable
 *    - State-dependent actions belong in context surfaces
 * 
 * 3. NO NESTED ACTIONS:
 *    - Commands execute single actions, not workflows
 *    - No multi-step processes or wizards
 *    - Complex actions belong in dedicated surfaces
 * 
 * 4. NO STORE MUTATIONS:
 *    - Commands navigate or trigger flows, not mutate state directly
 *    - State mutations belong in components or stores
 *    - Commands are thin wrappers around navigation/actions
 * 
 * 5. LIMITED SCOPE:
 *    - Only essential, frequently-used actions
 *    - Not exhaustive feature sets
 *    - Keeps Command Palette calm and scannable
 * 
 * See docs/architecture/command-palette-invariants.md for architectural rules.
 * 
 * ============================================================================
 */

import type { Router } from 'vue-router';
import type {
  CommandPaletteItem,
  CommandContext,
  NavigationUtilities
} from '@/types/commandPalette.types';

/**
 * Create navigation utilities from Vue Router
 * 
 * Converts Vue Router instance into NavigationUtilities interface.
 * This allows commands to work with router without direct coupling.
 */
function createNavigationUtilities(router: Router): NavigationUtilities {
  const performNavigation = async (target: string | { path: string; query: Record<string, string> }) => {
    try {
      await router.push(target);
    } catch (err: unknown) {
      const name = err && typeof err === 'object' && 'name' in err ? err.name : undefined;
      if (name !== 'NavigationDuplicated') {
        console.warn('[CommandRegistry] Navigation error:', err);
      }
    }
  };

  return {
    navigate: async (path: string) => {
      await performNavigation(path);
    },
    navigateWithQuery: async (path: string, query: Record<string, string>) => {
      await performNavigation({ path, query });
    },
    openTab: async (path: string, _options?: { title?: string; background?: boolean }) => {
      // Note: This is a placeholder - actual tab opening is handled in GlobalSearch
      // where useTabs() is available. This ensures commands can request tab opening.
      await performNavigation(path);
    },
    getCurrentRoute: () => router.currentRoute
  };
}

/**
 * Global commands
 * 
 * Commands available everywhere, regardless of context.
 * These are core navigation and creation actions that are always relevant.
 * 
 * ARCHITECTURE NOTE: Command palette routes to intent, not raw entities.
 * 
 * Commands represent user intentions (e.g., "create event", "schedule audit"),
 * not direct entity manipulation. This ensures:
 * - Commands route to appropriate surfaces (GenericEventCreateSurface vs Audit flow)
 * - Intent-based descriptions guide users to the right action
 * - Audit events are blocked from generic creation flows
 * - Each command maps to the correct workflow for its domain
 * 
 * See: docs/architecture/event-settings.md
 */
/**
 * Manual global commands (not inferable from registry routes alone).
 * Navigation to modules/apps comes from buildCommandsFromRegistry via useCommandPaletteCommands.
 */
function createManualGlobalCommands(_nav: NavigationUtilities): CommandPaletteItem[] {
  return [
    // Creation commands
    // ARCHITECTURE NOTE: Command palette routes to intent, not raw entities.
    // Each command maps to the appropriate surface for its domain.
    {
      id: 'create-person',
      label: 'Create Person',
      description: 'Add a new person to your contacts',
      category: 'create',
      scope: 'global',
      moduleKey: 'people',
      kind: 'action',
      handler: () => {
        // Open drawer in same tab, not navigating
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:open-people-quick-create'));
        }
      }
    },
    {
      id: 'create-organization',
      label: 'Create Organization',
      description: 'Add a new organization or company',
      category: 'create',
      scope: 'global',
      moduleKey: 'organizations',
      kind: 'action',
      // ARCHITECTURAL INTENT: Command palette opens CreateOrganizationDrawer
      // This is a drawer with Quick → Full form behavior
      // Post-creation: Opens OrganizationSurface for the new org
      handler: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:open-organization-quick-create', {
            detail: {
              initialData: {},
              autoLinkContext: null
            }
          }));
        }
      }
    },
    {
      id: 'create-task',
      label: 'Create Task',
      description: 'Create a new task or to-do item',
      category: 'create',
      scope: 'global',
      moduleKey: 'tasks',
      kind: 'action',
      handler: (route) => {
        // Guard: ensure route exists
        if (!route) {
          console.warn('[CommandRegistry] Route not available for create-task command');
          return;
        }
        
        // Build initial data with context awareness
        const initialData: Record<string, string> = {};
        
        // Auto-assign to current user (will be set in GlobalSearch)
        // Auto-link to current context if present
        const routeName = route.name as string | undefined;
        const routePath = route.path;
        const id = route.params?.id as string | undefined;
        
        // Determine context from route
        if (routeName === 'person-detail' || (routePath.startsWith('/people/') && id && routePath !== '/people' && routePath !== '/people/create')) {
          // Person detail context - link task to person
          if (id) {
            initialData.contactId = id;
            initialData.personId = id;
          }
        } else if (routeName === 'organization-detail' || (routePath.startsWith('/organizations/') && id && routePath !== '/organizations')) {
          // Organization detail context - link task to organization
          if (id) initialData.organizationId = id;
        }
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:open-create-drawer', {
            detail: {
              moduleKey: 'tasks',
              initialData,
              title: 'New Task',
              description: 'Create a new task'
            }
          }));
        }
      }
    },
    {
      id: 'create-event',
      label: 'Create Event',
      description: 'Schedule a meeting or sales beat (basic events only)',
      category: 'create',
      scope: 'global',
      moduleKey: 'events',
      kind: 'action',
      // ARCHITECTURE NOTE: Opens EventQuickCreateDrawer in same tab, not navigating.
      // This surface is intentionally limited and does not support audit events.
      // Audit event types are blocked from generic event creation.
      // See: docs/architecture/event-settings.md Section 7 (Quick Create Rules)
      handler: () => {
        // Open drawer in same tab, not navigating
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:open-event-quick-create'));
        }
      }
    },
    {
      id: 'schedule-audit',
      label: 'Schedule Audit',
      description: 'Plan and schedule an audit event',
      category: 'create',
      scope: 'global',
      moduleKey: 'audits',
      kind: 'navigate',
      // ARCHITECTURE NOTE: Routes to Audit Scheduling Surface, the ONLY way to create audit events.
      // Audit events require complex configuration (roles, forms, geo) and must be
      // created through Audit Scheduling Surface, not generic event creation.
      // See: docs/architecture/audit-scheduling-surface.md
      run: (nav) => nav.openTab('/audit/schedule', { title: 'Schedule Audit' })
    },
    {
      id: 'plan-audit-beat',
      label: 'Plan Audit Beat',
      description: 'Schedule a multi-organization audit route',
      category: 'create',
      scope: 'global',
      moduleKey: 'audits',
      kind: 'navigate',
      // ARCHITECTURE NOTE: Routes to Audit Scheduling Surface for beat planning.
      // Audit beats require complex configuration and must be created through Audit Scheduling Surface.
      // See: docs/architecture/audit-scheduling-surface.md
      run: (nav) => nav.openTab('/audit/schedule', { title: 'Plan Audit Beat' })
    }
  ];
}

/**
 * Inbox context commands
 * 
 * Commands available when viewing Inbox surface.
 * These are actions specific to inbox context.
 */
function createInboxContextCommands(_nav: NavigationUtilities): CommandPaletteItem[] {
  return [
    {
      id: 'inbox-create-task',
      label: 'Create Task',
      description: 'Create a new task',
      category: 'create',
      scope: 'contextual',
      context: 'inbox',
      moduleKey: 'tasks',
      kind: 'action',
      handler: (_route) => {
        // Build initial data - auto-assign to current user
        const initialData: Record<string, string> = {};
        
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('arivu:open-create-drawer', {
            detail: {
              moduleKey: 'tasks',
              initialData,
              title: 'New Task',
              description: 'Create a new task'
            }
          }));
        }
      }
    }
  ];
}

/**
 * People context commands
 * 
 * Commands available when viewing Person detail surface.
 * These are actions specific to person context.
 */
function createPeopleContextCommands(_nav: NavigationUtilities): CommandPaletteItem[] {
  return [
    {
      id: 'person-ai-research',
      label: 'Research with AI',
      description: 'Generate a read-only research brief for this person',
      category: 'action',
      scope: 'contextual',
      context: 'people',
      moduleKey: 'people',
      kind: 'action',
      handler: (route) => {
        const id = route?.params?.id as string | undefined;
        if (typeof window !== 'undefined' && id) {
          window.dispatchEvent(new CustomEvent('arivu:ai-research', {
            detail: { moduleKey: 'people', recordId: id },
          }));
        }
      },
    },
    {
      id: 'person-assign-task',
      label: 'Assign Task',
      description: 'Assign a task to this person',
      category: 'create',
      scope: 'contextual',
      context: 'people',
      moduleKey: 'tasks',
      kind: 'action',
      handler: (route) => {
        // Guard: ensure route exists
        if (!route || !route.params) {
          console.warn('[CommandRegistry] Route not available for person-assign-task command');
          return;
        }
        
        // Get person ID from current route
        const personId = route.params?.id as string | undefined;
        
        if (personId && typeof window !== 'undefined') {
          // Build initial data - link to person and auto-assign to current user
          const initialData: Record<string, string> = {
            contactId: personId,
            personId: personId
          };
          
          window.dispatchEvent(new CustomEvent('arivu:open-create-drawer', {
            detail: {
              moduleKey: 'tasks',
              initialData,
              title: 'Assign Task',
              description: 'Create a task assigned to this person'
            }
          }));
        }
      }
    },
    {
      id: 'person-link-organization',
      label: 'Link Organization',
      description: 'Link an organization to this person',
      category: 'action',
      scope: 'contextual',
      context: 'people',
      moduleKey: 'organizations',
      kind: 'action',
      handler: (route) => {
        // Guard: ensure route exists
        if (!route || !route.params) {
          console.warn('[CommandRegistry] Route not available for person-link-organization command');
          return;
        }
        
        // Get person ID from current route
        const personId = route.params?.id as string | undefined;
        
        if (personId && typeof window !== 'undefined') {
          // Dispatch event to open link drawer in GlobalSearch component
          // Allow create from link drawer
          window.dispatchEvent(new CustomEvent('arivu:open-link-drawer', {
            detail: {
              moduleKey: 'organizations',
              title: 'Link Organization',
              context: { contactId: personId, personId: personId },
              allowCreate: true
            }
          }));
        }
      }
    },
    {
      id: 'person-create-organization',
      label: 'Create Organization',
      description: 'Create a new organization and link it to this person',
      category: 'create',
      scope: 'contextual',
      context: 'people',
      moduleKey: 'organizations',
      kind: 'action',
      // ARCHITECTURAL INTENT: People surface "Create Organization" opens CreateOrganizationDrawer
      // Post-creation: Links organization to person and closes drawer
      handler: (route) => {
        // Guard: ensure route exists
        if (!route || !route.params) {
          console.warn('[CommandRegistry] Route not available for person-create-organization command');
          return;
        }
        
        // Get person ID from current route
        const personId = route.params?.id as string | undefined;
        
        if (personId && typeof window !== 'undefined') {
          // Dispatch event to open Organization Quick Create drawer with auto-link context
          window.dispatchEvent(new CustomEvent('arivu:open-organization-quick-create', {
            detail: {
              initialData: {},
              autoLinkContext: { contactId: personId, personId: personId } // Context for auto-linking after creation
            }
          }));
        }
      }
    }
  ];
}

/**
 * Organization context commands
 * 
 * Commands available when viewing Organization surface.
 * These are actions specific to organization context.
 */
function createOrganizationContextCommands(_nav: NavigationUtilities): CommandPaletteItem[] {
  return [
    {
      id: 'org-link-person',
      label: 'Link Person',
      description: 'Link a person to this organization',
      category: 'action',
      scope: 'contextual',
      context: 'organization',
      moduleKey: 'people',
      kind: 'action',
      handler: (route) => {
        // Guard: ensure route exists
        if (!route || !route.params) {
          console.warn('[CommandRegistry] Route not available for org-link-person command');
          return;
        }
        
        // Get organization ID from current route
        const orgId = route.params?.id as string | undefined;
        
        if (orgId && typeof window !== 'undefined') {
          // Dispatch event to open link drawer in GlobalSearch component
          window.dispatchEvent(new CustomEvent('arivu:open-link-drawer', {
            detail: {
              moduleKey: 'people',
              title: 'Link Contacts',
              context: { organizationId: orgId }
            }
          }));
        }
      }
    },
    {
      id: 'org-create-deal',
      label: 'Create Deal',
      description: 'Create a deal for this organization',
      category: 'create',
      scope: 'contextual',
      context: 'organization',
      moduleKey: 'deals',
      kind: 'action',
      handler: (route) => {
        // Guard: ensure route exists
        if (!route || !route.params) {
          console.warn('[CommandRegistry] Route not available for org-create-deal command');
          return;
        }
        
        // Get organization ID from current route
        const orgId = route.params?.id as string | undefined;
        
        if (orgId && typeof window !== 'undefined') {
          // Build initial data - prefill organization and lock it
          const initialData: Record<string, string> = {
            accountId: orgId
          };
          
          window.dispatchEvent(new CustomEvent('arivu:open-create-drawer', {
            detail: {
              moduleKey: 'deals',
              initialData,
              lockedFields: ['accountId'], // Lock the organization field
              title: 'New Deal',
              description: 'Create a deal for this organization'
            }
          }));
        }
      }
    }
  ];
}

/**
 * Get available commands for a given context
 * 
 * Returns all commands (both global and contextual).
 * Filtering by scope happens in the component based on active surface.
 * 
 * @param context - Current context (for backward compatibility, can be undefined)
 * @param router - Vue Router instance for navigation
 * @returns Array of all CommandPaletteItem objects with scope set
 * 
 * NOTE: This function now returns ALL commands. Scope-based filtering
 * is handled in the component to ensure:
 * - Global commands are always visible
 * - Contextual commands only appear when context matches
 * - Contextual commands appear above global commands
 */
/**
 * Manual commands only (create drawers, contextual actions, audit scheduling).
 * GlobalSearch merges these with registry-derived navigation via useCommandPaletteCommands.
 */
export function getManualCommands(router: Router): CommandPaletteItem[] {
  const nav = createNavigationUtilities(router);
  return [
    ...createManualGlobalCommands(nav),
    ...createInboxContextCommands(nav),
    ...createPeopleContextCommands(nav),
    ...createOrganizationContextCommands(nav)
  ];
}

/** @deprecated Use useCommandPaletteCommands().allCommands for full platform coverage */
export function getAvailableCommands(
  context: CommandContext | 'global' | undefined,
  router: Router
): CommandPaletteItem[] {
  return getManualCommands(router);
}

/**
 * Get all commands (for debugging or admin purposes)
 * 
 * Returns all commands regardless of context.
 * This is useful for:
 * - Command discovery and documentation
 * - Admin/debugging tools
 * - Testing
 * 
 * NOTE: This should NOT be used in Command Palette UI.
 * Command Palette should use getAvailableCommands() with proper context.
 */
export function getAllCommands(router: Router): CommandPaletteItem[] {
  return getManualCommands(router);
}

/**
 * Find command by ID
 * 
 * Utility function to find a command by its ID.
 * Useful for command execution or lookup.
 * 
 * @param commandId - Command ID to find
 * @param router - Vue Router instance
 * @param context - Optional context (for backward compatibility, can be undefined)
 * @returns CommandPaletteItem if found, undefined otherwise
 */
export function findCommandById(
  commandId: string,
  router: Router,
  context?: CommandContext | 'global'
): CommandPaletteItem | undefined {
  const commands = getAvailableCommands(context, router);
  return commands.find(cmd => cmd.id === commandId);
}
