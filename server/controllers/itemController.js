const Item = require('../models/Item');
const ItemVariant = require('../models/ItemVariant');
const mongoose = require('mongoose');
const {
    CATALOG_LIFECYCLE_DEFAULT,
    CATALOG_LIFECYCLE_STATES,
    canTransitionCatalogLifecycle,
    inferLifecycleStateFromLegacyStatus,
    isCatalogLifecycleState,
    syncLegacyItemStatusFromLifecycle
} = require('../constants/catalogLifecycle');
const {
  sortMediaEntries,
  seedMediaFromProductImage
} = require('../services/itemMediaService');
const {
  ensureDefaultVariant,
  listItemVariants
} = require('../services/itemVariantService');
const { applyCatalogFieldsToPayload } = require('../services/catalogItemIntegration');
const { listAttributeTemplates } = require('../services/catalogAttributeTemplateService');
const { getCategoryById } = require('../services/catalogCategoryService');
const { applyFlatCompatShimForList, applyFlatCompatShimForDetail } = require('../constants/catalogFieldOwnership');
const {
  applyVariantWriteAfterItemSave,
  applyVariantWriteOnItemUpdate,
  setCatalogApiVersionHeader
} = require('../services/catalogVariantWriteService');
const { syncDefaultVariantLifecycleFromItem } = require('../services/itemVariantService');

async function enrichItemCatalogPayload(item, userId) {
  if (!item) return null;
  await seedMediaFromProductImage(item, userId);
  await ensureDefaultVariant(item, userId);
  const variants = await listItemVariants(item._id, item.organizationId);
  const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
  const data = flattenCustomFieldsForResponse(item);
  data.media = sortMediaEntries(item.media || []);
  data.variants = variants;
  data.defaultVariant = variants.find((v) => v.is_default) || variants[0] || null;

  if (data.categoryId) {
    data.catalogCategory = await getCategoryById(data.categoryId, item.organizationId);
    data.attributeTemplates = await listAttributeTemplates(data.categoryId, item.organizationId);
  } else {
    data.catalogCategory = null;
    data.attributeTemplates = [];
  }

  return applyFlatCompatShimForDetail(data, data.defaultVariant);
}

