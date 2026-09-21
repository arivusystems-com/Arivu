'use strict';

const duplicates = require('../services/duplicates');

function getOrgId(req) {
  return req.user?.organizationId;
}

function getUserId(req) {
  return req.user?._id;
}

async function listModules(req, res) {
  try {
    const organizationId = getOrgId(req);
    const configs = await Promise.all(
      duplicates.SUPPORTED_MODULES.map((moduleKey) => duplicates.getConfig(organizationId, moduleKey))
    );
    return res.json({ success: true, data: configs });
  } catch (err) {
    console.error('[duplicates] listModules', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to list duplicate configs',
    });
  }
}

async function getModuleConfig(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!duplicates.isSupportedModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Unsupported module' });
    }
    const config = await duplicates.getConfig(getOrgId(req), moduleKey);
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('[duplicates] getModuleConfig', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed to load config',
    });
  }
}

async function updateModuleConfig(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!duplicates.isSupportedModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Unsupported module' });
    }
    const config = await duplicates.upsertConfig(
      getOrgId(req),
      moduleKey,
      req.body || {},
      getUserId(req)
    );
    return res.json({ success: true, data: config });
  } catch (err) {
    console.error('[duplicates] updateModuleConfig', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      code: err.code,
      message: err.message || 'Failed to save config',
    });
  }
}

async function evaluate(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || req.body.moduleKey || '').toLowerCase();
    if (!duplicates.isSupportedModule(moduleKey)) {
      return res.status(400).json({ success: false, message: 'Unsupported module' });
    }
    const candidate = req.body.candidate || req.body.record || req.body;
    const excludeRecordId = req.body.excludeRecordId || req.body.recordId || null;
    const result = await duplicates.evaluateDuplicates({
      organizationId: getOrgId(req),
      moduleKey,
      candidate,
      excludeRecordId,
      emitEvent: true,
      triggeredBy: getUserId(req),
      limit: Math.min(Number(req.body.limit) || 10, 25),
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[duplicates] evaluate', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Duplicate evaluation failed',
    });
  }
}

async function compare(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!duplicates.isMergeableModule(moduleKey)) {
      return res.status(400).json({
        success: false,
        code: 'MERGE_UNSUPPORTED',
        message: 'Compare/merge is only available for People, Organizations, and Items',
      });
    }
    const { recordIdA, recordIdB } = req.body || {};
    if (!recordIdA || !recordIdB) {
      return res.status(400).json({ success: false, message: 'recordIdA and recordIdB are required' });
    }
    const data = await duplicates.getComparePayload({
      organizationId: getOrgId(req),
      moduleKey,
      recordIdA,
      recordIdB,
    });
    // Do not return full mongo docs to client beyond comparison needs
    return res.json({
      success: true,
      data: {
        recordA: data.recordA,
        recordB: data.recordB,
        comparison: data.comparison,
      },
    });
  } catch (err) {
    console.error('[duplicates] compare', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Compare failed',
    });
  }
}

async function merge(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!duplicates.isMergeableModule(moduleKey)) {
      return res.status(400).json({
        success: false,
        code: 'MERGE_UNSUPPORTED',
        message: 'Merge is only available for People, Organizations, and Items',
      });
    }
    const { masterId, duplicateId, fieldSelections } = req.body || {};
    if (!masterId || !duplicateId) {
      return res.status(400).json({ success: false, message: 'masterId and duplicateId are required' });
    }
    const user = req.user;
    const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User';
    const data = await duplicates.mergeRecords({
      organizationId: getOrgId(req),
      moduleKey,
      masterId,
      duplicateId,
      fieldSelections: fieldSelections || {},
      userId: getUserId(req),
      userName,
    });
    return res.json({ success: true, data });
  } catch (err) {
    console.error('[duplicates] merge', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      code: err.code,
      message: err.message || 'Merge failed',
    });
  }
}

async function notDuplicate(req, res) {
  try {
    const moduleKey = String(req.params.moduleKey || '').toLowerCase();
    if (!duplicates.isMergeableModule(moduleKey)) {
      return res.status(400).json({
        success: false,
        code: 'MERGE_UNSUPPORTED',
        message: 'Not-duplicate marking is only available for People, Organizations, and Items',
      });
    }
    const { recordIdA, recordIdB } = req.body || {};
    const data = await duplicates.markNotDuplicate({
      organizationId: getOrgId(req),
      moduleKey,
      recordIdA,
      recordIdB,
      userId: getUserId(req),
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Failed',
    });
  }
}

module.exports = {
  listModules,
  getModuleConfig,
  updateModuleConfig,
  evaluate,
  compare,
  merge,
  notDuplicate,
};
