import type { Component, Editor } from 'grapesjs';
import {
  commitTableColumnWidths,
  ensureTableColumnLayout,
  percentFromBorderPx,
  previewTableColumnPercents,
  readTableColumnPercents,
  resizeColumnPairPercents
} from './tableColumnWidths';
import { isTableSheetEditing } from './tableSheetEditor';
import {
  buildTableGrid,
  findResizableTableRoot,
  findTableRoot,
  getAnchorCell,
  getTableCellContext,
  resolveTableCellComponent
} from './tableModel';
import { findLineItemInnerTableComponent, isLineItemComponent } from './lineItemModel';
import { persistLineItemColumnPercents } from './lineItemComponent';

const IFRAME_LAYER_ID = 'arivu-table-col-resize-layer';
const HANDLE_CLASS = 'arivu-table-col-resize-handle';

let mountedCell: Component | null = null;
let mountedLineItemRoot: Component | null = null;
let overlayHandle: HTMLButtonElement | null = null;
const lineItemHandles = new Map<number, HTMLButtonElement>();
let activeEditor: Editor | null = null;
let resizeActive = false;
let overlayLayer: HTMLDivElement | null = null;

interface ResizeBorder {
  pairCol: number;
  left: number;
  top: number;
}

function frameDocument(editor: Editor): Document | null {
  return editor.Canvas.getFrameEl()?.contentDocument ?? null;
}

function frameWindow(editor: Editor): Window | null {
  return editor.Canvas.getFrameEl()?.contentWindow ?? null;
}

function tableMeasureWidth(tableEl: HTMLTableElement): number {
  return Math.max(tableEl.getBoundingClientRect().width, 1);
}

function elementFrameRect(element: HTMLElement): DOMRect | null {
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return rect;
}

function resolveResizeBorder(cell: Component, logicalCol: number, table?: Component | null): ResizeBorder | null {
  const resolvedTable = table || findResizableTableRoot(cell);
  if (!resolvedTable) return null;

  const grid = buildTableGrid(resolvedTable);
  if (grid.colCount <= 1) return null;

  const cellEl = cell.view?.el as HTMLElement | undefined;
  if (!cellEl) return null;

  const cellRect = elementFrameRect(cellEl);
  if (!cellRect) return null;

  const isLastCol = logicalCol >= grid.colCount - 1;
  if (isLastCol) {
    if (logicalCol <= 0) return null;
    const leftCell = getAnchorCell(grid, 0, logicalCol - 1)?.component?.view?.el as HTMLElement | undefined;
    const leftRect = leftCell ? elementFrameRect(leftCell) : null;
    const borderLeft = leftRect ? (leftRect.right + cellRect.left) / 2 : cellRect.left;
    return {
      pairCol: logicalCol - 1,
      left: borderLeft,
      top: cellRect.top + cellRect.height / 2
    };
  }

  const rightCell = getAnchorCell(grid, 0, logicalCol + 1)?.component?.view?.el as HTMLElement | undefined;
  const rightRect = rightCell ? elementFrameRect(rightCell) : null;
  const borderLeft = rightRect ? (cellRect.right + rightRect.left) / 2 : cellRect.right;

  return {
    pairCol: logicalCol,
    left: borderLeft,
    top: cellRect.top + cellRect.height / 2
  };
}

function resolveLineItemResizeBorder(
  table: Component,
  grid: ReturnType<typeof buildTableGrid>,
  pairCol: number
): ResizeBorder | null {
  const anchor = getAnchorCell(grid, 0, pairCol);
  if (!anchor) return null;
  return resolveResizeBorder(anchor.component, pairCol, table);
}

function ensureIframeLayer(editor: Editor): HTMLDivElement | null {
  const doc = frameDocument(editor);
  if (!doc?.body) return null;

  let layer = doc.getElementById(IFRAME_LAYER_ID) as HTMLDivElement | null;
  if (!layer) {
    layer = doc.createElement('div');
    layer.id = IFRAME_LAYER_ID;
    layer.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
    doc.body.appendChild(layer);
  }
  overlayLayer = layer;
  return layer;
}

function removeAllOverlayHandles(): void {
  overlayHandle?.remove();
  overlayHandle = null;
  lineItemHandles.forEach((handle) => handle.remove());
  lineItemHandles.clear();
  mountedCell = null;
  mountedLineItemRoot = null;
}

