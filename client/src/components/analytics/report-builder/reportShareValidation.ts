import type { AnalyticsShareTarget, AnalyticsVisibility } from '@/types/analytics.types';

/** Returns which share target type is required but missing. */
export function getMissingShareTargetType(
  visibility: AnalyticsVisibility,
  sharedWith: AnalyticsShareTarget[] | null | undefined,
): 'team' | 'role' | null {
  const targets = Array.isArray(sharedWith) ? sharedWith : [];
  if (visibility === 'team') {
    const hasGroup = targets.some((target) => target?.type === 'team' && target.id);
    return hasGroup ? null : 'team';
  }
  if (visibility === 'role') {
    const hasRole = targets.some((target) => target?.type === 'role' && target.id);
    return hasRole ? null : 'role';
  }
  return null;
}

export function shareValidationMessageKey(
  missing: 'team' | 'role' | null,
): 'analytics.shareGroupsRequired' | 'analytics.shareRolesRequired' | null {
  if (missing === 'team') return 'analytics.shareGroupsRequired';
  if (missing === 'role') return 'analytics.shareRolesRequired';
  return null;
}