// @desc    Create new item
// @route   POST /api/items
// @access  Private
exports.createItem = async (req, res) => {
    try {
        const { stripClientSource, assignResolvedSource } = require('../services/sourceResolver');
        stripClientSource(req.body);
        const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const { standardPayload, customFieldsSet } = extractCustomFields(req.body, Item);

        const payload = {
            ...standardPayload,
            organizationId: req.user.organizationId,
            createdBy: req.user._id,
            modifiedBy: req.user._id,
            assignedTo: standardPayload.assignedTo || req.user._id,
            ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet })
        };
        assignResolvedSource(payload, 'ui');

        // Item Code is system-generated via Module Numbering — never accept client value
        delete payload.item_code;
        delete payload.item_id;

        // Validate required fields
        if (!payload.item_name) {
            return res.status(400).json({
                success: false,
                message: 'Item name is required'
            });
        }
        if (!payload.assignedTo) {
            return res.status(400).json({
                success: false,
                message: 'Assigned To is required'
            });
        }

        // Unique item via Core Duplicate Engine (default: item_code Exact)
        const trimmedName = String(payload.item_name).trim();
        payload.item_name = trimmedName;
        try {
            const { evaluateDuplicates } = require('../services/duplicates');
            const dupResult = await evaluateDuplicates({
                organizationId: req.user.organizationId,
                moduleKey: 'items',
                candidate: payload,
                emitEvent: true,
                triggeredBy: req.user._id,
                limit: 5,
            });
            if (dupResult.enabled && dupResult.hasMatch) {
                const policy = dupResult.policy || 'reject';
                if (policy === 'reject' || policy === 'warn') {
                    return res.status(409).json({
                        success: false,
                        code: 'DUPLICATE_ITEM',
                        message: 'A matching Item already exists.',
                        errors: { item_code: 'A matching Item already exists.' },
                        data: { matches: dupResult.matches },
                    });
                }
            }
        } catch (dupErr) {
            console.warn('[itemController.create] duplicate check failed:', dupErr.message);
            const existingByName = await Item.findOne({
                organizationId: req.user.organizationId,
                item_name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
                deletedAt: null
            }).select('_id').lean();
            if (existingByName) {
                return res.status(409).json({
                    success: false,
                    code: 'DUPLICATE_ITEM_NAME',
                    message: 'An Item with this name already exists.',
                    errors: { item_name: 'An Item with this name already exists.' }
                });
            }
        }

        // Set defaults
        if (!payload.lifecycle_state) {
            payload.lifecycle_state = payload.status === 'Inactive'
                ? inferLifecycleStateFromLegacyStatus('Inactive', null)
                : CATALOG_LIFECYCLE_DEFAULT;
        }
        if (!isCatalogLifecycleState(payload.lifecycle_state)) {
            return res.status(400).json({
                success: false,
                message: `Invalid lifecycle_state. Allowed: ${CATALOG_LIFECYCLE_STATES.join(', ')}`
            });
        }
        payload.status = syncLegacyItemStatusFromLifecycle(payload.lifecycle_state);
        if (!payload.status) {
            payload.status = 'Active';
        }
        if (!payload.item_type) {
            payload.item_type = 'Product';
        }

        const catalogResult = await applyCatalogFieldsToPayload(payload, req.user.organizationId);
        if (catalogResult.error) {
            return res.status(catalogResult.error.status).json({
                success: false,
                message: catalogResult.error.message,
                details: catalogResult.error.details
            });
        }
        Object.assign(payload, catalogResult.payload);

        // Re-strip after catalog processing (system-owned fields)
        delete payload.item_code;
        delete payload.item_id;

        const newItem = await Item.create(payload);
        
        const item = await Item.findById(newItem._id)
            .populate('vendor', 'name')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .populate('modifiedBy', 'firstName lastName email');

        await applyVariantWriteAfterItemSave({
            item,
            userId: req.user._id,
            rawPayload: standardPayload
        });

        const refreshed = await Item.findById(newItem._id)
            .populate('vendor', 'name')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .populate('modifiedBy', 'firstName lastName email');

        const data = await enrichItemCatalogPayload(refreshed, req.user._id);
        setCatalogApiVersionHeader(res);
        
        res.status(201).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Create item error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error creating item.', 
            error: error.message 
        });
    }
};