function createResizeHandle(
  layer: HTMLDivElement,
  pairCol: number,
  table: Component,
  lineItemRoot: Component | null
): HTMLButtonElement {
  const handle = layer.ownerDocument.createElement('button');
  handle.type = 'button';
  handle.className = HANDLE_CLASS;
  handle.setAttribute('aria-label', 'Resize column');
  handle.dataset.pairCol = String(pairCol);
  handle.style.cssText = [
    'position:fixed',
    'width:10px',
    'height:20px',
    'padding:0',
    'margin:0',
    'border:0',
    'background:transparent',
    'cursor:col-resize',
    'pointer-events:auto',
    'touch-action:none',
    'transform:translate(-50%,-50%)'
  ].join(';');
  handle.innerHTML =
    '<span style="display:block;width:3px;height:16px;margin:0 auto;border-radius:2px;background:#6049e7;opacity:0.85;box-shadow:0 0 0 1px #fff"></span>';
  handle.addEventListener('mousedown', (event) => {
    if (!activeEditor) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    mountedLineItemRoot = lineItemRoot;
    beginTableColumnResize(activeEditor, table, pairCol, event.clientX, lineItemRoot);
  });
  return handle;
}

function positionResizeHandle(handle: HTMLButtonElement, border: ResizeBorder): void {
  handle.style.left = `${border.left}px`;
  handle.style.top = `${border.top}px`;
}

function layoutOverlayHandle(
  editor: Editor,
  cell: Component,
  table: Component,
  logicalCol: number
): void {
  lineItemHandles.forEach((handle) => handle.remove());
  lineItemHandles.clear();
  mountedLineItemRoot = null;

  const border = resolveResizeBorder(cell, logicalCol, table);
  if (!border) {
    removeAllOverlayHandles();
    return;
  }

  const layer = ensureIframeLayer(editor);
  if (!layer) return;

  overlayHandle?.remove();
  overlayHandle = createResizeHandle(layer, border.pairCol, table, null);
  layer.appendChild(overlayHandle);

  positionResizeHandle(overlayHandle, border);
  mountedCell = cell;
}

function layoutLineItemResizeHandles(
  editor: Editor,
  lineItemRoot: Component,
  table: Component,
  grid: ReturnType<typeof buildTableGrid>
): void {
  overlayHandle?.remove();
  overlayHandle = null;
  mountedCell = null;

  const layer = ensureIframeLayer(editor);
  if (!layer) return;

  const activePairCols = new Set<number>();
  for (let pairCol = 0; pairCol < grid.colCount - 1; pairCol += 1) {
    const border = resolveLineItemResizeBorder(table, grid, pairCol);
    if (!border) continue;

    activePairCols.add(pairCol);
    let handle = lineItemHandles.get(pairCol);
    if (!handle) {
      handle = createResizeHandle(layer, pairCol, table, lineItemRoot);
      lineItemHandles.set(pairCol, handle);
      layer.appendChild(handle);
    }
    positionResizeHandle(handle, border);
  }

  lineItemHandles.forEach((handle, pairCol) => {
    if (!activePairCols.has(pairCol)) {
      handle.remove();
      lineItemHandles.delete(pairCol);
    }
  });

  mountedLineItemRoot = lineItemRoot;
}

function refreshOverlayHandle(editor: Editor): void {
  if (isTableSheetEditing()) {
    removeAllOverlayHandles();
    return;
  }

  const selected = editor.getSelected?.();

  if (selected && isLineItemComponent(selected)) {
    const table = findLineItemInnerTableComponent(selected);
    if (!table) {
      if (!resizeActive) removeAllOverlayHandles();
      return;
    }

    if (!resizeActive) {
      try {
        ensureTableColumnLayout(table);
      } catch {
        removeAllOverlayHandles();
        return;
      }
    }

    const grid = buildTableGrid(table);
    if (grid.colCount <= 1) {
      if (!resizeActive) removeAllOverlayHandles();
      return;
    }

    layoutLineItemResizeHandles(editor, selected, table, grid);
    return;
  }

  lineItemHandles.forEach((handle) => handle.remove());
  lineItemHandles.clear();
  mountedLineItemRoot = null;

  const cell = resolveTableCellComponent(selected);
  if (!cell) {
    if (!resizeActive) removeAllOverlayHandles();
    return;
  }

  const ctx = getTableCellContext(cell);
  const table = findTableRoot(cell);
  if (!ctx || !table) {
    if (!resizeActive) removeAllOverlayHandles();
    return;
  }

  if (!resizeActive) {
    try {
      ensureTableColumnLayout(table);
    } catch {
      removeAllOverlayHandles();
      return;
    }
  }

  const grid = buildTableGrid(table);
  if (grid.colCount <= 1) {
    if (!resizeActive) removeAllOverlayHandles();
    return;
  }

  layoutOverlayHandle(editor, cell, table, ctx.logicalCol);
}

