/**
 * ============================================================================
 * EVENT ACTIVITY NORMALIZATION UTILITIES
 * ============================================================================
 * 
 * These utilities normalize event data into canonical EventActivity objects.
 * 
 * Rules:
 * - MUST NOT call APIs
 * - MUST NOT infer missing data
 * - MUST ONLY map existing event fields
 * - MUST return activities sorted by timestamp ASC
 * 
 * ============================================================================
 */

import type { EventActivity, EventActivityType } from './eventActivity.types';

interface ActivityUserRef {
  _id?: string;
  id?: string;
  firstName?: string;
  lastName?: string;
  appKey?: string;
}

interface ActivityAuditEntry {
  timestamp?: unknown;
  action?: unknown;
  from?: unknown;
  to?: unknown;
  performedBy?: unknown;
}

interface ActivityCheckPoint {
  timestamp?: unknown;
  userId?: unknown;
  location?: unknown;
}

interface ActivityEvent {
  _id?: unknown;
  id?: unknown;
  createdAt?: unknown;
  startDateTime?: unknown;
  createdBy?: unknown;
  assignedTo?: unknown;
  executionStartTime?: unknown;
  executionStartedBy?: unknown;
  executionEndTime?: unknown;
  completedAt?: unknown;
  completedBy?: unknown;
  cancelledAt?: unknown;
  cancelledBy?: unknown;
  cancellationReason?: unknown;
  auditHistory?: ActivityAuditEntry[] | null;
  checkIn?: ActivityCheckPoint | null;
  checkOut?: ActivityCheckPoint | null;
  submittedAt?: unknown;
  submittedBy?: unknown;
  eventType?: string;
}

function asDateInput(value: unknown): string | number | Date {
  if (typeof value === 'string' || typeof value === 'number' || value instanceof Date) return value;
  return String(value ?? '');
}

function definedValue(value: unknown): unknown {
  if (value == null || value === '') return undefined;
  return value;
}

/**
 * Normalize event data into canonical activity list
 * 
 * Maps existing event fields to activities:
 * - createdAt → EVENT_CREATED
 * - executionStartTime → EXECUTION_STARTED
 * - executionEndTime → EXECUTION_COMPLETED
 * - cancelledAt → EXECUTION_CANCELLED
 * - auditHistory[] → audit workflow activities
 * - checkIn / checkOut → GEO_CAPTURED
 * 
 * @param event - Event object (any shape, normalized from existing fields)
 * @returns Array of EventActivity objects, sorted by timestamp ASC
 */
