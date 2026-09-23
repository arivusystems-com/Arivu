/**
 * Field Configuration Layout
 *
 * Layout sections are orthogonal to ownership (core / participation / system).
 * Badges come from field metadata; sectionId is settings UI placement only.
 *
 * See docs/architecture/field-model.md (axes) — this module does NOT redefine ownership.
 */

export type FieldLayoutSection = {
  id: string;
  /** i18n key for default/platform sections */
  labelKey?: string;
  /** Tenant override label (wins over labelKey when set) */
  label?: string;
  order: number;
  /** Protected defaults cannot be deleted */
  protected?: boolean;
};

export type FieldLayout = {
  version: 1;
  sections: FieldLayoutSection[];
  /**
   * One-shot repair marker for people Basic Information seed order.
   * When missing/older, core fields are reordered to PEOPLE_BASIC_SEED_ORDER once.
   */
  peopleBasicSeedOrder?: number;
  /**
   * One-shot repair marker for organizations Basic Information seed.
   * Collapses Contact Details and pulls address/primaryContact into basic once.
   */
  orgBasicSeedOrder?: number;
  /**
   * One-shot repair marker for tasks Basic Information seed.
   * Collapses Scheduling/General and pulls all core fields into basic once.
   */
  taskBasicSeedOrder?: number;
};

export type LayoutField = {
  key?: string;
  sectionId?: string;
  order?: number;
  owner?: string;
  metadata?: { owner?: string; [key: string]: unknown };
  [key: string]: unknown;
};

