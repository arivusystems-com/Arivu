const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const {
    CATALOG_LIFECYCLE_STATES,
    CATALOG_LIFECYCLE_DEFAULT,
    syncLegacyItemStatusFromLifecycle,
    inferLifecycleStateFromLegacyStatus
} = require('../constants/catalogLifecycle');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

// Item Schema Definition
const ItemSchema = new Schema({
    // 🏢 ORGANIZATION REFERENCE (Multi-tenancy)
    organizationId: {
        type: Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },

    // 📋 CORE IDENTIFICATION
    item_id: {
        type: String,
        unique: true,
        sparse: true,
        trim: true
    },
    item_name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    item_code: {
        type: String,
        trim: true,
        index: true
    },
    /** True when more than one variant exists for this parent item. */
    hasVariants: {
        type: Boolean,
        default: false,
        index: true
    },
    /** Fast path to default sellable SKU (C3). */
    defaultVariantId: {
        type: Schema.Types.ObjectId,
        ref: 'ItemVariant',
        default: null,
        index: true
    },
    item_type: {
        type: String,
        enum: ['Product', 'Service', 'Serialized Product', 'Non-Stock Product', 'Bundle'],
        required: true,
        default: 'Product',
        index: true
    },

    // 📂 CATEGORIZATION
    /** @deprecated Denormalized label — prefer categoryId. Synced from catalog category tree. */
    category: {
        type: String,
        trim: true,
        index: true
    },
    /** @deprecated Denormalized sub-label — synced when category has a parent. */
    subcategory: {
        type: String,
        trim: true
    },
    categoryId: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogCategory',
        default: null,
        index: true
    },
    attributeValues: {
        type: Schema.Types.Mixed,
        default: {}
    },
    /** CPQ Item Group parent (template); null for manually created items */
    itemGroupId: {
        type: Schema.Types.ObjectId,
        ref: 'ItemGroup',
        default: null,
        index: true
    },
    tags: [{
        type: String,
        trim: true
    }],

    // 📏 MEASUREMENT & STATUS
    unit_of_measure: {
        type: String,
        enum: ['pcs', 'liters', 'hours', 'boxes', 'kg', 'meters', 'units'],
        default: 'pcs'
    },
    /** @deprecated Legacy alias — synced from lifecycle_state. Prefer lifecycle_state for catalog semantics. */
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active',
        index: true
    },

    /** Catalog lifecycle (canonical). See docs/CATALOG_ROADMAP.md */
    lifecycle_state: {
        type: String,
        enum: CATALOG_LIFECYCLE_STATES,
        default: CATALOG_LIFECYCLE_DEFAULT,
        index: true
    },

    // 📝 DESCRIPTION & MEDIA
    description: {
        type: String,
        trim: true
    },
    descriptionVersions: [{
        content: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now, required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    }],
    /** @deprecated Use media[] gallery — kept for list thumbnail compat (synced from primary media). */
    product_image: {
        type: String, // File path or URL
        trim: true
    },

    /** Ordered catalog media gallery (C1). Primary entry syncs to product_image. */
    media: [{
        url: { type: String, required: true, trim: true },
        kind: { type: String, enum: ['image', 'document'], default: 'image' },
        isPrimary: { type: Boolean, default: false },
        altText: { type: String, trim: true, default: '' },
        sortOrder: { type: Number, default: 0 },
        fileName: { type: String, trim: true },
        fileType: { type: String, trim: true },
        fileSize: { type: Number, min: 0 },
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        uploadedAt: { type: Date, default: Date.now }
    }],

    // 💰 PRICING (deprecated on parent — canonical values live on ItemVariant; synced for API compat)
    cost_price: {
        type: Number,
        min: 0,
        default: 0
    },
    selling_price: {
        type: Number,
        min: 0,
        default: 0
    },
    currency: {
        type: String,
        default: 'USD',
        trim: true
    },

    // 💳 TAX & COMMISSION
    tax_type: {
        type: String,
        enum: ['GST', 'VAT', 'None'],
        default: 'None'
    },
    tax_percentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    /** India GST (GTM-1) — HSN/SAC code */
    hsnSac: {
        type: String,
        trim: true
    },
    gstTaxability: {
        type: String,
        enum: ['taxable', 'exempt', 'nil_rated', 'non_gst', 'zero_rated'],
        trim: true
    },
    gstRatePercent: {
        type: Number,
        min: 0,
        max: 100
    },
    commission_rate: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },

    // 🏭 LEGACY INVENTORY PLACEHOLDERS (frozen — not catalog scope until Orders/ledger exist)
    stock_quantity: {
        type: Number,
        min: 0,
        default: 0
    },
    reorder_level: {
        type: Number,
        min: 0,
        default: 0
    },

    // 🔢 SERIALIZED PRODUCT FIELDS
    serial_numbers: [{
        type: String,
        trim: true
    }],
    warranty_period_months: {
        type: Number,
        min: 0,
        default: 0
    },

    // 🔗 RELATIONSHIPS
    vendor: {
        type: Schema.Types.ObjectId,
        ref: 'Organization', // Vendor organization
        index: true
    },
    linked_deals: [{
        type: Schema.Types.ObjectId,
        ref: 'Deal',
        index: true
    }],
    linked_invoices: [{
        type: Schema.Types.ObjectId,
        ref: 'Invoice', // Future module
        index: true
    }],
    linked_forms: [{
        type: Schema.Types.ObjectId,
        ref: 'Form',
        index: true
    }],
    linked_contacts: [{
        type: Schema.Types.ObjectId,
        ref: 'People',
        index: true
    }],

    /** System-managed creation channel (set server-side only) */
    source: {
        type: String,
        enum: RECORD_SOURCE_VALUES,
        default: DEFAULT_RECORD_SOURCE
    },

    // 📊 METADATA
    assignedTo: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    
    // 🔧 CUSTOM FIELDS
    customFields: {
        type: Schema.Types.Mixed,
        default: {}
    },

    // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deletionReason: { type: String, trim: true, maxlength: 500 },

    // Duplicate merge
    mergedInto: { type: Schema.Types.ObjectId, ref: 'Item', default: null, index: true },
    mergedAt: { type: Date, default: null },
    mergedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, {
    timestamps: true // Automatically handles 'createdAt' and 'updatedAt'
});

