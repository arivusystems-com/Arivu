/**
 * ============================================================================
 * EVENT PERMISSION DERIVATION UTILITIES (PURE, DETERMINISTIC)
 * ============================================================================
 * 
 * These utilities derive event action permissions from event state.
 * 
 * Rules:
 * - MUST be pure (no side effects)
 * - MUST NOT call APIs
 * - MUST NOT throw
 * - MUST NOT enforce or block actions
 * - MUST ONLY explain permissions
 * 
 * ============================================================================
 */

import type { EventActionPermission } from './eventPermissions.types';
import type { EventTypeDefinition } from '@/types/eventSettings.types';

/**
 * Derive execution state from event data
 */
type ExecutionState = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface PermissionEvent {
  status?: string | null;
  executionStartTime?: unknown;
  executionStartedAt?: unknown;
  auditState?: string;
  submittedAt?: unknown;
}

function deriveExecutionState(event: PermissionEvent | null | undefined): ExecutionState {
  if (!event) return 'NOT_STARTED';
  
  if (event.status === 'Cancelled' || event.status === 'CANCELLED') return 'CANCELLED';
  if (event.status === 'Completed' || event.status === 'COMPLETED') return 'COMPLETED';
  if (Boolean(event.executionStartTime) || Boolean(event.executionStartedAt)) return 'IN_PROGRESS';
  
  return 'NOT_STARTED';
}

/**
 * Derive event action permissions
 * 
 * This function explains which actions are allowed and why.
 * It does NOT enforce permissions or block actions.
 * 
 * @param params - Parameters for permission derivation
 * @returns Array of EventActionPermission objects
 */
export function deriveEventPermissions(params: {
  event: PermissionEvent | null | undefined;
  currentUser: unknown;
  eventTypeDefinition: EventTypeDefinition | null;
}): EventActionPermission[] {
  const { event, eventTypeDefinition } = params;
  
  if (!event || !eventTypeDefinition) {
    return [];
  }
  
  const permissions: EventActionPermission[] = [];
  const executionMode = eventTypeDefinition.executionMode || 'generic';
  const isAuditEvent = eventTypeDefinition.isAuditEvent === true;
  const executionState = deriveExecutionState(event);
  
  // ============================================================================
  // GENERIC EVENT PERMISSIONS
  // ============================================================================
  
  if (executionMode === 'generic') {
    // START_EXECUTION
    permissions.push({
      action: 'START_EXECUTION',
      allowed: executionState === 'NOT_STARTED',
      reason: executionState === 'NOT_STARTED'
        ? undefined
        : executionState === 'COMPLETED'
        ? 'Event has already been completed'
        : executionState === 'CANCELLED'
        ? 'Event has been cancelled'
        : 'Event execution has already started'
    });
    
    // COMPLETE_EXECUTION
    permissions.push({
      action: 'COMPLETE_EXECUTION',
      allowed: executionState === 'IN_PROGRESS',
      reason: executionState === 'IN_PROGRESS'
        ? undefined
        : executionState === 'NOT_STARTED'
        ? 'Event execution must be started first'
        : executionState === 'COMPLETED'
        ? 'Event has already been completed'
        : 'Event has been cancelled'
    });
    
    // CANCEL_EXECUTION
    permissions.push({
      action: 'CANCEL_EXECUTION',
      allowed: executionState === 'IN_PROGRESS',
      reason: executionState === 'IN_PROGRESS'
        ? undefined
        : executionState === 'NOT_STARTED'
        ? 'Event execution must be started first'
        : executionState === 'COMPLETED'
        ? 'Event has already been completed and cannot be cancelled'
        : 'Event has already been cancelled'
    });
  }
  
  // ============================================================================
  // AUDIT EVENT PERMISSIONS
  // ============================================================================
  
  if (isAuditEvent && executionMode === 'audit-workflow') {
    // AUDIT_CHECK_IN
    const auditState = event.auditState || 'Ready to start';
    const canCheckIn = auditState === 'Ready to start' || auditState === 'ready to start';
    
    permissions.push({
      action: 'AUDIT_CHECK_IN',
      allowed: canCheckIn,
      reason: canCheckIn
        ? undefined
        : auditState === 'checked_in' || auditState === 'CHECKED_IN'
        ? 'Audit has already been checked in'
        : auditState === 'submitted' || auditState === 'SUBMITTED'
        ? 'Audit has already been submitted'
        : auditState === 'approved' || auditState === 'APPROVED' || auditState === 'closed' || auditState === 'CLOSED'
        ? 'Audit workflow has been completed'
        : 'Audit is not ready for check-in'
    });
    
    // AUDIT_SUBMIT
    const canSubmit = (auditState === 'checked_in' || auditState === 'CHECKED_IN') && 
                      !Boolean(event.submittedAt);
    
    permissions.push({
      action: 'AUDIT_SUBMIT',
      allowed: canSubmit,
      reason: canSubmit
        ? undefined
        : !(auditState === 'checked_in' || auditState === 'CHECKED_IN')
        ? 'Audit must be checked in before submission'
        : Boolean(event.submittedAt)
        ? 'Audit has already been submitted'
        : 'Audit is not ready for submission'
    });
    
    // COMPLETE_EXECUTION (always false for audit events)
    permissions.push({
      action: 'COMPLETE_EXECUTION',
      allowed: false,
      reason: 'Audit events are completed only by workflow closure'
    });
  }
  
  // ============================================================================
  // DEV-ONLY ASSERTIONS
  // ============================================================================
  
  if (process.env.NODE_ENV === 'development') {
    // Assert: Audit events never expose COMPLETE_EXECUTION as allowed
    const auditCompletePermission = permissions.find(
      p => p.action === 'COMPLETE_EXECUTION' && isAuditEvent
    );
    if (auditCompletePermission) {
      console.assert(
        !auditCompletePermission.allowed,
        '[eventPermissions.utils] Audit events must never expose COMPLETE_EXECUTION as allowed',
        { permission: auditCompletePermission }
      );
    }
    
    // Assert: Execution mode must match EventTypeDefinition
    const expectedMode = isAuditEvent ? 'audit-workflow' : 'generic';
    console.assert(
      executionMode === expectedMode,
      '[eventPermissions.utils] Execution mode must match EventTypeDefinition',
      { executionMode, expectedMode, isAuditEvent }
    );
  }
  
  return permissions;
}