export function beginTableColumnResize(
  editor: Editor,
  table: Component,
  pairColIndex: number,
  startClientX: number,
  lineItemRoot: Component | null = null
): () => void {
  const startPercents = readTableColumnPercents(table);
  let draft = [...startPercents];
  const tableEl = table.view?.el as HTMLTableElement | undefined;
  const win = frameWindow(editor);
  const doc = frameDocument(editor);
  const resolvedLineItemRoot = lineItemRoot || mountedLineItemRoot;

  if (!tableEl || !win || !doc) return () => {};

  resizeActive = true;
  doc.body.classList.add('arivu-table-col-resizing');

  let frameId = 0;
  let pendingX = startClientX;

  const repositionHandles = (clientX: number) => {
    if (resolvedLineItemRoot) {
      const grid = buildTableGrid(table);
      lineItemHandles.forEach((handle, pairCol) => {
        if (pairCol === pairColIndex) {
          handle.style.left = `${clientX}px`;
          return;
        }
        const border = resolveLineItemResizeBorder(table, grid, pairCol);
        if (border) positionResizeHandle(handle, border);
      });
      return;
    }

    if (overlayHandle) {
      overlayHandle.style.left = `${clientX}px`;
      const cell = mountedCell;
      if (cell) {
        const ctx = getTableCellContext(cell);
        if (ctx) {
          const border = resolveResizeBorder(cell, ctx.logicalCol, table);
          if (border) overlayHandle.style.top = `${border.top}px`;
        }
      }
    }
  };

  const applyPreview = () => {
    frameId = 0;
    const tableRect = elementFrameRect(tableEl);
    if (!tableRect) return;

    const tableWidth = tableMeasureWidth(tableEl);
    const borderPx = pendingX - tableRect.left;
    const leftPercent = percentFromBorderPx(startPercents, pairColIndex, borderPx, tableWidth);
    draft = resizeColumnPairPercents(startPercents, pairColIndex, leftPercent);
    previewTableColumnPercents(table, draft);
    repositionHandles(pendingX);
  };

  const onMove = (event: MouseEvent) => {
    pendingX = event.clientX;
    if (!frameId) {
      frameId = win.requestAnimationFrame(applyPreview);
    }
  };

  const onUp = () => {
    if (frameId) {
      win.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    applyPreview();
    commitTableColumnWidths(table, draft);
    if (resolvedLineItemRoot) {
      persistLineItemColumnPercents(resolvedLineItemRoot, draft);
      editor.trigger('component:update', resolvedLineItemRoot);
    }
    resizeActive = false;
    doc.body.classList.remove('arivu-table-col-resizing');
    win.removeEventListener('mousemove', onMove);
    win.removeEventListener('mouseup', onUp);
    editor.trigger('arivu:table-column-resize-end');
    refreshOverlayHandle(editor);
  };

  win.addEventListener('mousemove', onMove);
  win.addEventListener('mouseup', onUp);

  return onUp;
}

export function bindTableCellResizeHandle(editor: Editor): void {
  activeEditor = editor;
  document.getElementById('arivu-table-col-resize-root')?.remove();

  const scheduleRefresh = () => {
    const win = frameWindow(editor);
    if (win) {
      win.requestAnimationFrame(() => refreshOverlayHandle(editor));
    }
  };

  const boot = () => scheduleRefresh();
  const win = () => frameWindow(editor);

  editor.on('canvas:frame:load', () => {
    win()?.addEventListener('scroll', scheduleRefresh, true);
    boot();
  });
  editor.on('load', boot);
  editor.on('component:selected', scheduleRefresh);
  editor.on('component:deselected', () => {
    if (!resizeActive) removeAllOverlayHandles();
  });
  editor.on('component:update', () => {
    if (resizeActive) return;
    scheduleRefresh();
  });
  editor.on('component:add', scheduleRefresh);
  editor.on('component:remove', () => {
    if (!resizeActive) removeAllOverlayHandles();
  });
  editor.on('canvas:scroll', scheduleRefresh);
  editor.on('arivu:table-column-resize-end', scheduleRefresh);

  const onViewportChange = () => scheduleRefresh();
  window.addEventListener('resize', onViewportChange);
  win()?.addEventListener('resize', onViewportChange);

  editor.on('destroy', () => {
    win()?.removeEventListener('scroll', scheduleRefresh, true);
    win()?.removeEventListener('resize', onViewportChange);
    removeAllOverlayHandles();
    overlayLayer?.remove();
    overlayLayer = null;
    activeEditor = null;
    window.removeEventListener('resize', onViewportChange);
    document.getElementById('arivu-table-col-resize-root')?.remove();
  });

  boot();
}
