import type { Component, Editor } from 'grapesjs';
import {
  insertTableColumnWidth,
  removeTableColumnWidth,
  ensureTableColumnLayout
} from './tableColumnWidths';
import {
  buildRowDefinition,
  buildTableGrid,
  createTableCellDefinition,
  defaultCellMarkup,
  findComponentById,
  findTableRoot,
  getAnchorCell,
  getCellAt,
  getTableCellContext,
  isTableCellComponent,
  readCellText,
  repaintTableCells,
  resolveTableCellComponent,
  resolveTableCellFromElement,
  resolveTableCellTarget,
  type TableCellTarget,
  type TableGrid,
  writeCellText
} from './tableModel';
import { isTableSheetEditing } from './tableSheetEditor';

export interface TableSelectionRange {
  tableId: string;
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

export const TABLE_SELECTION_CHANGED = 'arivu:table-selection-changed';

const TABLE_CELL_RANGE_CLASS = 'arivu-table-cell-in-range';
const TABLE_CELL_PRIMARY_CLASS = 'arivu-table-cell-range-primary';

let selectionRange: TableSelectionRange | null = null;
let selectionEditor: Editor | null = null;
let selectionDragActive = false;
let tableMutationDepth = 0;
let tableMutationGraceUntil = 0;
let contextMenuOpen = false;

export function isTableMutating(): boolean {
  return tableMutationDepth > 0 || Date.now() < tableMutationGraceUntil || contextMenuOpen;
}

export function isTableMutationInProgress(): boolean {
  return tableMutationDepth > 0;
}

export function setContextMenuOpen(open: boolean): void {
  contextMenuOpen = open;
  if (!open) {
    tableMutationGraceUntil = Math.max(tableMutationGraceUntil, Date.now() + 800);
  }
}

export function getTableSelectionRange(): TableSelectionRange | null {
  return selectionRange;
}

function clearSelectionHighlights(editor: Editor): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;
  doc.querySelectorAll(`.${TABLE_CELL_RANGE_CLASS}, .${TABLE_CELL_PRIMARY_CLASS}`).forEach((node) => {
    node.classList.remove(TABLE_CELL_RANGE_CLASS, TABLE_CELL_PRIMARY_CLASS);
  });
}

function applySelectionHighlights(editor: Editor): void {
  clearSelectionHighlights(editor);
  if (!selectionRange) return;

  const table = findComponentById(editor, selectionRange.tableId);
  if (!table) return;

  const grid = buildTableGrid(table);
  const bounds = getNormalizedSelection(grid);
  if (!bounds) return;

  const marked = new Set<HTMLElement>();
  for (let row = bounds.r0; row <= bounds.r1; row += 1) {
    for (let col = bounds.c0; col <= bounds.c1; col += 1) {
      const anchor = getAnchorCell(grid, row, col);
      const element = anchor?.component.view?.el as HTMLElement | undefined;
      if (!element || marked.has(element)) continue;
      marked.add(element);
      element.classList.add(TABLE_CELL_RANGE_CLASS);
      if (row === selectionRange.r1 && col === selectionRange.c1) {
        element.classList.add(TABLE_CELL_PRIMARY_CLASS);
      }
    }
  }
}

function syncSelectionHighlights(): void {
  if (!selectionEditor) return;
  applySelectionHighlights(selectionEditor);
}

function applyTableSelectionRange(
  table: Component,
  r0: number,
  c0: number,
  r1: number,
  c1: number
): void {
  selectionRange = {
    tableId: String(table.getId()),
    r0,
    c0,
    r1,
    c1
  };
  notifySelectionChanged();
}

function isMultiCellSelection(grid: TableGrid): boolean {
  const bounds = getNormalizedSelection(grid);
  return Boolean(bounds && (bounds.r0 !== bounds.r1 || bounds.c0 !== bounds.c1));
}

function notifySelectionChanged(): void {
  syncSelectionHighlights();
  if (tableMutationDepth > 0 || contextMenuOpen || !selectionEditor) return;
  queueMicrotask(() => {
    selectionEditor?.trigger(TABLE_SELECTION_CHANGED);
  });
}

export function clearTableSelectionRange(): void {
  if (!selectionRange) {
    syncSelectionHighlights();
    return;
  }
  selectionRange = null;
  notifySelectionChanged();
}

