/**
 * Centralized role display logic for People participation.
 * Use this instead of direct person.type access in UI.
 *
 * @param person - Person record
 * @param appKey - App key (e.g. 'SALES')
 * @returns { app, appLabel, role } or null
 */
import { getParticipation } from './getParticipation';

const APP_LABELS: Record<string, string> = {
  SALES: 'Sales',
  HELPDESK: 'Helpdesk',
  MARKETING: 'Marketing',
  AUDIT: 'Audit',
  PORTAL: 'Portal',
  PROJECTS: 'Projects',
  INVENTORY: 'Inventory',
  LMS: 'Learning',
};

export function getAppLabel(appKey: string | null | undefined): string {
  if (appKey == null || appKey === '') return '';
  const key = String(appKey).toUpperCase();
  return APP_LABELS[key] ?? String(appKey);
}

export function getRoleDisplay(
  person: Record<string, unknown> | null | undefined,
  appKey: string
): { app: string; appLabel: string; role: string } | null {
  const participation = getParticipation(person, appKey);
  if (!participation?.role) return null;

  const roleLabel =
    String(participation.role).charAt(0).toUpperCase() +
    String(participation.role).slice(1).toLowerCase();

  return {
    app: appKey,
    appLabel: getAppLabel(appKey),
    role: roleLabel
  };
}