// Indexes
ItemSchema.index({ organizationId: 1, status: 1 });
ItemSchema.index({ organizationId: 1, categoryId: 1 });
ItemSchema.index({ organizationId: 1, lifecycle_state: 1 });
ItemSchema.index({ organizationId: 1, item_type: 1 });
ItemSchema.index({ organizationId: 1, category: 1 });
ItemSchema.index({ organizationId: 1, vendor: 1 });
ItemSchema.index({ organizationId: 1, assignedTo: 1 });
ItemSchema.index({ organizationId: 1, item_code: 1 }, { unique: true, sparse: true });
ItemSchema.index({ organizationId: 1, deletedAt: 1 });

// Pre-save: lifecycle_state is canonical; keep legacy status in sync
ItemSchema.pre('save', async function(next) {
    // Legacy items created before assignedTo: backfill from createdBy
    if (!this.assignedTo && this.createdBy) {
        this.assignedTo = this.createdBy;
    }
    if (!this.lifecycle_state) {
        this.lifecycle_state = inferLifecycleStateFromLegacyStatus(this.status, this.lifecycle_state);
    }
    this.status = syncLegacyItemStatusFromLifecycle(this.lifecycle_state);

    if (!this.item_id) {
        /**
         * NOTE:
         * Historically this used countDocuments() which can generate duplicates under concurrency,
         * and legacy data may contain missing item_id values. Since item_id is indexed unique
         * (legacy global index), we must generate a value that is guaranteed unique.
         *
         * Use the MongoDB ObjectId (stable) as the unique suffix.
         */
        this.item_id = `ITM-${this._id.toString()}`;
    }
    
    // Set modifiedBy on update
    if (!this.isNew && !this.modifiedBy) {
        // modifiedBy should be set by controller
    }
    
    // Item Code is system-owned: immutable after first assignment; allocated via Module Numbering only.
    if (!this.isNew && this.isModified('item_code')) {
        return next(
            Object.assign(new Error('Item Code is system-generated and cannot be modified'), {
                statusCode: 400,
                code: 'ITEM_CODE_IMMUTABLE',
            })
        );
    }

    if (!this.item_code) {
        try {
            const { allocate } = require('../services/moduleNumberingService');
            const result = await allocate({
                organizationId: this.organizationId,
                moduleKey: 'items',
            });
            if (result?.recordId) {
                this.item_code = result.recordId;
            } else if (this.item_id) {
                // Auto-numbering disabled: fall back to stable item_id (same pattern as quotes)
                this.item_code = this.item_id;
            } else {
                return next(
                    Object.assign(new Error('Failed to allocate Item Code'), {
                        statusCode: 500,
                        code: 'ITEM_CODE_ALLOCATE_FAILED',
                    })
                );
            }
        } catch (err) {
            return next(err);
        }
    }

    next();
});