export function updateTableSelection(component: Component, shiftKey: boolean): void {
  const ctx = getTableCellContext(component);
  const table = findTableRoot(component);
  if (!ctx || !table) {
    clearTableSelectionRange();
    return;
  }

  const tableId = String(table.getId());
  const row = ctx.logicalRow;
  const col = ctx.logicalCol;

  if (shiftKey && selectionRange && selectionRange.tableId === tableId) {
    if (selectionRange.r1 === row && selectionRange.c1 === col) return;
    selectionRange = {
      tableId,
      r0: selectionRange.r0,
      c0: selectionRange.c0,
      r1: row,
      c1: col
    };
    notifySelectionChanged();
    return;
  }

  if (
    !shiftKey &&
    selectionRange?.tableId === tableId &&
    selectionRange.r0 === row &&
    selectionRange.c0 === col &&
    selectionRange.r1 === row &&
    selectionRange.c1 === col
  ) {
    return;
  }

  selectionRange = {
    tableId,
    r0: row,
    c0: col,
    r1: row,
    c1: col
  };
  notifySelectionChanged();
}

export function getNormalizedSelection(grid: TableGrid): {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
} | null {
  if (!selectionRange || selectionRange.tableId !== String(grid.table.getId())) return null;
  return {
    r0: Math.min(selectionRange.r0, selectionRange.r1),
    c0: Math.min(selectionRange.c0, selectionRange.c1),
    r1: Math.max(selectionRange.r0, selectionRange.r1),
    c1: Math.max(selectionRange.c0, selectionRange.c1)
  };
}

function insertRowCells(row: Component, colCount: number, isHeader: boolean): void {
  for (let i = 0; i < colCount; i += 1) {
    row.append(createTableCellDefinition(isHeader));
  }
}

function isAttachedCell(component: Component | null | undefined): component is Component {
  if (!component || !isTableCellComponent(component)) return false;
  return Boolean(component.parent?.());
}

function selectTableCell(editor: Editor, cell: Component | null | undefined): void {
  if (!isAttachedCell(cell)) return;
  const current = editor.getSelected?.();
  if (current === cell) return;
  editor.select(cell);
}

function runTableMutation(fn: () => void): void {
  tableMutationDepth += 1;
  try {
    fn();
  } finally {
    tableMutationDepth -= 1;
    if (tableMutationDepth === 0) {
      tableMutationGraceUntil = Date.now() + 800;
    }
  }
}

function renderComponentTree(component: Component): void {
  component.view?.render?.();
  for (const child of component.components()) {
    renderComponentTree(child);
  }
}

function syncTableView(table: Component | null | undefined): void {
  if (!table) return;
  renderComponentTree(table);
  repaintTableCells(table);
}

function insertRowAt(table: Component, rowIndex: number, position: 'above' | 'below'): void {
  const grid = buildTableGrid(table);
  const targetRow = position === 'above' ? rowIndex : rowIndex + 1;

  if (targetRow >= grid.rows.length) {
    const last = grid.rows[grid.rows.length - 1];
    if (!last) return;
    const section = last.component.parent?.();
    if (!section) return;
    const isHeader = last.section === 'thead';
    section.append(buildRowDefinition(grid.colCount, isHeader), { at: last.component.index() + 1 });
    return;
  }

  const targetRowRef = grid.rows[targetRow];
  if (!targetRowRef) return;
  const section = targetRowRef.component.parent?.();
  if (!section) return;
  const isHeader = targetRowRef.section === 'thead';
  section.append(buildRowDefinition(grid.colCount, isHeader), { at: targetRowRef.component.index() });
}

function insertColumnAt(
  table: Component,
  logicalCol: number,
  colSpan: number,
  position: 'left' | 'right'
): void {
  const grid = buildTableGrid(table);
  const targetLogicalCol = position === 'left' ? logicalCol : logicalCol + colSpan;

  for (const rowRef of grid.rows) {
    const row = rowRef.component;
    const isHeader = rowRef.section === 'thead';
    const rowIndex = rowRef.rowIndex;

    if (targetLogicalCol >= grid.colCount) {
      row.append(createTableCellDefinition(isHeader));
      continue;
    }

    const anchor =
      position === 'left'
        ? getAnchorCell(grid, rowIndex, targetLogicalCol)
        : getAnchorCell(grid, rowIndex, Math.max(0, targetLogicalCol - 1));

    if (!anchor) {
      row.append(createTableCellDefinition(isHeader));
      continue;
    }

    const insertAt =
      position === 'left' ? anchor.component.index() : anchor.component.index() + 1;

    row.append(createTableCellDefinition(isHeader), { at: insertAt });
  }

  insertTableColumnWidth(table, targetLogicalCol);
  ensureTableColumnLayout(table);
}

