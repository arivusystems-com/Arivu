const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const { RECORD_SOURCE_VALUES, DEFAULT_RECORD_SOURCE } = require('../constants/recordSource');
const { wrapTenantModel } = require('../utils/tenantModelProxy');

const TaskSchema = new Schema({
  organizationId: {
    type: Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },

  // Basic Info
  title: {
    type: String,
    required: true,
    trim: true
  },
  taskNumber: {
    type: String,
    trim: true,
    index: true,
  },
  description: {
    type: String,
    trim: true
  },

  // Relationships - Related To (Contact, Deal, Project, Organization)
  relatedTo: {
    type: {
      type: String,
      enum: ['contact', 'deal', 'project', 'organization', 'none'],
      default: 'none'
    },
    id: {
      type: Schema.Types.ObjectId,
      refPath: 'relatedTo.type'
    }
  },

  // Optional: Direct project reference for easier querying
  projectId: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },

  // Assignment
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },

  // Status & Priority (values from module field config, not hardcoded enum)
  status: {
    type: String,
    default: 'todo',
    index: true
  },
  priority: {
    type: String,
    default: 'medium',
    index: true
  },
  taskType: {
    type: String,
    default: 'general_task',
    index: true
  },

  // Timeline
  dueDate: {
    type: Date,
    index: true
  },
  startDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },

  // Time Tracking
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },

  // Checklist/Subtasks
  subtasks: [{
    title: {
      type: String,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    completedAt: Date,
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  }],

  // Classification
  tags: [{
    type: String,
    trim: true
  }],

  lifecycleState: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active',
    index: true
  },
  closedAt: { type: Date, default: null },
  reopenedAt: { type: Date, default: null },

  /** System-managed creation channel (set server-side only) */
  source: {
    type: String,
    enum: RECORD_SOURCE_VALUES,
    default: DEFAULT_RECORD_SOURCE
  },

  // Notifications
  reminderDate: Date,
  reminderSent: {
    type: Boolean,
    default: false
  },

  // Activity logs (field-level change history)
  activityLogs: [{
    user: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, required: true }
  }],

  // Description version history (for restore); retained up to 365 days
  descriptionVersions: [{
    content: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  }],

  // Custom fields (user-defined via Settings → Modules & Fields)
  customFields: {
    type: Schema.Types.Mixed,
    default: {}
  },

  // Trash (soft delete) - See docs/TRASH_IMPLEMENTATION_SPEC.md
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  deletionReason: { type: String, trim: true, maxlength: 500 },
  importHistoryId: { type: Schema.Types.ObjectId, ref: 'ImportHistory', default: null, index: true },

  // Metadata
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
TaskSchema.index({ organizationId: 1, assignedTo: 1, status: 1 });
TaskSchema.index({ organizationId: 1, dueDate: 1, status: 1 });
TaskSchema.index({ organizationId: 1, priority: 1, status: 1 });
TaskSchema.index({ organizationId: 1, projectId: 1 });
TaskSchema.index({ organizationId: 1, deletedAt: 1 });
TaskSchema.index({ organizationId: 1, importHistoryId: 1 });
TaskSchema.index({ organizationId: 1, taskNumber: 1 }, { unique: true, sparse: true });
TaskSchema.index(
  { organizationId: 1, assignedTo: 1, deletedAt: 1, dueDate: 1, status: 1 },
  { name: 'task_home_summary_idx' }
);

// Virtual for overdue status
TaskSchema.virtual('isOverdue').get(function() {
  if (this.status === 'completed' || this.status === 'cancelled') {
    return false;
  }
  return this.dueDate && this.dueDate < new Date();
});

// Virtual for completion percentage (based on subtasks)
TaskSchema.virtual('completionPercentage').get(function() {
  if (!this.subtasks || this.subtasks.length === 0) {
    return this.status === 'completed' ? 100 : 0;
  }
  const completed = this.subtasks.filter(st => st.completed).length;
  return Math.round((completed / this.subtasks.length) * 100);
});

// Pre-save middleware
TaskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Auto-set completedDate when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.completedDate) {
    this.completedDate = new Date();
  }
  
  next();
});

// Instance methods
TaskSchema.methods.markComplete = function(userId) {
  this.status = 'completed';
  this.completedDate = new Date();
  return this.save();
};

TaskSchema.methods.markIncomplete = function() {
  this.status = 'todo';
  this.completedDate = null;
  return this.save();
};

// Ensure virtuals are included in JSON
TaskSchema.set('toJSON', { virtuals: true });
TaskSchema.set('toObject', { virtuals: true });

TaskSchema.pre('validate', async function assignTaskNumber(next) {
  if (this.taskNumber || !this.isNew) return next();
  try {
    const { assignModuleRecordNumber } = require('../utils/assignModuleRecordNumber');
    await assignModuleRecordNumber(this, { moduleKey: 'tasks', fieldKey: 'taskNumber' });
    return next();
  } catch (err) {
    return next(err);
  }
});

module.exports = wrapTenantModel(mongoose.model('Task', TaskSchema));
