/**
 * CSV bulk-invite for Settings → Users.
 * Preview validates without creating; commit uses the shared invite path.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Role = require('../models/Role');
const UserDirectory = require('../models/UserDirectory');
const { isTenantPrivilegedUser } = require('../utils/tenantPrivilegedAccess');
const { isRbacV2Enabled } = require('../utils/rbacFeatureFlags');
const {
  canAddUserToApp,
  ensureOrgSubscriptionForEnabledApps,
  getSeatLimit,
  getSeatsUsed
} = require('../utils/subscriptionUtils');
const { deriveAppAccessFromRole } = require('../services/roleEntitlementService');

const MAX_BULK_INVITE_ROWS = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {object} organization
 * @returns {Promise<import('mongoose').Model>}
 */
async function getScopedUserModel(organization) {
  if (organization?.database?.name && organization.database.initialized) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
    return getTenantModel(orgDbConnection, 'User', User);
  }
  return User;
}

/**
 * @param {object} organization
 * @returns {Promise<import('mongoose').Model>}
 */
async function getScopedRoleModel(organization) {
  if (organization?.database?.name && organization.database.initialized) {
    const dbConnectionManager = require('../utils/databaseConnectionManager');
    const orgDbConnection = await dbConnectionManager.getOrganizationConnection(organization.database.name);
    return getTenantModel(orgDbConnection, 'Role', Role);
  }
  return Role;
}

function getTenantModel(connection, modelName, fallbackModel) {
  if (connection.models[modelName]) {
    return connection.models[modelName];
  }
  const originalSchema = fallbackModel.schema;
  const clonedSchema = originalSchema.clone();
  if (originalSchema.methods) {
    Object.keys(originalSchema.methods).forEach((methodName) => {
      clonedSchema.methods[methodName] = originalSchema.methods[methodName];
    });
  }
  if (originalSchema.statics) {
    Object.keys(originalSchema.statics).forEach((staticName) => {
      clonedSchema.statics[staticName] = originalSchema.statics[staticName];
    });
  }
  return connection.model(modelName, clonedSchema);
}

function buildUserScopeQuery(actor, organization) {
  if (organization?.database?.name && organization.database.initialized) {
    return {};
  }
  return { organizationId: actor.organizationId };
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i += 1;
        continue;
      }
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

/**
 * Parse CSV text into invite row objects.
 * Required headers: email, firstName, lastName. Optional: role.
 *
 * @param {string} csvText
 * @returns {{ ok: true, rows: object[] } | { ok: false, message: string, code: string }}
 */
