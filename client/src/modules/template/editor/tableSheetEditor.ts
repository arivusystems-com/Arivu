import type { Component, Editor } from 'grapesjs';
import { chipHtmlToMergeTokens, elementToMergeTokens, mergeTokensToChipHtml } from '@/utils/builderMergeTagHtml';
import {
  attachMergeChipEditingToHost,
  insertMergeTokenAtLogicalOffset,
  restoreTextCaretAtOffset
} from './mergeChipEditing';
import {
  lockInsertTarget,
  publishInsertTarget,
  resolveInsertCaretOffset,
  snapshotHostTextSelection,
  unlockInsertTarget
} from './textInsertTarget';
import { formatMergeToken } from './mergeTokens';
import { ensureTableColumnLayout } from './tableColumnWidths';
import { registerTableCellComponents } from './tableCellComponents';
import { isTableMutationInProgress } from './tableActions';
import {
  findTableRoot,
  isTableCellComponent,
  paintTableCellContent,
  readCellText,
  repaintTableCells,
  resolveTableCellComponent,
  resolveTableCellFromElement,
  writeCellText
} from './tableModel';
import { isLineItemDataRow, normalizeLineScopeMergePath } from './lineItemModel';

const EDITING_CLASS = 'arivu-sheet-cell-editing';

interface ActiveSheetEditor {
  editor: Editor;
  cell: Component;
  element: HTMLElement;
  detachMergeChipEditing?: () => void;
  detachFocusOut?: (event: FocusEvent) => void;
}

