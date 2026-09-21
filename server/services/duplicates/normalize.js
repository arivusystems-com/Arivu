'use strict';

const ORG_SUFFIX_RE = /\b(pvt\.?\s*ltd\.?|private\s+limited|ltd\.?|limited|inc\.?|incorporated|llc|llp|corp\.?|corporation|co\.?)\b/gi;

function normalizeEmail(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s.includes('@') ? s : null;
}

function normalizePhone(value) {
  if (value == null) return null;
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) return null;
  // Keep last 10 digits when longer (common India/US local compare)
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function normalizeDomain(value) {
  if (value == null) return null;
  let s = String(value).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0].split('?')[0];
  if (s.includes('@')) {
    s = s.split('@')[1] || s;
  }
  return s || null;
}

function normalizeText(value) {
  if (value == null) return null;
  let s = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(ORG_SUFFIX_RE, '').replace(/\s+/g, ' ').trim();
  return s || null;
}

function normalizeCode(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  return s || null;
}

function personDisplayName(record) {
  if (!record) return '';
  if (record.name) return String(record.name).trim();
  const parts = [record.first_name, record.last_name].filter(Boolean);
  return parts.join(' ').trim();
}

function getFieldRawValue(moduleKey, field, record) {
  if (!record) return null;
  const key = String(moduleKey || '').toLowerCase();
  if (key === 'people') {
    if (field === 'name') return personDisplayName(record) || null;
    if (field === 'email') return record.email ?? null;
    if (field === 'phone') return record.phone ?? record.mobile ?? null;
    return record[field] ?? null;
  }
  if (key === 'organizations') {
    if (field === 'name') return record.name ?? null;
    if (field === 'domain') {
      return record.domain || record.website || record.emailDomain || null;
    }
    if (field === 'taxId') {
      return record.taxId || record.tax_id || record.gstin || record.vatNumber || null;
    }
    return record[field] ?? null;
  }
  if (key === 'items') {
    if (field === 'sku') return record.sku || record.item_code || null;
    return record[field] ?? null;
  }
  if (key === 'deals') {
    if (field === 'name') return record.name ?? null;
    if (field === 'contactId') {
      const c = record.contactId;
      if (c && typeof c === 'object' && c._id) return c._id;
      return c ?? null;
    }
    return record[field] ?? null;
  }
  if (key === 'tasks') {
    if (field === 'title') return record.title ?? null;
    return record[field] ?? null;
  }
  if (key === 'cases') {
    if (field === 'caseId') return record.caseId ?? null;
    if (field === 'title') return record.title ?? null;
    if (field === 'requesterEmail') return record.requesterEmail ?? null;
    if (field === 'contactId') {
      const c = record.contactId;
      if (c && typeof c === 'object' && c._id) return c._id;
      return c ?? null;
    }
    return record[field] ?? null;
  }
  return record[field] ?? null;
}

function normalizeFieldValue(moduleKey, field, rawValue) {
  if (rawValue == null || String(rawValue).trim() === '') return null;
  const f = String(field || '').toLowerCase();
  if (f === 'email' || f === 'requesteremail') return normalizeEmail(rawValue);
  if (f === 'phone' || f === 'mobile') return normalizePhone(rawValue);
  if (f === 'domain' || f === 'website') return normalizeDomain(rawValue);
  if (
    f === 'item_code'
    || f === 'sku'
    || f === 'taxid'
    || f === 'tax_id'
    || f === 'external_id'
    || f === 'caseid'
    || f === 'contactid'
  ) {
    return normalizeCode(rawValue);
  }
  if (f === 'name' || f === 'item_name' || f === 'title') return normalizeText(rawValue);
  return normalizeText(rawValue);
}

function valuesExactMatch(a, b) {
  if (a == null || b == null) return false;
  return a === b;
}

function valuesSimilarMatch(a, b) {
  if (a == null || b == null) return false;
  if (a === b) return true;
  // Token overlap only (≥50% of shorter). No character substring —
  // that falsely matched short seeds inside unrelated longer names.
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (!ta.size || !tb.size) return false;
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap += 1;
  }
  const shorter = Math.min(ta.size, tb.size);
  return overlap / shorter >= 0.5;
}

module.exports = {
  normalizeEmail,
  normalizePhone,
  normalizeDomain,
  normalizeText,
  normalizeCode,
  personDisplayName,
  getFieldRawValue,
  normalizeFieldValue,
  valuesExactMatch,
  valuesSimilarMatch,
};
