import type { Component, Editor } from 'grapesjs';
import { getPrintAreaComponent, PRINT_AREA_ATTR, PRINT_AREA_TYPE, resolveInsertTarget } from './printArea';
import { insertMergeIntoCanvasText, hasPendingCanvasTextInsert } from './canvasInsertion';
import { formatMergeToken } from './mergeTokens';
import { readTextContent, writeTextContent } from './textContent';
import { insertMergeIntoTableCell } from './tableSheetEditor';
import { resolveAssetDownloadUrl } from '../composables/useCompanyLogoAsset';
import { applyImageSrcToComponent } from './canvasImageSrc';
import {
  findResizableTableRoot,
  isSelectionInTableContext,
  isTableCellComponent,
  isTableStructureComponent
} from './tableModel';

export interface LayerNode {
  id: string;
  label: string;
  tag: string;
  depth: number;
  children: LayerNode[];
}

const TEXT_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'li', 'td', 'th']);

export { isComponentDomFocused, isCorruptedComponentContent, isEditableTextComponent, normalizeDisplayText, readRichTextHtml, readTextContent, repairAllTextComponents, syncTextContentFromDom, writeRichTextHtml, writeTextContent } from './textContent';

export function isTextComponent(component: Component | null): boolean {
  if (!component) return false;
  const tag = String(component.get('tagName') || '').toLowerCase();
  return TEXT_TAGS.has(tag);
}

export function isImageComponent(component: Component | null): boolean {
  if (!component) return false;
  return String(component.get('tagName') || '').toLowerCase() === 'img';
}

export function isMergeFieldComponent(component: Component | null): boolean {
  if (!component) return false;
  const attrs = component.getAttributes?.() || {};
  return attrs['data-merge-field'] === 'true' || attrs['data-merge-field'] === true;
}

export function readComponentStyle(component: Component, key: string): string {
  const style = component.getStyle?.() || {};
  const value = style[key];
  return value != null ? String(value) : '';
}

export function patchComponentStyle(
  component: Component,
  patch: Record<string, string | number | undefined>
): void {
  const current = { ...(component.getStyle?.() || {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '') {
      delete current[key];
    } else {
      current[key] = String(value);
    }
  }
  component.setStyle(current);
}

export function readStyleValue(component: Component | null, keys: string[], fallback = ''): string {
  if (!component) return fallback;
  for (const key of keys) {
    const value = readComponentStyle(component, key);
    if (value) return value;
  }
  return fallback;
}

export function readComponentClasses(component: Component | null): string {
  if (!component) return '';
  return component.getClasses?.().join(' ') || '';
}

export function writeComponentClasses(component: Component, value: string): void {
  const classes = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (classes.length) {
    component.setClass(classes.join(' '));
  } else {
    component.setClass('');
  }
}

export function readComponentAttributes(component: Component): Record<string, string> {
  const attrs = component.getAttributes?.() || {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value != null) result[key] = String(value);
  }
  return result;
}

export function patchComponentAttributes(
  component: Component,
  patch: Record<string, string | undefined>
): void {
  const current = readComponentAttributes(component);
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete current[key];
    } else {
      current[key] = value;
    }
  }
  component.setAttributes(current);
}

export { formatMergeToken, parseMergePathFromContent } from './mergeTokens';

function isStructuralLayerNode(component: Component): boolean {
  if (component.get('layerable') === false) return true;

  const type = String(component.get('type') || '');
  const tag = String(component.get('tagName') || '').toLowerCase();
  const attrs = component.getAttributes?.() || {};

  if (type === 'wrapper' || type === PRINT_AREA_TYPE || attrs[PRINT_AREA_ATTR] === 'true') {
    return true;
  }

  return tag === 'colgroup' || tag === 'col';
}

function resolveLayerLabel(component: Component, tag: string): string {
  const attrs = component.getAttributes?.() || {};
  const customName = typeof attrs['data-layer-name'] === 'string' ? attrs['data-layer-name'] : '';
  if (customName) return customName;

  const name = String(component.get('name') || '').trim();
  if (name) return name;

  if (attrs['data-line-item'] === 'true' || attrs['data-line-item'] === true) {
    return 'Line items';
  }

  if (attrs['data-merge-field'] === 'true' || attrs['data-merge-field'] === true) {
    const content = readTextContent(component).trim();
    return content || 'Merge field';
  }

  return tag;
}