interface FrameHandlers {
  onDblClick: (event: MouseEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onParentKeyDown: (event: KeyboardEvent) => void;
  onParentMouseDown: (event: MouseEvent) => void;
}

let activeEditor: ActiveSheetEditor | null = null;

const boundEditors = new WeakMap<Editor, FrameHandlers>();

export function isTableSheetEditing(): boolean {
  return Boolean(activeEditor);
}

export function flushTableSheetEdits(editor?: Editor | null): void {
  if (!activeEditor) return;
  if (editor && activeEditor.editor !== editor) return;
  commitActiveEdit();
}

/** Sync in-progress sheet cell content to the model without ending the edit session. */
export function syncActiveSheetEditForSerialize(editor?: Editor | null): void {
  if (!activeEditor) return;
  if (editor && activeEditor.editor !== editor) return;

  const { cell, element } = activeEditor;
  const html = elementToMergeTokens(element);
  writeCellText(cell, html);
}

export function getActiveTableSheetCell(): Component | null {
  return activeEditor?.cell ?? null;
}

export function getActiveTableSheetEditor(): ActiveSheetEditor | null {
  return activeEditor;
}

function isMergeSidebarTarget(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (target.closest('[data-arivu-merge-insert]')) return true;
  if (target.closest('[data-arivu-merge-picker]')) return true;
  if (target.closest('[data-arivu-merge-tab="true"]')) return true;
  if (target.closest('[data-arivu-builder-sidebar][data-arivu-merge-picker-active="true"]')) return true;
  return false;
}

function frameWindow(element: HTMLElement): Window {
  return element.ownerDocument.defaultView || window;
}

function focusEditableEnd(element: HTMLElement): void {
  const doc = element.ownerDocument;
  const win = frameWindow(element);
  element.focus();
  const range = doc.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  const selection = win.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function insertTextInElement(element: HTMLElement, text: string): void {
  const win = frameWindow(element);
  element.focus();
  if (typeof win.document.execCommand === 'function') {
    win.document.execCommand('insertText', false, String(text ?? ''));
    return;
  }
  element.textContent = `${element.textContent || ''}${text}`;
}

function isPrintableKey(event: KeyboardEvent): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return event.key.length === 1;
}

function shouldHandleGlobalKeys(event: KeyboardEvent): boolean {
  if (activeEditor) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return false;
  if (target.isContentEditable) return false;
  if (target.closest('aside, [role="dialog"], .arivu-table-col-resize-handle')) return false;
  return true;
}

function detachEditBlur(element: HTMLElement, handler: () => void): void {
  element.removeEventListener('blur', handler, true);
}

function detachSheetEditHandlers(element: HTMLElement, session: ActiveSheetEditor): void {
  session.detachMergeChipEditing?.();
  session.detachMergeChipEditing = undefined;
  if (session.detachFocusOut) {
    element.removeEventListener('focusout', session.detachFocusOut, true);
    session.detachFocusOut = undefined;
  }
  const blurHandler = (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur;
  if (blurHandler) {
    detachEditBlur(element, blurHandler);
    delete (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur;
  }
}

function commitActiveEdit(): void {
  if (!activeEditor) return;

  const { cell, element, editor } = activeEditor;
  const html = elementToMergeTokens(element);
  writeCellText(cell, html);
  detachSheetEditHandlers(element, activeEditor);
  element.removeAttribute('contenteditable');
  element.classList.remove(EDITING_CLASS);
  activeEditor = null;
  editor.trigger('arivu:sheet-edit-committed');
}

function cancelActiveEdit(): void {
  if (!activeEditor) return;
  const { cell, element } = activeEditor;
  element.innerHTML = mergeTokensToChipHtml(readCellText(cell));
  detachSheetEditHandlers(element, activeEditor);
  element.removeAttribute('contenteditable');
  element.classList.remove(EDITING_CLASS);
  activeEditor = null;
}

function focusCanvas(editor: Editor): void {
  editor.Canvas.getFrameEl()?.contentWindow?.focus();
}

function startSheetEdit(editor: Editor, cell: Component): void {
  const element = cell.view?.el as HTMLElement | undefined;
  if (!element || !isTableCellComponent(cell)) return;

  if (activeEditor?.cell === cell) {
    focusEditableEnd(element);
    return;
  }

  if (activeEditor) {
    commitActiveEdit();
  }

  const table = findTableRoot(cell);
  if (table) {
    try {
      ensureTableColumnLayout(table);
    } catch {
      // ignore layout errors during edit
    }
  }

  element.classList.add(EDITING_CLASS);
  element.setAttribute('contenteditable', 'true');
  const raw = readCellText(cell);
  let display =
    raw === '&nbsp;' || raw === '\u00a0' || !String(raw).replace(/<[^>]+>/g, '').trim()
      ? ''
      : raw;
  if (!display) {
    const painted = element.innerHTML.trim();
    if (painted && painted !== '&nbsp;') {
      display = chipHtmlToMergeTokens(painted);
    }
  }
  element.innerHTML = mergeTokensToChipHtml(display);

  const session: ActiveSheetEditor = { editor, cell, element };
  activeEditor = session;
  editor.select(cell);

  session.detachMergeChipEditing = attachMergeChipEditingToHost(element, {
    isActive: () => activeEditor?.element === element,
    onContentChange: (tokenText) => {
      writeCellText(cell, tokenText);
    }
  });

  const onFocusOut = (event: FocusEvent) => {
    if (activeEditor?.element !== element) return;
    const related = event.relatedTarget;
    if (!(related instanceof Node)) return;
    const sidebar = document.querySelector('[data-arivu-builder-sidebar]');
    if (!sidebar?.contains(related)) return;
    snapshotHostTextSelection(editor, cell, element, { mergePickerActive: true });
    lockInsertTarget();
  };
  element.addEventListener('focusout', onFocusOut, true);
  session.detachFocusOut = onFocusOut;

  const onBlur = () => {
    if (!activeEditor || activeEditor.element !== element) return;
    window.setTimeout(() => {
      if (!activeEditor || activeEditor.element !== element) return;
      const doc = element.ownerDocument;
      const active = doc.activeElement;
      if (active === element || element.contains(active)) return;
      commitActiveEdit();
      editor.trigger('arivu:table-column-resize-end');
    }, 0);
  };

  (element as HTMLElement & { __arivuBlur?: () => void }).__arivuBlur = onBlur;
  element.addEventListener('blur', onBlur, true);
  restoreTextCaretAtOffset(element, elementToMergeTokens(element).length);
  focusCanvas(editor);
}

function handleSheetKeydown(editor: Editor, event: KeyboardEvent): void {
  if (!shouldHandleGlobalKeys(event) && !activeEditor) return;

  if (event.key === 'Escape') {
    if (activeEditor) {
      event.preventDefault();
      event.stopPropagation();
      cancelActiveEdit();
    }
    return;
  }

  if (activeEditor) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.stopPropagation();
      commitActiveEdit();
      editor.trigger('arivu:table-column-resize-end');
    }
    return;
  }

  if (!isPrintableKey(event)) return;

  const selected = editor.getSelected();
  const cell = resolveTableCellComponent(selected);
  if (!cell) return;

  event.preventDefault();
  event.stopPropagation();
  startSheetEdit(editor, cell);
  const editEl = cell.view?.el as HTMLElement | undefined;
  if (editEl) {
    insertTextInElement(editEl, event.key);
  }
}

function handleDocumentMousedown(editor: Editor, event: MouseEvent): void {
  if (!activeEditor) return;
  const target = event.target as HTMLElement | null;
  if (isMergeSidebarTarget(target)) return;
  if (target && activeEditor.element.contains(target)) return;
  commitActiveEdit();
  editor.trigger('arivu:table-column-resize-end');
}

function detachFrameHandlers(editor: Editor): void {
  const handlers = boundEditors.get(editor);
  if (!handlers) return;

  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (doc) {
    doc.removeEventListener('dblclick', handlers.onDblClick, true);
    doc.removeEventListener('keydown', handlers.onKeyDown, true);
  }

  window.removeEventListener('keydown', handlers.onParentKeyDown, true);
  window.removeEventListener('mousedown', handlers.onParentMouseDown, true);
  boundEditors.delete(editor);
}

function attachFrameHandlers(editor: Editor): void {
  const doc = editor.Canvas.getFrameEl()?.contentDocument;
  if (!doc) return;

  detachFrameHandlers(editor);

  const onDblClick = (event: MouseEvent) => {
    const cell = resolveTableCellFromElement(event.target, editor);
    if (!cell) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    startSheetEdit(editor, cell);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (isTableMutationInProgress()) return;
    handleSheetKeydown(editor, event);
  };

  const onParentKeyDown = (event: KeyboardEvent) => {
    if (isTableMutationInProgress()) return;
    handleSheetKeydown(editor, event);
  };

  const onParentMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.arivu-table-col-resize-handle')) return;
    handleDocumentMousedown(editor, event);
  };