export function insertRowAbove(cell: Component): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;
  insertRowAt(table, ctx.row.rowIndex, 'above');
}

export function insertRowBelow(cell: Component): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;
  insertRowAt(table, ctx.row.rowIndex, 'below');
}

export function deleteRow(cell: Component): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;

  const grid = buildTableGrid(table);
  if (grid.rows.length <= 1) return;

  ctx.row.component.remove();
}

export function insertColumnLeft(cell: Component): void {
  insertColumnRelative(cell, 'left');
}

export function insertColumnRight(cell: Component): void {
  insertColumnRelative(cell, 'right');
}

function insertColumnRelative(cell: Component, position: 'left' | 'right'): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;
  insertColumnAt(table, ctx.logicalCol, ctx.colSpan, position);
}

export function deleteColumn(cell: Component): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;

  const grid = buildTableGrid(table);
  if (grid.colCount <= 1) return;

  const targetCol = ctx.logicalCol;
  const removed = new Set<Component>();

  for (let r = 0; r < grid.rows.length; r += 1) {
    const anchor = getAnchorCell(grid, r, targetCol);
    if (!anchor || removed.has(anchor.component)) continue;

    if (anchor.colSpan > 1) {
      anchor.component.addAttributes({ colspan: String(anchor.colSpan - 1) });
    } else {
      anchor.component.remove();
    }
    removed.add(anchor.component);
  }

  removeTableColumnWidth(table, targetCol);
  ensureTableColumnLayout(table);
}

function resolveMergeBounds(grid: TableGrid): {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
} | null {
  const bounds = getNormalizedSelection(grid);
  if (!bounds || (bounds.r0 === bounds.r1 && bounds.c0 === bounds.c1)) {
    return null;
  }
  return bounds;
}

export function mergeSelectedCells(cell: Component): Component | null {
  const table = findTableRoot(cell);
  if (!table) return null;

  const grid = buildTableGrid(table);
  const bounds = resolveMergeBounds(grid);
  if (!bounds) return null;

  if (!mergeCellRange(grid, bounds.r0, bounds.c0, bounds.r1, bounds.c1)) {
    return null;
  }

  return getAnchorCell(buildTableGrid(table), bounds.r0, bounds.c0)?.component ?? null;
}

export function mergeCellRange(
  grid: TableGrid,
  r0: number,
  c0: number,
  r1: number,
  c1: number
): boolean {
  if (r0 === r1 && c0 === c1) return false;

  const anchor = getAnchorCell(grid, r0, c0);
  if (!anchor) return false;

  const rowSpan = r1 - r0 + 1;
  const colSpan = c1 - c0 + 1;
  const toRemove = new Set<Component>();

  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const occupant = getCellAt(grid, r, c);
      if (!occupant) continue;
      if (occupant.component !== anchor.component) {
        toRemove.add(occupant.component);
      }
    }
  }

  anchor.component.addAttributes({
    colspan: String(colSpan),
    rowspan: String(rowSpan)
  });

  for (const component of toRemove) {
    component.remove();
  }

  return true;
}

export function unmergeCell(cell: Component): void {
  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) return;
  if (ctx.colSpan <= 1 && ctx.rowSpan <= 1) return;

  const grid = buildTableGrid(table);
  const anchor = getAnchorCell(grid, ctx.logicalRow, ctx.logicalCol);
  if (!anchor) return;

  const startRow = anchor.logicalRow;
  const colSpan = anchor.colSpan;
  const rowSpan = anchor.rowSpan;
  const content = readCellText(anchor.component);

  anchor.component.addAttributes({ colspan: '1', rowspan: '1' });
  writeCellText(anchor.component, content);

  for (let dr = 0; dr < rowSpan; dr += 1) {
    for (let dc = 0; dc < colSpan; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const rowRef = grid.rows[startRow + dr];
      if (!rowRef) continue;
      rowRef.component.append(defaultCellMarkup(anchor.isHeader), { at: dc });
    }
  }
}

