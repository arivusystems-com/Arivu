'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');
const controller = require('../controllers/duplicatePreventionController');

router.use(protect);

router.get('/', checkPermission('settings', 'view'), controller.listModules);
router.get('/:moduleKey', checkPermission('settings', 'view'), controller.getModuleConfig);
router.put('/:moduleKey', checkPermission('settings', 'edit'), controller.updateModuleConfig);

router.post('/:moduleKey/evaluate', controller.evaluate);
router.post('/:moduleKey/compare', controller.compare);
router.post('/:moduleKey/merge', checkPermission('settings', 'edit'), controller.merge);
router.post('/:moduleKey/not-duplicate', controller.notDuplicate);

module.exports = router;
