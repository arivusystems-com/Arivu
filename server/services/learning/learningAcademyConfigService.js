'use strict';

/**
 * Tenant Learning Academy configuration — owned by Learning, not CRM Portal.
 */

const Organization = require('../../models/Organization');
const {
  ACADEMY_CATALOG_VISIBILITY,
  ACADEMY_LEARNER_AUDIENCES,
  DEFAULT_ACADEMY_PRIMARY_COLOR,
} = require('../../constants/learningConstants');

function defaultAcademyConfig() {
  return {
    enabled: false,
    name: '',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: DEFAULT_ACADEMY_PRIMARY_COLOR,
    secondaryColor: null,
    customDomain: null,
    catalogVisibility: ACADEMY_CATALOG_VISIBILITY.ASSIGNED,
    allowedAudiences: [...ACADEMY_LEARNER_AUDIENCES],
  };
}

function normalizeAudiences(raw) {
  const allowed = new Set(ACADEMY_LEARNER_AUDIENCES);
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  for (const a of list) {
    const key = String(a || '').toLowerCase();
    if (allowed.has(key) && !out.includes(key)) out.push(key);
  }
  return out.length ? out : [...ACADEMY_LEARNER_AUDIENCES];
}

function normalizeCatalogVisibility(raw) {
  const key = String(raw || '').toLowerCase();
  if (Object.values(ACADEMY_CATALOG_VISIBILITY).includes(key)) return key;
  return ACADEMY_CATALOG_VISIBILITY.ASSIGNED;
}

function normalizeAcademyConfig(raw) {
  const base = defaultAcademyConfig();
  if (!raw || typeof raw !== 'object') return base;
  return {
    enabled: raw.enabled === true,
    name: String(raw.name || '').trim().slice(0, 120),
    logoUrl: raw.logoUrl ? String(raw.logoUrl).trim() : null,
    faviconUrl: raw.faviconUrl ? String(raw.faviconUrl).trim() : null,
    primaryColor: String(raw.primaryColor || base.primaryColor).trim() || base.primaryColor,
    secondaryColor: raw.secondaryColor ? String(raw.secondaryColor).trim() : null,
    customDomain: raw.customDomain ? String(raw.customDomain).trim().toLowerCase() : null,
    catalogVisibility: normalizeCatalogVisibility(raw.catalogVisibility),
    allowedAudiences: normalizeAudiences(raw.allowedAudiences),
  };
}

async function getAcademyConfig(organizationId) {
  const org = await Organization.findById(organizationId)
    .select('name settings.learningAcademy settings.logoUrl settings.primaryColor')
    .lean();
  const stored = normalizeAcademyConfig(org?.settings?.learningAcademy);
  // Soft-fill branding from org settings when Academy fields empty
  if (!stored.logoUrl && org?.settings?.logoUrl) {
    stored.logoUrl = org.settings.logoUrl;
  }
  if (
    (!stored.primaryColor || stored.primaryColor === DEFAULT_ACADEMY_PRIMARY_COLOR)
    && org?.settings?.primaryColor
  ) {
    stored.primaryColor = org.settings.primaryColor;
  }
  if (!stored.name && org?.name) {
    stored.name = `${org.name} Academy`;
  }
  return stored;
}

async function updateAcademyConfig(organizationId, patch = {}) {
  const current = await getAcademyConfig(organizationId);
  const next = normalizeAcademyConfig({
    ...current,
    ...patch,
    enabled: patch.enabled !== undefined ? patch.enabled === true : current.enabled,
  });
  await Organization.findByIdAndUpdate(organizationId, {
    $set: { 'settings.learningAcademy': next },
  });
  return next;
}

function isAcademyEnabled(config) {
  return Boolean(config?.enabled);
}

module.exports = {
  defaultAcademyConfig,
  normalizeAcademyConfig,
  getAcademyConfig,
  updateAcademyConfig,
  isAcademyEnabled,
};