function parseInviteCsv(csvText) {
  const lines = String(csvText || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      ok: false,
      message: 'CSV must include a header row and at least one data row',
      code: 'CSV_EMPTY'
    };
  }

  const header = splitCsvLine(lines[0]).map(normalizeHeader);
  const col = (aliases) => {
    for (const alias of aliases) {
      const i = header.indexOf(normalizeHeader(alias));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iEmail = col(['email', 'emailaddress']);
  const iFirst = col(['firstname', 'first', 'givenname']);
  const iLast = col(['lastname', 'last', 'surname', 'familyname']);
  const iRole = col(['role', 'rolename', 'rolekey']);

  if (iEmail < 0 || iFirst < 0 || iLast < 0) {
    return {
      ok: false,
      message: 'CSV header must include email, firstName, and lastName columns',
      code: 'CSV_MISSING_COLUMNS'
    };
  }

  const dataLineCount = lines.length - 1;
  if (dataLineCount > MAX_BULK_INVITE_ROWS) {
    return {
      ok: false,
      message: `CSV exceeds the maximum of ${MAX_BULK_INVITE_ROWS} rows`,
      code: 'CSV_TOO_MANY_ROWS',
      maxRows: MAX_BULK_INVITE_ROWS
    };
  }

  const rows = [];
  for (let r = 1; r < lines.length; r += 1) {
    const cells = splitCsvLine(lines[r]);
    rows.push({
      rowNumber: r + 1,
      email: String(cells[iEmail] || '').trim(),
      firstName: String(cells[iFirst] || '').trim(),
      lastName: String(cells[iLast] || '').trim(),
      role: iRole >= 0 ? String(cells[iRole] || '').trim() : ''
    });
  }

  return { ok: true, rows };
}

/**
 * @param {object} organization
 * @param {string} roleRef
 * @param {Map<string, object>} roleByKey
 * @returns {object | null}
 */
function resolveRole(roleRef, roleByKey) {
  const key = String(roleRef || '').trim().toLowerCase();
  if (!key) return null;
  return roleByKey.get(key) || null;
}

/**
 * @param {object} params
 * @returns {Promise<object>}
 */
async function buildRoleIndex(organization) {
  const ScopedRole = await getScopedRoleModel(organization);
  const orgId = organization._id;
  let roles = await ScopedRole.find({
    organizationId: orgId,
    isActive: { $ne: false }
  })
    .select('_id name userType')
    .lean();

  if ((!roles || roles.length === 0) && organization?.database?.name && organization.database.initialized) {
    roles = await ScopedRole.find({ isActive: { $ne: false } })
      .select('_id name userType')
      .lean();
  }

  /** @type {Map<string, object>} */
  const roleByKey = new Map();
  for (const role of roles || []) {
    const nameKey = String(role.name || '').trim().toLowerCase();
    if (nameKey) roleByKey.set(nameKey, role);
    roleByKey.set(String(role._id), role);
  }
  return { roles: roles || [], roleByKey };
}

/**
 * @param {object} params
 * @param {object} params.actor
 * @param {object} params.organization
 * @param {object[]} params.rows
 * @param {string} params.businessHourSetId
 * @param {string} [params.defaultRoleId]
 * @returns {Promise<object>}
 */
async function previewBulkInvite({
  actor,
  organization,
  rows,
  businessHourSetId,
  defaultRoleId
}) {
  if (!isTenantPrivilegedUser(actor)) {
    return {
      ok: false,
      statusCode: 403,
      message: 'Only Sales administrators can add users',
      code: 'INSUFFICIENT_PERMISSIONS'
    };
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      statusCode: 400,
      message: 'At least one row is required',
      code: 'NO_ROWS'
    };
  }

  if (rows.length > MAX_BULK_INVITE_ROWS) {
    return {
      ok: false,
      statusCode: 400,
      message: `Maximum ${MAX_BULK_INVITE_ROWS} rows per import`,
      code: 'CSV_TOO_MANY_ROWS',
      maxRows: MAX_BULK_INVITE_ROWS
    };
  }

  if (!businessHourSetId || !mongoose.Types.ObjectId.isValid(businessHourSetId)) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Business hours is required',
      code: 'BUSINESS_HOURS_REQUIRED'
    };
  }

  const BusinessHourSet = require('../models/BusinessHourSet');
  const businessHourSet = await BusinessHourSet.findOne({
    _id: businessHourSetId,
    organizationId: organization._id
  })
    .select('_id name')
    .lean();

  if (!businessHourSet) {
    return {
      ok: false,
      statusCode: 400,
      message: 'Selected business hours not found',
      code: 'BUSINESS_HOURS_NOT_FOUND'
    };
  }

  const rbacV2 = isRbacV2Enabled(organization);
  const { roleByKey } = await buildRoleIndex(organization);

  let defaultRole = null;
  if (defaultRoleId) {
    defaultRole = resolveRole(defaultRoleId, roleByKey);
    if (!defaultRole) {
      return {
        ok: false,
        statusCode: 400,
        message: 'Default role not found',
        code: 'DEFAULT_ROLE_NOT_FOUND'
      };
    }
  }

  await ensureOrgSubscriptionForEnabledApps(organization);

  const ScopedUser = await getScopedUserModel(organization);
  const scopeQuery = buildUserScopeQuery(actor, organization);

  const currentUserCount = await ScopedUser.countDocuments({
    organizationId: organization._id,
    status: 'active'
  });

  const maxUsers = organization.limits?.maxUsers;
  const userLimitReached =
    maxUsers !== undefined && maxUsers !== -1 && currentUserCount >= maxUsers;

  /** @type {Map<string, number>} */
  const emailFirstIndex = new Map();
  const emails = rows
    .map((r) => String(r.email || '').toLowerCase().trim())
    .filter(Boolean);

  const existingUsers = emails.length
    ? await ScopedUser.find({
        email: { $in: emails },
        ...scopeQuery
      })
        .select('email status')
        .lean()
    : [];

  /** @type {Map<string, object>} */
  const existingByEmail = new Map();
  for (const u of existingUsers) {
    existingByEmail.set(String(u.email).toLowerCase(), u);
  }

  const directoryClaims = emails.length
    ? await UserDirectory.find({ email: { $in: emails } })
        .select('email organizationId')
        .lean()
    : [];
  /** @type {Map<string, object>} */
  const directoryByEmail = new Map();
  for (const d of directoryClaims) {
    directoryByEmail.set(String(d.email).toLowerCase(), d);
  }

  /** @type {Map<string, number>} */
  const projectedSeatNeeds = new Map();
  let projectedNewSeats = 0;

  const results = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const rowNumber = row.rowNumber || i + 1;
    const email = String(row.email || '').toLowerCase().trim();
    const firstName = String(row.firstName || '').trim();
    const lastName = String(row.lastName || '').trim();
    const roleRef = String(row.role || '').trim();

    /** @type {{ rowNumber: number, email: string, firstName: string, lastName: string, status: string, code?: string, message?: string, roleId?: string, roleName?: string }} */
    const entry = {
      rowNumber,
      email: row.email || '',
      firstName,
      lastName,
      status: 'valid'
    };

    if (!email) {
      entry.status = 'invalid';
      entry.code = 'EMAIL_REQUIRED';
      entry.message = 'Email is required';
      results.push(entry);
      continue;
    }

    if (!EMAIL_RE.test(email)) {
      entry.status = 'invalid';
      entry.code = 'EMAIL_INVALID';
      entry.message = 'Invalid email address';
      results.push(entry);
      continue;
    }

    if (!firstName || !lastName) {
      entry.status = 'invalid';
      entry.code = 'NAME_REQUIRED';
      entry.message = 'firstName and lastName are required';
      results.push(entry);
      continue;
    }

    if (emailFirstIndex.has(email)) {
      entry.status = 'duplicate_in_file';
      entry.code = 'DUPLICATE_IN_FILE';
      entry.message = `Duplicate of row ${emailFirstIndex.get(email)}`;
      results.push(entry);
      continue;
    }
    emailFirstIndex.set(email, rowNumber);

    const existing = existingByEmail.get(email);
    if (existing) {
      if (existing.status === 'active') {
        entry.status = 'already_member';
        entry.code = 'ALREADY_MEMBER';
        entry.message = 'User already exists in your organization';
        results.push(entry);
        continue;
      }
      if (!['inactive', 'invited', 'deleted'].includes(existing.status)) {
        entry.status = 'already_member';
        entry.code = 'ALREADY_MEMBER';
        entry.message = 'User already exists in your organization';
        results.push(entry);
        continue;
      }
      entry.status = 'reinvite';
      entry.code = 'WILL_REINVITE';
      entry.message = `Will re-invite existing ${existing.status} user`;
    }

    const directoryClaim = directoryByEmail.get(email);
    if (
      directoryClaim?.organizationId
      && String(directoryClaim.organizationId) !== String(organization._id)
    ) {
      entry.status = 'invalid';
      entry.code = 'EMAIL_IN_OTHER_TENANT';
      entry.message =
        'This email already belongs to another workspace';
      results.push(entry);
      continue;
    }

    let roleDoc = null;
    if (roleRef) {
      roleDoc = resolveRole(roleRef, roleByKey);
      if (!roleDoc) {
        entry.status = 'invalid';
        entry.code = 'ROLE_NOT_FOUND';
        entry.message = `Role "${roleRef}" not found`;
        results.push(entry);
        continue;
      }
    } else if (defaultRole) {
      roleDoc = defaultRole;
    } else if (rbacV2) {
      entry.status = 'invalid';
      entry.code = 'ROLE_REQUIRED';
      entry.message = 'Role is required';
      results.push(entry);
      continue;
    } else {
      entry.status = 'invalid';
      entry.code = 'ROLE_REQUIRED';
      entry.message = 'Role is required (column or default)';
      results.push(entry);
      continue;
    }

    entry.roleId = String(roleDoc._id);
    entry.roleName = roleDoc.name;

    if (entry.status === 'valid' || entry.status === 'reinvite') {
      const isNewBillable =
        entry.status === 'valid'
        || existing?.status === 'inactive'
        || existing?.status === 'deleted';

      if (isNewBillable) {
        projectedNewSeats += 1;
        try {
          const derived = deriveAppAccessFromRole(roleDoc, organization);
          for (const app of derived.appAccess || []) {
            const key = app.appKey;
            projectedSeatNeeds.set(key, (projectedSeatNeeds.get(key) || 0) + 1);
          }
        } catch {
          // Role may not derive apps in legacy mode; seat check below still covers org limit.
        }
      }
    }

    results.push(entry);
  }

  const seatWarnings = [];
  if (userLimitReached) {
    seatWarnings.push({
      code: 'USER_LIMIT_REACHED',
      message: `User limit reached (${maxUsers}). Upgrade your plan before inviting more users.`
    });
  } else if (maxUsers !== undefined && maxUsers !== -1) {
    const remaining = maxUsers - currentUserCount;
    if (projectedNewSeats > remaining) {
      seatWarnings.push({
        code: 'USER_LIMIT_SHORTFALL',
        message: `Import needs ${projectedNewSeats} new seats but only ${remaining} remain (limit ${maxUsers}).`,
        needed: projectedNewSeats,
        remaining
      });
    }
  }

  for (const [appKey, needed] of projectedSeatNeeds.entries()) {
    const canAdd = await canAddUserToApp(organization._id, appKey);
    const limit = await getSeatLimit(organization._id, appKey);
    const used = await getSeatsUsed(organization._id, appKey);
    const available = limit == null ? null : Math.max(0, limit - used);

    if (!canAdd.allowed) {
      seatWarnings.push({
        code: 'SEAT_BLOCKED',
        appKey,
        message: canAdd.reason || `Cannot add users to ${appKey}`,
        needed,
        available
      });
    } else if (available != null && needed > available) {
      seatWarnings.push({
        code: 'SEAT_SHORTFALL',
        appKey,
        message: `${appKey} needs ${needed} seats but only ${available} available`,
        needed,
        available
      });
    }
  }

  const summary = {
    total: results.length,
    valid: results.filter((r) => r.status === 'valid' || r.status === 'reinvite').length,
    invalid: results.filter((r) => r.status === 'invalid').length,
    duplicateInFile: results.filter((r) => r.status === 'duplicate_in_file').length,
    alreadyMember: results.filter((r) => r.status === 'already_member').length,
    reinvite: results.filter((r) => r.status === 'reinvite').length,
    projectedNewSeats,
    seatBlocked: seatWarnings.length > 0
  };

  return {
    ok: true,
    statusCode: 200,
    data: {
      rows: results,
      summary,
      seatWarnings,
      businessHourSetId: String(businessHourSet._id),
      maxRows: MAX_BULK_INVITE_ROWS
    }
  };
}

/**
 * Build invite body for one CSV row using shared defaults.
 *
 * @param {object} row
 * @param {object} defaults
 * @returns {object}
 */
function buildInviteBodyFromRow(row, defaults) {
  return {
    email: String(row.email || '').trim(),
    firstName: String(row.firstName || '').trim(),
    lastName: String(row.lastName || '').trim(),
    roleId: row.roleId || defaults.defaultRoleId,
    businessHourSetId: defaults.businessHourSetId,
    sendEmail: defaults.sendEmail !== false
  };
}

/**
 * Create a response capture object for reusing inviteUser.
 * @returns {{ res: object, getResult: () => { statusCode: number, body: object | null } }}
 */
function createCaptureRes() {
  const state = { statusCode: 200, body: null };
  const res = {
    locals: {},
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(body) {
      state.body = body;
      return this;
    }
  };
  return {
    res,
    getResult: () => ({ statusCode: state.statusCode, body: state.body })
  };
}

module.exports = {
  MAX_BULK_INVITE_ROWS,
  parseInviteCsv,
  previewBulkInvite,
  buildInviteBodyFromRow,
  createCaptureRes,
  buildRoleIndex,
  resolveRole
};