// @desc    Get all items
// @route   GET /api/items
// @access  Private
exports.getItems = async (req, res) => {
    try {
        let query = { organizationId: req.user.organizationId, deletedAt: null };
        
        // Filters
        if (req.query.lifecycle_state) {
            query.lifecycle_state = req.query.lifecycle_state;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        if (req.query.item_type) {
            query.item_type = req.query.item_type;
        }
        if (req.query.category) {
            query.category = req.query.category;
        }
        if (req.query.categoryId) {
            if (mongoose.Types.ObjectId.isValid(req.query.categoryId)) {
                query.categoryId = new mongoose.Types.ObjectId(req.query.categoryId);
            }
        }
        if (req.query.vendor) {
            if (mongoose.Types.ObjectId.isValid(req.query.vendor)) {
                query.vendor = new mongoose.Types.ObjectId(req.query.vendor);
            }
        }
        if (req.query.tag) {
            query.tags = req.query.tag;
        }
        
        const { buildSearchOrConditions, resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
        const directSearchTerm = req.query.search ? String(req.query.search).trim() : '';
        if (directSearchTerm) {
            query.$or = buildSearchOrConditions(directSearchTerm, ['item_name', 'item_code', 'item_id', 'description']);
        }
        
        // Low stock filter (deprecated — API compat only; hidden from catalog UI)
        if (req.query.low_stock === 'true') {
            query.item_type = { $in: ['Product', 'Serialized Product'] };
            query.status = 'Active';
            query.$expr = {
                $lte: ['$stock_quantity', '$reorder_level']
            };
        }
        
        // Out of stock filter (deprecated — API compat only)
        if (req.query.out_of_stock === 'true') {
            query.item_type = { $in: ['Product', 'Serialized Product'] };
            query.stock_quantity = 0;
        }
        
        const { applyListFilterQueryParam } = require('../utils/listFilterQuery');
        query = applyListFilterQueryParam(query, req.query, 'items', { userId: req.user?._id });

        // Pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Sorting (multi: sortBy=a,b&sortOrder=asc,desc)
        const { parseListSort } = require('../utils/parseListSort');
        const { sortObject: sort } = parseListSort(req.query, {
            defaultField: 'createdAt',
            defaultOrder: 'desc',
            tieBreaker: '_id'
        });
        
        const itemPopulate = [
            { path: 'vendor', select: 'name' },
            { path: 'assignedTo', select: 'firstName lastName email' },
            { path: 'createdBy', select: 'firstName lastName email' },
            { path: 'modifiedBy', select: 'firstName lastName email' }
        ];
        const searchTerm = resolveListSearchTerm(req.query, 'items');
        const items = isSearchActive(searchTerm)
            ? await fetchRankedSearchPage(Item, {
                matchQuery: query,
                searchTerm,
                fieldSpecs: SEARCH_FIELD_PRESETS.items,
                skip,
                limit,
                fallbackSort: sort,
                populate: itemPopulate,
                lean: false
            })
            : await Item.find(query)
                .populate('vendor', 'name')
                .populate('assignedTo', 'firstName lastName email')
                .populate('createdBy', 'firstName lastName email')
                .populate('modifiedBy', 'firstName lastName email')
                .sort(sort)
                .limit(limit)
                .skip(skip);
        
        const total = await Item.countDocuments(query);

        // Full-query KPIs for ModuleList cards (same filter as list rows).
        const { castMatchQueryForAggregate } = require('../utils/searchRelevance');
        const listCardBreakdown = await Item.aggregate([
            { $match: castMatchQueryForAggregate(Item, query) },
            {
                $group: {
                    _id: null,
                    activeItems: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_state', 'Active'] }, 1, 0] }
                    },
                    draftItems: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_state', 'Draft'] }, 1, 0] }
                    },
                    discontinuedItems: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_state', 'Discontinued'] }, 1, 0] }
                    },
                    archivedItems: {
                        $sum: { $cond: [{ $eq: ['$lifecycle_state', 'Archived'] }, 1, 0] }
                    },
                    inactiveItems: {
                        $sum: { $cond: [{ $ne: ['$lifecycle_state', 'Active'] }, 1, 0] }
                    },
                    products: {
                        $sum: { $cond: [{ $eq: ['$item_type', 'Product'] }, 1, 0] }
                    },
                    services: {
                        $sum: { $cond: [{ $eq: ['$item_type', 'Service'] }, 1, 0] }
                    },
                    serializedProducts: {
                        $sum: { $cond: [{ $eq: ['$item_type', 'Serialized Product'] }, 1, 0] }
                    },
                    nonStockProducts: {
                        $sum: { $cond: [{ $eq: ['$item_type', 'Non-Stock Product'] }, 1, 0] }
                    },
                    totalStockValue: {
                        $sum: {
                            $cond: [
                                { $in: ['$item_type', ['Product', 'Serialized Product']] },
                                { $multiply: [{ $ifNull: ['$stock_quantity', 0] }, { $ifNull: ['$cost_price', 0] }] },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const statsRow = listCardBreakdown[0] || {
            activeItems: 0,
            draftItems: 0,
            discontinuedItems: 0,
            archivedItems: 0,
            inactiveItems: 0,
            products: 0,
            services: 0,
            serializedProducts: 0,
            nonStockProducts: 0,
            totalStockValue: 0
        };
        const listStatistics = {
            totalItems: total,
            activeItems: statsRow.activeItems || 0,
            draftItems: statsRow.draftItems || 0,
            discontinuedItems: statsRow.discontinuedItems || 0,
            products: statsRow.products || 0,
            services: statsRow.services || 0
        };

        const itemIds = items.map((item) => item._id);
        const defaultVariants = itemIds.length
            ? await ItemVariant.find({
                organizationId: req.user.organizationId,
                itemId: { $in: itemIds },
                is_default: true
            }).lean()
            : [];
        const variantByItemId = new Map(defaultVariants.map((v) => [String(v.itemId), v]));

        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const enrichedItems = items.map((item) => {
            const flat = flattenCustomFieldsForResponse(item);
            const defaultVariant = variantByItemId.get(String(item._id)) || null;
            return applyFlatCompatShimForList(flat, defaultVariant);
        });

        setCatalogApiVersionHeader(res);
        
        res.status(200).json({
            success: true,
            data: enrichedItems,
            pagination: {
                currentPage: page,
                limit,
                totalItems: total,
                totalRecords: total,
                totalPages: Math.ceil(total / limit)
            },
            statistics: {
                totalItems: total,
                ...statsRow
            },
            listStatistics
        });
    } catch (error) {
        console.error('Get items error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching items.', 
            error: error.message 
        });
    }
};

// @desc    Get single item
// @route   GET /api/items/:id
// @access  Private
exports.getItemById = async (req, res) => {
    try {
        const item = await Item.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId,
            deletedAt: null
        })
        .populate('vendor', 'name industry phone email')
        .populate('linked_deals', 'name amount stage status')
        .populate('linked_forms', 'name formType status')
        .populate('linked_contacts', 'first_name last_name email phone')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');
        
        if (!item) {
            return res.status(404).json({ 
                success: false,
                message: 'Item not found or access denied.' 
            });
        }
        
        const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
        const data = await enrichItemCatalogPayload(item, req.user._id);
        setCatalogApiVersionHeader(res);
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Get item error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching item.', 
            error: error.message 
        });
    }
};

// @desc    Update item
// @route   PUT /api/items/:id
// @access  Private
exports.updateItem = async (req, res) => {
    try {
        // Prevent changing organizationId
        delete req.body.organizationId;
        delete req.body.source;
        // Item Code / legacy item_id are system-managed
        delete req.body.item_code;
        delete req.body.item_id;

        const previous = await Item.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        }).lean();

        const previousLifecycle = previous?.lifecycle_state
            || inferLifecycleStateFromLegacyStatus(previous?.status, previous?.lifecycle_state);

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'lifecycle_state')) {
            const nextLifecycle = req.body.lifecycle_state;
            if (!isCatalogLifecycleState(nextLifecycle)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid lifecycle_state. Allowed: ${CATALOG_LIFECYCLE_STATES.join(', ')}`
                });
            }
            if (!canTransitionCatalogLifecycle(previousLifecycle, nextLifecycle)) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot transition lifecycle from ${previousLifecycle} to ${nextLifecycle}`
                });
            }
            req.body.status = syncLegacyItemStatusFromLifecycle(nextLifecycle);
        } else if (Object.prototype.hasOwnProperty.call(req.body || {}, 'status')) {
            // Legacy status-only updates map to lifecycle for catalog consistency
            req.body.lifecycle_state = inferLifecycleStateFromLegacyStatus(req.body.status, previousLifecycle);
            req.body.status = syncLegacyItemStatusFromLifecycle(req.body.lifecycle_state);
        }

        req.body.modifiedBy = req.user._id;

        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'assignedTo') && !req.body.assignedTo) {
            return res.status(400).json({
                success: false,
                message: 'Assigned To is required'
            });
        }

        const catalogResult = await applyCatalogFieldsToPayload(req.body, req.user.organizationId);
        if (catalogResult.error) {
            return res.status(catalogResult.error.status).json({
                success: false,
                message: catalogResult.error.message,
                details: catalogResult.error.details
            });
        }
        Object.assign(req.body, catalogResult.payload);
        delete req.body.item_code;
        delete req.body.item_id;

        // Generic description versioning: store previous description before update.
        if (Object.prototype.hasOwnProperty.call(req.body || {}, 'description')) {
            try {
                const prevDesc = String(previous?.description ?? previous?.customFields?.description ?? '');
                const nextDesc = String(req.body.description ?? '');
                if (prevDesc !== nextDesc) {
                    await Item.updateOne(
                        { _id: req.params.id, organizationId: req.user.organizationId, deletedAt: null },
                        {
                            $push: {
                                descriptionVersions: {
                                    content: prevDesc,
                                    createdAt: new Date(),
                                    createdBy: req.user?._id
                                }
                            }
                        }
                    );
                }
            } catch (versionErr) {
                console.warn('Description version push (item) failed:', versionErr?.message || versionErr);
            }
        }

        const { splitItemPayload } = require('../constants/catalogFieldOwnership');
        const { parentPayload } = splitItemPayload(req.body);

        const { buildUpdateWithCustomFields } = require('../utils/customFieldsExtractor');
        const $set = buildUpdateWithCustomFields(parentPayload, Item);
        
        const updatedItem = await Item.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId,
                deletedAt: null
            },
            { $set },
            { new: true, runValidators: true }
        )
        .populate('vendor', 'name')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');

        if (!updatedItem) {
            return res.status(404).json({ 
                success: false,
                message: 'Item not found or access denied.' 
            });
        }

        try {
            const { appendFieldChangeLogs } = require('../utils/recordActivityLogger');
            const ModuleDefinition = require('../models/ModuleDefinition');
            const moduleDef = await ModuleDefinition.findOne({
                organizationId: req.user.organizationId,
                key: 'items'
            });
            await appendFieldChangeLogs({
                organizationId: req.user.organizationId,
                moduleKey: 'items',
                recordId: req.params.id,
                authorId: req.user._id,
                previous: previous || {},
                updated: updatedItem.toObject ? updatedItem.toObject() : updatedItem,
                updateDataKeys: Object.keys(req.body || {}),
                fieldLabels: moduleDef && Array.isArray(moduleDef.fields) ? moduleDef.fields : undefined
            });
        } catch (logErr) {
            console.warn('Record activity log (item update) failed:', logErr?.message || logErr);
        }

        await applyVariantWriteOnItemUpdate({
            itemId: req.params.id,
            organizationId: req.user.organizationId,
            userId: req.user._id,
            rawPayload: req.body
        });

        await syncDefaultVariantLifecycleFromItem(updatedItem, req.user._id);

        const refreshedItem = await Item.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        })
        .populate('vendor', 'name')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');

        const data = await enrichItemCatalogPayload(refreshedItem, req.user._id);
        setCatalogApiVersionHeader(res);
        
        res.status(200).json({
            success: true,
            data
        });
    } catch (error) {
        console.error('Update item error:', error);
        res.status(400).json({ 
            success: false,
            message: 'Error updating item.', 
            error: error.message 
        });
    }
};

