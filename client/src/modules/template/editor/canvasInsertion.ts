import type { Component, Editor } from 'grapesjs';
import { mergeTokensToChipHtml } from '@/utils/builderMergeTagHtml';
import { dismissCanvasInlineEditing, hideRteToolbar } from './rteToolbar';
import { formatMergeToken } from './mergeTokens';
import { isEditableTextComponent, readTextContent } from './textContent';
import { isTableCellComponent, readCellText, resolveComponentFromElement, writeCellText } from './tableModel';
import { getActiveTableSheetEditor } from './tableSheetEditor';
import {
  applyMergeChipsFromComponent,
  bindMergeChipEditing,
  insertMergeTokenAtLogicalOffset,
  restoreTextCaretAtOffset,
  syncComponentContentFromDom
} from './mergeChipEditing';
import {
  clearInsertTarget,
  getInsertTarget,
  getInsertTargetForEditor,
  isInsertTargetLocked,
  lockInsertTarget,
  publishInsertTarget,
  resolveInsertCaretOffset,
  snapshotHostTextSelection,
  unlockInsertTarget
} from './textInsertTarget';

let mergeTagPickerActive = false;
let pendingMergeTabActivation = false;
let rteDismissRequested = false;

const boundSidebarGuards = new WeakMap<Editor, () => void>();

function isTextInsertHost(component: Component | null | undefined): component is Component {
  if (!component) return false;
  return isEditableTextComponent(component) || isTableCellComponent(component);
}

function getCanvasDocument(editor: Editor): Document | null {
  return editor.Canvas.getFrameEl()?.contentDocument ?? null;
}

function getCanvasFrame(editor: Editor): HTMLIFrameElement | null {
  const frame = editor.Canvas.getFrameEl();
  return frame instanceof HTMLIFrameElement ? frame : null;
}

function isCanvasTextFocused(editor: Editor, element: HTMLElement): boolean {
  const doc = getCanvasDocument(editor);
  const active = doc?.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active === element || element.contains(active);
}

function getHostElement(component: Component): HTMLElement | null {
  const el = component.view?.el;
  return el instanceof HTMLElement ? el : null;
}

function resolveComponentFromEditableElement(active: HTMLElement): Component | null {
  let node: HTMLElement | null = active;
  while (node) {
    const component = resolveComponentFromElement(node);
    if (isTextInsertHost(component)) return component;
    node = node.parentElement;
  }
  return null;
}

function resolveTargetFromActiveEditable(editor: Editor): Component | null {
  const doc = getCanvasDocument(editor);
  const active = doc?.activeElement;
  if (!(active instanceof HTMLElement) || !active.isContentEditable || active.closest('td, th')) {
    return null;
  }
  return resolveComponentFromEditableElement(active);
}

function resolveTargetComponent(editor: Editor): Component | null {
  const tableSession = getActiveTableSheetEditor();
  if (tableSession?.editor === editor && isTableCellComponent(tableSession.cell)) {
    return tableSession.cell;
  }

  const locked = getInsertTargetForEditor(editor);
  if (locked && isTextInsertHost(locked.component)) {
    return locked.component;
  }

  const editing = editor.getEditing?.();
  if (editing && isTextInsertHost(editing)) return editing;

  const selected = editor.getSelected();
  if (isTextInsertHost(selected)) return selected;

  return resolveTargetFromActiveEditable(editor);
}

function hasTextInsertContext(editor: Editor): boolean {
  return Boolean(resolveTargetComponent(editor));
}

function readHostTokenText(component: Component): string {
  if (isTableCellComponent(component)) return readCellText(component);
  return readTextContent(component);
}

function snapshotCanvasTextSelection(editor: Editor, force = false): void {
  const component = resolveTargetComponent(editor);
  if (!isTextInsertHost(component)) return;

  const element = getHostElement(component);
  if (!element) return;

  snapshotHostTextSelection(editor, component, element, {
    force,
    mergePickerActive: mergeTagPickerActive || pendingMergeTabActivation
  });
}

export function runWithPreservedCanvasEditing<T>(editor: Editor, fn: () => T): T {
  snapshotCanvasTextSelection(editor, true);
  try {
    return fn();
  } finally {
    queueMicrotask(() => restoreCanvasCaret(editor));
    requestAnimationFrame(() => restoreCanvasCaret(editor));
  }
}

export function restoreCanvasCaret(editor: Editor | null | undefined): void {
  const target = editor ? getInsertTargetForEditor(editor) : null;
  if (!editor || !target) return;
  ensureTextHostEditing(editor, target.component, target.caretOffset);
}

