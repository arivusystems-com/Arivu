'use strict';

/**
 * Derive Learning audience for analytics / catalog — not User identity types.
 */

const Role = require('../../models/Role');
const People = require('../../models/People');
const Organization = require('../../models/Organization');
const {
  LEARNING_AUDIENCES,
} = require('../../constants/learningConstants');
const {
  matchPrimaryOrganizationType,
} = require('../organizationPortalEligibilityService');
const {
  normalizeOrgTypeToken,
  ORG_TYPE_PRIORITY,
} = require('../../constants/portalEligibilityDefaults');

function normalizeUserType(user) {
  return String(user?.userType || '').toUpperCase();
}

function mapOrgTypeToAudience(orgTypeToken) {
  const t = normalizeOrgTypeToken(orgTypeToken);
  if (t === 'CUSTOMER') return LEARNING_AUDIENCES.CUSTOMER;
  if (t === 'PARTNER') return LEARNING_AUDIENCES.PARTNER;
  return LEARNING_AUDIENCES.EXTERNAL;
}

function mapRoleKeyToAudience(roleKeyOrName) {
  const raw = String(roleKeyOrName || '').trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes('CUSTOMER')) return LEARNING_AUDIENCES.CUSTOMER;
  if (raw.includes('PARTNER')) return LEARNING_AUDIENCES.PARTNER;
  return null;
}

/**
 * Synchronous classify from already-loaded hints.
 * @param {{ userType?: string, roleKey?: string, roleName?: string, orgType?: string }} hints
 */
function classifyAudienceFromHints(hints = {}) {
  if (normalizeUserType(hints) !== 'EXTERNAL' && normalizeUserType({ userType: hints.userType }) !== 'EXTERNAL') {
    if (hints.userType && normalizeUserType({ userType: hints.userType }) !== 'EXTERNAL') {
      return LEARNING_AUDIENCES.INTERNAL;
    }
  }
  if (String(hints.userType || '').toUpperCase() !== 'EXTERNAL') {
    return LEARNING_AUDIENCES.INTERNAL;
  }
  const fromRole =
    mapRoleKeyToAudience(hints.roleKey) || mapRoleKeyToAudience(hints.roleName);
  if (fromRole) return fromRole;
  if (hints.orgType) return mapOrgTypeToAudience(hints.orgType);
  return LEARNING_AUDIENCES.EXTERNAL;
}

/**
 * @param {object} user lean User
 * @returns {Promise<'internal'|'customer'|'partner'|'external'>}
 */
async function deriveLearnerAudience(user) {
  if (!user) return LEARNING_AUDIENCES.EXTERNAL;
  if (normalizeUserType(user) !== 'EXTERNAL') {
    return LEARNING_AUDIENCES.INTERNAL;
  }

  let roleKey = null;
  let roleName = null;
  const activeRoleId = user.activeExternalRoleId || user._activeExternalRoleId;
  if (activeRoleId) {
    const role = await Role.findById(activeRoleId).select('name appEntitlements').lean();
    roleName = role?.name || null;
    const lmsEnt = (role?.appEntitlements || []).find(
      (e) => String(e.appKey || '').toUpperCase() === 'LMS'
    );
    roleKey = lmsEnt?.appRoleKey || null;
    const mapped = mapRoleKeyToAudience(roleKey) || mapRoleKeyToAudience(roleName);
    if (mapped) return mapped;
  }

  // Prefer any ACTIVE external assignment role name
  const assignmentRoleIds = (user.externalRoleAssignments || [])
    .filter((a) => String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
    .map((a) => a.roleId)
    .filter(Boolean);
  if (assignmentRoleIds.length) {
    const roles = await Role.find({ _id: { $in: assignmentRoleIds } })
      .select('name')
      .lean();
    for (const r of roles) {
      const mapped = mapRoleKeyToAudience(r.name);
      if (mapped) return mapped;
    }
  }

  if (user.peopleId) {
    const person = await People.findById(user.peopleId).select('organization').lean();
    if (person?.organization) {
      const biz = await Organization.findById(person.organization).select('types type').lean();
      const types = Array.isArray(biz?.types) && biz.types.length
        ? biz.types
        : biz?.type
          ? [biz.type]
          : [];
      const normalized = types.map((t) => normalizeOrgTypeToken(t)).filter(Boolean);
      const matched = matchPrimaryOrganizationType(normalized, [...ORG_TYPE_PRIORITY]);
      if (matched) return mapOrgTypeToAudience(matched);
    }
  }

  return LEARNING_AUDIENCES.EXTERNAL;
}

/**
 * Batch derive for seat breakdown.
 * @param {object[]} users
 * @returns {Promise<Map<string, string>>} userId → audience
 */
async function deriveLearnerAudiencesBatch(users) {
  const map = new Map();
  const externals = [];
  for (const u of users) {
    const id = String(u._id);
    if (normalizeUserType(u) !== 'EXTERNAL') {
      map.set(id, LEARNING_AUDIENCES.INTERNAL);
    } else {
      externals.push(u);
    }
  }
  if (!externals.length) return map;

  const roleIdSet = new Set();
  const peopleIds = [];
  for (const u of externals) {
    if (u.activeExternalRoleId) roleIdSet.add(String(u.activeExternalRoleId));
    for (const a of u.externalRoleAssignments || []) {
      if (a?.roleId && String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
        roleIdSet.add(String(a.roleId));
      }
    }
    if (u.peopleId) peopleIds.push(u.peopleId);
  }

  const roles = roleIdSet.size
    ? await Role.find({ _id: { $in: [...roleIdSet] } }).select('name').lean()
    : [];
  const roleById = new Map(roles.map((r) => [String(r._id), r]));

  const people = peopleIds.length
    ? await People.find({ _id: { $in: peopleIds } }).select('organization').lean()
    : [];
  const peopleById = new Map(people.map((p) => [String(p._id), p]));
  const bizOrgIds = people.map((p) => p.organization).filter(Boolean);
  const bizOrgs = bizOrgIds.length
    ? await Organization.find({ _id: { $in: bizOrgIds } }).select('types type').lean()
    : [];
  const bizById = new Map(bizOrgs.map((o) => [String(o._id), o]));

  for (const u of externals) {
    const id = String(u._id);
    let audience = null;

    const tryRole = (roleId) => {
      if (!roleId) return null;
      return mapRoleKeyToAudience(roleById.get(String(roleId))?.name);
    };

    audience = tryRole(u.activeExternalRoleId);
    if (!audience) {
      for (const a of u.externalRoleAssignments || []) {
        if (String(a.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') continue;
        audience = tryRole(a.roleId);
        if (audience) break;
      }
    }

    if (!audience && u.peopleId) {
      const person = peopleById.get(String(u.peopleId));
      const biz = person?.organization ? bizById.get(String(person.organization)) : null;
      const types = Array.isArray(biz?.types) && biz.types.length
        ? biz.types
        : biz?.type
          ? [biz.type]
          : [];
      const normalized = types.map((t) => normalizeOrgTypeToken(t)).filter(Boolean);
      const matched = matchPrimaryOrganizationType(normalized, [...ORG_TYPE_PRIORITY]);
      if (matched) audience = mapOrgTypeToAudience(matched);
    }

    map.set(id, audience || LEARNING_AUDIENCES.EXTERNAL);
  }

  return map;
}

module.exports = {
  classifyAudienceFromHints,
  deriveLearnerAudience,
  deriveLearnerAudiencesBatch,
  mapOrgTypeToAudience,
  mapRoleKeyToAudience,
};
