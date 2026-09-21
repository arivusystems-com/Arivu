import type { Component, Editor } from 'grapesjs';
import type { LineItemBindings } from '@/constants/lineItemDefaults';
import { lineItemLayoutSignature, normalizeLineItemColumnList } from '@/constants/lineItemDefaults';
import { buildLineItemTableHtml } from './lineItemHtml';
import {
  captureLineItemRowCellContent,
  restoreLineItemRowCellContent
} from './tableModel';
import {
  findLineItemInnerTableComponent,
  isLineItemComponent,
  isLineItemInnerTable,
  LINE_ITEM_TYPE,
  readLineItemBindings,
  writeLineItemBindings
} from './lineItemModel';

let templateModuleScope = '';

export function setLineItemTemplateModuleScope(moduleScope: string): void {
  templateModuleScope = String(moduleScope || '').trim().toLowerCase();
}

export function getLineItemTemplateModuleScope(): string {
  return templateModuleScope;
}

function configureLineItemTable(table: Component): void {
  table.set({
    selectable: true,
    hoverable: true,
    highlightable: true,
    draggable: false,
    droppable: false,
    editable: false,
    removable: false,
    copyable: false,
    layerable: true
  });
}

function ensureLineItemTable(component: Component): void {
  const attrs = component.getAttributes?.() || {};
  const hasBindings = Boolean(attrs['data-line-item-bindings']);
  const table = findLineItemInnerTableComponent(component);
  if (table) {
    configureLineItemTable(table);
    return;
  }
  // Bindings present but no table (empty seed wrapper) — build from bindings.
  if (hasBindings) {
    renderLineItemTable(component, readLineItemBindings(component, templateModuleScope));
  } else {
    renderLineItemTable(component, { moduleScope: templateModuleScope });
  }
}

export function renderLineItemTable(component: Component, bindings: Partial<LineItemBindings>): void {
  const existingTable = findLineItemInnerTableComponent(component);
  const current = readLineItemBindings(component, templateModuleScope);
  const resolved: LineItemBindings = {
    ...current,
    ...bindings,
    columns: normalizeLineItemColumnList(bindings.columns ?? current.columns)
  };
  const preserveEdits = existingTable != null
    && lineItemLayoutSignature(current) === lineItemLayoutSignature(resolved);
  const preservedRows = preserveEdits
    ? captureLineItemRowCellContent(existingTable)
    : [];

  writeLineItemBindings(component, resolved);

  const tableHtml = buildLineItemTableHtml(resolved);
  component.components(tableHtml);

  const table = component.components().find(
    (child: Component) => String(child.get('tagName') || '').toLowerCase() === 'table'
  );
  if (table) {
    configureLineItemTable(table);
    if (preserveEdits) {
      restoreLineItemRowCellContent(table, preservedRows);
    }
  }
}

export function registerLineItemComponent(editor: Editor): void {
  if (editor.DomComponents.getType(LINE_ITEM_TYPE)) return;

  editor.DomComponents.addType(LINE_ITEM_TYPE, {
    isComponent: (el) => {
      if (!el || typeof el !== 'object') return false;
      const element = el as HTMLElement;
      return (
        element.getAttribute?.('data-line-item') === 'true'
        || element.getAttribute?.('data-gjs-type') === LINE_ITEM_TYPE
      );
    },
    model: {
      defaults: {
        tagName: 'div',
        name: 'Line items',
        attributes: {
          'data-line-item': 'true',
          class: 'arivu-line-item-block'
        },
        droppable: false,
        stylable: true,
        draggable: true,
        copyable: true,
        removable: true,
        layerable: true,
        badgable: true,
        toolbar: []
      },
      init() {
        ensureLineItemTable(this);
      }
    }
  });

  editor.on('component:add', (component: Component) => {
    if (isLineItemComponent(component)) {
      ensureLineItemTable(component);
      return;
    }
    if (isLineItemInnerTable(component)) {
      configureLineItemTable(component);
    }
  });

  editor.on('load', () => {
    const wrapper = editor.getWrapper();
    if (!wrapper) return;
    const visit = (component: Component) => {
      if (isLineItemComponent(component)) {
        ensureLineItemTable(component);
      }
      component.components().forEach(visit);
    };
    visit(wrapper);
  });
}

export function persistLineItemColumnPercents(lineItemRoot: Component, percents: number[]): void {
  const bindings = readLineItemBindings(lineItemRoot, templateModuleScope);
  const stored = percents.map((value) => Math.round(value * 1000) / 1000);
  writeLineItemBindings(lineItemRoot, {
    ...bindings,
    columnWidthPercents: stored
  });
}

export function updateLineItemBindings(
  component: Component,
  patch: Partial<LineItemBindings>
): void {
  const next = {
    ...readLineItemBindings(component, templateModuleScope),
    ...patch,
    columns: patch.columns ?? readLineItemBindings(component, templateModuleScope).columns
  };
  renderLineItemTable(component, next);
}
