export type FilterLogic = 'AND' | 'OR';

export interface FilterRuleRef {
  kind: 'rule';
  id: string;
  fieldKey: string | null;
  /** Nested filters combined with this rule (AND with parent when both active). */
  nested?: FilterGroupNode;
}

export interface FilterGroupNode {
  kind: 'group';
  id: string;
  logic: FilterLogic;
  children: FilterQueryNode[];
}

export type FilterQueryNode = FilterRuleRef | FilterGroupNode;

/** Maximum nesting depth for filter groups (root = 0). */
export const FILTER_MAX_GROUP_DEPTH = 4;

export function createGroupId(): string {
  return `fg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createRuleRefId(): string {
  return `fr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyRuleRef(): FilterRuleRef {
  return { kind: 'rule', id: createRuleRefId(), fieldKey: null };
}

export function createDefaultRootGroup(): FilterGroupNode {
  return {
    kind: 'group',
    id: createGroupId(),
    logic: 'AND',
    children: [createEmptyRuleRef()],
  };
}

export function isFilterGroupNode(node: FilterQueryNode): node is FilterGroupNode {
  return node.kind === 'group';
}

export function isFilterRuleRef(node: FilterQueryNode): node is FilterRuleRef {
  return node.kind === 'rule';
}

function collectKeysFromRule(rule: FilterRuleRef, keys: string[]) {
  if (rule.fieldKey) keys.push(rule.fieldKey);
  if (rule.nested) walkNodes(rule.nested.children, keys);
}

function walkNodes(nodes: FilterQueryNode[], keys: string[]) {
  for (const node of nodes) {
    if (isFilterRuleRef(node)) collectKeysFromRule(node, keys);
    if (isFilterGroupNode(node)) walkNodes(node.children, keys);
  }
}

export function collectRuleFieldKeys(group: FilterGroupNode): string[] {
  const keys: string[] = [];
  walkNodes(group.children, keys);
  return keys;
}

export function createEmptyNestedGroup(): FilterGroupNode {
  return {
    kind: 'group',
    id: createGroupId(),
    logic: 'AND',
    children: [createEmptyRuleRef()],
  };
}

export function appendNestedRuleToRule(rule: FilterRuleRef): FilterRuleRef {
  const next = JSON.parse(JSON.stringify(rule)) as FilterRuleRef;
  if (!next.nested) {
    next.nested = createEmptyNestedGroup();
  } else {
    next.nested.children.push(createEmptyRuleRef());
  }
  return next;
}

export function appendRuleToGroup(group: FilterGroupNode): FilterGroupNode {
  const next = JSON.parse(JSON.stringify(group)) as FilterGroupNode;
  next.children.push(createEmptyRuleRef());
  return next;
}

export function countActiveRulesInGroup(
  group: FilterGroupNode,
  isActive: (fieldKey: string) => boolean
): number {
  let count = 0;
  const walk = (nodes: FilterQueryNode[]) => {
    for (const node of nodes) {
      if (isFilterRuleRef(node)) {
        if (node.fieldKey && isActive(node.fieldKey)) count += 1;
        if (node.nested) walk(node.nested.children);
      }
      if (isFilterGroupNode(node)) walk(node.children);
    }
  };
  walk(group.children);
  return count;
}