// @desc    Delete item (move to trash)
// @route   DELETE /api/items/:id
// @access  Private
exports.deleteItem = async (req, res) => {
    try {
        const deletionService = require('../services/deletionService');
        const result = await deletionService.moveToTrash({
            moduleKey: 'items',
            recordId: req.params.id,
            organizationId: req.user.organizationId,
            userId: req.user._id,
            appKey: 'platform',
            reason: req.body?.reason,
            cascadeConfirmed: !!req.body?.cascadeConfirmed
        });

        if (!result.ok) {
            if (result.blocked) {
                return res.status(400).json({
                    success: false,
                    blocked: true,
                    dependencies: result.dependencies,
                    message: result.message
                });
            }
            return res.status(400).json({
                success: false,
                message: result.message || 'Failed to delete item'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Item moved to trash',
            retentionExpiresAt: result.retentionExpiresAt
        });
    } catch (error) {
        console.error('Delete item error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting item.',
            error: error.message
        });
    }
};

// @desc    Update stock quantity
// @route   PATCH /api/items/:id/stock
// @access  Private
exports.updateStock = async (req, res) => {
    try {
        const { stock_quantity, operation } = req.body; // operation: 'set', 'add', 'subtract'
        
        if (stock_quantity === undefined && !operation) {
            return res.status(400).json({
                success: false,
                message: 'stock_quantity or operation is required'
            });
        }
        
        const item = await Item.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId,
            deletedAt: null
        });
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found or access denied'
            });
        }
        
        if (item.item_type === 'Service' || item.item_type === 'Non-Stock Product' || item.item_type === 'Bundle') {
            return res.status(400).json({
                success: false,
                message: 'Stock cannot be updated for Service, Non-Stock Product, or Bundle items'
            });
        }
        
        let newStockQuantity = item.stock_quantity;
        
        if (operation === 'add' && stock_quantity !== undefined) {
            newStockQuantity = item.stock_quantity + stock_quantity;
        } else if (operation === 'subtract' && stock_quantity !== undefined) {
            newStockQuantity = Math.max(0, item.stock_quantity - stock_quantity);
        } else if (operation === 'set' && stock_quantity !== undefined) {
            newStockQuantity = Math.max(0, stock_quantity);
        } else if (stock_quantity !== undefined) {
            newStockQuantity = Math.max(0, stock_quantity);
        }
        
        item.stock_quantity = newStockQuantity;
        item.modifiedBy = req.user._id;
        await item.save();
        
        const updatedItem = await Item.findById(item._id)
            .populate('vendor', 'name')
            .populate('assignedTo', 'firstName lastName email')
            .populate('createdBy', 'firstName lastName email')
            .populate('modifiedBy', 'firstName lastName email');
        
        res.status(200).json({
            success: true,
            data: updatedItem
        });
    } catch (error) {
        console.error('Update stock error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating stock',
            error: error.message
        });
    }
};