export function setCellAlign(cell: Component, align: string): void {
  const current = { ...(cell.getStyle?.() || {}) };
  current['text-align'] = align;
  cell.setStyle(current);
}

export function deleteTable(cell: Component): void {
  findTableRoot(cell)?.remove();
}

export function toggleTableFooter(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;

  for (const child of table.components()) {
    if (String(child.get('tagName') || '').toLowerCase() === 'tfoot') {
      child.remove();
      return false;
    }
  }

  const grid = buildTableGrid(table);
  const tfoot = table.append('<tfoot></tfoot>')[0] as Component;
  const row = tfoot.append('<tr></tr>')[0] as Component;
  insertRowCells(row, grid.colCount, false);
  return true;
}

export function hasTableFooter(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;
  return table.components().some((child: Component) => String(child.get('tagName') || '').toLowerCase() === 'tfoot');
}

export function toggleDataRow(cell: Component): boolean {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;
  const attrs = ctx.row.component.getAttributes?.() || {};
  const isData = attrs['data-repeat-row'] === 'true' || attrs['data-repeat-row'] === true;
  if (isData) {
    ctx.row.component.removeAttributes('data-repeat-row');
    return false;
  }
  for (const row of ctx.row.component.parent?.()?.components?.() || []) {
    if (String(row.get('tagName') || '').toLowerCase() === 'tr') {
      row.removeAttributes('data-repeat-row');
    }
  }
  ctx.row.component.addAttributes({ 'data-repeat-row': 'true' });
  return true;
}

export function isDataRow(cell: Component): boolean {
  const ctx = getTableCellContext(cell);
  if (!ctx) return false;
  const attrs = ctx.row.component.getAttributes?.() || {};
  return attrs['data-repeat-row'] === 'true' || attrs['data-repeat-row'] === true;
}

export function copyCell(cell: Component): { text: string; align: string } | null {
  if (!getTableCellContext(cell)) return null;
  return {
    text: readCellText(cell),
    align: String(cell.getStyle?.()['text-align'] || 'left')
  };
}

export function pasteCell(cell: Component, payload: { text: string; align?: string }): void {
  writeCellText(cell, payload.text);
  if (payload.align) setCellAlign(cell, payload.align);
}

export function canDeleteColumn(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;
  return buildTableGrid(table).colCount > 1;
}

export function canDeleteRow(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;
  return buildTableGrid(table).rows.length > 1;
}

export function canMerge(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;
  return isMultiCellSelection(buildTableGrid(table));
}

export function canUnmerge(cell: Component): boolean {
  const table = findTableRoot(cell);
  if (!table) return false;
  const grid = buildTableGrid(table);
  if (isMultiCellSelection(grid)) return false;

  const ctx = getTableCellContext(cell);
  if (!ctx) return false;
  return ctx.colSpan > 1 || ctx.rowSpan > 1;
}

export function getTableActionState(cell: Component): {
  canMerge: boolean;
  canUnmerge: boolean;
  canDeleteRow: boolean;
  canDeleteCol: boolean;
  showFooter: boolean;
  isDataRow: boolean;
} | null {
  const table = findTableRoot(cell);
  if (!table) return null;

  const grid = buildTableGrid(table);

  return {
    canMerge: isMultiCellSelection(grid),
    canUnmerge: canUnmerge(cell),
    canDeleteRow: grid.rows.length > 1,
    canDeleteCol: grid.colCount > 1,
    showFooter: hasTableFooter(cell),
    isDataRow: isDataRow(cell)
  };
}

