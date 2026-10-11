import type { ContentComponentNode } from '@/constants/contentComponentRegistry';
import { isBuilderContainerComponentType } from '@/constants/contentComponentRegistry';

export function createNodeId(prefix = 'node'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function cloneDefinition(definition: ContentComponentNode): ContentComponentNode {
  return JSON.parse(JSON.stringify(definition)) as ContentComponentNode;
}

export interface TreeLocation {
  parent: ContentComponentNode;
  index: number;
  node: ContentComponentNode;
}

export function findNodeLocation(
  root: ContentComponentNode,
  nodeId: string,
  parent: ContentComponentNode = root
): TreeLocation | null {
  const children = parent.children || [];
  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    if (!node) continue;
    if (node.id === nodeId) {
      return { parent, index, node };
    }
    const nested = findNodeLocation(root, nodeId, node);
    if (nested) return nested;
  }
  return null;
}

export function findNode(root: ContentComponentNode, nodeId: string): ContentComponentNode | null {
  if (root.id === nodeId) return root;
  const location = findNodeLocation(root, nodeId);
  return location?.node || null;
}

export function ensureChildren(node: ContentComponentNode): ContentComponentNode[] {
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
  return node.children;
}

export function addChild(
  root: ContentComponentNode,
  parentId: string,
  child: ContentComponentNode
): ContentComponentNode {
  const next = cloneDefinition(root);
  const parent = parentId === root.id ? next : findNode(next, parentId);
  if (!parent) return root;
  ensureChildren(parent).push(child);
  return next;
}

export function insertChildAt(
  root: ContentComponentNode,
  parentId: string,
  index: number,
  child: ContentComponentNode
): ContentComponentNode {
  const next = cloneDefinition(root);
  const parent = parentId === root.id ? next : findNode(next, parentId);
  if (!parent) return root;
  const children = ensureChildren(parent);
  const safeIndex = Math.max(0, Math.min(index, children.length));
  children.splice(safeIndex, 0, child);
  return next;
}

export function isNodeHidden(node: ContentComponentNode | null | undefined): boolean {
  return node?.visibility?.hidden === true;
}

export function isNodeLocked(node: ContentComponentNode | null | undefined): boolean {
  return node?.visibility?.locked === true;
}

export function toggleNodeVisibility(
  root: ContentComponentNode,
  nodeId: string,
  hidden?: boolean
): ContentComponentNode {
  const next = cloneDefinition(root);
  const node = findNode(next, nodeId);
  if (!node) return root;
  node.visibility = {
    ...(node.visibility || {}),
    hidden: hidden ?? !isNodeHidden(node)
  };
  return next;
}

export function toggleNodeLocked(
  root: ContentComponentNode,
  nodeId: string,
  locked?: boolean
): ContentComponentNode {
  const next = cloneDefinition(root);
  const node = findNode(next, nodeId);
  if (!node) return root;
  node.visibility = {
    ...(node.visibility || {}),
    locked: locked ?? !isNodeLocked(node)
  };
  return next;
}

export function removeNode(root: ContentComponentNode, nodeId: string): ContentComponentNode {
  if (root.id === nodeId) return root;
  const next = cloneDefinition(root);
  const location = findNodeLocation(next, nodeId);
  if (!location) return root;
  const children = ensureChildren(location.parent);
  children.splice(location.index, 1);
  return next;
}

export function updateNode(
  root: ContentComponentNode,
  nodeId: string,
  patch: Partial<ContentComponentNode>
): ContentComponentNode {
  const next = cloneDefinition(root);
  const node = findNode(next, nodeId);
  if (!node) return root;

  if (patch.name !== undefined) node.name = patch.name;
  if (patch.type !== undefined) node.type = patch.type;
  if (patch.layout !== undefined) node.layout = { ...node.layout, ...patch.layout };
  if (patch.style !== undefined) {
    node.style = {
      ...node.style,
      ...patch.style,
      typography: {
        ...(node.style?.typography as Record<string, unknown> | undefined),
        ...(patch.style.typography as Record<string, unknown> | undefined)
      }
    };
  }
  if (patch.bindings !== undefined) node.bindings = { ...node.bindings, ...patch.bindings };
  if (patch.visibility !== undefined) node.visibility = { ...node.visibility, ...patch.visibility };

  return next;
}