function collectLayerChildren(component: Component, depth: number): LayerNode[] {
  const nodes: LayerNode[] = [];

  for (const child of component.components()) {
    if (isStructuralLayerNode(child)) {
      nodes.push(...collectLayerChildren(child, depth));
      continue;
    }
    nodes.push(buildLayerNode(child, depth));
  }

  return nodes;
}

function buildLayerNode(component: Component, depth: number): LayerNode {
  const tag = String(component.get('tagName') || component.get('type') || 'div').toLowerCase();
  return {
    id: String(component.getId()),
    label: resolveLayerLabel(component, tag),
    tag,
    depth,
    children: collectLayerChildren(component, depth + 1)
  };
}

/** @deprecated Use getLayerTree — kept for any direct callers */
export function buildLayerTree(component: Component, depth = 0): LayerNode {
  return buildLayerNode(component, depth);
}

export function getLayerTree(editor: Editor | null): LayerNode | null {
  const wrapper = editor?.getWrapper?.();
  if (!wrapper) return null;

  const printArea = getPrintAreaComponent(wrapper);
  if (printArea) {
    return {
      id: String(printArea.getId()),
      label: 'Print Area',
      tag: 'div',
      depth: 0,
      children: collectLayerChildren(printArea, 1)
    };
  }

  return {
    id: String(wrapper.getId()),
    label: String(wrapper.get('name') || 'Document'),
    tag: String(wrapper.get('tagName') || 'body').toLowerCase(),
    depth: 0,
    children: collectLayerChildren(wrapper, 1)
  };
}

export function findComponentById(root: Component, componentId: string): Component | null {
  if (String(root.getId()) === componentId) return root;
  for (const child of root.components()) {
    const found = findComponentById(child, componentId);
    if (found) return found;
  }
  return null;
}

export function selectComponentById(editor: Editor | null, componentId: string): void {
  if (!editor || !componentId) return;
  const wrapper = editor.getWrapper();
  if (!wrapper) return;
  const found = findComponentById(wrapper, componentId);
  if (found) editor.select(found);
}

export function insertMergeField(
  editor: Editor,
  path: string,
  hintComponent?: Component | null
): void {
  const token = formatMergeToken(path);

  if (insertMergeIntoTableCell(editor, path)) return;
  if (insertMergeIntoCanvasText(editor, path, hintComponent)) return;

  const selected = editor.getSelected();
  const dropTarget = resolveInsertTarget(editor);
  if (!dropTarget) return;

  if (isTableStructureComponent(dropTarget) || findResizableTableRoot(dropTarget)) {
    if (isSelectionInTableContext(selected) && insertMergeIntoTableCell(editor, path)) return;
    return;
  }

  if (selected && isMergeFieldComponent(selected)) {
    writeTextContent(selected, token);
    patchComponentAttributes(selected, { 'data-merge-field': 'true' });
    return;
  }

  if (selected && isTextComponent(selected) && !isTableCellComponent(selected)) {
    const current = readTextContent(selected);
    writeTextContent(selected, current ? `${current} ${token}` : token, { force: true });
    return;
  }

  if (hasPendingCanvasTextInsert(editor)) return;

  dropTarget.append(
    `<span data-gjs-type="text" data-merge-field="true" style="display:inline-block;padding:2px 6px;border-radius:4px;background:#eef2ff;color:#4338ca;font-family:monospace;font-size:13px;">${token}</span>`
  );
}

export function insertImageAsset(
  editor: Editor,
  payload: { src: string; alt?: string }
): void {
  const selected = editor.getSelected();
  const dropTarget = resolveInsertTarget(editor);
  if (!dropTarget || !payload.src) return;

  const resolvedSrc = resolveAssetDownloadUrl(payload.src);

  if (selected && isImageComponent(selected)) {
    const attrs = selected.getAttributes?.() as Record<string, string> | undefined;
    const patch: Record<string, string | undefined> = {
      alt: payload.alt || ''
    };
    if (attrs?.['data-logo'] === 'true') {
      patch['data-company-logo'] = 'false';
      patch['data-custom-image'] = 'true';
      patch['data-merge-src'] = undefined;
    }
    patchComponentAttributes(selected, patch);
    applyImageSrcToComponent(selected, resolvedSrc, editor);
    return;
  }

  dropTarget.append(
    `<img src="${resolvedSrc}" alt="${payload.alt || ''}" style="max-width:100%;height:auto;display:block;" />`
  );
}
