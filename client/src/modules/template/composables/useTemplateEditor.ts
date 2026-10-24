import { computed, ref, shallowRef } from 'vue';
import {
  fetchTemplate,
  publishTemplate,
  updateTemplateDefinition,
  type TemplateMetadataPatch,
  type TemplateRecord
} from '../services/templateApi';
import {
  createBlankGrapesDefinition,
  hasGrapesDefinitionContent,
  hasGrapesProjectContent,
  isGrapesDefinition,
  isGrapesDefinitionDegraded,
  type GrapesTemplateDefinition
} from '../editor/storage';
import {
  isEmailDefinitionDegraded,
  protectEmailDefinitionRoundTrip,
  readImportSnapshot
} from '../utils/emailImportSnapshot';
import type { SaveStatus } from './useGrapesEditor';
import { isTableMutating } from '../editor/tableActions';
import { isTableSheetEditing } from '../editor/tableSheetEditor';

const AUTOSAVE_IDLE_MS = 10000;
const AUTOSAVE_RETRY_MS = 1500;
const EMAIL_BACKUP_PREFIX = 'arivu.emailTemplate.backup:';

function persistEmailBackup(templateId: string, definition: GrapesTemplateDefinition) {
  if (typeof localStorage === 'undefined') return;
  try {
    const html = String(definition.html || '').trim();
    if (!html) return;
    localStorage.setItem(
      `${EMAIL_BACKUP_PREFIX}${templateId}`,
      JSON.stringify({
        html,
        css: String(definition.css || ''),
        savedAt: new Date().toISOString()
      })
    );
  } catch {
    // Ignore quota / private mode.
  }
}

function readEmailBackup(templateId: string): GrapesTemplateDefinition | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${EMAIL_BACKUP_PREFIX}${templateId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { html?: string; css?: string };
    const html = String(parsed?.html || '').trim();
    if (!html) return null;
    return {
      ...createBlankGrapesDefinition(),
      html,
      css: String(parsed.css || ''),
      project: null
    };
  } catch {
    return null;
  }
}

let extraAutosaveBlocked: (() => boolean) | null = null;

function isAutosaveBlocked(): boolean {
  return isTableSheetEditing() || isTableMutating() || Boolean(extraAutosaveBlocked?.());
}

