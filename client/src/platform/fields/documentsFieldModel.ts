/**
 * ============================================================================
 * PLATFORM FIELD MODEL: Documents
 * ============================================================================
 */

import type {
  BaseFieldMetadata,
  BaseFieldOwner,
  BaseFieldScope,
} from './BaseFieldModel';
import {
  validateBaseFieldMetadata,
  normalizeFieldKeyForMetadataLookup,
  classifyFieldBase,
} from './BaseFieldModel';

export type DocumentFieldIntent = 'primary' | 'state' | 'detail' | 'system';
export type DocumentFieldOwner = BaseFieldOwner;
export type DocumentFieldScope = BaseFieldScope;

export interface DocumentFieldMetadata extends Omit<BaseFieldMetadata, 'intent'> {
  intent: DocumentFieldIntent;
}

const DOCUMENT_FIELD_METADATA: Record<string, DocumentFieldMetadata> = {
  title: {
    owner: 'core',
    intent: 'primary',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'text',
    allowOnCreate: true,
  },
  documentNumber: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    filterable: true,
    filterType: 'text',
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
  },
  documentType: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'select',
    allowOnCreate: true,
  },
  status: {
    owner: 'core',
    intent: 'state',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'select',
    allowOnCreate: false,
  },
  folderId: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'entity',
    allowOnCreate: true,
  },
  tags: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'multi-select',
    allowOnCreate: true,
  },
  assignedTo: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    filterable: true,
    filterType: 'user',
    allowOnCreate: true,
  },
  versionNumber: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: false,
    filterable: false,
    allowOnCreate: false,
  },
  description: {
    owner: 'core',
    intent: 'detail',
    fieldScope: 'CORE',
    editable: true,
    filterable: false,
    allowOnCreate: true,
  },
  createdBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    filterable: true,
    filterType: 'user',
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
  },
  modifiedBy: {
    owner: 'system',
    intent: 'system',
    fieldScope: 'CORE',
    editable: false,
    filterable: false,
    isProtected: true,
    isSystem: true,
    isVisibleInConfig: true,
  },
};

function validateDocumentFieldMetadata(fieldName: string, metadata: DocumentFieldMetadata): void {
  validateBaseFieldMetadata(fieldName, metadata as unknown as BaseFieldMetadata);

  const { owner, intent } = metadata;
  const validCoreIntents: DocumentFieldIntent[] = ['primary', 'state', 'detail'];
  if (owner === 'core' && !validCoreIntents.includes(intent)) {
    throw new Error(
      `Field "${fieldName}": Document core fields must have intent: ${validCoreIntents.join(' | ')}. Found: ${intent}`
    );
  }
}

function validateAllDocumentMetadata(): void {
  for (const [fieldName, metadata] of Object.entries(DOCUMENT_FIELD_METADATA)) {
    validateDocumentFieldMetadata(fieldName, metadata);
  }
}

validateAllDocumentMetadata();

export { DOCUMENT_FIELD_METADATA };

export function getDocumentFieldMetadata(fieldKey: string): DocumentFieldMetadata | undefined {
  const normalizedName = normalizeFieldKeyForMetadataLookup(fieldKey);
  if (DOCUMENT_FIELD_METADATA[fieldKey]) {
    return DOCUMENT_FIELD_METADATA[fieldKey];
  }
  for (const [key, metadata] of Object.entries(DOCUMENT_FIELD_METADATA)) {
    if (normalizeFieldKeyForMetadataLookup(key) === normalizedName) {
      return metadata;
    }
  }
  return undefined;
}

export function getDocumentFields(): DocumentFieldMetadata[] {
  return Object.values(DOCUMENT_FIELD_METADATA);
}

export function classifyDocumentField(fieldName: string): string {
  const metadata = getDocumentFieldMetadata(fieldName);
  return classifyFieldBase(metadata as unknown as BaseFieldMetadata);
}

export function isDocumentProtectedField(fieldName: string): boolean {
  const metadata = getDocumentFieldMetadata(fieldName);
  return metadata?.isProtected === true;
}

export function isExcludedFromDocumentQuickCreate(fieldName: string): boolean {
  const metadata = getDocumentFieldMetadata(fieldName);
  if (!metadata) return true;
  if (metadata.owner === 'system') return true;
  if (metadata.owner === 'core' && metadata.allowOnCreate === false) return true;
  return false;
}
