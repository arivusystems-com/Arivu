const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus } = require('../middleware/organizationMiddleware');
const { canManageUsers } = require('../middleware/permissionMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const { sessionBootstrapLimiter } = require('../middleware/rateLimitMiddleware');
const { resendVerification } = require('../controllers/userInviteAuthController');
const {
    getUsers,
    getUsersForAssignment,
    getUser,
    inviteUser,
    previewBulkInvite,
    commitBulkInvite,
    updateUser,
    deactivateUser,
    getUserOwnershipSummary,
    transferUserRecords,
    deleteUser,
    getMyPresence,
    updateMyPresence,
    getOrganizationPresence,
    getProfile,
    updateProfile,
    changePassword,
    resendUserInvite,
    resetUserPassword,
    getAddCapabilities,
    uploadAvatar,
    deleteAvatar
} = require('../controllers/userController');
const { createSettingsAuditMiddleware } = require('../middleware/settingsAuditMiddleware');

// Apply auth and organization middleware to all routes
router.use(protect);
router.use(organizationIsolation);
router.use(checkTrialStatus);
// Profile paths are skipped via SETTINGS_AUDIT_SKIP_PATH_SUBSTRINGS (/profile)
router.use(createSettingsAuditMiddleware({ surface: 'users', entityType: 'User' }));

// --- Profile Routes (any authenticated user, app-agnostic) ---
// Profile routes should be accessible to all authenticated users regardless of app
// These routes do NOT require app context or app entitlement
router.get('/profile', sessionBootstrapLimiter, getProfile);
router.put('/profile', updateProfile);
router.put('/profile/password', changePassword);
router.post('/profile/resend-verification', resendVerification);
router.post('/profile/avatar', uploadSingle('avatar'), uploadAvatar);
router.delete('/profile/avatar', deleteAvatar);

// Presence is self-writable and tenant-readable for requested active users.
router.get('/presence/me', getMyPresence);
router.put('/presence/me', updateMyPresence);
router.get('/presence', getOrganizationPresence);

// --- User Management Routes (Platform-level, app-agnostic) ---
// User management is platform-level, NOT app-specific
// These routes do NOT require app context, app entitlement, or app-specific initialization
// They are accessible from Settings → Users & Access

// --- Public user list for assignments (any authenticated user can see org users) ---
// IMPORTANT: Must be before /:id route to avoid route conflict
// Using exact path matching to ensure "list" doesn't get caught by /:id
router.get('/list', (req, res, next) => {
    // Explicitly handle /list route
    getUsersForAssignment(req, res).catch(next);
});

// --- Add User Capabilities (requires manageUsers permission) ---
router.get('/add-capabilities', canManageUsers(), getAddCapabilities);

// --- Bulk invite (CSV) — must be before /:id ---
router.post('/bulk-invite/preview', canManageUsers(), previewBulkInvite);
router.post('/bulk-invite', canManageUsers(), commitBulkInvite);

// --- User Management Routes (requires manageUsers permission) ---
router.get('/', canManageUsers(), getUsers);
router.post('/', canManageUsers(), inviteUser);

// --- Single User Routes (requires manageUsers permission) ---
// IMPORTANT: Must be after /list route - validate that id is a valid ObjectId
router.get('/:id', canManageUsers(), async (req, res, next) => {
    // Check if id looks like a MongoDB ObjectId (24 hex characters)
    // If not, skip to next route (shouldn't happen as we have /list above, but safety check)
    const { id } = req.params;
    if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid user ID format'
        });
    }
    next();
}, getUser);

router.put('/:id', canManageUsers(), updateUser);
router.post('/:id/deactivate', canManageUsers(), deactivateUser);
router.get('/:id/ownership-summary', canManageUsers(), getUserOwnershipSummary);
router.post('/:id/transfer-records', canManageUsers(), transferUserRecords);
router.post('/:id/resend-invite', canManageUsers(), resendUserInvite);
router.post('/:id/reset-password', canManageUsers(), resetUserPassword);
router.delete('/:id', canManageUsers(), deleteUser);

module.exports = router;

