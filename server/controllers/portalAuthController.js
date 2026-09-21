'use strict';

const Organization = require('../models/Organization');
const User = require('../models/User');
const {
  buildAuthenticatedSessionResponse
} = require('../services/authSessionService');
const {
  isExternalUser,
  resolveExternalLoginSession,
  hydrateExternalUserSession,
  assertExternalRoleSelectable,
  getActiveExternalPortalRoles,
  recordPortalSessionEvent
} = require('../services/externalRoleSessionService');
const { getScopedUserModel } = require('../services/userInviteService');

function reqMeta(req) {
  return {
    ip: req.ip || null,
    userAgent: req.get('user-agent') || null
  };
}

function existingSessionIds(reqUser) {
  if (reqUser._sessionJti) {
    return {
      jti: reqUser._sessionJti,
      sessionVersion: reqUser._authSessionVersion ?? reqUser.authSessionVersion ?? 0
    };
  }
  return null;
}

function sessionBuildOptions(reqUser, req) {
  const sessionIds = existingSessionIds(reqUser);
  return {
    sessionMeta: reqMeta(req),
    sessionIds,
    issueSession: !sessionIds
  };
}

async function loadOrganizationForUser(user) {
  return Organization.findById(user.organizationId)
    .select('name industry subscription limits enabledApps enabledModules settings isActive database security')
    .lean();
}

async function reloadUserDocument(reqUser) {
  const organization = await loadOrganizationForUser(reqUser);
  const ScopedUser = await getScopedUserModel(organization);
  const user = await ScopedUser.findById(reqUser._id);
  if (!user) {
    return { user: null, organization };
  }
  if (!user.organizationId) {
    user.organizationId = reqUser.organizationId;
  }
  user.activeExternalRoleId = reqUser.activeExternalRoleId || null;
  return { user, organization };
}

function handleError(res, error, fallbackStatus = 500) {
  const status = error.status || fallbackStatus;
  return res.status(status).json({
    success: false,
    code: error.code || 'PORTAL_SESSION_ERROR',
    message: error.message || 'Portal session operation failed'
  });
}

exports.selectPortal = async (req, res) => {
  try {
    if (!isExternalUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'NOT_EXTERNAL_USER',
        message: 'Portal selection is only available for external users'
      });
    }

    const roleId = req.body?.roleId;
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: 'PORTAL_ROLE_REQUIRED',
        message: 'roleId is required'
      });
    }

    const { user, organization } = await reloadUserDocument(req.user);
    if (!user || !organization) {
      return res.status(404).json({ success: false, message: 'User or organization not found' });
    }

    const selectable = await assertExternalRoleSelectable(user, roleId, organization);
    if (!selectable.ok) {
      return handleError(res, selectable, selectable.status || 403);
    }

    const hydration = await hydrateExternalUserSession(user, roleId, organization);
    if (!hydration.ok) {
      return handleError(res, hydration, 403);
    }

    const activePortal = selectable.portals.find((p) => String(p.roleId) === String(roleId));

    await recordPortalSessionEvent({
      type: 'portal_selected',
      user,
      organizationId: organization._id,
      roleId,
      reqMeta: reqMeta(req),
      description: `Portal selected: ${activePortal?.name || roleId}`
    });

    const payload = await buildAuthenticatedSessionResponse(user, organization, {
      activeExternalRoleId: roleId,
      requiresPortalSelection: false,
      portals: selectable.portals,
      activePortal,
      ...sessionBuildOptions(req.user, req)
    });

    return res.json({ success: true, ...payload });
  } catch (error) {
    console.error('[portalAuth] selectPortal error:', error);
    return res.status(500).json({ success: false, message: 'Server error during portal selection' });
  }
};

