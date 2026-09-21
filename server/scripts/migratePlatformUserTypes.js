/**
 * Backfill User/Role userType: INTERNAL→STANDARD|ADMIN, SYSTEM→ADMIN.
 * Owner / Admin(istrator) system roles and assignees → ADMIN.
 *
 * Usage:
 *   node server/scripts/migratePlatformUserTypes.js
 *   node server/scripts/migratePlatformUserTypes.js --dry-run
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const dbConnectionManager = require('../utils/databaseConnectionManager');
const { runWithTenantContext } = require('../utils/tenantContext');
const { getMongoUris } = require('../lib/mongoConnect');
const {
  normalizePlatformUserType,
  PLATFORM_USER_TYPES,
} = require('../constants/platformUserTypes');
const { isPrivilegedSystemRoleName } = require('../utils/tenantPrivilegedAccess');

const dryRun = process.argv.includes('--dry-run');

async function migrateRolesInTenant() {
  const Role = require('../models/Role');
  const roles = await Role.find({}).select('_id name userType isSystemRole').lean();
  let updated = 0;
  for (const role of roles) {
    let next = normalizePlatformUserType(role.userType, { roleName: role.name });
    if (isPrivilegedSystemRoleName(role.name)) {
      next = PLATFORM_USER_TYPES.ADMIN;
    }
    if (String(role.userType || '') === next) continue;
    updated += 1;
    if (!dryRun) {
      await Role.updateOne({ _id: role._id }, { $set: { userType: next } });
    }
  }
  return { examined: roles.length, updated };
}

async function migrateUsersInTenant() {
  const User = require('../models/User');
  const Role = require('../models/Role');
  const users = await User.find({})
    .select('_id userType isOwner role roleId')
    .lean();
  const roleIds = [...new Set(users.map((u) => u.roleId).filter(Boolean).map(String))];
  const roleDocs = roleIds.length
    ? await Role.find({ _id: { $in: roleIds } }).select('_id name userType').lean()
    : [];
  const roleById = new Map(roleDocs.map((r) => [String(r._id), r]));

  let updated = 0;
  for (const user of users) {
    const roleDoc = user.roleId ? roleById.get(String(user.roleId)) : null;
    let next = normalizePlatformUserType(user.userType, {
      isOwner: user.isOwner,
      roleName: user.role || roleDoc?.name,
    });
    if (user.isOwner || (roleDoc && isPrivilegedSystemRoleName(roleDoc.name))) {
      next = PLATFORM_USER_TYPES.ADMIN;
    } else if (roleDoc) {
      next = normalizePlatformUserType(roleDoc.userType, {
        isOwner: user.isOwner,
        roleName: roleDoc.name,
      });
    }
    if (String(user.userType || '') === next) continue;
    updated += 1;
    if (!dryRun) {
      await User.updateOne({ _id: user._id }, { $set: { userType: next } });
    }
  }
  return { examined: users.length, updated };
}

async function migrateTenant(org) {
  const dbName = org.database?.name;
  if (!dbName || !org.database?.initialized) {
    return { skipped: true, reason: 'no_db' };
  }

  const conn = await dbConnectionManager.getOrganizationConnection(dbName);
  if (conn.readyState !== 1) await conn.asPromise();

  return runWithTenantContext(
    { organizationId: org._id, connection: conn, databaseName: dbName },
    async () => {
      const roles = await migrateRolesInTenant();
      const users = await migrateUsersInTenant();
      return { skipped: false, roles, users };
    }
  );
}

async function main() {
  const { masterUri } = getMongoUris();
  await mongoose.connect(masterUri);
  await dbConnectionManager.initializeMasterConnection();
  console.log(`[migratePlatformUserTypes] Connected${dryRun ? ' (dry-run)' : ''}`);
  console.log(`[migratePlatformUserTypes] DB: ${mongoose.connection.name}`);

  const tenants = await Organization.find({
    isTenant: true,
    'database.initialized': true,
  })
    .select('_id name database')
    .lean();

  console.log(`[migratePlatformUserTypes] Tenants: ${tenants.length}`);

  let roleUpdated = 0;
  let userUpdated = 0;
  for (const org of tenants) {
    try {
      const result = await migrateTenant(org);
      if (result.skipped) {
        console.log(`  skip ${org.name}: ${result.reason}`);
        continue;
      }
      roleUpdated += result.roles.updated;
      userUpdated += result.users.updated;
      console.log(
        `  ${org.name}: roles ${result.roles.updated}/${result.roles.examined}, users ${result.users.updated}/${result.users.examined}`
      );
    } catch (err) {
      console.error(`  FAIL ${org.name}:`, err.message);
    }
  }

  console.log(`[migratePlatformUserTypes] Done. rolesUpdated=${roleUpdated} usersUpdated=${userUpdated}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migratePlatformUserTypes] Failed', err);
  process.exit(1);
});
