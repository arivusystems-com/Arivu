import type { FilterOperatorId } from '@/platform/filters/filterOperators';
import { isFilterRuleActive } from '@/platform/filters/filterQueryCompiler';
import { isFilterValueActive } from '@/platform/filters/filterValueUtils';

export type FilterRuleSource = 'column' | 'builder';

export type FilterOperator = FilterOperatorId;

export interface FilterRuleMeta {
  id: string;
  source: FilterRuleSource;
  operator: FilterOperatorId;
  updatedAt: number;
}

export interface FilterRule {
  id: string;
  fieldKey: string;
  operator: FilterOperator;
  value: unknown;
  source: FilterRuleSource;
  updatedAt: number;
}

export interface FilterQuery {
  logic: 'AND';
  rules: FilterRule[];
}

export function createRuleId(): string {
  return `fr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyFilterQuery(): FilterQuery {
  return { logic: 'AND', rules: [] };
}

export function compileRulesToFlatFilters(
  rules: FilterRule[]
): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const rule of rules) {
    if (!rule.fieldKey || !isFilterValueActive(rule.value)) continue;
    flat[rule.fieldKey] = rule.value;
  }
  return flat;
}

export function flatFiltersToRules(
  filters: Record<string, unknown>,
  ruleMeta: Record<string, FilterRuleMeta> = {}
): FilterRule[] {
  const rules: FilterRule[] = [];
  for (const [fieldKey, value] of Object.entries(filters)) {
    if (!isFilterValueActive(value)) continue;
    const meta = ruleMeta[fieldKey];
    rules.push({
      id: meta?.id ?? createRuleId(),
      fieldKey,
      operator: meta?.operator ?? 'is',
      value,
      source: meta?.source ?? 'column',
      updatedAt: meta?.updatedAt ?? 0,
    });
  }
  return rules.sort((a, b) => a.updatedAt - b.updatedAt);
}

export function countActiveFilterRules(
  filters: Record<string, unknown>,
  operators: Record<string, FilterOperatorId> = {},
  options?: { allowedKeys?: Iterable<string> }
): number {
  const allowed = options?.allowedKeys ? new Set(options.allowedKeys) : null;
  const keys = new Set([...Object.keys(filters), ...Object.keys(operators)]);
  let count = 0;
  for (const key of keys) {
    // Advanced AST payload is never a column filter key.
    if (key !== 'filterQuery' && allowed && !allowed.has(key)) continue;
    const operator = operators[key] ?? 'is';
    if (isFilterRuleActive(filters[key], operator)) count += 1;
  }
  return count;
}