export function reorderPageChildren(
  root: ContentComponentNode,
  orderedIds: string[]
): ContentComponentNode {
  return reorderChildren(root, root.id, orderedIds);
}

export function reorderChildren(
  root: ContentComponentNode,
  parentId: string,
  orderedIds: string[]
): ContentComponentNode {
  const next = cloneDefinition(root);
  const parent = parentId === next.id ? next : findNode(next, parentId);
  if (!parent) return root;

  const children = ensureChildren(parent);
  const byId = new Map(children.map((child) => [child.id, child]));
  const reordered = orderedIds
    .map((id) => byId.get(id))
    .filter((node): node is ContentComponentNode => Boolean(node));

  if (reordered.length !== children.length) return root;
  parent.children = reordered;
  return next;
}

function assignNewIds(node: ContentComponentNode, prefix: string): void {
  node.id = createNodeId(prefix);
  for (const child of node.children || []) {
    assignNewIds(child, String(child.type).toLowerCase());
  }
}

export function duplicateNode(
  root: ContentComponentNode,
  nodeId: string
): { root: ContentComponentNode; newNodeId: string | null } {
  if (nodeId === root.id) return { root, newNodeId: null };

  const next = cloneDefinition(root);
  const location = findNodeLocation(next, nodeId);
  if (!location) return { root, newNodeId: null };

  const copy = cloneDefinition(location.node);
  assignNewIds(copy, String(copy.type).toLowerCase());
  ensureChildren(location.parent).splice(location.index + 1, 0, copy);
  return { root: next, newNodeId: copy.id };
}

export function countComponents(root: ContentComponentNode): number {
  let count = 0;
  const walk = (node: ContentComponentNode) => {
    count += 1;
    for (const child of node.children || []) {
      walk(child);
    }
  };
  walk(root);
  return Math.max(count - 1, 0);
}

export function isContainerComponentType(type: string): boolean {
  return isBuilderContainerComponentType(type);
}

export function flattenTree(root: ContentComponentNode): Array<{ node: ContentComponentNode; depth: number }> {
  const items: Array<{ node: ContentComponentNode; depth: number }> = [];
  const walk = (node: ContentComponentNode, depth: number) => {
    items.push({ node, depth });
    for (const child of node.children || []) {
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return items;
}

export function remapDefinitionIds(definition: ContentComponentNode): ContentComponentNode {
  const next = cloneDefinition(definition);
  const walk = (node: ContentComponentNode) => {
    node.id = createNodeId(String(node.type).toLowerCase());
    for (const child of node.children || []) {
      walk(child);
    }
  };
  walk(next);
  return next;
}

export function findNodePath(
  root: ContentComponentNode,
  nodeId: string
): ContentComponentNode[] {
  if (root.id === nodeId) return [root];

  const path: ContentComponentNode[] = [];

  function walk(node: ContentComponentNode): boolean {
    path.push(node);
    if (node.id === nodeId) return true;
    for (const child of node.children || []) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  }

  for (const child of root.children || []) {
    path.length = 0;
    if (walk(child)) return [...path];
  }

  return [];
}

export function componentPreviewLabel(node: ContentComponentNode): string {
  const bindings = node.bindings || {};
  if (typeof bindings.text === 'string' && bindings.text.trim()) return bindings.text.trim();
  if (typeof bindings.path === 'string' && bindings.path.trim()) return `{{${bindings.path}}}`;
  if (typeof bindings.collection === 'string' && bindings.collection.trim()) {
    return bindings.collection;
  }
  return node.name || node.type;
}