export function bindTableSelection(editor: Editor): void {
  selectionEditor = editor;
  let pendingShift = false;
  let pendingRightClick = false;

  const attachFrameHandlers = () => {
    const doc = editor.Canvas.getFrameEl()?.contentDocument;
    if (!doc) return;

    const prior = doc.__arivuTableSelectionHandlers;
    if (prior) {
      doc.removeEventListener('mousedown', prior.onMouseDown, true);
      doc.removeEventListener('mousedown', prior.onTrackModifiers, true);
    }

    const onTrackModifiers = (event: MouseEvent) => {
      pendingShift = event.shiftKey;
      pendingRightClick = event.button === 2;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (isTableMutationInProgress() || isTableSheetEditing()) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('.arivu-table-col-resize-handle')) return;

      const cell = resolveTableCellFromElement(event.target, editor);
      if (!cell) return;

      const ctx = getTableCellContext(cell);
      const table = findTableRoot(cell);
      if (!ctx || !table) return;

      const anchorRow = ctx.logicalRow;
      const anchorCol = ctx.logicalCol;
      const tableId = String(table.getId());
      const startX = event.clientX;
      const startY = event.clientY;
      let dragMoved = false;

      const onMove = (moveEvent: MouseEvent) => {
        if (!dragMoved) {
          const dx = moveEvent.clientX - startX;
          const dy = moveEvent.clientY - startY;
          if (Math.hypot(dx, dy) < 4) return;
          dragMoved = true;
          selectionDragActive = true;
        }

        const hit = resolveTableCellFromElement(
          doc.elementFromPoint(moveEvent.clientX, moveEvent.clientY),
          editor
        );
        if (!hit) return;

        const hitCtx = getTableCellContext(hit);
        const hitTable = findTableRoot(hit);
        if (!hitCtx || !hitTable || String(hitTable.getId()) !== tableId) return;

        applyTableSelectionRange(
          hitTable,
          anchorRow,
          anchorCol,
          hitCtx.logicalRow,
          hitCtx.logicalCol
        );
      };

      const onUp = (upEvent: MouseEvent) => {
        selectionDragActive = false;
        doc.removeEventListener('mousemove', onMove, true);
        doc.removeEventListener('mouseup', onUp, true);
        window.removeEventListener('mouseup', onUp, true);

        if (!dragMoved) {
          const endCell = resolveTableCellFromElement(upEvent.target, editor);
          if (endCell) {
            updateTableSelection(endCell, upEvent.shiftKey);
          }
        }
      };

      doc.addEventListener('mousemove', onMove, true);
      doc.addEventListener('mouseup', onUp, true);
      window.addEventListener('mouseup', onUp, true);
    };

    doc.addEventListener('mousedown', onTrackModifiers, true);
    doc.addEventListener('mousedown', onMouseDown, true);
    doc.__arivuTableSelectionHandlers = { onMouseDown, onTrackModifiers };
    syncSelectionHighlights();
  };

  editor.on('canvas:frame:load', attachFrameHandlers);
  attachFrameHandlers();

  editor.on('component:selected', (component: Component) => {
    if (tableMutationDepth > 0 || contextMenuOpen) return;

    const cell = resolveTableCellComponent(component);
    if (!cell) {
      if (!findTableRoot(component)) clearTableSelectionRange();
      return;
    }

    if (pendingRightClick) {
      pendingRightClick = false;
      return;
    }

    if (selectionDragActive) return;

    updateTableSelection(cell, pendingShift);
    pendingShift = false;
  });

  editor.on('component:remove', (component: Component) => {
    if (tableMutationDepth > 0 || !selectionRange) return;
    if (!isTableCellComponent(component)) return;
    clearTableSelectionRange();
  });

  editor.on('destroy', () => {
    const doc = editor.Canvas.getFrameEl()?.contentDocument;
    const prior = doc?.__arivuTableSelectionHandlers;
    if (doc && prior) {
      doc.removeEventListener('mousedown', prior.onMouseDown, true);
      doc.removeEventListener('mousedown', prior.onTrackModifiers, true);
      delete doc.__arivuTableSelectionHandlers;
    }
    clearSelectionHighlights(editor);
    selectionEditor = null;
    selectionRange = null;
  });
}

export type TableActionId =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'insert-col-left'
  | 'insert-col-right'
  | 'merge-cells'
  | 'unmerge-cells'
  | 'delete-row'
  | 'delete-col'
  | 'delete-table'
  | 'toggle-footer'
  | 'toggle-data-row'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'copy-cell'
  | 'paste-cell';

