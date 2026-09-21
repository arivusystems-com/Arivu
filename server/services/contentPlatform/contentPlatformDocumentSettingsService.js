'use strict';

const ContentTemplate = require('../../models/ContentTemplate');
const { MODULE_DOCUMENT_CONFIG } = require('../../constants/contentPlatformIntegration');
const {
  CONTENT_PLATFORM_ERROR_CODES,
  ContentPlatformError
} = require('../../utils/contentPlatformErrors');
const { writeContentAuditLog } = require('./contentPlatformEventService');

const SUPPORTED_MODULE_KEYS = new Set(
  Object.keys(MODULE_DOCUMENT_CONFIG).filter((key) => key !== 'billing_invoices')
);

function notDeletedFilter() {
  return { deletedAt: null };
}

/**
 * @param {string} moduleKey
 */
function assertSupportedModuleKey(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  if (!SUPPORTED_MODULE_KEYS.has(key)) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      `Unsupported module key: ${moduleKey}`,
      { statusCode: 400 }
    );
  }
  return key;
}

/**
 * @param {object} template
 */
function formatTemplateOption(template) {
  if (!template) return null;
  return {
    id: String(template._id),
    name: String(template.name || ''),
    status: String(template.status || ''),
    latestPublishedVersion: Number(template.latestPublishedVersion) || 0,
    isDefault: template.isDefault === true
  };
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleScope
 * @param {string} params.purpose
 * @param {string | null} [params.exceptTemplateId]
 */
async function clearModuleDefaultTemplates({ organizationId, moduleScope, purpose, exceptTemplateId = null }) {
  // One default per module (print/pdf). Purpose kept for listing filters only.
  void purpose;
  const filter = {
    organizationId,
    moduleScope,
    outputFormat: 'pdf',
    isDefault: true,
    ...notDeletedFilter()
  };
  if (exceptTemplateId) {
    filter._id = { $ne: exceptTemplateId };
  }
  await ContentTemplate.updateMany(filter, { $set: { isDefault: false } });
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleKey
 */
async function getModuleDocumentTemplateSettings({ organizationId, moduleKey }) {
  const key = assertSupportedModuleKey(moduleKey);
  const config = MODULE_DOCUMENT_CONFIG[key];

  const [defaultTemplate, publishedTemplates] = await Promise.all([
    ContentTemplate.findOne({
      organizationId,
      moduleScope: config.moduleScope,
      outputFormat: 'pdf',
      isDefault: true,
      ...notDeletedFilter()
    })
      .select('name status latestPublishedVersion isDefault')
      .lean(),
    ContentTemplate.find({
      organizationId,
      moduleScope: config.moduleScope,
      purpose: config.purpose,
      status: 'published',
      ...notDeletedFilter()
    })
      .sort({ isDefault: -1, name: 1, updatedAt: -1 })
      .select('name status latestPublishedVersion isDefault')
      .lean()
  ]);

  return {
    moduleKey: key,
    moduleScope: config.moduleScope,
    purpose: config.purpose,
    defaultTemplateId: defaultTemplate?._id ? String(defaultTemplate._id) : null,
    defaultTemplate: formatTemplateOption(defaultTemplate),
    templates: publishedTemplates.map(formatTemplateOption)
  };
}

/**
 * @param {object} params
 * @param {string} params.organizationId
 * @param {string} params.moduleKey
 * @param {string | null} params.templateId
 * @param {string | null} [params.userId]
 * @param {string | null} [params.ipAddress]
 */
async function setModuleDefaultTemplate({
  organizationId,
  moduleKey,
  templateId,
  userId = null,
  ipAddress = null
}) {
  const key = assertSupportedModuleKey(moduleKey);
  const config = MODULE_DOCUMENT_CONFIG[key];
  const normalizedTemplateId = String(templateId || '').trim();

  if (!normalizedTemplateId) {
    await clearModuleDefaultTemplates({
      organizationId,
      moduleScope: config.moduleScope,
      purpose: config.purpose
    });

    await writeContentAuditLog({
      organizationId,
      action: 'module_document.default_template_cleared',
      entityType: 'content_template',
      entityId: organizationId,
      userId,
      ipAddress,
      details: { moduleKey: key, moduleScope: config.moduleScope, purpose: config.purpose }
    });

    return getModuleDocumentTemplateSettings({ organizationId, moduleKey: key });
  }

  const template = await ContentTemplate.findOne({
    _id: normalizedTemplateId,
    organizationId,
    moduleScope: config.moduleScope,
    purpose: config.purpose,
    status: 'published',
    ...notDeletedFilter()
  });

  if (!template) {
    throw new ContentPlatformError(
      CONTENT_PLATFORM_ERROR_CODES.VALIDATION_FAILED,
      'Published template not found for this module',
      { statusCode: 400 }
    );
  }

  await clearModuleDefaultTemplates({
    organizationId,
    moduleScope: config.moduleScope,
    purpose: config.purpose,
    exceptTemplateId: template._id
  });

  template.isDefault = true;
  template.modifiedBy = userId;
  await template.save();

  await writeContentAuditLog({
    organizationId,
    action: 'module_document.default_template_set',
    entityType: 'content_template',
    entityId: template._id,
    userId,
    ipAddress,
    details: {
      moduleKey: key,
      moduleScope: config.moduleScope,
      purpose: config.purpose,
      templateId: String(template._id),
      templateName: template.name
    }
  });

  return getModuleDocumentTemplateSettings({ organizationId, moduleKey: key });
}

module.exports = {
  SUPPORTED_MODULE_KEYS,
  assertSupportedModuleKey,
  formatTemplateOption,
  clearModuleDefaultTemplates,
  getModuleDocumentTemplateSettings,
  setModuleDefaultTemplate
};
