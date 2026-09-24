/**
 * Closed Records settings + reopen HTTP handlers.
 */

const closedRecordsService = require('../services/closedRecordsService');
const { listEligibleModules, isEligibleModule } = require('../constants/closedRecordsModules');
const { requireAdmin } = require('../middleware/permissionMiddleware');

function orgId(req) {
  return req.user?.organizationId || req.organizationId || null;
}

function userId(req) {
  return req.user?._id || req.user?.id || null;
}

exports.listModules = async (req, res) => {
  try {
    return res.json({ success: true, data: listEligibleModules() });
  } catch (error) {
    console.error('[closedRecords] listModules', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConfig = async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!isEligibleModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Module not eligible for Closed Records' });
    }
    const config = await closedRecordsService.getOrCreateConfig(moduleKey, {
      organizationId: orgId(req)
    });
    const picklistValues = await closedRecordsService.loadPicklistValues(moduleKey, {
      organizationId: orgId(req)
    });
    return res.json({
      success: true,
      data: {
        config,
        picklistValues,
        statusField: config.statusField,
        statusPicklistKey: config.statusPicklistKey
      }
    });
  } catch (error) {
    console.error('[closedRecords] getConfig', error);
    const status = error.code === 'MODULE_NOT_ELIGIBLE' ? 400 : 500;
    return res.status(status).json({ success: false, message: error.message, code: error.code });
  }
};

exports.getPicklist = async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!isEligibleModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Module not eligible for Closed Records' });
    }
    const picklistValues = await closedRecordsService.loadPicklistValues(moduleKey, {
      organizationId: orgId(req)
    });
    const def = require('../constants/closedRecordsModules').getModuleDef(moduleKey);
    return res.json({
      success: true,
      data: {
        moduleKey,
        statusField: def.statusField,
        statusPicklistKey: def.statusPicklistKey,
        values: picklistValues
      }
    });
  } catch (error) {
    console.error('[closedRecords] getPicklist', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveConfig = async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!isEligibleModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Module not eligible for Closed Records' });
    }
    const config = await closedRecordsService.saveConfig(moduleKey, req.body || {}, {
      organizationId: orgId(req),
      userId: userId(req)
    });
    return res.json({ success: true, data: config });
  } catch (error) {
    console.error('[closedRecords] saveConfig', error);
    const status =
      error.code === 'MODULE_NOT_ELIGIBLE'
        ? 400
        : [
              'CLOSED_STATE_REQUIRED',
              'REOPEN_STATUS_REQUIRED',
              'REOPEN_CANNOT_BE_CLOSED',
              'REOPEN_NOT_IN_PICKLIST',
              'INVALID_CLOSED_STATE'
            ].includes(error.code)
          ? 400
          : 500;
    return res.status(status).json({
      success: false,
      message: error.message,
      code: error.code,
      details: error.details
    });
  }
};

/**
 * Generic reopen for modules with a registered model path.
 * Cases keep a dedicated controller that delegates here.
 */
exports.reopenRecord = async (req, res) => {
  try {
    const moduleKey = String(req.params.moduleKey || req.body?.moduleKey || '').toLowerCase();
    const recordId = req.params.id || req.params.recordId;
    if (!isEligibleModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Module not eligible' });
    }
    const doc = await closedRecordsService.reopenRecord(moduleKey, {
      recordId,
      reason: req.body?.reason || req.body?.reopenReason || null,
      organizationId: orgId(req),
      userId: userId(req),
      appKey: req.appKey || req.headers['x-app-key'] || null
    });
    return res.json({ success: true, data: doc });
  } catch (error) {
    console.error('[closedRecords] reopenRecord', error);
    const map = {
      NOT_FOUND: 404,
      NOT_CLOSED: 400,
      REOPEN_DISABLED: 400,
      REOPEN_STATUS_MISSING: 400,
      REOPEN_CANNOT_BE_CLOSED: 400,
      MODEL_MISSING: 400,
      MODULE_NOT_ELIGIBLE: 400
    };
    return res.status(map[error.code] || 500).json({
      success: false,
      message: error.message,
      code: error.code
    });
  }
};

exports.requireConfigureClosedRecords = requireAdmin();