// @desc    Get low stock items
// @route   GET /api/items/low-stock
// @access  Private
exports.getLowStockItems = async (req, res) => {
    try {
        const items = await Item.getLowStockItems(req.user.organizationId);
        
        res.status(200).json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Get low stock items error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching low stock items',
            error: error.message
        });
    }
};

// @desc    Get items by type
// @route   GET /api/items/type/:type
// @access  Private
exports.getItemsByType = async (req, res) => {
    try {
        const { type } = req.params;
        const validTypes = ['Product', 'Service', 'Serialized Product', 'Non-Stock Product'];
        
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid item type'
            });
        }
        
        const items = await Item.getItemsByType(req.user.organizationId, type);
        
        res.status(200).json({
            success: true,
            data: items
        });
    } catch (error) {
        console.error('Get items by type error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching items by type',
            error: error.message
        });
    }
};

// @desc    Get item statistics
// @route   GET /api/items/statistics
// @access  Private
exports.getItemStatistics = async (req, res) => {
    try {
        const stats = await Item.getItemStatistics(req.user.organizationId);
        
        res.status(200).json({
            success: true,
            data: stats[0] || {
                totalItems: 0,
                activeItems: 0,
                draftItems: 0,
                discontinuedItems: 0,
                archivedItems: 0,
                inactiveItems: 0,
                products: 0,
                services: 0,
                serializedProducts: 0,
                nonStockProducts: 0,
                totalStockValue: 0
            }
        });
    } catch (error) {
        console.error('Get item statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching item statistics',
            error: error.message
        });
    }
};