export function normalizeEventActivities(event: ActivityEvent | null | undefined): EventActivity[] {
  if (!event) return [];
  
  const activities: EventActivity[] = [];
  
  // ============================================================================
  // EVENT CREATED
  // ============================================================================
  const createdAt = event.createdAt || event.startDateTime;
  if (createdAt) {
    activities.push({
      type: 'EVENT_CREATED',
      source: 'SYSTEM',
      timestamp: new Date(asDateInput(createdAt)).toISOString(),
      actor: extractActor(event.createdBy || event.assignedTo),
      metadata: {}
    });
  }
  
  // ============================================================================
  // EXECUTION ACTIVITIES (Generic Events)
  // ============================================================================
  
  // Execution started
  if (event.executionStartTime) {
    activities.push({
      type: 'EXECUTION_STARTED',
      source: 'USER',
      timestamp: new Date(asDateInput(event.executionStartTime)).toISOString(),
      actor: extractActor(event.executionStartedBy),
      metadata: {}
    });
  }
  
  // Execution completed
  if (event.executionEndTime || event.completedAt) {
    const completedAt = event.executionEndTime || event.completedAt;
    activities.push({
      type: 'EXECUTION_COMPLETED',
      source: 'USER',
      timestamp: new Date(asDateInput(completedAt)).toISOString(),
      actor: extractActor(event.completedBy),
      metadata: {}
    });
  }
  
  // Execution cancelled
  if (event.cancelledAt) {
    activities.push({
      type: 'EXECUTION_CANCELLED',
      source: 'USER',
      timestamp: new Date(asDateInput(event.cancelledAt)).toISOString(),
      actor: extractActor(event.cancelledBy),
      metadata: {
        reason: definedValue(event.cancellationReason)
      }
    });
  }
  
  // ============================================================================
  // AUDIT WORKFLOW ACTIVITIES
  // ============================================================================
  
  // Use auditHistory array if available (preferred source)
  if (event.auditHistory && Array.isArray(event.auditHistory) && event.auditHistory.length > 0) {
    event.auditHistory.forEach((entry) => {
      if (!entry || !Boolean(entry.timestamp)) return;

      const action = String(entry.action ?? '').toLowerCase();
      let activityType: EventActivityType | null = null;
      
      if (action.includes('check') || action.includes('check_in')) {
        activityType = 'AUDIT_CHECK_IN';
      } else if (action.includes('submit')) {
        activityType = 'AUDIT_SUBMITTED';
      } else if (action.includes('approve')) {
        activityType = 'AUDIT_APPROVED';
      } else if (action.includes('reject')) {
        activityType = 'AUDIT_REJECTED';
      } else if (Boolean(entry.from) || Boolean(entry.to)) {
        // State transition
        activityType = 'STATUS_CHANGED';
      }
      
      if (activityType) {
        activities.push({
          type: activityType,
          source: 'WORKFLOW',
          timestamp: new Date(asDateInput(entry.timestamp)).toISOString(),
          actor: extractActor(entry.performedBy),
          metadata: {
            from: definedValue(entry.from),
            to: definedValue(entry.to),
            action: definedValue(entry.action)
          }
        });
      }
    });
  }
  
  // Fallback: Map individual audit fields if auditHistory not available
  // Check-in
  if (event.checkIn && event.checkIn.timestamp) {
    const checkIn = event.checkIn;
    // Only add if not already in auditHistory
    const hasCheckInInHistory = activities.some(
      a => a.type === 'AUDIT_CHECK_IN' && 
      new Date(a.timestamp).getTime() === new Date(asDateInput(checkIn.timestamp)).getTime()
    );
    
    if (!hasCheckInInHistory) {
      activities.push({
        type: 'AUDIT_CHECK_IN',
        source: 'WORKFLOW',
        timestamp: new Date(asDateInput(checkIn.timestamp)).toISOString(),
        actor: extractActor(checkIn.userId),
        metadata: {
          location: definedValue(checkIn.location)
        }
      });
    }
  }
  
  // Submitted
  if (event.submittedAt) {
    const hasSubmittedInHistory = activities.some(
      a => a.type === 'AUDIT_SUBMITTED' && 
      new Date(a.timestamp).getTime() === new Date(asDateInput(event.submittedAt)).getTime()
    );
    
    if (!hasSubmittedInHistory) {
      activities.push({
        type: 'AUDIT_SUBMITTED',
        source: 'WORKFLOW',
        timestamp: new Date(asDateInput(event.submittedAt)).toISOString(),
        actor: extractActor(event.submittedBy),
        metadata: {}
      });
    }
  }
  
  // ============================================================================
  // GEO CAPTURED ACTIVITIES
  // ============================================================================
  
  // Check-in location
  if (event.checkIn && event.checkIn.location && event.checkIn.timestamp) {
    const checkIn = event.checkIn;
    // Only add GEO_CAPTURED if location data exists and it's not already represented
    const hasGeoCheckIn = activities.some(
      a => a.type === 'GEO_CAPTURED' && 
      a.metadata?.checkType === 'checkIn' &&
      new Date(a.timestamp).getTime() === new Date(asDateInput(checkIn.timestamp)).getTime()
    );
    
    if (!hasGeoCheckIn) {
      activities.push({
        type: 'GEO_CAPTURED',
        source: 'SYSTEM',
        timestamp: new Date(asDateInput(checkIn.timestamp)).toISOString(),
        actor: extractActor(checkIn.userId),
        metadata: {
          checkType: 'checkIn',
          location: checkIn.location
        }
      });
    }
  }
  
  // Check-out location
  if (event.checkOut && event.checkOut.location && event.checkOut.timestamp) {
    const checkOut = event.checkOut;
    activities.push({
      type: 'GEO_CAPTURED',
      source: 'SYSTEM',
      timestamp: new Date(asDateInput(checkOut.timestamp)).toISOString(),
      actor: extractActor(checkOut.userId),
      metadata: {
        checkType: 'checkOut',
        location: checkOut.location
      }
    });
  }
  
  // ============================================================================
  // SORT BY TIMESTAMP (ASC)
  // ============================================================================
  
  const sorted = activities.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  // ============================================================================
  // DEV-ONLY GUARDS
  // ============================================================================
  
  if (process.env.NODE_ENV === 'development') {
    // Warn if no EVENT_CREATED activity exists
    const hasCreated = sorted.some(a => a.type === 'EVENT_CREATED');
    if (!hasCreated) {
      console.warn(
        '[eventActivity.utils] Event missing EVENT_CREATED activity',
        { eventId: event._id || event.id, hasCreatedAt: !!event.createdAt, hasStartDateTime: !!event.startDateTime }
      );
    }
    
    // Warn if audit event has no workflow activities
    const isAuditEvent = event.eventType && (
      event.eventType.includes('Audit') || 
      event.eventType === 'Internal Audit' ||
      event.eventType === 'External Audit — Single Org' ||
      event.eventType === 'External Audit Beat'
    );
    
    if (isAuditEvent) {
      const hasWorkflowActivities = sorted.some(
        a => a.type === 'AUDIT_CHECK_IN' || 
        a.type === 'AUDIT_SUBMITTED' || 
        a.type === 'AUDIT_APPROVED' || 
        a.type === 'AUDIT_REJECTED'
      );
      
      if (!hasWorkflowActivities && !event.auditHistory) {
        console.warn(
          '[eventActivity.utils] Audit event missing workflow activities',
          { eventId: event._id || event.id, hasAuditHistory: !!event.auditHistory, hasCheckIn: !!event.checkIn }
        );
      }
    }
  }
  
  return sorted;
}

/**
 * Extract actor information from various user reference formats
 * 
 * Handles:
 * - ObjectId references
 * - Populated user objects with firstName/lastName
 * - String IDs
 * 
 * @param userRef - User reference (any format)
 * @returns Actor object or undefined
 */
function extractActor(userRef: unknown): EventActivity['actor'] | undefined {
  if (!userRef) return undefined;

  if (typeof userRef === 'string') {
    return { id: userRef, name: undefined, appKey: undefined };
  }

  if (typeof userRef !== 'object') return undefined;

  const user = userRef as ActivityUserRef;
  if (user.firstName) {
    const name = `${user.firstName} ${user.lastName || ''}`.trim();
    return {
      id: user._id || user.id,
      name: name || undefined,
      appKey: user.appKey || undefined
    };
  }

  if (user._id || user.id) {
    return { id: user._id || user.id, name: undefined, appKey: undefined };
  }

  return undefined;
}