export function runTableAction(
  editor: Editor,
  cellOrTarget: Component | TableCellTarget,
  action: TableActionId,
  clipboard?: { text: string; align?: string } | null
): void {
  const resolved =
    typeof cellOrTarget === 'object' && cellOrTarget && 'cellId' in cellOrTarget
      ? resolveTableCellTarget(editor, cellOrTarget)
      : (() => {
          const resolvedCell = resolveTableCellComponent(cellOrTarget as Component);
          const table = findTableRoot(resolvedCell);
          const ctx = resolvedCell && table ? getTableCellContext(resolvedCell) : null;
          if (!resolvedCell || !table || !ctx) return null;
          return { table, cell: resolvedCell, ctx };
        })();

  if (!resolved) return;

  const { table, cell: resolvedCell, ctx } = resolved;
  const insertCoords =
    typeof cellOrTarget === 'object' && cellOrTarget && 'cellId' in cellOrTarget
      ? cellOrTarget
      : {
          rowIndex: ctx.row.rowIndex,
          logicalCol: ctx.logicalCol,
          colSpan: ctx.colSpan
        };
  let nextSelection: Component | null = resolvedCell;
  const shouldReselect =
    action === 'merge-cells' ||
    action === 'delete-row' ||
    action === 'delete-col' ||
    action === 'delete-table';
  const shouldSyncView =
    action === 'insert-row-above' ||
    action === 'insert-row-below' ||
    action === 'insert-col-left' ||
    action === 'insert-col-right' ||
    action === 'merge-cells' ||
    action === 'unmerge-cells' ||
    action === 'delete-row' ||
    action === 'delete-col' ||
    action === 'delete-table' ||
    action === 'toggle-footer';

  runTableMutation(() => {
    switch (action) {
      case 'insert-row-above':
        insertRowAt(table, insertCoords.rowIndex, 'above');
        break;
      case 'insert-row-below':
        insertRowAt(table, insertCoords.rowIndex, 'below');
        break;
      case 'insert-col-left':
        insertColumnAt(table, insertCoords.logicalCol, insertCoords.colSpan, 'left');
        break;
      case 'insert-col-right':
        insertColumnAt(table, insertCoords.logicalCol, insertCoords.colSpan, 'right');
        break;
      case 'merge-cells':
        nextSelection = mergeSelectedCells(resolvedCell);
        break;
      case 'unmerge-cells':
        unmergeCell(resolvedCell);
        break;
      case 'delete-row': {
        const ctx = getTableCellContext(resolvedCell);
        const fallbackRow = ctx?.row.rowIndex ?? 0;
        const fallbackCol = ctx?.logicalCol ?? 0;
        deleteRow(resolvedCell);
        if (table) {
          const grid = buildTableGrid(table);
          const rowIdx = Math.min(fallbackRow, Math.max(grid.rows.length - 1, 0));
          const colIdx = Math.min(fallbackCol, Math.max(grid.colCount - 1, 0));
          nextSelection = getAnchorCell(grid, rowIdx, colIdx)?.component ?? null;
        }
        break;
      }
      case 'delete-col': {
        const ctx = getTableCellContext(resolvedCell);
        const fallbackRow = ctx?.logicalRow ?? 0;
        const fallbackCol = ctx?.logicalCol ?? 0;
        deleteColumn(resolvedCell);
        if (table) {
          const grid = buildTableGrid(table);
          const rowIdx = Math.min(fallbackRow, Math.max(grid.rows.length - 1, 0));
          const colIdx = Math.min(fallbackCol, Math.max(grid.colCount - 1, 0));
          nextSelection = getAnchorCell(grid, rowIdx, colIdx)?.component ?? null;
        }
        break;
      }
      case 'delete-table':
        deleteTable(resolvedCell);
        nextSelection = null;
        break;
      case 'toggle-footer':
        toggleTableFooter(resolvedCell);
        break;
      case 'toggle-data-row':
        toggleDataRow(resolvedCell);
        break;
      case 'align-left':
        setCellAlign(resolvedCell, 'left');
        break;
      case 'align-center':
        setCellAlign(resolvedCell, 'center');
        break;
      case 'align-right':
        setCellAlign(resolvedCell, 'right');
        break;
      case 'copy-cell':
        break;
      case 'paste-cell':
        if (clipboard) pasteCell(resolvedCell, clipboard);
        break;
      default:
        break;
    }

    if (action === 'merge-cells' || action === 'delete-row' || action === 'delete-col') {
      clearTableSelectionRange();
    }
  });

  if (shouldSyncView) {
    queueMicrotask(() => {
      syncTableView(table);
    });
  }

  if (!shouldReselect) return;

  if (action === 'delete-table') {
    editor.select(undefined);
    return;
  }

  queueMicrotask(() => {
    selectTableCell(editor, nextSelection);
  });
}