export function useTemplateEditor(getTemplateId: () => string) {
  const templateMeta = shallowRef<TemplateRecord | null>(null);
  const loading = ref(true);
  const saveStatus = ref<SaveStatus>('saved');
  const publishBusy = ref(false);
  const previewBusy = ref(false);
  const previewRecordId = ref('');
  const previewRecordLabel = ref('');

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  let suppressAutosave = false;
  let serializeFn: (() => GrapesTemplateDefinition) | null = null;
  let loadedDefinitionHadContent = false;
  let lastGoodDefinition: GrapesTemplateDefinition | null = null;

  const templateName = computed(() => String(templateMeta.value?.name || ''));
  const templateDescription = computed(() => String(templateMeta.value?.description || ''));
  const outputFormat = computed(() => String(templateMeta.value?.outputFormat || 'pdf'));

  function resolveDraftDefinition(record: TemplateRecord | null): GrapesTemplateDefinition {
    const draft = record?.draftDefinition;
    if (isGrapesDefinition(draft)) {
      if (hasGrapesDefinitionContent(draft) && String(draft.html || '').trim()) {
        return draft;
      }

      // Recover from accidental empty save when an HTML import snapshot still exists.
      const snapshot = readImportSnapshot(draft);
      if (snapshot?.html?.trim()) {
        return {
          ...draft,
          html: snapshot.html,
          css: String(snapshot.css || draft.css || '')
        };
      }

      const backup = readEmailBackup(String(record?._id || getTemplateId() || ''));
      if (backup?.html?.trim()) {
        return {
          ...draft,
          html: backup.html,
          css: String(backup.css || draft.css || '')
        };
      }
      return draft;
    }

    const backup = readEmailBackup(String(record?._id || getTemplateId() || ''));
    if (backup?.html?.trim()) return backup;
    return createBlankGrapesDefinition();
  }

  function didRecoverDraftDefinition(
    record: TemplateRecord | null,
    resolved: GrapesTemplateDefinition
  ): boolean {
    const raw = record?.draftDefinition;
    if (!isGrapesDefinition(raw) || !String(resolved.html || '').trim()) return false;
    // Snapshot-only / empty-html drafts still need a heal persist.
    return !String(raw.html || '').trim();
  }

  function hasRenderableEmailHtml(definition: GrapesTemplateDefinition | null | undefined): boolean {
    if (!definition) return false;
    if (String(definition.html || '').trim()) return true;
    return hasGrapesProjectContent(definition.project);
  }

  async function loadTemplate() {
    loading.value = true;
    try {
      const id = getTemplateId();
      templateMeta.value = await fetchTemplate(id);
      const definition = resolveDraftDefinition(templateMeta.value);
      loadedDefinitionHadContent = hasGrapesDefinitionContent(definition);
      if (loadedDefinitionHadContent) {
        lastGoodDefinition = definition;
      }
      return definition;
    } finally {
      loading.value = false;
    }
  }

  function registerSerializer(fn: () => GrapesTemplateDefinition) {
    serializeFn = fn;
  }

  function setAutosaveBlockedChecker(fn: (() => boolean) | null) {
    extraAutosaveBlocked = fn;
  }

  function scheduleAutosave() {
    if (suppressAutosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void attemptAutosave();
    }, AUTOSAVE_IDLE_MS);
  }

  function scheduleAutosaveRetry() {
    if (suppressAutosave) return;
    if (autosaveTimer) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      void attemptAutosave();
    }, AUTOSAVE_RETRY_MS);
  }

  async function attemptAutosave() {
    if (suppressAutosave) return;
    if (isAutosaveBlocked()) {
      scheduleAutosaveRetry();
      return;
    }
    try {
      await saveDraft({ silent: true });
    } catch {
      // saveDraft updates saveStatus
    }
  }

  function markDirty() {
    if (suppressAutosave) return;
    if (saveStatus.value !== 'saving') {
      saveStatus.value = 'dirty';
    }
    scheduleAutosave();
  }

  async function saveDraft(options: {
    force?: boolean;
    silent?: boolean;
    /** Persist this definition instead of serializing the live canvas. */
    jsonDefinition?: GrapesTemplateDefinition;
    /** Explicitly allow saving a blank canvas over existing content. */
    allowClearingContent?: boolean;
  } = {}): Promise<boolean> {
    const id = String(getTemplateId() || templateMeta.value?._id || '').trim();
    if (!id || id === 'undefined' || id === 'null' || (!serializeFn && !options.jsonDefinition)) {
      return false;
    }

    if (!options.force && isAutosaveBlocked()) {
      scheduleAutosaveRetry();
      return false;
    }

    const silent = Boolean(options.silent && !options.force);
    if (!silent) {
      saveStatus.value = 'saving';
    }

    try {
      let jsonDefinition = options.jsonDefinition ?? serializeFn!();

      // Always protect email drafts against empty/flat/shrunk serializes — including
      // explicit payloads that raced the canvas (except intentional clear).
      if (outputFormat.value === 'email' && !options.allowClearingContent) {
        const protectedDefinition = protectEmailDefinitionRoundTrip(
          jsonDefinition,
          lastGoodDefinition
        );
        // If the incoming payload was a regression, keep last good and skip the write
        // only when protection could not recover renderable html.
        if (
          isEmailDefinitionDegraded(jsonDefinition, lastGoodDefinition)
          && !String(protectedDefinition.html || '').trim()
        ) {
          if (!silent) {
            saveStatus.value = 'dirty';
          }
          return false;
        }
        jsonDefinition = protectedDefinition;
      }

      // PDF/document: block flattened serializes on autosave only.
      // Explicit Save draft / Publish (force) must always persist user intent.
      if (
        outputFormat.value !== 'email'
        && !options.force
        && !options.allowClearingContent
        && isGrapesDefinitionDegraded(jsonDefinition, lastGoodDefinition)
      ) {
        if (!silent) {
          saveStatus.value = 'dirty';
        }
        return false;
      }

      // Never persist an empty canvas over a template that previously had content.
      const nextHasContent = outputFormat.value === 'email'
        ? hasRenderableEmailHtml(jsonDefinition)
        : hasGrapesDefinitionContent(jsonDefinition);
      if (!nextHasContent && loadedDefinitionHadContent) {
        if (!options.allowClearingContent && !options.force) {
          if (!silent) {
            saveStatus.value = 'dirty';
          }
          return false;
        }
      }

      if (
        !nextHasContent
        && lastGoodDefinition
        && (
          outputFormat.value === 'email'
            ? hasRenderableEmailHtml(lastGoodDefinition)
            : hasGrapesDefinitionContent(lastGoodDefinition)
        )
        && !options.allowClearingContent
        && !options.force
      ) {
        if (!silent) {
          saveStatus.value = 'dirty';
        }
        return false;
      }

      const updated = await updateTemplateDefinition(id, { jsonDefinition });
      // Promote lastGood after a successful write. Force saves always re-baseline.
      const savedOk = options.force
        || (
          outputFormat.value === 'email'
            ? (
              hasRenderableEmailHtml(jsonDefinition)
              && !isEmailDefinitionDegraded(jsonDefinition, lastGoodDefinition)
            )
            : (
              hasGrapesDefinitionContent(jsonDefinition)
              && !isGrapesDefinitionDegraded(jsonDefinition, lastGoodDefinition)
            )
        );
      if (savedOk && hasGrapesDefinitionContent(jsonDefinition)) {
        loadedDefinitionHadContent = true;
        lastGoodDefinition = jsonDefinition;
        persistEmailBackup(id, jsonDefinition);
      }

      if (silent) {
        if (saveStatus.value === 'dirty' || saveStatus.value === 'saved') {
          saveStatus.value = 'saved';
        }
      } else {
        templateMeta.value = updated;
        saveStatus.value = 'saved';
      }
      return true;
    } catch (error) {
      saveStatus.value = 'error';
      throw error;
    }
  }

  async function updateTemplateMargins(margins: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  }) {
    return patchTemplateMetadata({ margins });
  }

  async function patchTemplateMetadata(payload: TemplateMetadataPatch) {
    const id = getTemplateId();
    if (!id) return;

    saveStatus.value = 'saving';
    try {
      const updated = await updateTemplateDefinition(id, payload);
      templateMeta.value = updated;
      saveStatus.value = 'saved';
      return updated;
    } catch (error) {
      saveStatus.value = 'error';
      throw error;
    }
  }

  function setPreviewRecord(recordId: string, label = '') {
    previewRecordId.value = String(recordId || '');
    previewRecordLabel.value = String(label || '');
  }

  async function runPublish(releaseNotes = '') {
    publishBusy.value = true;
    try {
      await saveDraft({ force: true });
      const updated = await publishTemplate(getTemplateId(), releaseNotes);
      templateMeta.value = updated;
    } finally {
      publishBusy.value = false;
    }
  }

  function setPreviewBusy(value: boolean) {
    previewBusy.value = value;
  }

  async function withAutosaveSuppressed<T>(fn: () => Promise<T> | T): Promise<T> {
    suppressAutosave = true;
    try {
      return await fn();
    } finally {
      suppressAutosave = false;
    }
  }

  function seedLastGoodDefinition(definition: GrapesTemplateDefinition | null | undefined) {
    if (!definition || !hasGrapesDefinitionContent(definition)) return;
    if (outputFormat.value === 'email') {
      if (isEmailDefinitionDegraded(definition, lastGoodDefinition)) return;
    } else if (isGrapesDefinitionDegraded(definition, lastGoodDefinition)) {
      return;
    }
    lastGoodDefinition = definition;
    loadedDefinitionHadContent = true;
    persistEmailBackup(getTemplateId(), definition);
  }

  return {
    templateMeta,
    templateName,
    templateDescription,
    outputFormat,
    loading,
    saveStatus,
    publishBusy,
    previewBusy,
    loadTemplate,
    registerSerializer,
    setAutosaveBlockedChecker,
    markDirty,
    saveDraft,
    seedLastGoodDefinition,
    updateTemplateMargins,
    patchTemplateMetadata,
    runPublish,
    setPreviewBusy,
    setPreviewRecord,
    previewRecordId,
    previewRecordLabel,
    withAutosaveSuppressed,
    resolveDraftDefinition,
    didRecoverDraftDefinition
  };
}