  doc.addEventListener('dblclick', onDblClick, true);
  doc.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keydown', onParentKeyDown, true);
  window.addEventListener('mousedown', onParentMouseDown, true);

  boundEditors.set(editor, {
    onDblClick,
    onKeyDown,
    onParentKeyDown,
    onParentMouseDown
  });
}

function syncAllTableLayouts(editor: Editor): void {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (String(component.get('tagName') || '').toLowerCase() === 'table') {
      try {
        ensureTableColumnLayout(component);
      } catch {
        // skip invalid tables during sync
      }
    }
    component.components().forEach(visit);
  };
  visit(wrapper);
}

export function refreshCanvasTablesAfterHtmlApply(editor: Editor): void {
  syncAllTableLayouts(editor);
  const wrapper = editor.getWrapper();
  if (!wrapper) return;

  const visit = (component: Component) => {
    if (String(component.get('tagName') || '').toLowerCase() === 'table') {
      repaintTableCells(component);
    }
    component.components().forEach(visit);
  };
  visit(wrapper);
}

export function insertMergeIntoTableCell(editor: Editor, path: string): boolean {
  // Only insert into an active sheet-edit session. The old "append to selected
  // layout cell" path flattened nested email HTML and ignored the caret.
  if (!activeEditor || activeEditor.editor !== editor) {
    return false;
  }

  let trimmedPath = path.replace(/^\{\{|\}\}$/g, '').trim() || path.trim();
  const { cell, element } = activeEditor;
  if (isLineItemDataRow(cell)) {
    trimmedPath = normalizeLineScopeMergePath(trimmedPath);
  }
  const tokenText = readCellText(cell);
  const caretOffset = resolveInsertCaretOffset(editor, cell, tokenText.length);
  const nextOffset = insertMergeTokenAtLogicalOffset(
    element,
    tokenText,
    formatMergeToken(trimmedPath),
    caretOffset,
    (text) => writeCellText(cell, text)
  );
  publishInsertTarget(editor, cell, element, nextOffset);
  unlockInsertTarget();
  restoreTextCaretAtOffset(element, nextOffset);
  return true;
}

export function bindTableSheetEditor(editor: Editor): void {
  registerTableCellComponents(editor);

  const boot = () => {
    attachFrameHandlers(editor);
    syncAllTableLayouts(editor);
    const wrapper = editor.getWrapper();
    if (wrapper) {
      const visit = (component: Component) => {
        if (String(component.get('tagName') || '').toLowerCase() === 'table') {
          repaintTableCells(component);
        }
        component.components().forEach(visit);
      };
      visit(wrapper);
    }
  };

  editor.on('canvas:frame:load', boot);
  editor.on('load', boot);

  editor.on('component:selected', (component: Component) => {
    if (activeEditor && activeEditor.cell !== component) {
      commitActiveEdit();
    }
    const cell = resolveTableCellComponent(component);
    if (cell) {
      if (!activeEditor || activeEditor.cell !== cell) {
        paintTableCellContent(cell);
      }
      if (!activeEditor) {
        focusCanvas(editor);
      }
      const table = findTableRoot(cell);
      if (table) {
        try {
          ensureTableColumnLayout(table);
        } catch {
          // ignore
        }
      }
    }
    editor.trigger('arivu:table-column-resize-end');
  });

  editor.on('component:add', (component: Component) => {
    if (String(component.get('tagName') || '').toLowerCase() === 'table') {
      try {
        ensureTableColumnLayout(component);
      } catch {
        // ignore
      }
    }
  });

  editor.on('destroy', () => {
    detachFrameHandlers(editor);
    if (activeEditor?.editor === editor) {
      activeEditor = null;
    }
  });

  boot();
}