// Virtual for calculating total price with tax
ItemSchema.virtual('totalPrice').get(function() {
    if (this.tax_type === 'None' || !this.tax_percentage) {
        return this.selling_price || 0;
    }
    return this.selling_price * (1 + this.tax_percentage / 100);
});

// Virtual for stock status
ItemSchema.virtual('stockStatus').get(function() {
    if (this.item_type === 'Service' || this.item_type === 'Non-Stock Product' || this.item_type === 'Bundle') {
        return 'N/A';
    }
    if (this.stock_quantity === 0) {
        return 'Out of Stock';
    }
    if (this.reorder_level > 0 && this.stock_quantity <= this.reorder_level) {
        return 'Low Stock';
    }
    return 'In Stock';
});

// Method to check if stock is low
ItemSchema.methods.isLowStock = function() {
    if (this.item_type === 'Service' || this.item_type === 'Non-Stock Product' || this.item_type === 'Bundle') {
        return false;
    }
    return this.reorder_level > 0 && this.stock_quantity <= this.reorder_level;
};

// Method to check if out of stock
ItemSchema.methods.isOutOfStock = function() {
    if (this.item_type === 'Service' || this.item_type === 'Non-Stock Product' || this.item_type === 'Bundle') {
        return false;
    }
    return this.stock_quantity === 0;
};

// Static method to get items by type
ItemSchema.statics.getItemsByType = async function(organizationId, itemType) {
    return await this.find({
        organizationId: organizationId,
        item_type: itemType,
        status: 'Active'
    }).sort({ item_name: 1 });
};

// Static method to get low stock items
ItemSchema.statics.getLowStockItems = async function(organizationId) {
    return await this.find({
        organizationId: organizationId,
        item_type: { $in: ['Product', 'Serialized Product'] },
        status: 'Active',
        $expr: {
            $lte: ['$stock_quantity', '$reorder_level']
        }
    }).sort({ stock_quantity: 1 });
};

// Static method to get item statistics
ItemSchema.statics.getItemStatistics = async function(organizationId) {
    // Convert organizationId to ObjectId if it's a string
    const orgId = mongoose.Types.ObjectId.isValid(organizationId) 
        ? (organizationId instanceof mongoose.Types.ObjectId ? organizationId : new mongoose.Types.ObjectId(organizationId))
        : organizationId;
    
    return await this.aggregate([
        { $match: { organizationId: orgId, deletedAt: null } },
        {
            $group: {
                _id: null,
                totalItems: { $sum: 1 },
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
                            { $multiply: ['$stock_quantity', '$cost_price'] },
                            0
                        ]
                    }
                }
            }
        }
    ]);
};

// Enable virtuals in JSON
ItemSchema.set('toJSON', { virtuals: true });
ItemSchema.set('toObject', { virtuals: true });

module.exports = wrapTenantModel(mongoose.model('Item', ItemSchema));