exports.switchPortal = async (req, res) => {
  try {
    if (!isExternalUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'NOT_EXTERNAL_USER',
        message: 'Portal switching is only available for external users'
      });
    }

    const roleId = req.body?.roleId;
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: 'PORTAL_ROLE_REQUIRED',
        message: 'roleId is required'
      });
    }

    if (req.user.activeExternalRoleId && String(req.user.activeExternalRoleId) === String(roleId)) {
      const { user, organization } = await reloadUserDocument(req.user);
      const portals = await getActiveExternalPortalRoles(user);
      const activePortal = portals.find((p) => String(p.roleId) === String(roleId));
      const payload = await buildAuthenticatedSessionResponse(user, organization, {
        activeExternalRoleId: roleId,
        portals,
        activePortal,
        ...sessionBuildOptions(req.user, req)
      });
      return res.json({ success: true, ...payload });
    }

    const { user, organization } = await reloadUserDocument(req.user);
    if (!user || !organization) {
      return res.status(404).json({ success: false, message: 'User or organization not found' });
    }

    const selectable = await assertExternalRoleSelectable(user, roleId, organization);
    if (!selectable.ok) {
      return handleError(res, selectable, selectable.status || 403);
    }

    const hydration = await hydrateExternalUserSession(user, roleId, organization);
    if (!hydration.ok) {
      return handleError(res, hydration, 403);
    }

    const activePortal = selectable.portals.find((p) => String(p.roleId) === String(roleId));

    await recordPortalSessionEvent({
      type: 'portal_switched',
      user,
      organizationId: organization._id,
      roleId,
      reqMeta: reqMeta(req),
      description: `Portal switched: ${activePortal?.name || roleId}`
    });

    const payload = await buildAuthenticatedSessionResponse(user, organization, {
      activeExternalRoleId: roleId,
      requiresPortalSelection: false,
      portals: selectable.portals,
      activePortal,
      ...sessionBuildOptions(req.user, req)
    });

    return res.json({ success: true, ...payload });
  } catch (error) {
    console.error('[portalAuth] switchPortal error:', error);
    return res.status(500).json({ success: false, message: 'Server error during portal switch' });
  }
};

exports.setDefaultExternalRole = async (req, res) => {
  try {
    if (!isExternalUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'NOT_EXTERNAL_USER',
        message: 'Only external users may set a default portal'
      });
    }

    const roleId = req.body?.roleId;
    if (!roleId) {
      return res.status(400).json({
        success: false,
        code: 'PORTAL_ROLE_REQUIRED',
        message: 'roleId is required'
      });
    }

    const { user, organization } = await reloadUserDocument(req.user);
    if (!user || !organization) {
      return res.status(404).json({ success: false, message: 'User or organization not found' });
    }

    const selectable = await assertExternalRoleSelectable(user, roleId, organization);
    if (!selectable.ok) {
      return handleError(res, selectable, selectable.status || 403);
    }

    user.defaultExternalRoleId = roleId;
    await user.save();

    if (user !== User) {
      await User.findByIdAndUpdate(user._id, { $set: { defaultExternalRoleId: roleId } }).catch(() => {});
    }

    return res.json({
      success: true,
      defaultExternalRoleId: roleId
    });
  } catch (error) {
    console.error('[portalAuth] setDefaultExternalRole error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating default portal' });
  }
};

exports.listPortals = async (req, res) => {
  try {
    if (!isExternalUser(req.user)) {
      return res.status(403).json({
        success: false,
        code: 'NOT_EXTERNAL_USER',
        message: 'Only external users have portal roles'
      });
    }

    const { user, organization } = await reloadUserDocument(req.user);
    const session = await resolveExternalLoginSession(user, organization);
    if (!session.ok) {
      return handleError(res, session, session.status || 403);
    }

    return res.json({
      success: true,
      portals: session.portals,
      activeExternalRoleId: session.activeExternalRoleId || req.user.activeExternalRoleId || null,
      defaultExternalRoleId: user.defaultExternalRoleId || null,
      requiresPortalSelection: session.requiresPortalSelection === true,
    });
  } catch (error) {
    console.error('[portalAuth] listPortals error:', error);
    return res.status(500).json({ success: false, message: 'Server error listing portals' });
  }
};
