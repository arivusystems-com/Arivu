const AnalyticsReport = require('../models/AnalyticsReport');
const AnalyticsWidget = require('../models/AnalyticsWidget');
const AnalyticsDashboard = require('../models/AnalyticsDashboard');
const AnalyticsExecution = require('../models/AnalyticsExecution');
const AnalyticsFavorite = require('../models/AnalyticsFavorite');
const AnalyticsFolder = require('../models/AnalyticsFolder');
const Organization = require('../models/Organization');
const { invalidateReportCache } = require('../services/analytics/analyticsCacheService');
const {
  buildReportListVisibilityFilter,
  userBypassesReportSharing,
} = require('../services/analytics/analyticsReportAccessService');

const ANALYTICS_SETTINGS_DEFAULTS = Object.freeze({
  cacheTtlSeconds: 300,
  exportRowLimit: 10000,
  fiscalYearStartMonth: 1,
  defaultDatePreset: 'last30days',
});

const ASSET_MODELS = Object.freeze({
  report: AnalyticsReport,
  widget: AnalyticsWidget,
  dashboard: AnalyticsDashboard,
});

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mapRecentAsset(doc, assetType, activityAtField = 'updatedAt') {
  if (!doc) return null;
  const activityAt = doc[activityAtField] || doc.updatedAt || doc.createdAt;
  return {
    assetType,
    _id: doc._id,
    name: doc.name,
    apiName: doc.apiName,
    status: doc.status,
    activityAt,
  };
}

async function resolveFavoriteItems(organizationId, userId) {
  const favorites = await AnalyticsFavorite.find({ organizationId, userId })
    .sort({ updatedAt: -1 })
    .limit(12)
    .lean();

  if (!favorites.length) return [];

  const byType = { report: [], widget: [], dashboard: [] };
  for (const fav of favorites) {
    if (byType[fav.assetType]) byType[fav.assetType].push(fav.assetId);
  }

  const [reports, widgets, dashboards] = await Promise.all([
    byType.report.length
      ? AnalyticsReport.find({
          _id: { $in: byType.report },
          organizationId,
          status: { $ne: 'archived' },
        })
          .select('name apiName status updatedAt')
          .lean()
      : [],
    byType.widget.length
      ? AnalyticsWidget.find({
          _id: { $in: byType.widget },
          organizationId,
          status: { $ne: 'archived' },
        })
          .select('name apiName status updatedAt')
          .lean()
      : [],
    byType.dashboard.length
      ? AnalyticsDashboard.find({
          _id: { $in: byType.dashboard },
          organizationId,
          status: { $ne: 'archived' },
        })
          .select('name apiName status updatedAt')
          .lean()
      : [],
  ]);

  const docMap = new Map();
  for (const doc of reports) docMap.set(`report:${doc._id}`, doc);
  for (const doc of widgets) docMap.set(`widget:${doc._id}`, doc);
  for (const doc of dashboards) docMap.set(`dashboard:${doc._id}`, doc);

  return favorites
    .map((fav) => {
      const doc = docMap.get(`${fav.assetType}:${String(fav.assetId)}`);
      if (!doc) return null;
      return {
        assetType: fav.assetType,
        _id: doc._id,
        name: doc.name,
        apiName: doc.apiName,
        status: doc.status,
        activityAt: doc.updatedAt,
        favoritedAt: fav.updatedAt,
      };
    })
    .filter(Boolean);
}

