import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Ref
} from 'vue';
import type { Component, Editor } from 'grapesjs';
import type { PageMarginsMm } from '@/constants/contentPageSettings';
import { initGrapesEditor } from '../editor/grapes';
import {
  addBlockToCanvas
} from '../editor/blocks';
import { openPreviewWindow } from '../editor/preview';
import {
  getLayerTree,
  insertImageAsset,
  insertMergeField,
  selectComponentById,
  type LayerNode
} from '../editor/selection';
import { getTextInsertTarget } from '../editor/canvasInsertion';
import {
  endLibraryBlockDrag,
  moveLibraryBlockDrag,
  startLibraryBlockDrag
} from '../editor/dragDrop';
import {
  createBlankGrapesDefinition,
  isGrapesDefinition,
  loadDefinition,
  serializeEditor,
  type GrapesTemplateDefinition
} from '../editor/storage';
import { parseTemplateHtmlDocumentForCanvas, encodeMsoConditionals } from '../utils/emailHtmlExport';
import { setEditorMsoChunks, clearEditorMsoChunks } from '../editor/msoChunksStore';
import { applyHtmlToEditorCanvas } from '../editor/canvasHtmlApply';
import {
  applyPageDimensions,
  bindPageDimensionFrameCss,
  parseDimensionPx,
  resolveTemplateMarginsMm,
  type PageLayoutOptions
} from '../editor/pageDimensions';
import { isTableMutating } from '../editor/tableActions';
import { isTableSheetEditing } from '../editor/tableSheetEditor';
import { setLineItemTemplateModuleScope } from '../editor/lineItemComponent';

const DIRTY_DEBOUNCE_MS = 400;

export type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error';

export interface UseGrapesEditorOptions {
  containerRef: Ref<HTMLElement | null>;
  outputFormat?: Ref<string | undefined>;
  canvasWidth?: Ref<string | undefined>;
  canvasHeight?: Ref<string | undefined>;
  pageMarginsMm?: Ref<Partial<PageMarginsMm> | undefined>;
  moduleScope?: Ref<string | undefined>;
  onDirty?: () => void;
}

