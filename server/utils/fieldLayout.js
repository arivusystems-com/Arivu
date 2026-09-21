/**
 * Field Configuration Layout (server)
 * Layout sections are orthogonal to field ownership (platform|app|org / core|participation|system).
 */

function cloneSections(sections) {
  return (sections || []).map((s) => ({ ...s }));
}

const GENERIC_DEFAULT = [
  { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
  { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
];

const BASIC_ADDITIONAL = [
  { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
  { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 1, protected: true }
];

const MODULE_DEFAULT_SECTIONS = {
  people: BASIC_ADDITIONAL,
  organizations: [
    { id: 'basic', labelKey: 'settings.modFieldsSectionBasic', order: 0, protected: true },
    { id: 'contact', labelKey: 'settings.modFieldsSectionContact', order: 1, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
  ],
  tasks: [
    { id: 'general', labelKey: 'settings.modFieldsSectionGeneral', order: 0, protected: true },
    { id: 'scheduling', labelKey: 'settings.modFieldsSectionScheduling', order: 1, protected: true },
    { id: 'additional', labelKey: 'settings.modFieldsSectionAdditional', order: 2, protected: true }
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
  items: BASIC_ADDITIONAL,
  quotes: BASIC_ADDITIONAL,
  sales_orders: BASIC_ADDITIONAL,
  invoices: BASIC_ADDITIONAL,
  payments: BASIC_ADDITIONAL,
  documents: BASIC_ADDITIONAL,
  purchase_orders: BASIC_ADDITIONAL,
  receipt_notes: BASIC_ADDITIONAL,
  purchase_returns: BASIC_ADDITIONAL,
  delivery_notes: BASIC_ADDITIONAL,
  delivery_returns: BASIC_ADDITIONAL,
  sales_returns: BASIC_ADDITIONAL,
  stockrooms: BASIC_ADDITIONAL,
  stock_adjustments: BASIC_ADDITIONAL,
  stock_transfers: BASIC_ADDITIONAL,
  inventory: BASIC_ADDITIONAL
};

const PEOPLE_SEED_SECTION = {
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

/** Keep in sync with client PEOPLE_BASIC_SEED_ORDER. */
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
];

const PEOPLE_BASIC_SEED_ORDER_VERSION = 1;

const PEOPLE_LEGACY_SECTION_IDS = new Set(['contact', 'assignment']);

const COMMERCIAL_BASIC_SEED = {
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

function normalizeKey(key) {
  return String(key || '').trim().toLowerCase().replace(/-/g, '');
}

function getDefaultFieldLayout(moduleKey) {
  const key = String(moduleKey || '').toLowerCase();
  const sections = MODULE_DEFAULT_SECTIONS[key] || GENERIC_DEFAULT;
  return { version: 1, sections: cloneSections(sections) };
}

function getDefaultSectionIdForModule(moduleKey) {
  const layout = getDefaultFieldLayout(moduleKey);
  const additional = layout.sections.find((s) => s.id === 'additional');
  if (additional) return additional.id;
  return layout.sections[layout.sections.length - 1]?.id || 'general';
}

function seedSectionIdForField(moduleKey, fieldKey) {
  const mod = String(moduleKey || '').toLowerCase();
  const nk = normalizeKey(fieldKey);
  if (mod === 'people' && PEOPLE_SEED_SECTION[nk]) return PEOPLE_SEED_SECTION[nk];
  if (COMMERCIAL_LAYOUT_MODULES.has(mod) && COMMERCIAL_BASIC_SEED[nk]) {
    return COMMERCIAL_BASIC_SEED[nk];
  }
  return getDefaultSectionIdForModule(mod);
}

function sortSections(sections) {
  return [...sections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function normalizeFieldLayout(moduleKey, existing) {
  const defaults = getDefaultFieldLayout(moduleKey);
  if (!existing || !Array.isArray(existing.sections) || existing.sections.length === 0) {
    return defaults;
  }

  const mod = String(moduleKey || '').toLowerCase();
  const wantsBasic = defaults.sections.some((s) => s.id === 'basic');
  const byId = new Map();
  for (const s of existing.sections) {
    if (!s?.id) continue;
    let id = String(s.id);
    let labelKey = s.labelKey;
    if (wantsBasic && id === 'general') {
      id = 'basic';
      if (!labelKey || labelKey === 'settings.modFieldsSectionGeneral') {
        labelKey = 'settings.modFieldsSectionBasic';
      }
    }
    if (mod === 'people' && PEOPLE_LEGACY_SECTION_IDS.has(id)) continue;
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
      const cur = byId.get(def.id);
      if (def.protected) cur.protected = true;
      if (!cur.labelKey && def.labelKey) cur.labelKey = def.labelKey;
      if (def.id === 'basic' && cur.labelKey === 'settings.modFieldsSectionGeneral') {
        cur.labelKey = 'settings.modFieldsSectionBasic';
      }
    }
  }

  const sections = sortSections(Array.from(byId.values())).map((s, i) => ({ ...s, order: i }));
  const next = { version: 1, sections };
  if (mod === 'people' && typeof existing.peopleBasicSeedOrder === 'number') {
    next.peopleBasicSeedOrder = existing.peopleBasicSeedOrder;
  }
  return next;
}

function reorderPeopleBasicSeedFields(fields, layout) {
  const basicId = layout.sections.find((s) => s.id === 'basic')?.id;
  if (!basicId) return fields;

  const seedRank = new Map(PEOPLE_BASIC_SEED_ORDER.map((k, i) => [k, i]));
  const basicSeeded = [];
  const basicOther = [];
  const nonBasic = [];

  for (const field of fields) {
    if (String(field.sectionId) !== basicId) {
      nonBasic.push(field);
      continue;
    }
    const nk = normalizeKey(field.key);
    if (seedRank.has(nk)) basicSeeded.push(field);
    else basicOther.push(field);
  }

  basicSeeded.sort(
    (a, b) => (seedRank.get(normalizeKey(a.key)) ?? 0) - (seedRank.get(normalizeKey(b.key)) ?? 0)
  );

  const bySection = new Map();
  for (const s of layout.sections) bySection.set(s.id, []);
  for (const f of [...basicSeeded, ...basicOther]) {
    bySection.get(basicId).push(f);
  }
  for (const f of nonBasic) {
    const sid = String(f.sectionId || '');
    if (bySection.has(sid)) bySection.get(sid).push(f);
    else bySection.get(layout.sections[layout.sections.length - 1].id).push(f);
  }

  const out = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    for (const f of bySection.get(s.id) || []) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

function flattenFieldsByLayout(fields, layout) {
  const bySection = new Map();
  for (const s of layout.sections) bySection.set(s.id, []);
  const orphan = [];
  for (const f of fields) {
    let sid = String(f.sectionId || '');
    if (sid === 'general' && bySection.has('basic')) sid = 'basic';
    if (PEOPLE_LEGACY_SECTION_IDS.has(sid) && bySection.has('basic') && !bySection.has(sid)) {
      sid = 'basic';
    }
    if (bySection.has(sid)) bySection.get(sid).push({ ...f, sectionId: sid || f.sectionId });
    else orphan.push(f);
  }
  const fallbackId = layout.sections[layout.sections.length - 1]?.id;
  if (fallbackId && orphan.length) {
    bySection.get(fallbackId).push(...orphan);
  }
  const out = [];
  let order = 0;
  for (const s of sortSections(layout.sections)) {
    for (const f of bySection.get(s.id) || []) {
      out.push({ ...f, sectionId: s.id, order: order++ });
    }
  }
  return out;
}

function ensureFieldsHaveSectionIds(moduleKey, fields, layout) {
  const validIds = new Set(layout.sections.map((s) => s.id));
  const fallback = getDefaultSectionIdForModule(moduleKey);
  const primaryId = layout.sections.find((s) => s.id === 'basic' || s.id === 'general')?.id;
  const list = Array.isArray(fields) ? fields : [];
  const mod = String(moduleKey || '').toLowerCase();

  const mapped = list.map((field) => {
    const next = { ...field };
    let sid = next.sectionId ? String(next.sectionId) : '';
    if (sid === 'general' && validIds.has('basic')) sid = 'basic';
    if (mod === 'people' && PEOPLE_LEGACY_SECTION_IDS.has(sid) && validIds.has('basic')) {
      sid = 'basic';
    }
    if (sid && validIds.has(sid)) {
      next.sectionId = sid;
      return next;
    }
    const seeded = seedSectionIdForField(moduleKey, String(next.key || ''));
    next.sectionId = validIds.has(seeded) ? seeded : fallback;
    return next;
  });

  if (primaryId && (COMMERCIAL_LAYOUT_MODULES.has(mod) || mod === 'people')) {
    const primaryOccupied = mapped.some((f) => String(f.sectionId) === primaryId);
    if (!primaryOccupied) {
      return mapped.map((field) => {
        const seeded = seedSectionIdForField(moduleKey, String(field.key || ''));
        if (seeded === primaryId && validIds.has(primaryId)) {
          return { ...field, sectionId: primaryId };
        }
        return field;
      });
    }
  }

  return mapped;
}

/**
 * Normalize incoming fieldLayout + field.sectionId on module save.
 * Never mutates owner / context / dataType.
 */
function applyFieldLayoutOnSave(moduleKey, fields, fieldLayout) {
  const mod = String(moduleKey || '').toLowerCase();
  let layout = normalizeFieldLayout(moduleKey, fieldLayout);
  const withSections = ensureFieldsHaveSectionIds(moduleKey, fields, layout);
  const sorted = [...withSections].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let ordered = flattenFieldsByLayout(sorted, layout);

  if (mod === 'people') {
    const currentVersion = Number(layout.peopleBasicSeedOrder || 0);
    if (currentVersion < PEOPLE_BASIC_SEED_ORDER_VERSION) {
      ordered = reorderPeopleBasicSeedFields(ordered, layout);
      layout = { ...layout, peopleBasicSeedOrder: PEOPLE_BASIC_SEED_ORDER_VERSION };
    }
  }

  return {
    fieldLayout: layout,
    fields: ordered
  };
}

/**
 * Validate layout payload shape (soft — returns sanitized layout).
 */
function validateFieldLayoutPayload(moduleKey, fieldLayout) {
  if (fieldLayout === undefined) return { ok: true, fieldLayout: undefined };
  if (fieldLayout === null) {
    return { ok: true, fieldLayout: getDefaultFieldLayout(moduleKey) };
  }
  if (typeof fieldLayout !== 'object' || Array.isArray(fieldLayout)) {
    return { ok: false, error: 'fieldLayout must be an object' };
  }
  if (fieldLayout.sections !== undefined && !Array.isArray(fieldLayout.sections)) {
    return { ok: false, error: 'fieldLayout.sections must be an array' };
  }
  return { ok: true, fieldLayout: normalizeFieldLayout(moduleKey, fieldLayout) };
}

module.exports = {
  getDefaultFieldLayout,
  normalizeFieldLayout,
  applyFieldLayoutOnSave,
  validateFieldLayoutPayload,
  getDefaultSectionIdForModule
};
