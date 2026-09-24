const express = require('express');
const { 
    createDeal, 
    getDeals,
    getDealsListMeta,
    getDealRecordMeta,
    getDealById, 
    updateDeal, 
    updateDealTags,
    deleteDeal,
    addNote,
    updateDealNote,
    getActivityLogs,
    addActivityLog,
    getDashboardMetrics,
    getPipelineSummary,
    getPlaybookAnalytics,
    updateStage,
    reopenDeal,
    updatePlaybookActionStatus,
    getDescriptionVersions,
    restoreDescriptionVersion,
    getDealComments,
    createDealComment,
    updateDealComment,
    toggleDealCommentReaction,
    deleteDealComment,
    uploadDealCommentAttachment
} = require('../controllers/dealController');
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation, checkTrialStatus, checkFeatureAccess } = require('../middleware/organizationMiddleware');
const { checkPermission, applySharingFilter } = require('../middleware/permissionMiddleware');
const { resolveAppContext } = require('../middleware/resolveAppContextMiddleware');
const { requireAppEntitlement } = require('../middleware/requireAppEntitlementMiddleware');
const { lazySalesInitialization } = require('../middleware/lazySalesInitializationMiddleware');
const { requireSalesApp } = require('../middleware/requireSalesAppMiddleware');
const { uploadSingle } = require('../middleware/uploadMiddleware');
const {
    getDealLines,
    addDealLine,
    patchDealLine,
    deleteDealLine,
    reorderDealLines,
    patchDealAmountMode,
    recalculateDealLines
} = require('../controllers/dealLineController');

const router = express.Router();

// Apply middleware to all routes
router.use(protect);
router.use(resolveAppContext); // After auth, resolve appKey from URL
router.use(requireAppEntitlement); // Check user's app entitlements
router.use(lazySalesInitialization); // Lazy initialize CRM if needed
router.use(requireSalesApp); // Enforce Sales-only access
router.use(organizationIsolation);
router.use(checkTrialStatus);
router.use(checkFeatureAccess('deals'));

// Pipeline summary (must come before /:id routes)
router.get('/dashboard/metrics', checkPermission('deals', 'view'), getDashboardMetrics);
router.get('/pipeline/summary', checkPermission('deals', 'view'), getPipelineSummary);
router.get('/playbooks/analytics', checkPermission('deals', 'view'), getPlaybookAnalytics);

router.get('/meta', applySharingFilter('deals'), checkPermission('deals', 'view'), getDealsListMeta);

// Routes that handle collections (GET all, POST new)
router.route('/')
    .get(applySharingFilter('deals'), checkPermission('deals', 'view'), getDeals)
    .post(checkPermission('deals', 'create'), createDeal);

// Routes that handle single resources (GET by ID, PUT, DELETE)
router.route('/:id')
    .get(checkPermission('deals', 'view'), getDealById)
    .put(checkPermission('deals', 'edit'), updateDeal)
    .delete(checkPermission('deals', 'delete'), deleteDeal);
router.put('/:id/tags', checkPermission('deals', 'edit'), updateDealTags);
router.patch('/:id/tags', checkPermission('deals', 'edit'), updateDealTags);

// Deal lines (commercial intent aggregate) — permissions inherit from deals
router.get('/:id/lines', checkPermission('deals', 'view'), getDealLines);
router.post('/:id/lines', checkPermission('deals', 'edit'), addDealLine);
router.patch('/:id/lines/reorder', checkPermission('deals', 'edit'), reorderDealLines);
router.post('/:id/lines/recalculate', checkPermission('deals', 'edit'), recalculateDealLines);
router.patch('/:id/lines/:lineId', checkPermission('deals', 'edit'), patchDealLine);
router.delete('/:id/lines/:lineId', checkPermission('deals', 'edit'), deleteDealLine);
router.patch('/:id/amount-mode', checkPermission('deals', 'edit'), patchDealAmountMode);

// Update deal stage
router.patch('/:id/stage', checkPermission('deals', 'edit'), updateStage);
router.post('/:id/reopen', checkPermission('deals', 'edit'), reopenDeal);

// Update playbook action completion
router.patch('/:id/playbook-state/actions/:actionKey', checkPermission('deals', 'edit'), updatePlaybookActionStatus);

// Legacy notes (kept for backward compatibility)
router.post('/:id/notes', checkPermission('deals', 'edit'), addNote);
router.put('/:id/notes/:noteId', checkPermission('deals', 'edit'), updateDealNote);

// Activity logs
router.get('/:id/meta', checkPermission('deals', 'view'), getDealRecordMeta);
router.get('/:id/activity-logs', checkPermission('deals', 'view'), getActivityLogs);
router.post('/:id/activity-logs', checkPermission('deals', 'edit'), addActivityLog);
router.get('/:id/description-versions', checkPermission('deals', 'view'), getDescriptionVersions);
router.post('/:id/description-versions/restore', checkPermission('deals', 'edit'), restoreDescriptionVersion);

// Deal comments (new collection-based system with threading, reactions, attachments)
router.get('/:id/comments', checkPermission('deals', 'view'), getDealComments);
router.post('/:id/comment-attachments', checkPermission('deals', 'edit'), uploadSingle('file'), uploadDealCommentAttachment);
router.post('/:id/comments', checkPermission('deals', 'edit'), createDealComment);
router.put('/:id/comments/:commentId', checkPermission('deals', 'edit'), updateDealComment);
router.post('/:id/comments/:commentId/reactions', checkPermission('deals', 'edit'), toggleDealCommentReaction);
router.delete('/:id/comments/:commentId', checkPermission('deals', 'edit'), deleteDealComment);

module.exports = router;