function ensureTextHostEditing(
  editor: Editor,
  component: Component,
  tokenOffset: number
): void {
  const element = getHostElement(component);
  if (!element) return;

  editor.select(component);
  getCanvasFrame(editor)?.contentWindow?.focus();

  if (isTableCellComponent(component)) {
    element.contentEditable = 'true';
    element.classList.add('arivu-sheet-cell-editing');
    applyMergeChipsForTableCell(element, component);
    restoreCaretAtTokenOffset(element, tokenOffset);
    return;
  }

  rteDismissRequested = true;

  const view = component.view as { onActive?: () => void } | undefined;
  const wasEditing = editor.getEditing?.() === component;

  syncComponentContentFromDom(element, component);

  if (!wasEditing) {
    if (view?.onActive) {
      view.onActive();
    } else {
      element.contentEditable = 'true';
      const rte = editor.RichTextEditor as unknown as {
        enable?: (model: Component, view?: unknown) => void;
      } | undefined;
      rte?.enable?.(component, view);
    }
  } else if (!element.isContentEditable) {
    element.contentEditable = 'true';
  }

  applyMergeChipsFromComponent(element, component);

  const placeCaret = () => restoreCaretAtTokenOffset(element, tokenOffset);
  queueMicrotask(() => {
    placeCaret();
    rteDismissRequested = false;
  });
  requestAnimationFrame(placeCaret);
}

function applyMergeChipsForTableCell(element: HTMLElement, component: Component): void {
  const tokenText = readCellText(component);
  if (!tokenText.includes('{{')) return;
  element.innerHTML = mergeTokensToChipHtml(tokenText);
}

function restoreCaretAtTokenOffset(element: HTMLElement, tokenOffset: number): void {
  restoreTextCaretAtOffset(element, tokenOffset);
}

function requestCanvasInlineDismiss(editor: Editor): void {
  rteDismissRequested = true;
  unlockInsertTarget();
  dismissCanvasInlineEditing(editor);
  queueMicrotask(() => {
    rteDismissRequested = false;
  });
}

function isMergePickerNativeFocusTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-arivu-sample-record-picker]')) return true;
  if (target.matches('input[data-arivu-merge-search], textarea[data-arivu-merge-search]')) return true;
  if (target.closest('[data-arivu-merge-search]')) return true;
  if (target.closest('[data-arivu-merge-filter]')) return true;
  if (target.closest('[data-arivu-merge-filter-options]')) return true;
  if (target.closest('[role="combobox"], [role="listbox"], [role="option"]')?.closest('[data-arivu-builder-sidebar]')) {
    return true;
  }
  return false;
}

function isMergeSidebarNativeFocusActive(): boolean {
  return isMergePickerNativeFocusTarget(document.activeElement);
}

function isMergePickerTabSwitchAway(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tab = target.closest('[role="tab"]');
  return Boolean(tab && !tab.closest('[data-arivu-merge-tab="true"]'));
}

function shouldKeepCanvasFocused(target: HTMLElement): boolean {
  if (isMergePickerNativeFocusTarget(target)) return false;
  if (isMergePickerTabSwitchAway(target)) return false;
  if (target.closest('[data-arivu-merge-tab="true"]')) return true;
  if (target.closest('[data-arivu-merge-picker]')) return true;
  if (mergeTagPickerActive && target.closest('[data-arivu-builder-sidebar][data-arivu-merge-picker-active="true"]')) {
    return true;
  }
  return false;
}