// @desc    Link item to deal
// @route   POST /api/items/:id/link-deal
// @access  Private
exports.linkDeal = async (req, res) => {
    try {
        const { dealId } = req.body;
        
        if (!dealId || !mongoose.Types.ObjectId.isValid(dealId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid dealId is required'
            });
        }
        
        const item = await Item.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            {
                $addToSet: { linked_deals: dealId },
                $set: { modifiedBy: req.user._id }
            },
            { new: true, runValidators: true }
        )
        .populate('vendor', 'name')
        .populate('linked_deals', 'name amount stage status')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found or access denied'
            });
        }
        
        res.status(200).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Link deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Error linking deal',
            error: error.message
        });
    }
};

// @desc    Unlink item from deal
// @route   DELETE /api/items/:id/unlink-deal/:dealId
// @access  Private
exports.unlinkDeal = async (req, res) => {
    try {
        const { dealId } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(dealId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid dealId'
            });
        }
        
        const item = await Item.findOneAndUpdate(
            { 
                _id: req.params.id, 
                organizationId: req.user.organizationId 
            },
            {
                $pull: { linked_deals: dealId },
                $set: { modifiedBy: req.user._id }
            },
            { new: true, runValidators: true }
        )
        .populate('vendor', 'name')
        .populate('linked_deals', 'name amount stage status')
        .populate('assignedTo', 'firstName lastName email')
        .populate('createdBy', 'firstName lastName email')
        .populate('modifiedBy', 'firstName lastName email');
        
        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Item not found or access denied'
            });
        }
        
        res.status(200).json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Unlink deal error:', error);
        res.status(500).json({
            success: false,
            message: 'Error unlinking deal',
            error: error.message
        });
    }
};

// @desc    List meta fingerprint for items
// @route   GET /api/items/meta
exports.getItemsListMeta = async (req, res) => {
    try {
        const { buildItemsListQuery } = require('../utils/listQueryBuilders/itemsListQuery');
        const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
        const query = buildItemsListQuery(req);
        const meta = await fetchListMeta(Item, query);
        sendListMetaResponse(res, meta);
    } catch (error) {
        console.error('[getItemsListMeta] error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch items list meta' });
    }
};