async function getAnalyticsHome(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const baseFilter = { organizationId, status: { $ne: 'archived' } };
    const weekStart = startOfWeek();
    const userId = req.user._id;

    const reportVisibility =
      userBypassesReportSharing(req.user)
        ? baseFilter
        : { $and: [baseFilter, await buildReportListVisibilityFilter(req.user, organizationId)] };

    const listedInHomeFilter = {
      $or: [
        { ownerId: userId },
        { createdBy: userId },
        { listedInHome: { $ne: false } },
        { listedInHome: { $exists: false } },
      ],
    };

    const reportFilter = { $and: [reportVisibility, listedInHomeFilter] };

    const [
      reportCount,
      widgetCount,
      dashboardCount,
      folderCount,
      executionsThisWeek,
      recentReports,
      recentWidgets,
      recentDashboards,
      favorites,
    ] = await Promise.all([
      AnalyticsReport.countDocuments(reportFilter),
      AnalyticsWidget.countDocuments(baseFilter),
      AnalyticsDashboard.countDocuments(baseFilter),
      AnalyticsFolder.countDocuments({ organizationId }),
      AnalyticsExecution.countDocuments({
        organizationId,
        status: 'success',
        preview: { $ne: true },
        createdAt: { $gte: weekStart },
      }),
      AnalyticsReport.find(reportFilter)
        .sort({ lastExecutedAt: -1, updatedAt: -1 })
        .limit(5)
        .select('name apiName status lastExecutedAt updatedAt')
        .lean(),
      AnalyticsWidget.find(baseFilter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('name apiName status chartType updatedAt')
        .lean(),
      AnalyticsDashboard.find(baseFilter)
        .sort({ lastViewedAt: -1, updatedAt: -1 })
        .limit(5)
        .select('name apiName status category lastViewedAt updatedAt')
        .lean(),
      resolveFavoriteItems(organizationId, req.user._id),
    ]);

    const recent = [
      ...recentReports.map((doc) =>
        mapRecentAsset(doc, 'report', doc.lastExecutedAt ? 'lastExecutedAt' : 'updatedAt')
      ),
      ...recentWidgets.map((doc) => mapRecentAsset(doc, 'widget')),
      ...recentDashboards.map((doc) =>
        mapRecentAsset(doc, 'dashboard', doc.lastViewedAt ? 'lastViewedAt' : 'updatedAt')
      ),
    ]
      .filter(Boolean)
      .sort((a, b) => new Date(b.activityAt).getTime() - new Date(a.activityAt).getTime())
      .slice(0, 8);

    return res.json({
      success: true,
      data: {
        kpiStrip: {
          reports: reportCount,
          widgets: widgetCount,
          dashboards: dashboardCount,
          folders: folderCount,
          executionsThisWeek,
        },
        recent,
        favorites,
      },
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics home');
  }
}

async function searchAnalyticsAssets(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const baseAssetFilter = {
      organizationId,
      status: { $ne: 'archived' },
      $or: [{ name: regex }, { apiName: regex }, { tags: regex }],
    };

    const reportVisibility =
      userBypassesReportSharing(req.user)
        ? baseAssetFilter
        : {
            $and: [
              baseAssetFilter,
              await buildReportListVisibilityFilter(req.user, organizationId),
            ],
          };

    const [reports, widgets, dashboards] = await Promise.all([
      AnalyticsReport.find(reportVisibility)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('name apiName status type primaryModule updatedAt')
        .lean(),
      AnalyticsWidget.find(baseAssetFilter)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('name apiName status chartType updatedAt')
        .lean(),
      AnalyticsDashboard.find(baseAssetFilter)
        .sort({ updatedAt: -1 })
        .limit(limit)
        .select('name apiName status category updatedAt')
        .lean(),
    ]);

    const results = [
      ...reports.map((doc) => ({ assetType: 'report', ...doc })),
      ...widgets.map((doc) => ({ assetType: 'widget', ...doc })),
      ...dashboards.map((doc) => ({ assetType: 'dashboard', ...doc })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit);

    return res.json({ success: true, data: results });
  } catch (error) {
    return handleError(res, error, 'Error searching analytics assets');
  }
}

async function listFavorites(req, res) {
  try {
    const data = await resolveFavoriteItems(req.user.organizationId, req.user._id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics favorites');
  }
}

async function addFavorite(req, res) {
  try {
    const assetType = String(req.body?.assetType || '').trim();
    const assetId = req.body?.assetId;
    const Model = ASSET_MODELS[assetType];
    if (!Model || !assetId) {
      return res.status(400).json({ success: false, message: 'assetType and assetId are required' });
    }

    const asset = await Model.findOne({
      _id: assetId,
      organizationId: req.user.organizationId,
      status: { $ne: 'archived' },
    })
      .select('_id name')
      .lean();

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    const favorite = await AnalyticsFavorite.findOneAndUpdate(
      {
        organizationId: req.user.organizationId,
        userId: req.user._id,
        assetType,
        assetId,
      },
      {},
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    return handleError(res, error, 'Error adding analytics favorite');
  }
}

async function removeFavorite(req, res) {
  try {
    const assetType = String(req.params.assetType || '').trim();
    const assetId = req.params.assetId;
    await AnalyticsFavorite.deleteOne({
      organizationId: req.user.organizationId,
      userId: req.user._id,
      assetType,
      assetId,
    });
    return res.json({ success: true, message: 'Favorite removed' });
  } catch (error) {
    return handleError(res, error, 'Error removing analytics favorite');
  }
}

async function listFolders(req, res) {
  try {
    const folders = await AnalyticsFolder.find({ organizationId: req.user.organizationId })
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, data: folders });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics folders');
  }
}

async function createFolder(req, res) {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      return res.status(400).json({ success: false, message: 'name is required' });
    }

    const folder = await AnalyticsFolder.create({
      organizationId: req.user.organizationId,
      name,
      description: req.body?.description || null,
      ownerId: req.user._id,
      createdBy: req.user._id,
    });

    return res.status(201).json({ success: true, data: folder });
  } catch (error) {
    return handleError(res, error, 'Error creating analytics folder');
  }
}

async function updateFolder(req, res) {
  try {
    const folder = await AnalyticsFolder.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    if (req.body?.name) folder.name = String(req.body.name).trim();
    if (req.body?.description !== undefined) folder.description = req.body.description;
    folder.updatedBy = req.user._id;
    await folder.save();

    return res.json({ success: true, data: folder });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics folder');
  }
}