const GENERIC_DEFAULT: FieldLayoutSection[] = [
  { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
  { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
];

const MODULE_DEFAULT_SECTIONS: Record<string, FieldLayoutSection[]> = {
  people: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  organizations: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  tasks: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  events: [
    { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
    { id: 'scheduling', labelKey: 'settings.modFieldsSectionScheduling', order: 1, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
  ],
  deals: [
    { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
    { id: 'pipeline', labelKey: 'settings.modFieldsSectionPipeline', order: 1, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
  ],
  cases: [
    { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  forms: [
    { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  items: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  quotes: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  sales_orders: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  invoices: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  payments: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  documents: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  purchase_orders: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  receipt_notes: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  purchase_returns: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  delivery_notes: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  delivery_returns: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  sales_returns: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  stockrooms: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  stock_adjustments: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  stock_transfers: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ],
  inventory: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
  ]
};

/** Seed section assignment by field key (layout only — not ownership). */
const PEOPLE_SEED_SECTION: Record<string, string> = {
  first_name: 'basic',
  last_name: 'basic',
  salutation: 'basic',
  source: 'basic',
  tags: 'basic',
  do_not_contact: 'basic',
  email: 'basic',
  phone: 'basic',
  mobile: 'basic',
  organization: 'basic',
  assignedto: 'basic'
};

/**
 * Canonical people Basic Information order (identity → contact → ownership → flags).
 * Keep in sync with server peopleDefaultFieldOrder / fieldLayout PEOPLE_BASIC_SEED_ORDER.
 */
const PEOPLE_BASIC_SEED_ORDER = [
  'salutation',
  'first_name',
  'last_name',
  'email',
  'phone',
  'mobile',
  'organization',
  'assignedto',
  'tags',
  'do_not_contact',
  'source'
] as const;

const PEOPLE_BASIC_SEED_ORDER_VERSION = 1;

/** Legacy people sections collapsed into Basic Information. */
const PEOPLE_LEGACY_SECTION_IDS = new Set(['contact', 'assignment']);

/** Legacy organizations Contact Details collapsed into Basic Information. */
const ORG_LEGACY_SECTION_IDS = new Set(['contact']);

const ORG_SEED_SECTION: Record<string, string> = {
  name: 'basic',
  industry: 'basic',
  website: 'basic',
  phone: 'basic',
  email: 'basic',
  assignedto: 'basic',
  address: 'basic',
  primarycontact: 'basic',
  tags: 'basic',
  description: 'basic'
};

/**
 * Canonical organizations Basic Information order.
 * Keep in sync with server/utils/fieldLayout.js ORG_BASIC_SEED_ORDER.
 */
const ORG_BASIC_SEED_ORDER = [
  'name',
  'industry',
  'website',
  'phone',
  'email',
  'assignedto',
  'address',
  'primarycontact',
  'tags',
  'description'
] as const;

const ORG_BASIC_SEED_ORDER_VERSION = 2;

const TASK_SEED_SECTION: Record<string, string> = {
  title: 'basic',
  name: 'basic',
  status: 'basic',
  priority: 'basic',
  assignedto: 'basic',
  relatedto: 'basic',
  startdate: 'basic',
  duedate: 'basic',
  enddate: 'basic',
  tasktype: 'basic',
  description: 'basic',
  estimatedhours: 'basic',
  actualhours: 'basic',
  projectid: 'basic',
  tags: 'basic',
  subtasks: 'basic'
};

/**
 * Canonical tasks Basic Information order.
 * Keep in sync with server/utils/fieldLayout.js TASK_BASIC_SEED_ORDER.
 */
const TASK_BASIC_SEED_ORDER = [
  'title',
  'status',
  'priority',
  'assignedto',
  'relatedto',
  'startdate',
  'duedate',
  'tasktype',
  'description',
  'estimatedhours',
  'actualhours',
  'projectid',
  'tags',
  'subtasks'
] as const;

const TASK_BASIC_SEED_ORDER_VERSION = 2;

/** Legacy tasks Scheduling collapsed into Basic Information. */
const TASK_LEGACY_SECTION_IDS = new Set(['scheduling']);

/** Commercial + inventory header fields → Basic Information (system/meta stay additional via default). */
const COMMERCIAL_BASIC_SEED: Record<string, string> = {
  quotetitle: 'basic',
  invoicetitle: 'basic',
  title: 'basic',
  name: 'basic',
  subject: 'basic',
  quotedate: 'basic',
  invoicedate: 'basic',
  orderdate: 'basic',
  podate: 'basic',
  date: 'basic',
  duedate: 'basic',
  validuntil: 'basic',
  status: 'basic',
  currency: 'basic',
  paymentcurrency: 'basic',
  assignedto: 'basic',
  contactid: 'basic',
  contact: 'basic',
  organizationrefid: 'basic',
  organization: 'basic',
  organizationid: 'basic',
  accountid: 'basic',
  dealid: 'basic',
  vendorid: 'basic',
  customerid: 'basic',
  billtoorganizationid: 'basic',
  shiptoorganizationid: 'basic',
  locationcode: 'basic',
  locationtype: 'basic',
  isdefault: 'basic',
  allownegative: 'basic',
  itemname: 'basic',
  item_name: 'basic',
  itemtype: 'basic',
  item_type: 'basic',
  categoryid: 'basic',
  sellingprice: 'basic',
  selling_price: 'basic',
  unitofmeasure: 'basic',
  unit_of_measure: 'basic',
  lifecyclestate: 'basic',
  lifecycle_state: 'basic',
  description: 'basic'
};

const COMMERCIAL_LAYOUT_MODULES = new Set([
  'quotes',
  'invoices',
  'sales_orders',
  'payments',
  'documents',
  'items',
  'purchase_orders',
  'receipt_notes',
  'purchase_returns',
  'delivery_notes',
  'delivery_returns',
  'sales_returns',
  'stockrooms',
  'stock_adjustments',
  'stock_transfers',
  'inventory'
]);

function normalizeKey(key: string | undefined | null): string {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
}

function cloneSections(sections: FieldLayoutSection[]): FieldLayoutSection[] {
  return sections.map((s) => ({ ...s }));
}

export function getDefaultFieldLayout(moduleKey: string): FieldLayout {
  const key = String(moduleKey || '').toLowerCase();
  const sections = MODULE_DEFAULT_SECTIONS[key] || GENERIC_DEFAULT;
  return { version: 1, sections: cloneSections(sections) };
}

export function getDefaultSectionIdForModule(moduleKey: string): string {
  const layout = getDefaultFieldLayout(moduleKey);
  const additional = layout.sections.find((s) => s.id === 'additional');
  if (additional) return additional.id;
  return layout.sections[layout.sections.length - 1]?.id || 'general';
}

export function seedSectionIdForField(moduleKey: string, fieldKey: string): string {
  const mod = String(moduleKey || '').toLowerCase();
  const nk = normalizeKey(fieldKey);
  if (mod === 'people' && PEOPLE_SEED_SECTION[nk]) return PEOPLE_SEED_SECTION[nk];
  if (mod === 'organizations' && ORG_SEED_SECTION[nk]) return ORG_SEED_SECTION[nk];
  if (mod === 'tasks' && TASK_SEED_SECTION[nk]) return TASK_SEED_SECTION[nk];
  if (mod === 'deals') {
    if (['name', 'title', 'amount', 'currency', 'closedate', 'assignedto'].includes(nk)) return 'general';
    if (['stage', 'pipeline', 'pipelineid', 'probability'].includes(nk)) return 'pipeline';
  }
  if (COMMERCIAL_LAYOUT_MODULES.has(mod) && COMMERCIAL_BASIC_SEED[nk]) {
    return COMMERCIAL_BASIC_SEED[nk];
  }
  return getDefaultSectionIdForModule(mod);
}

function sortSections(sections: FieldLayoutSection[]): FieldLayoutSection[] {
  return [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Merge tenant layout with module defaults: keep tenant order/labels,
 * ensure protected defaults still exist, drop unknown empty refs later at UI.
 */
export function normalizeFieldLayout(
  moduleKey: string,
  existing: FieldLayout | null | undefined
): FieldLayout {
  const defaults = getDefaultFieldLayout(moduleKey);
  if (!existing || !Array.isArray(existing.sections) || existing.sections.length === 0) {
    return defaults;
  }

  const mod = String(moduleKey || '').toLowerCase();
  const wantsBasic = defaults.sections.some((s) => s.id === 'basic');
  const byId = new Map<string, FieldLayoutSection>();
  for (const s of existing.sections) {
    if (!s?.id) continue;
    let id = String(s.id);
    let labelKey = s.labelKey;
    // Commercial modules renamed General → Basic Information
    if (wantsBasic && id === 'general') {
      id = 'basic';
      if (!labelKey || labelKey === 'settings.modFieldsSectionGeneral') {
        labelKey = 'settings.modFieldsSectionBasic';
      }
    }
    // People: Contact Details + Assignment collapsed into Basic Information
    if (mod === 'people' && PEOPLE_LEGACY_SECTION_IDS.has(id)) continue;
    // Organizations: Contact Details collapsed into Basic Information
    if (mod === 'organizations' && ORG_LEGACY_SECTION_IDS.has(id)) continue;
    // Tasks: Scheduling collapsed into General
    if (mod === 'tasks' && TASK_LEGACY_SECTION_IDS.has(id)) continue;
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      labelKey,
      label: s.label,
      order: typeof s.order === 'number' ? s.order : byId.size,
      protected: !!s.protected
    });
  }

  for (const def of defaults.sections) {
    if (!byId.has(def.id)) {
      byId.set(def.id, { ...def, order: byId.size });
    } else {
      const cur = byId.get(def.id)!;
      if (def.protected) cur.protected = true;
      if (!cur.labelKey && def.labelKey) cur.labelKey = def.labelKey;
    }
  }

  const sections = sortSections(Array.from(byId.values())).map((s, i) => ({ ...s, order: i }));
  const next: FieldLayout = { version: 1, sections };
  if (mod === 'people' && typeof existing.peopleBasicSeedOrder === 'number') {
    next.peopleBasicSeedOrder = existing.peopleBasicSeedOrder;
  }
  if (mod === 'organizations' && typeof existing.orgBasicSeedOrder === 'number') {
    next.orgBasicSeedOrder = existing.orgBasicSeedOrder;
  }
  if (mod === 'tasks') {
    const prior =
      typeof existing.taskBasicSeedOrder === 'number'
        ? existing.taskBasicSeedOrder
        : typeof (existing as { taskGeneralSeedOrder?: number }).taskGeneralSeedOrder === 'number'
          ? (existing as { taskGeneralSeedOrder?: number }).taskGeneralSeedOrder
          : undefined;
    if (typeof prior === 'number') next.taskBasicSeedOrder = prior;
  }
  return next;
}

/**
 * Reorder people Basic Information seed fields to PEOPLE_BASIC_SEED_ORDER.
 * Custom / non-seed basic fields keep relative order after the seed block.
 */
function reorderPeopleBasicSeedFields(fields: LayoutField[], layout: FieldLayout): LayoutField[] {
  const basicId = layout.sections.find((s) => s.id === 'basic')?.id;
  if (!basicId) return fields;

  const seedRank = new Map<string, number>(
    PEOPLE_BASIC_SEED_ORDER.map((k, i) => [k, i])
  );

  const basicSeeded: LayoutField[] = [];
  const basicOther: LayoutField[] = [];
  const nonBasic: LayoutField[] = [];

  for (const field of fields) {
    if (String(field.sectionId) !== basicId) {
      nonBasic.push(field);
      continue;
    }
    const nk = normalizeKey(String(field.key || ''));
    if (seedRank.has(nk)) basicSeeded.push(field);
    else basicOther.push(field);
  }

  basicSeeded.sort(
    (a, b) =>
      (seedRank.get(normalizeKey(String(a.key || ''))) ?? 0) -
      (seedRank.get(normalizeKey(String(b.key || ''))) ?? 0)
  );

  const bySection = new Map<string, LayoutField[]>();
  for (const s of layout.sections) bySection.set(s.id, []);
  for (const f of [...basicSeeded, ...basicOther]) {
    bySection.get(basicId)!.push(f);
  }
  for (const f of nonBasic) {
    const sid = String(f.sectionId || '');
    if (bySection.has(sid)) bySection.get(sid)!.push(f);
    else bySection.get(layout.sections[layout.sections.length - 1]!.id)!.push(f);
  }

  const out: LayoutField[] = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    for (const f of bySection.get(s.id) || []) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

/**
 * One-shot: move org seed keys into Basic Information and reorder.
 */
function repairOrgBasicSeedFields(fields: LayoutField[], layout: FieldLayout): LayoutField[] {
  const basicId = layout.sections.find((s) => s.id === 'basic')?.id;
  if (!basicId) return fields;

  const remapped = fields.map((field) => {
    const nk = normalizeKey(String(field.key || ''));
    if (ORG_SEED_SECTION[nk] === 'basic') {
      return field.sectionId === basicId ? field : { ...field, sectionId: basicId };
    }
    return field;
  });

  const seedRank = new Map<string, number>(ORG_BASIC_SEED_ORDER.map((k, i) => [k, i]));

  const basicSeeded: LayoutField[] = [];
  const basicOther: LayoutField[] = [];
  const nonBasic: LayoutField[] = [];

  for (const field of remapped) {
    if (String(field.sectionId) !== basicId) {
      nonBasic.push(field);
      continue;
    }
    const nk = normalizeKey(String(field.key || ''));
    if (seedRank.has(nk)) basicSeeded.push(field);
    else basicOther.push(field);
  }

  basicSeeded.sort(
    (a, b) =>
      (seedRank.get(normalizeKey(String(a.key || ''))) ?? 0) -
      (seedRank.get(normalizeKey(String(b.key || ''))) ?? 0)
  );

  const bySection = new Map<string, LayoutField[]>();
  for (const s of layout.sections) bySection.set(s.id, []);
  for (const f of [...basicSeeded, ...basicOther]) {
    bySection.get(basicId)!.push(f);
  }
  for (const f of nonBasic) {
    const sid = String(f.sectionId || '');
    if (bySection.has(sid)) bySection.get(sid)!.push(f);
    else bySection.get(layout.sections[layout.sections.length - 1]!.id)!.push(f);
  }

  const out: LayoutField[] = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    for (const f of bySection.get(s.id) || []) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

/**
 * One-shot: collapse Scheduling + move all core task fields into Basic Information and reorder.
 */
function repairTaskBasicSeedFields(fields: LayoutField[], layout: FieldLayout): LayoutField[] {
  const basicId = layout.sections.find((s) => s.id === 'basic')?.id;
  if (!basicId) return fields;

  const remapped = fields.map((field) => {
    const nk = normalizeKey(String(field.key || ''));
    const owner = String(field.owner || field.metadata?.owner || '').toLowerCase();
    if (TASK_SEED_SECTION[nk] === 'basic' || owner === 'core') {
      return field.sectionId === basicId ? field : { ...field, sectionId: basicId };
    }
    return field;
  });

  const seedRank = new Map<string, number>(TASK_BASIC_SEED_ORDER.map((k, i) => [k, i]));

  const basicSeeded: LayoutField[] = [];
  const basicOther: LayoutField[] = [];
  const nonBasic: LayoutField[] = [];

  for (const field of remapped) {
    if (String(field.sectionId) !== basicId) {
      nonBasic.push(field);
      continue;
    }
    const nk = normalizeKey(String(field.key || ''));
    if (seedRank.has(nk)) basicSeeded.push(field);
    else basicOther.push(field);
  }

  basicSeeded.sort(
    (a, b) =>
      (seedRank.get(normalizeKey(String(a.key || ''))) ?? 0) -
      (seedRank.get(normalizeKey(String(b.key || ''))) ?? 0)
  );

  const bySection = new Map<string, LayoutField[]>();
  for (const s of layout.sections) bySection.set(s.id, []);
  for (const f of [...basicSeeded, ...basicOther]) {
    bySection.get(basicId)!.push(f);
  }
  for (const f of nonBasic) {
    const sid = String(f.sectionId || '');
    if (bySection.has(sid)) bySection.get(sid)!.push(f);
    else bySection.get(layout.sections[layout.sections.length - 1]!.id)!.push(f);
  }

  const out: LayoutField[] = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    for (const f of bySection.get(s.id) || []) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

/**
 * Ensure every field has a sectionId; return layout + fields with sectionIds filled.
 * Does not mutate ownership / context / dataType.
 */
export function ensureFieldsHaveSectionIds(
  moduleKey: string,
  fields: LayoutField[],
  layout: FieldLayout
): LayoutField[] {
  const validIds = new Set(layout.sections.map((s) => s.id));
  const fallback = getDefaultSectionIdForModule(moduleKey);
  const primaryId = layout.sections.find((s) => s.id === 'basic' || s.id === 'general')?.id;

  const mod = String(moduleKey || '').toLowerCase();
  const mapped = fields.map((field) => {
    let sid = field.sectionId ? String(field.sectionId) : '';
    // Migrate legacy general → basic when layout uses basic
    if (sid === 'general' && validIds.has('basic')) sid = 'basic';
    // People: Contact Details + Assignment → Basic Information
    if (mod === 'people' && PEOPLE_LEGACY_SECTION_IDS.has(sid) && validIds.has('basic')) {
      sid = 'basic';
    }
    // Organizations: Contact Details → Basic Information
    if (mod === 'organizations' && ORG_LEGACY_SECTION_IDS.has(sid) && validIds.has('basic')) {
      sid = 'basic';
    }
    // Tasks: Scheduling → Basic Information
    if (mod === 'tasks' && TASK_LEGACY_SECTION_IDS.has(sid) && validIds.has('basic')) {
      sid = 'basic';
    }
    if (sid && validIds.has(sid)) {
      return field.sectionId === sid ? field : { ...field, sectionId: sid };
    }
    const seeded = seedSectionIdForField(moduleKey, String(field.key || ''));
    const resolved = validIds.has(seeded) ? seeded : fallback;
    if (field.sectionId === resolved) return field;
    return { ...field, sectionId: resolved };
  });

  // Bootstrap repair: primary section empty but seeded keys dumped into additional
  if (
    primaryId &&
    (COMMERCIAL_LAYOUT_MODULES.has(mod) ||
      mod === 'people' ||
      mod === 'organizations' ||
      mod === 'tasks')
  ) {
    const primaryOccupied = mapped.some((f) => String(f.sectionId) === primaryId);
    if (!primaryOccupied) {
      return mapped.map((field) => {
        const seeded = seedSectionIdForField(moduleKey, String(field.key || ''));
        if (seeded === primaryId && validIds.has(primaryId)) {
          return field.sectionId === primaryId ? field : { ...field, sectionId: primaryId };
        }
        return field;
      });
    }
  }

  return mapped;
}

export function applyFieldLayoutToModuleState(
  moduleKey: string,
  fields: LayoutField[],
  existingLayout?: FieldLayout | null
): { layout: FieldLayout; fields: LayoutField[] } {
  const mod = String(moduleKey || '').toLowerCase();
  let layout = normalizeFieldLayout(moduleKey, existingLayout);
  const withSections = ensureFieldsHaveSectionIds(moduleKey, fields, layout);
  // Sort once by existing order so first bootstrap preserves prior sequence within sections.
  const sorted = [...withSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let ordered = flattenFieldsByLayout(sorted, layout);

  if (mod === 'people') {
    const currentVersion = Number(layout.peopleBasicSeedOrder || 0);
    if (currentVersion < PEOPLE_BASIC_SEED_ORDER_VERSION) {
      ordered = reorderPeopleBasicSeedFields(ordered, layout);
      layout = { ...layout, peopleBasicSeedOrder: PEOPLE_BASIC_SEED_ORDER_VERSION };
    }
  }

  if (mod === 'organizations') {
    const currentVersion = Number(layout.orgBasicSeedOrder || 0);
    if (currentVersion < ORG_BASIC_SEED_ORDER_VERSION) {
      ordered = repairOrgBasicSeedFields(ordered, layout);
      layout = { ...layout, orgBasicSeedOrder: ORG_BASIC_SEED_ORDER_VERSION };
    }
  }

  if (mod === 'tasks') {
    const currentVersion = Number(
      layout.taskBasicSeedOrder ||
        (layout as { taskGeneralSeedOrder?: number }).taskGeneralSeedOrder ||
        0
    );
    if (currentVersion < TASK_BASIC_SEED_ORDER_VERSION) {
      ordered = repairTaskBasicSeedFields(ordered, layout);
      layout = { ...layout, taskBasicSeedOrder: TASK_BASIC_SEED_ORDER_VERSION };
      delete (layout as { taskGeneralSeedOrder?: number }).taskGeneralSeedOrder;
    }
  }

  return { layout, fields: ordered };
}

export function flattenFieldsByLayout(fields: LayoutField[], layout: FieldLayout): LayoutField[] {
  const bySection = new Map<string, LayoutField[]>();
  for (const s of layout.sections) bySection.set(s.id, []);
  const orphan: LayoutField[] = [];

  // Preserve caller array order (drag/drop updates position before flatten).
  for (const f of fields) {
    let sid = String(f.sectionId || '');
    if (sid === 'general' && bySection.has('basic')) sid = 'basic';
    if (PEOPLE_LEGACY_SECTION_IDS.has(sid) && bySection.has('basic') && !bySection.has(sid)) {
      sid = 'basic';
    }
    if (ORG_LEGACY_SECTION_IDS.has(sid) && bySection.has('basic') && !bySection.has(sid)) {
      sid = 'basic';
    }
    if (TASK_LEGACY_SECTION_IDS.has(sid) && bySection.has('basic') && !bySection.has(sid)) {
      sid = 'basic';
    }
    if (bySection.has(sid)) bySection.get(sid)!.push(sid === f.sectionId ? f : { ...f, sectionId: sid });
    else orphan.push(f);
  }

  const fallbackId = layout.sections[layout.sections.length - 1]?.id;
  if (fallbackId && orphan.length) {
    bySection.get(fallbackId)!.push(...orphan);
  }

  const out: LayoutField[] = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    const list = bySection.get(s.id) || [];
    for (const f of list) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

export type SectionGroup = {
  section: FieldLayoutSection;
  fieldKeys: string[];
};

export function groupFieldsByLayout(
  fields: LayoutField[],
  layout: FieldLayout,
  options?: {
    search?: string;
    includeField?: (field: LayoutField) => boolean;
  }
): SectionGroup[] {
  const q = (options?.search || '').toLowerCase().trim();
  const sections = sortSections(layout.sections);
  const groups: SectionGroup[] = sections.map((section) => ({ section, fieldKeys: [] }));
  const indexById = new Map(groups.map((g, i) => [g.section.id, i]));
  const fallbackIdx = groups.length - 1;

  const sorted = [...fields].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const field of sorted) {
    if (!field?.key) continue;
    if (options?.includeField && !options.includeField(field)) continue;
    if (q) {
      const label = String(field.label || '').toLowerCase();
      const key = String(field.key || '').toLowerCase();
      if (!label.includes(q) && !key.includes(q)) continue;
    }
    const sid = String(field.sectionId || '');
    const idx = indexById.has(sid) ? indexById.get(sid)! : fallbackIdx;
    const group = idx >= 0 ? groups[idx] : undefined;
    if (group) group.fieldKeys.push(field.key);
  }

  return groups;
}

/**
 * Move field to another field's position (and section). Rebuilds global order.
 */
export function moveFieldAcrossLayout(
  fields: LayoutField[],
  layout: FieldLayout,
  fromKey: string,
  toKey: string
): LayoutField[] {
  if (!fromKey || !toKey || fromKey === toKey) return fields;
  const list = fields.map((f) => ({ ...f }));
  const fromIdx = list.findIndex((f) => f.key === fromKey);
  const toIdx = list.findIndex((f) => f.key === toKey);
  if (fromIdx < 0 || toIdx < 0) return fields;

  const target = list[toIdx];
  if (!target) return fields;
  const targetSectionId = String(target.sectionId || getDefaultSectionIdForModule(''));
  const [moved] = list.splice(fromIdx, 1);
  if (!moved) return fields;
  moved.sectionId = targetSectionId;
  const insertAt = list.findIndex((f) => f.key === toKey);
  const finalIdx = insertAt < 0 ? list.length : (fromIdx < toIdx ? insertAt + 1 : insertAt);
  list.splice(finalIdx, 0, moved);
  return flattenFieldsByLayout(list, layout);
}

/** Drop onto a section (append to end of that section). */
export function moveFieldToSection(
  fields: LayoutField[],
  layout: FieldLayout,
  fieldKey: string,
  sectionId: string
): LayoutField[] {
  const list = fields.map((f) => ({ ...f }));
  const idx = list.findIndex((f) => f.key === fieldKey);
  if (idx < 0) return fields;
  if (!layout.sections.some((s) => s.id === sectionId)) return fields;
  list[idx] = { ...list[idx], sectionId };
  return flattenFieldsByLayout(list, layout);
}

export function createCustomSection(
  layout: FieldLayout,
  label: string
): FieldLayout {
  const id = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const sections = sortSections(layout.sections).map((s, i) => ({ ...s, order: i }));
  sections.push({
    id,
    label: String(label || '').trim() || 'New section',
    order: sections.length,
    protected: false
  });
  return { version: 1, sections };
}

export function renameSection(layout: FieldLayout, sectionId: string, label: string): FieldLayout {
  return {
    version: 1,
    sections: layout.sections.map((s) =>
      s.id === sectionId ? { ...s, label: String(label || '').trim() || s.label || s.id } : s
    )
  };
}

export function reorderSections(layout: FieldLayout, orderedIds: string[]): FieldLayout {
  const byId = new Map(layout.sections.map((s) => [s.id, s]));
  const sections: FieldLayoutSection[] = [];
  for (const id of orderedIds) {
    const s = byId.get(id);
    if (s) {
      sections.push({ ...s, order: sections.length });
      byId.delete(id);
    }
  }
  for (const s of byId.values()) {
    sections.push({ ...s, order: sections.length });
  }
  return { version: 1, sections };
}

export function deleteSectionIfEmpty(
  layout: FieldLayout,
  fields: LayoutField[],
  sectionId: string
): { ok: true; layout: FieldLayout } | { ok: false; reason: 'protected' | 'not_empty' | 'missing' } {
  const section = layout.sections.find((s) => s.id === sectionId);
  if (!section) return { ok: false, reason: 'missing' };
  if (section.protected) return { ok: false, reason: 'protected' };
  const occupied = fields.some((f) => String(f.sectionId) === sectionId);
  if (occupied) return { ok: false, reason: 'not_empty' };
  return {
    ok: true,
    layout: {
      version: 1,
      sections: sortSections(layout.sections.filter((s) => s.id !== sectionId)).map((s, i) => ({
        ...s,
        order: i
      }))
    }
  };
}

export function resolveSectionDisplayLabel(
  section: FieldLayoutSection,
  t: (key: string) => string
): string {
  if (section.label && String(section.label).trim()) return String(section.label).trim();
  if (section.labelKey) {
    try {
      const translated = t(section.labelKey);
      if (translated && translated !== section.labelKey) return translated;
    } catch {
      /* ignore */
    }
  }
  return section.id;
}
