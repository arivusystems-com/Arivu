/**
 * Create / full-mode surface layout.
 *
 * Field blocks come from Field Configuration (`fieldLayout` + `sectionId`).
 * Composites (app participation, lines, …) are module-gated slots inserted
 * at intuitive anchors — not ModuleDefinition fields.
 */

import {
  applyFieldLayoutToModuleState,
  groupFieldsByLayout,
  resolveSectionDisplayLabel,
  type FieldLayout,
  type LayoutField
} from './fieldLayout';

export type CreateSurfaceCompositeId =
  | 'app_participation'
  | 'lines'
  | 'deal_relationships'
  | 'vendor_catalog';

export type CreateSurfaceFieldBlock = {
  type: 'fields';
  sectionId: string;
  label: string;
  fields: LayoutField[];
};

export type CreateSurfaceCompositeBlock = {
  type: 'composite';
  id: CreateSurfaceCompositeId;
};

export type CreateSurfaceBlock = CreateSurfaceFieldBlock | CreateSurfaceCompositeBlock;

type CompositeAnchor = {
  id: CreateSurfaceCompositeId;
  /** Preferred: insert after this field-layout section when it exists */
  afterSectionId?: string;
  /** Fallback index among field sections (0-based; -1 = before all) */
  afterFieldSectionIndex?: number;
};

const COMPOSITE_ANCHORS: Record<string, CompositeAnchor[]> = {
  people: [
    { id: 'app_participation', afterSectionId: 'basic', afterFieldSectionIndex: 0 }
  ],
  organizations: [
    { id: 'app_participation', afterSectionId: 'basic', afterFieldSectionIndex: 0 },
    { id: 'vendor_catalog', afterSectionId: 'basic', afterFieldSectionIndex: 0 }
  ],
  deals: [
    { id: 'deal_relationships', afterSectionId: 'pipeline', afterFieldSectionIndex: 1 },
    { id: 'lines', afterSectionId: 'pipeline', afterFieldSectionIndex: 1 }
  ],
  quotes: [{ id: 'lines', afterSectionId: 'basic', afterFieldSectionIndex: 0 }],
  invoices: [{ id: 'lines', afterSectionId: 'basic', afterFieldSectionIndex: 0 }],
  sales_orders: [{ id: 'lines', afterSectionId: 'basic', afterFieldSectionIndex: 0 }],
  purchase_orders: [{ id: 'lines', afterSectionId: 'basic', afterFieldSectionIndex: 0 }]
};

export function getModuleCompositeAnchors(moduleKey: string): CompositeAnchor[] {
  const key = String(moduleKey || '').toLowerCase();
  return COMPOSITE_ANCHORS[key] ? [...COMPOSITE_ANCHORS[key]] : [];
}

function isParticipationOwner(field: LayoutField): boolean {
  const owner = String(field.owner || field.metadata?.owner || '')
    .trim()
    .toLowerCase();
  return owner === 'participation';
}

/**
 * Ensure module payload has normalized fieldLayout + sectionIds for create UI.
 */
export function ensureModuleCreateLayout(
  moduleKey: string,
  fields: LayoutField[],
  existingLayout?: FieldLayout | null
): { layout: FieldLayout; fields: LayoutField[] } {
  return applyFieldLayoutToModuleState(moduleKey, fields, existingLayout);
}

/**
 * Ordered create-surface blocks: Field Config sections + optional composites.
 */
export function buildCreateSurfaceBlocks(options: {
  moduleKey: string;
  fields: LayoutField[];
  fieldLayout?: FieldLayout | null;
  t: (key: string) => string;
  includeField?: (field: LayoutField) => boolean;
  includeComposites?: CreateSurfaceCompositeId[];
  /** When true, hide participation-owned fields (rendered via app_participation slot) */
  excludeParticipationOwner?: boolean;
}): CreateSurfaceBlock[] {
  const moduleKey = String(options.moduleKey || '').toLowerCase();
  const { layout, fields } = ensureModuleCreateLayout(
    moduleKey,
    options.fields || [],
    options.fieldLayout
  );

  const includeField = (field: LayoutField): boolean => {
    if (!field?.key) return false;
    if (options.excludeParticipationOwner && isParticipationOwner(field)) return false;
    if (options.includeField && !options.includeField(field)) return false;
    return true;
  };

  const groups = groupFieldsByLayout(fields, layout, { includeField });
  const fieldBlocks: CreateSurfaceFieldBlock[] = [];
  for (const group of groups) {
    if (!group.fieldKeys.length) continue;
    const byKey = new Map(
      fields.filter((f) => f?.key).map((f) => [String(f.key).toLowerCase(), f])
    );
    const sectionFields: LayoutField[] = [];
    for (const key of group.fieldKeys) {
      const field = byKey.get(String(key).toLowerCase());
      if (field) sectionFields.push(field);
    }
    if (!sectionFields.length) continue;
    fieldBlocks.push({
      type: 'fields',
      sectionId: group.section.id,
      label: resolveSectionDisplayLabel(group.section, options.t),
      fields: sectionFields
    });
  }

  const wanted = new Set(
    options.includeComposites ?? getModuleCompositeAnchors(moduleKey).map((a) => a.id)
  );
  const anchors = getModuleCompositeAnchors(moduleKey).filter((a) => wanted.has(a.id));
  if (!anchors.length) {
    return fieldBlocks;
  }

  const blocks: CreateSurfaceBlock[] = [...fieldBlocks];
  const inserted = new Set<CreateSurfaceCompositeId>();

  for (const anchor of anchors) {
    if (inserted.has(anchor.id)) continue;
    let insertAt = blocks.length;

    if (anchor.afterSectionId) {
      const idx = blocks.findIndex(
        (b) => b.type === 'fields' && b.sectionId === anchor.afterSectionId
      );
      if (idx >= 0) insertAt = idx + 1;
      else if (typeof anchor.afterFieldSectionIndex === 'number') {
        const fieldOnly = blocks
          .map((b, i) => (b.type === 'fields' ? i : -1))
          .filter((i) => i >= 0);
        const fi = anchor.afterFieldSectionIndex;
        if (fi < 0) insertAt = 0;
        else if (fi < fieldOnly.length) insertAt = fieldOnly[fi]! + 1;
      }
    } else if (typeof anchor.afterFieldSectionIndex === 'number') {
      const fieldOnly = blocks
        .map((b, i) => (b.type === 'fields' ? i : -1))
        .filter((i) => i >= 0);
      const fi = anchor.afterFieldSectionIndex;
      if (fi < 0) insertAt = 0;
      else if (fi < fieldOnly.length) insertAt = fieldOnly[fi]! + 1;
    }

    // Keep composite cluster order when multiple share the same anchor
    while (
      insertAt < blocks.length &&
      blocks[insertAt]?.type === 'composite' &&
      inserted.has((blocks[insertAt] as CreateSurfaceCompositeBlock).id)
    ) {
      insertAt += 1;
    }

    blocks.splice(insertAt, 0, { type: 'composite', id: anchor.id });
    inserted.add(anchor.id);
  }

  return blocks;
}