export function useGrapesEditor(options: UseGrapesEditorOptions) {
  const editor = shallowRef<Editor | null>(null);
  const selectedComponent = shallowRef<Component | null>(null);
  const lastTextComponent = shallowRef<Component | null>(null);
  const ready = ref(false);
  const layerTree = shallowRef<LayerNode | null>(null);
  let suppressDirty = false;

  function refreshLayerTree() {
    if (!editor.value) return;
    layerTree.value = getLayerTree(editor.value);
  }

  function isCanvasTextBlock(component: Component | null | undefined): boolean {
    if (!component) return false;
    const type = String(component.get('type') || '');
    if (
      [
        'text',
        'arivu-paragraph',
        'arivu-heading',
        'arivu-rich-text',
        'arivu-list',
        'arivu-address',
        'arivu-organization',
        'arivu-contact-card',
        'arivu-button',
        'arivu-watermark',
        'arivu-html'
      ].includes(type)
    ) {
      return true;
    }
    const tag = String(component.get('tagName') || '').toLowerCase();
    return ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'li'].includes(tag);
  }

  function bindSelectionHandlers(instance: Editor) {
    instance.on('component:selected', (component: Component) => {
      selectedComponent.value = component;
      if (isCanvasTextBlock(component)) {
        lastTextComponent.value = component;
      }
    });
    instance.on('component:deselected', () => {
      selectedComponent.value = null;
    });

    let layersTimer: ReturnType<typeof setTimeout> | null = null;
    let dirtyTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDirty = () => {
      if (suppressDirty) return;
      if (isTableSheetEditing() || isTableMutating()) return;
      if (dirtyTimer) clearTimeout(dirtyTimer);
      dirtyTimer = setTimeout(() => {
        dirtyTimer = null;
        if (isTableSheetEditing() || isTableMutating()) return;
        options.onDirty?.();
      }, DIRTY_DEBOUNCE_MS);
    };

    const bumpLayers = () => {
      if (layersTimer) clearTimeout(layersTimer);
      layersTimer = setTimeout(() => {
        layersTimer = null;
        if (!editor.value) return;
        if (isTableMutating()) {
          bumpLayers();
          return;
        }
        refreshLayerTree();
      }, 200);
    };

    instance.on('update', scheduleDirty);
    instance.on('arivu:sheet-edit-committed', () => {
      options.onDirty?.();
    });
    instance.on('load', bumpLayers);
    instance.on('project:load', bumpLayers);
    instance.on('component:add', bumpLayers);
    instance.on('component:remove', bumpLayers);
    instance.on('component:update', bumpLayers);
    instance.on('canvas:drop', () => {
      scheduleDirty();
      bumpLayers();
    });
  }

  function destroyEditor() {
    editor.value?.destroy();
    editor.value = null;
    layerTree.value = null;
    ready.value = false;
  }

  function resolvePageLayout(): PageLayoutOptions {
    const width = parseDimensionPx(options.canvasWidth?.value);
    const height = parseDimensionPx(options.canvasHeight?.value);
    return {
      dimensions: { width, height },
      marginsMm: resolveTemplateMarginsMm(options.pageMarginsMm?.value),
      isEmail: options.outputFormat?.value === 'email'
    };
  }

  function syncPageDimensions() {
    if (!editor.value) return;
    const layout = resolvePageLayout();
    if (!layout.dimensions.width || !layout.dimensions.height) return;
    applyPageDimensions(editor.value, layout);
    refreshLayerTree();
  }

  function mountEditor(el: HTMLElement) {
    if (editor.value) return;

    const instance = initGrapesEditor(el, {
      outputFormat: options.outputFormat?.value,
      canvasWidth: options.canvasWidth?.value,
      canvasHeight: options.canvasHeight?.value
    });

    bindSelectionHandlers(instance);
    bindPageDimensionFrameCss(instance, resolvePageLayout);
    editor.value = instance;
    refreshLayerTree();
    ready.value = true;
  }

  watch(
    () => options.containerRef.value,
    (el) => {
      if (!el) {
        destroyEditor();
        return;
      }
      mountEditor(el);
    },
    { flush: 'post', immediate: true }
  );

  onBeforeUnmount(() => {
    destroyEditor();
  });

  watch(
    () => options.moduleScope?.value,
    (scope) => {
      setLineItemTemplateModuleScope(String(scope || ''));
    },
    { immediate: true }
  );

  watch(
    () => ({
      width: options.canvasWidth?.value,
      height: options.canvasHeight?.value,
      marginTop: options.pageMarginsMm?.value?.top,
      marginRight: options.pageMarginsMm?.value?.right,
      marginBottom: options.pageMarginsMm?.value?.bottom,
      marginLeft: options.pageMarginsMm?.value?.left
    }),
    () => {
      syncPageDimensions();
    }
  );

  const canUndo = computed(() => {
    const um = editor.value?.UndoManager;
    return Boolean(um?.hasUndo?.());
  });

  const canRedo = computed(() => {
    const um = editor.value?.UndoManager;
    return Boolean(um?.hasRedo?.());
  });

  function undo() {
    editor.value?.UndoManager.undo();
  }

  function redo() {
    editor.value?.UndoManager.redo();
  }

  function addBlock(blockId: string) {
    if (!editor.value) return;
    addBlockToCanvas(editor.value, blockId);
    options.onDirty?.();
  }

  function startBlockDrag(blockId: string, event: DragEvent) {
    if (!editor.value) return false;
    return startLibraryBlockDrag(editor.value, blockId, event);
  }

  function moveBlockDrag(event: DragEvent) {
    if (!editor.value) return;
    moveLibraryBlockDrag(editor.value, event);
  }

  function endBlockDrag(cancelled = false) {
    if (!editor.value) return;
    endLibraryBlockDrag(editor.value, cancelled);
  }

  function loadProject(definition: GrapesTemplateDefinition | null | undefined) {
    if (!editor.value) return;
    suppressDirty = true;
    loadDefinition(editor.value, definition, {
      isEmail: options.outputFormat?.value === 'email',
      pageLayout: resolvePageLayout()
    });
    // Keep dirty suppressed until after Grapes finishes applying HTML/project
    // (may be deferred via canvas `load`). Early clear caused empty autosaves.
    nextTick(() => {
      syncPageDimensions();
      refreshLayerTree();
      requestAnimationFrame(() => {
        // Project load finishes in a microtask after loadDefinition — re-fit print area.
        syncPageDimensions();
        refreshLayerTree();
        requestAnimationFrame(() => {
          syncPageDimensions();
          suppressDirty = false;
        });
      });
    });
  }

  function serializeProject(): GrapesTemplateDefinition {
    if (!editor.value) return createBlankGrapesDefinition();
    return serializeEditor(editor.value, {
      isEmail: options.outputFormat?.value === 'email'
    });
  }

  function preview() {
    if (!editor.value) return;
    openPreviewWindow(editor.value);
  }

  function insertMerge(path: string) {
    if (!editor.value) return;
    const hint =
      getTextInsertTarget(editor.value) ||
      selectedComponent.value ||
      lastTextComponent.value;
    insertMergeField(editor.value, path, hint);
    options.onDirty?.();
  }

  function insertImage(payload: { src: string; alt?: string }) {
    if (!editor.value) return;
    insertImageAsset(editor.value, payload);
    options.onDirty?.();
  }

  function selectLayer(componentId: string) {
    selectComponentById(editor.value, componentId);
  }

  function applyTemplateHtmlDocument(raw: string) {
    if (!editor.value) return;
    const isEmail = options.outputFormat?.value === 'email';
    const { html: bodyHtml, css } = parseTemplateHtmlDocumentForCanvas(raw, { isEmail });

    let canvasHtml = bodyHtml;
    let msoChunks: string[] = [];
    if (isEmail) {
      const encoded = encodeMsoConditionals(bodyHtml);
      canvasHtml = encoded.html;
      msoChunks = encoded.chunks;
    }

    suppressDirty = true;
    applyHtmlToEditorCanvas(editor.value, canvasHtml, css, {
      isEmail,
      pageLayout: isEmail ? undefined : resolvePageLayout()
    });
    if (isEmail && msoChunks.length) {
      setEditorMsoChunks(editor.value, msoChunks);
    } else {
      clearEditorMsoChunks(editor.value);
    }
    nextTick(() => {
      syncPageDimensions();
      refreshLayerTree();
      suppressDirty = false;
      options.onDirty?.();
    });
  }

  function applyEmailHtml(raw: string) {
    applyTemplateHtmlDocument(raw);
  }

  function loadDefinitionIntoEditor(definition: GrapesTemplateDefinition | null | undefined) {
    loadProject(definition);
  }

  return {
    editor,
    selectedComponent,
    ready,
    canUndo,
    canRedo,
    undo,
    redo,
    addBlock,
    startBlockDrag,
    moveBlockDrag,
    endBlockDrag,
    loadProject,
    serializeProject,
    preview,
    insertMerge,
    insertImage,
    selectLayer,
    layerTree,
    applyEmailHtml,
    applyTemplateHtmlDocument,
    loadDefinitionIntoEditor,
    syncPageDimensions,
    isGrapesDefinition
  };
}
