/**
 * ============================================================================
 * CANONICAL EVENT ACTIVITY MODEL (UI-FACING ONLY)
 * ============================================================================
 * 
 * See docs/architecture/event-domain-contract.md
 * 
 * This model is canonical and UI-facing only.
 * It does NOT enforce behavior or mutate state.
 * 
 * Purpose:
 * - Provide a unified, normalized representation of event activities
 * - Support read-only display in EventDetail.vue
 * - Canonicalize activity data across generic and audit events
 * 
 * This model:
 * - MUST NOT call APIs
 * - MUST NOT infer missing data
 * - MUST ONLY map existing event fields
 * - MUST be deterministic and ordered
 * 
 * ============================================================================
 */

export type EventActivitySource =
  | 'SYSTEM'
  | 'USER'
  | 'WORKFLOW';

export type EventActivityType =
  | 'EVENT_CREATED'
  | 'STATUS_CHANGED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_CANCELLED'
  | 'AUDIT_CHECK_IN'
  | 'AUDIT_SUBMITTED'
  | 'AUDIT_APPROVED'
  | 'AUDIT_REJECTED'
  | 'GEO_CAPTURED'
  | 'NOTE_ADDED';

export interface EventActivity {
  id?: string;
  type: EventActivityType;
  source: EventActivitySource;
  timestamp: string;
  actor?: {
    id?: string;
    name?: string;
    appKey?: string;
  };
  metadata?: Record<string, unknown>;
}