async function deleteFolder(req, res) {
  try {
    const folder = await AnalyticsFolder.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
    });

    if (!folder) {
      return res.status(404).json({ success: false, message: 'Folder not found' });
    }

    await Promise.all([
      AnalyticsReport.updateMany(
        { organizationId: req.user.organizationId, folderId: folder._id },
        { $set: { folderId: null } }
      ),
      AnalyticsWidget.updateMany(
        { organizationId: req.user.organizationId, folderId: folder._id },
        { $set: { folderId: null } }
      ),
      AnalyticsDashboard.updateMany(
        { organizationId: req.user.organizationId, folderId: folder._id },
        { $set: { folderId: null } }
      ),
    ]);

    await folder.deleteOne();
    return res.json({ success: true, message: 'Folder deleted' });
  } catch (error) {
    return handleError(res, error, 'Error deleting analytics folder');
  }
}

async function listTrash(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const filter = { organizationId, status: 'archived' };
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const [reports, widgets, dashboards] = await Promise.all([
      AnalyticsReport.find(filter).sort({ archivedAt: -1 }).limit(limit).lean(),
      AnalyticsWidget.find(filter).sort({ archivedAt: -1 }).limit(limit).lean(),
      AnalyticsDashboard.find(filter).sort({ archivedAt: -1 }).limit(limit).lean(),
    ]);

    const items = [
      ...reports.map((doc) => ({
        assetType: 'report',
        _id: doc._id,
        name: doc.name,
        apiName: doc.apiName,
        archivedAt: doc.archivedAt,
      })),
      ...widgets.map((doc) => ({
        assetType: 'widget',
        _id: doc._id,
        name: doc.name,
        apiName: doc.apiName,
        archivedAt: doc.archivedAt,
      })),
      ...dashboards.map((doc) => ({
        assetType: 'dashboard',
        _id: doc._id,
        name: doc.name,
        apiName: doc.apiName,
        archivedAt: doc.archivedAt,
      })),
    ].sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());

    return res.json({ success: true, data: items });
  } catch (error) {
    return handleError(res, error, 'Error listing analytics trash');
  }
}

async function restoreTrashItem(req, res) {
  try {
    const assetType = String(req.params.assetType || '').trim();
    const assetId = req.params.id;
    const Model = ASSET_MODELS[assetType];
    if (!Model) {
      return res.status(400).json({ success: false, message: 'Invalid assetType' });
    }

    const asset = await Model.findOne({
      _id: assetId,
      organizationId: req.user.organizationId,
      status: 'archived',
    });

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Archived asset not found' });
    }

    asset.status = 'draft';
    asset.archivedAt = null;
    asset.updatedBy = req.user._id;
    await asset.save();

    if (assetType === 'report') {
      await invalidateReportCache(req.user.organizationId, asset._id);
    }

    return res.json({ success: true, data: asset });
  } catch (error) {
    return handleError(res, error, 'Error restoring analytics asset');
  }
}

function mergeAnalyticsSettings(orgSettings = {}) {
  const analytics = orgSettings.analytics && typeof orgSettings.analytics === 'object'
    ? orgSettings.analytics
    : {};
  const { resolveFiscalYearStartMonth } = require('../utils/fiscalYear');
  const merged = { ...ANALYTICS_SETTINGS_DEFAULTS, ...analytics };
  merged.fiscalYearStartMonth = resolveFiscalYearStartMonth({ settings: orgSettings });
  return merged;
}

async function getAnalyticsSettings(req, res) {
  try {
    const org = await Organization.findById(req.user.organizationId).select('settings').lean();
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }
    return res.json({
      success: true,
      data: mergeAnalyticsSettings(org.settings),
    });
  } catch (error) {
    return handleError(res, error, 'Error fetching analytics settings');
  }
}

async function updateAnalyticsSettings(req, res) {
  try {
    const { applyFiscalYearStartMonth, clampMonth } = require('../utils/fiscalYear');
    const org = await Organization.findById(req.user.organizationId);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organization not found' });
    }

    const current = mergeAnalyticsSettings(org.settings);
    const nextFy = clampMonth(
      req.body?.fiscalYearStartMonth ?? current.fiscalYearStartMonth,
      current.fiscalYearStartMonth
    );
    const next = {
      cacheTtlSeconds: Number(req.body?.cacheTtlSeconds ?? current.cacheTtlSeconds),
      exportRowLimit: Number(req.body?.exportRowLimit ?? current.exportRowLimit),
      fiscalYearStartMonth: nextFy,
      defaultDatePreset: String(req.body?.defaultDatePreset ?? current.defaultDatePreset),
    };

    org.settings = org.settings || {};
    org.settings.analytics = next;
    applyFiscalYearStartMonth(org, nextFy);
    org.markModified('settings');
    await org.save();

    return res.json({ success: true, data: next });
  } catch (error) {
    return handleError(res, error, 'Error updating analytics settings');
  }
}

module.exports = {
  getAnalyticsHome,
  searchAnalyticsAssets,
  listFavorites,
  addFavorite,
  removeFavorite,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  listTrash,
  restoreTrashItem,
  getAnalyticsSettings,
  updateAnalyticsSettings,
};