/** Sidebar pointer — keep canvas caret on Merge Tags tab; dismiss edit on other tabs. */
export function handleSidebarPointerDown(
  editor: Editor | null | undefined,
  target: EventTarget | null,
  event?: Event
): void {
  if (!editor) return;
  if (!(target instanceof HTMLElement)) return;
  if (!target.closest('[data-arivu-builder-sidebar]')) return;

  if (target.closest('[data-arivu-merge-tab="true"]') && hasTextInsertContext(editor)) {
    snapshotCanvasTextSelection(editor, false);
    lockInsertTarget();
    pendingMergeTabActivation = true;
    queueMicrotask(() => {
      pendingMergeTabActivation = false;
      restoreCanvasCaret(editor);
    });
    if (event) event.preventDefault();
    return;
  }

  if (shouldKeepCanvasFocused(target) && hasTextInsertContext(editor)) {
    snapshotCanvasTextSelection(editor, false);
    lockInsertTarget();
    hideRteToolbar(editor);
    if (event) {
      event.preventDefault();
      if (target.closest('[data-arivu-merge-insert]')) {
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }
    queueMicrotask(() => restoreCanvasCaret(editor));
    return;
  }

  if (isMergePickerNativeFocusTarget(target)) {
    if (hasTextInsertContext(editor)) {
      snapshotCanvasTextSelection(editor, false);
      lockInsertTarget();
    }
    return;
  }

  if (hasTextInsertContext(editor)) {
    snapshotCanvasTextSelection(editor, true);
  }

  if (isMergePickerTabSwitchAway(target)) {
    setMergeTagPickerActive(false);
  }

  if (getActiveTableSheetEditor()?.editor === editor) {
    return;
  }

  requestCanvasInlineDismiss(editor);
}

export function handleMergePickerSidebarPointer(
  editor: Editor | null | undefined,
  event: MouseEvent
): void {
  handleSidebarPointerDown(editor, event.target, event);
}

export function isMergeTagPickerActive(): boolean {
  return mergeTagPickerActive;
}

export function setMergeTagPickerActive(active: boolean): void {
  mergeTagPickerActive = active;
}

export function hasPendingCanvasTextInsert(editor: Editor): boolean {
  if (getInsertTargetForEditor(editor)) return true;
  if (getActiveTableSheetEditor()?.editor === editor) return true;
  return Boolean(resolveTargetFromActiveEditable(editor));
}

export function preserveCanvasTextSelection(editor: Editor | null | undefined): void {
  if (!editor || isInsertTargetLocked()) return;
  snapshotCanvasTextSelection(editor, false);
}

export function getTextInsertTarget(editor: Editor | null | undefined): Component | null {
  const target = editor ? getInsertTargetForEditor(editor) : null;
  if (!target || !isTextInsertHost(target.component)) return null;
  return target.component;
}

function bindMergePickerFocusLock(editor: Editor): void {
  editor.on('rte:enable', (view: { el?: HTMLElement; model?: Component }) => {
    const el = view?.el ?? view?.model?.view?.el;
    if (!(el instanceof HTMLElement)) return;

    const onFocusOut = (event: FocusEvent) => {
      if (isInsertTargetLocked()) return;
      const related = event.relatedTarget;
      if (!(related instanceof Node)) return;
      const sidebar = document.querySelector('[data-arivu-builder-sidebar]');
      if (!sidebar?.contains(related)) return;
      snapshotCanvasTextSelection(editor, false);
      lockInsertTarget();
    };

    el.addEventListener('focusout', onFocusOut, true);
    editor.once('rte:disable', () => {
      el.removeEventListener('focusout', onFocusOut, true);
    });
  });
}

function bindMergePickerRteGuard(editor: Editor): void {
  editor.on('rte:disable', () => {
    if (rteDismissRequested) return;
    if (!getInsertTargetForEditor(editor)) return;
    if (!mergeTagPickerActive && !pendingMergeTabActivation) return;
    if (isMergeSidebarNativeFocusActive()) return;

    queueMicrotask(() => {
      if (rteDismissRequested || isMergeSidebarNativeFocusActive()) return;
      restoreCanvasCaret(editor);
    });
  });
}

function bindCanvasInteractionUnlock(editor: Editor): void {
  const attach = () => {
    const doc = getCanvasDocument(editor);
    if (!doc || doc.documentElement.dataset.arivuCanvasUnlock === 'true') return;
    doc.documentElement.dataset.arivuCanvasUnlock = 'true';

    doc.addEventListener(
      'pointerdown',
      () => {
        unlockInsertTarget();
      },
      true
    );

    editor.on('destroy', () => {
      delete doc.documentElement.dataset.arivuCanvasUnlock;
    });
  };

  editor.on('canvas:frame:load', attach);
  editor.on('load', attach);
  attach();
}

function bindSidebarPointerGuard(editor: Editor): void {
  if (boundSidebarGuards.has(editor)) return;

  const onPointerDownCapture = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.closest('[data-arivu-builder-sidebar]')) return;
    handleSidebarPointerDown(editor, target, event);
  };

  window.addEventListener('pointerdown', onPointerDownCapture, true);

  const detach = () => {
    window.removeEventListener('pointerdown', onPointerDownCapture, true);
    boundSidebarGuards.delete(editor);
  };

  boundSidebarGuards.set(editor, detach);
  editor.on('destroy', detach);
}

function bindCanvasCaretSync(editor: Editor): void {
  const attach = () => {
    const doc = getCanvasDocument(editor);
    if (!doc || doc.documentElement.dataset.arivuMergeCaret === 'true') return;
    doc.documentElement.dataset.arivuMergeCaret = 'true';

    const syncCaret = () => {
      if (isInsertTargetLocked()) return;

      const tableSession = getActiveTableSheetEditor();
      if (tableSession?.editor === editor) {
        snapshotHostTextSelection(editor, tableSession.cell, tableSession.element, {
          mergePickerActive: mergeTagPickerActive || pendingMergeTabActivation
        });
        return;
      }

      const active = resolveTargetFromActiveEditable(editor);
      if (!active) return;
      const element = getHostElement(active);
      if (!element || !isCanvasTextFocused(editor, element)) return;
      snapshotCanvasTextSelection(editor);
    };

    doc.addEventListener('selectionchange', syncCaret);
    editor.on('destroy', () => {
      doc.removeEventListener('selectionchange', syncCaret);
      delete doc.documentElement.dataset.arivuMergeCaret;
    });
  };

  editor.on('canvas:frame:load', attach);
  editor.on('load', attach);
  attach();
}

export function bindCanvasTextInsertion(editor: Editor): void {
  bindSidebarPointerGuard(editor);
  bindCanvasCaretSync(editor);
  bindCanvasInteractionUnlock(editor);
  bindMergePickerFocusLock(editor);
  bindMergePickerRteGuard(editor);
  bindMergeChipEditing(editor);

  editor.on('rte:enable', (view: { model?: Component; el?: HTMLElement }) => {
    const component = view?.model;
    if (!component || !isEditableTextComponent(component)) return;
    const element = (view?.el ?? getHostElement(component)) as HTMLElement | null;
    if (!element) return;
    applyMergeChipsFromComponent(element, component);
    if (isInsertTargetLocked()) return;
    const locked = getInsertTarget();
    if (mergeTagPickerActive && locked?.component === component && locked.caretOffset >= 0) {
      return;
    }
    snapshotHostTextSelection(editor, component, element, {
      mergePickerActive: mergeTagPickerActive || pendingMergeTabActivation
    });
  });

  editor.on('component:selected', (component: Component) => {
    const locked = getInsertTarget();
    if (locked && locked.component !== component) {
      clearInsertTarget();
    }
  });
}

export function insertMergeIntoCanvasText(
  editor: Editor,
  path: string,
  hintComponent?: Component | null
): boolean {
  const token = formatMergeToken(path);

  let component: Component | null = null;
  const locked = getInsertTargetForEditor(editor);
  if (locked && isTextInsertHost(locked.component) && !isTableCellComponent(locked.component)) {
    component = locked.component;
  } else if (hintComponent && isTextInsertHost(hintComponent) && !isTableCellComponent(hintComponent)) {
    component = hintComponent;
  } else {
    const resolved = resolveTargetComponent(editor);
    if (resolved && isTextInsertHost(resolved) && !isTableCellComponent(resolved)) {
      component = resolved;
    }
  }

  if (!component) return false;

  const element = getHostElement(component);
  if (!element) return false;

  const tokenText = readHostTokenText(component);
  const caretOffset = resolveInsertCaretOffset(editor, component, tokenText.length);
  const nextOffset = insertMergeTokenAtLogicalOffset(
    element,
    tokenText,
    token,
    caretOffset,
    (text) => {
      if (isTableCellComponent(component)) {
        writeCellText(component, text);
        return;
      }
      syncComponentContentFromDom(element, component);
    }
  );

  publishInsertTarget(editor, component, element, nextOffset);
  unlockInsertTarget();
  ensureTextHostEditing(editor, component, nextOffset);

  return true;
}

export function isCanvasTextEditingActive(editor: Editor | null | undefined): boolean {
  if (!editor) return false;
  return Boolean(editor.getEditing?.());
}

export function refocusCanvasTextEditing(editor: Editor | null | undefined): void {
  restoreCanvasCaret(editor);
}

export function lockCanvasTextSelection(_editor: Editor | null | undefined): void {}
export function unlockCanvasTextSelection(): void {}
export function guardSidebarCanvasTextFocus(_editor: Editor | null | undefined): boolean {
  return false;
}
export function refocusLockedCanvasText(editor: Editor | null | undefined): void {
  restoreCanvasCaret(editor);
}
export function focusCanvasTextSelection(editor: Editor | null | undefined): void {
  restoreCanvasCaret(editor);
}
