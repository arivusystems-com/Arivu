const Task = require('../models/Task');
const TaskComment = require('../models/TaskComment');
const User = require('../models/User');
const People = require('../models/People');
const Deal = require('../models/Deal');
const Organization = require('../models/Organization');
const mongoose = require('mongoose');
const { persistMulterUpload } = require('../middleware/uploadMiddleware');
const { emitNotification } = require('../services/notificationEngine');
const { processCommentMentions } = require('../services/commentMentionNotifications');
const domainEvents = require('../constants/domainEvents');
const { emitTaskDomainEvent } = require('../services/taskDomainEventHelpers');
const { applyProjectionFilter } = require('../utils/appProjectionQuery');
const { getProjection } = require('../utils/moduleProjectionResolver');
const { resolveCreateType, getTypeFieldName } = require('../utils/appProjectionCreateResolver');
const { DEFAULT_TASK_TYPE, TASK_TYPE_LABELS } = require('../constants/taskTypes');
const { performance } = require('perf_hooks');
const { buildTasksListQuery } = require('../utils/listQueryBuilders/tasksListQuery');
const { fetchListMeta, sendListMetaResponse } = require('../utils/listMetaService');
const { fetchRecordUpdatedAtMeta, sendRecordMetaResponse } = require('../utils/recordMetaService');

const TASK_STATUS_LABELS = {
  todo: 'To Do',
  in_progress: 'In Progress',
  waiting: 'Waiting',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

const TASK_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const TASK_FIELD_LABELS = {
  title: 'title',
  description: 'description',
  relatedTo: 'related record',
  projectId: 'project',
  assignedTo: 'assignee',
  status: 'status',
  priority: 'priority',
  taskType: 'task type',
  dueDate: 'due date',
  startDate: 'start date',
  completedDate: 'completed date',
  estimatedHours: 'estimated hours',
  actualHours: 'actual hours',
  subtasks: 'subtasks',
  tags: 'tags',
  reminderDate: 'reminder date'
};

const TASK_ALLOWED_UPDATES = [
  'title', 'description', 'relatedTo', 'projectId', 'assignedTo',
  'status', 'priority', 'taskType', 'dueDate', 'startDate', 'completedDate',
  'estimatedHours', 'actualHours', 'subtasks', 'tags', 'reminderDate'
];

const getActorDisplayName = (user) => {
  if (!user) return 'System';
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.username || user.email || 'System';
};

const formatServerTiming = (timings) => {
  return timings
    .filter(({ duration }) => Number.isFinite(duration))
    .map(({ name, duration, description }) => {
      const desc = description ? `;desc="${description.replace(/"/g, "'")}"` : '';
      return `${name};dur=${duration.toFixed(1)}${desc}`;
    })
    .join(', ');
};

const measureTaskSummaryQuery = async (name, query) => {
  const start = performance.now();
  const data = await query;
  return {
    name,
    data,
    duration: performance.now() - start
  };
};

/** Map relatedTo.type to model and display field(s) for population */
const RELATED_TO_MODEL_MAP = {
  contact: { model: People, displayFields: ['first_name', 'last_name'] },
  deal: { model: Deal, displayFields: ['name'] },
  organization: { model: Organization, displayFields: ['name'] },
  project: null // No Project model; skip
};

/**
 * Populate relatedTo.name for tasks so list/kanban can display record names.
 * Fetches related records by type and attaches display name to each task.relatedTo.
 * @param {Array} tasks - Task documents (mongoose docs or plain objects)
 */
async function populateRelatedToNames(tasks) {
  if (!tasks || tasks.length === 0) return;
  const idsByType = { contact: [], deal: [], organization: [], project: [] };
  for (const task of tasks) {
    const rt = task?.relatedTo;
    if (!rt || rt.type === 'none' || !rt.id) continue;
    const type = String(rt.type || '').toLowerCase();
    const id = rt.id && typeof rt.id === 'object' ? rt.id._id : rt.id;
    if (id && idsByType[type]) idsByType[type].push(id);
  }
  const idToName = new Map();
  for (const [type, ids] of Object.entries(idsByType)) {
    if (ids.length === 0) continue;
    const config = RELATED_TO_MODEL_MAP[type];
    if (!config?.model) continue;
    const uniqueIds = [...new Set(ids.map((id) => String(id)))].filter(Boolean);
    if (uniqueIds.length === 0) continue;
    const select = config.displayFields.join(' ');
    const docs = await config.model
      .find({ _id: { $in: uniqueIds } })
      .select(select)
      .lean();
    for (const doc of docs) {
      const id = doc._id?.toString?.() || doc._id;
      let name = '';
      if (config.displayFields.includes('first_name') || config.displayFields.includes('last_name')) {
        const first = doc.first_name || '';
        const last = doc.last_name || '';
        name = `${first} ${last}`.trim() || doc.name || doc.title || '';
      } else {
        name = doc.name || doc.title || '';
      }
      if (name) idToName.set(id, name);
    }
  }
  for (const task of tasks) {
    const rt = task.relatedTo;
    if (!rt || rt.type === 'none' || !rt.id) continue;
    const id = rt.id && typeof rt.id === 'object' ? rt.id._id : rt.id;
    const idStr = id?.toString?.() || id;
    const name = idToName.get(idStr);
    if (name) {
      task.relatedTo = { type: rt.type, id: rt.id, name };
    }
  }
}

const normalizeTaskComparableValue = (value) => {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object' && typeof value.toObject === 'function') {
    try {
      const plainValue = value.toObject({
        depopulate: true,
        virtuals: false,
        getters: false,
        flattenMaps: true
      });
      return normalizeTaskComparableValue(plainValue);
    } catch (_) {
      // Fall through to best-effort object normalization below.
    }
  }

  if (Array.isArray(value)) return value.map(normalizeTaskComparableValue);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return String(value.toHexString());
    if (value._bsontype === 'ObjectID' || value._bsontype === 'ObjectId') return String(value);
    const sorted = {};
    Object.keys(value).sort().forEach((key) => {
      if (key === '__v') return;
      sorted[key] = normalizeTaskComparableValue(value[key]);
    });
    return sorted;
  }
  return value;
};

const areTaskFieldValuesEqual = (a, b) => (
  JSON.stringify(normalizeTaskComparableValue(a)) === JSON.stringify(normalizeTaskComparableValue(b))
);

const formatTaskDateForLog = (value) => {
  if (!value) return 'Empty';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Empty';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

const formatSubtasksForLog = (value) => {
  if (!Array.isArray(value) || value.length === 0) return 'No subtasks';
  const completedCount = value.filter((subtask) => !!subtask?.completed).length;
  return `${completedCount}/${value.length} completed`;
};

const formatRelatedToForLog = (value) => {
  if (!value || !value.type || value.type === 'none') return 'None';
  const typeLabel = String(value.type).replace(/_/g, ' ');
  const idPart = value.id ? ` (${String(value.id)})` : '';
  return `${typeLabel}${idPart}`;
};

const formatTaskFieldValueForLog = (field, value, userNameById = {}) => {
  if (value === undefined || value === null || value === '') return 'Empty';

  switch (field) {
    case 'status':
      return TASK_STATUS_LABELS[value] || String(value);
    case 'priority':
      return TASK_PRIORITY_LABELS[value] || String(value);
    case 'taskType':
      return TASK_TYPE_LABELS[value] || String(value);
    case 'assignedTo': {
      const id = String(value);
      return userNameById[id] || id;
    }
    case 'dueDate':
    case 'startDate':
    case 'completedDate':
    case 'reminderDate':
      return formatTaskDateForLog(value);
    case 'estimatedHours':
    case 'actualHours':
      return `${value}h`;
    case 'tags':
      return Array.isArray(value) && value.length > 0 ? value.join(', ') : 'Empty';
    case 'subtasks':
      return formatSubtasksForLog(value);
    case 'relatedTo':
      return formatRelatedToForLog(value);
    default:
      return String(value);
  }
};

const buildFieldChangeLogEntry = ({ actorName, actorId, field, oldValue, newValue, userNameById = {} }) => {
  const from = formatTaskFieldValueForLog(field, oldValue, userNameById);
  const to = formatTaskFieldValueForLog(field, newValue, userNameById);
  if (from === to) return null;

  return {
    user: actorName,
    userId: actorId,
    action: field === 'status' ? 'status_changed' : 'field_changed',
    details: {
      field,
      fieldLabel: TASK_FIELD_LABELS[field] || field,
      from,
      to
    },
    timestamp: new Date()
  };
};

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
const createTask = async (req, res) => {
  try {
    const { stripClientSource, assignResolvedSource } = require('../services/sourceResolver');
    stripClientSource(req.body);
    // Phase 2A.3: Projection-aware create type resolution
    // SAFETY: Projection-aware create logic — non-blocking fallback
    // Note: Tasks don't currently have a type field, but we handle it gracefully
    const appKey = req.appKey || 'SALES'; // From resolveAppContext middleware
    const moduleKey = 'tasks';
    const typeFieldName = getTypeFieldName(moduleKey);
    
    if (typeFieldName && req.body.hasOwnProperty(typeFieldName)) {
      const resolved = resolveCreateType({
        appKey,
        moduleKey,
        explicitType: req.body[typeFieldName],
        fallbackType: null
      });

      if (resolved.allowed === false) {
        return res.status(400).json({
          success: false,
          message: resolved.message || 'This task type is not allowed in this app.',
          code: resolved.reason
        });
      }

      // Set resolved type in body if available
      if (resolved.type !== null) {
        req.body[typeFieldName] = resolved.type;
      }
    }
    // If typeFieldName is null, skip projection type assignment silently

    const {
      title,
      description,
      relatedTo,
      projectId,
      assignedTo,
      status,
      priority,
      taskType,
      dueDate,
      startDate,
      estimatedHours,
      subtasks,
      tags,
      reminderDate
    } = req.body;

    // Validate assignedTo user exists and belongs to org
    if (assignedTo) {
      const assignee = await User.findOne({
        _id: assignedTo,
        organizationId: req.user.organizationId
      });
      
      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found in your organization'
        });
      }
    }

    const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const { customFieldsSet } = extractCustomFields(req.body, Task);

    const taskPayload = {
      organizationId: req.user.organizationId,
      title,
      description,
      relatedTo,
      projectId,
      assignedTo: assignedTo || req.user._id,
      assignedBy: req.user._id,
      status: status || 'todo',
      priority: priority || 'medium',
      taskType: taskType || DEFAULT_TASK_TYPE,
      dueDate,
      startDate,
      estimatedHours,
      subtasks,
      tags,
      reminderDate,
      ...(Object.keys(customFieldsSet).length > 0 && { customFields: customFieldsSet }),
      createdBy: req.user._id,
      activityLogs: [{
        user: getActorDisplayName(req.user),
        userId: req.user._id,
        action: 'created',
        details: {},
        timestamp: new Date()
      }]
    };
    assignResolvedSource(taskPayload, 'ui');

    try {
      const { evaluateDuplicates } = require('../services/duplicates');
      const dupResult = await evaluateDuplicates({
        organizationId: req.user.organizationId,
        moduleKey: 'tasks',
        candidate: taskPayload,
        emitEvent: true,
        triggeredBy: req.user._id,
        limit: 5,
      });
      if (dupResult.enabled && dupResult.hasMatch) {
        const policy = dupResult.policy || 'warn';
        if (policy === 'reject' || policy === 'warn') {
          return res.status(409).json({
            success: false,
            code: policy === 'reject' ? 'DUPLICATE_REJECTED' : 'DUPLICATE_WARNING',
            message: 'A matching Task already exists.',
            data: { matches: dupResult.matches, policy },
          });
        }
      }
    } catch (dupErr) {
      console.warn('[taskController.createTask] duplicate check failed:', dupErr.message);
    }

    const task = await Task.create(taskPayload);

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const fresh = await Task.findById(task._id);
      if (fresh) {
        await runImmediateAssignmentForSalesRecord({
          record: fresh,
          moduleKey: 'tasks',
          actorId: req.user._id,
          triggerSource: 'immediate',
          changedFields: []
        });
        await enqueueAssignmentJobsForSalesRecord({
          record: fresh,
          moduleKey: 'tasks',
          actorId: req.user._id,
          changedFields: []
        });
      }
    } catch (assignErr) {
      console.error('[taskController] assignment on create failed:', assignErr?.message || assignErr);
    }

    const populatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    // Emit domain events for task creation and assignment (non-blocking)
    emitTaskDomainEvent({
      task,
      eventType: 'task.created',
      previousState: null,
      currentState: { status: task.status, assignedTo: task.assignedTo },
      triggeredBy: req.user._id
    });

    // Emit TASK_CREATED event
    emitNotification({
      eventType: domainEvents.TASK_CREATED,
      entity: {
        type: 'Task',
        id: task._id.toString(),
        title: task.title,
        status: task.status,
        priority: task.priority
      },
      organizationId: req.user.organizationId,
      triggeredBy: req.user._id,
      sourceAppKey: 'SALES'
    }).catch(err => {
      console.error('[taskController] Error emitting TASK_CREATED notification:', err);
    });

    // Emit TASK_ASSIGNED event if task is assigned
    if (task.assignedTo) {
      emitNotification({
        eventType: domainEvents.TASK_ASSIGNED,
        entity: {
          type: 'Task',
          id: task._id.toString(),
          title: task.title,
          status: task.status,
          priority: task.priority
        },
        organizationId: req.user.organizationId,
        triggeredBy: req.user._id,
        sourceAppKey: 'SALES'
      }).catch(err => {
        console.error('[taskController] Error emitting TASK_ASSIGNED notification:', err);
      });
    }

    res.status(201).json({
      success: true,
      data: flattenCustomFieldsForResponse(populatedTask)
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating task',
      error: error.message
    });
  }
};

/** Combine list filter with an extra predicate for facet counts */
function tasksQueryAnd(baseQuery, clause) {
  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return clause;
  }
  return { $and: [baseQuery, clause] };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Keys: open, dueToday, overdue (+ totalTasks/myTasks set by caller).
 */
async function computeTasksListStatistics(query) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);
  endOfToday.setMilliseconds(-1);

  const openStatus = { status: { $nin: ['completed', 'cancelled'] } };

  const [open, dueToday, overdue] = await Promise.all([
    Task.countDocuments(tasksQueryAnd(query, openStatus)),
    Task.countDocuments(
      tasksQueryAnd(query, {
        ...openStatus,
        dueDate: { $gte: startOfToday, $lte: endOfToday }
      })
    ),
    // Before today — does not overlap Due Today
    Task.countDocuments(
      tasksQueryAnd(query, {
        ...openStatus,
        dueDate: { $lt: startOfToday }
      })
    )
  ]);

  return { open, dueToday, overdue };
}

// @desc    Get all tasks (with filters)
// @route   GET /api/tasks
// @access  Private
const getTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const query = buildTasksListQuery(req);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    const skip = (pageNum - 1) * limitNum;

    const { parseListSort } = require('../utils/parseListSort');
    const { sortObject } = parseListSort(req.query, {
      defaultField: 'createdAt',
      defaultOrder: 'desc',
      tieBreaker: '_id'
    });

    const taskPopulate = [
      { path: 'assignedTo', select: 'firstName lastName email avatar' },
      { path: 'assignedBy', select: 'firstName lastName' },
      { path: 'createdBy', select: 'firstName lastName' }
    ];
    const { resolveListSearchTerm, fetchRankedSearchPage, isSearchActive, SEARCH_FIELD_PRESETS } = require('../utils/searchRelevance');
    const searchTerm = resolveListSearchTerm(req.query, 'tasks');
    const tasksPromise = isSearchActive(searchTerm)
      ? fetchRankedSearchPage(Task, {
          matchQuery: query,
          searchTerm,
          fieldSpecs: SEARCH_FIELD_PRESETS.tasks,
          skip,
          limit: limitNum,
          fallbackSort: sortObject,
          populate: taskPopulate,
          lean: true
        })
      : Task.find(query)
          .populate('assignedTo', 'firstName lastName email avatar')
          .populate('assignedBy', 'firstName lastName')
          .populate('createdBy', 'firstName lastName')
          .sort(sortObject)
          .limit(limitNum)
          .skip(skip)
          .lean();

    const [tasks, total, listCardBreakdown] = await Promise.all([
      tasksPromise,
      Task.countDocuments(query),
      computeTasksListStatistics(query)
    ]);

    // Populate relatedTo names for list/kanban display
    try {
      await populateRelatedToNames(tasks);
    } catch (err) {
      console.error('[getTasks] populateRelatedToNames error:', err);
    }

    res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalRecords: total,
        totalTasks: total,
        tasksPerPage: limitNum
      },
      listStatistics: {
        ...listCardBreakdown,
        totalTasks: total,
        myTasks: total
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tasks',
      error: error.message
    });
  }
};

// @desc    Get task summary for homepage
const getTaskSummary = async (req, res) => {
  const requestStartedAt = req.taskSummaryRequestStartedAt || performance.now();
  const handlerStartedAt = performance.now();
  const timings = [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    const baseQuery = {
      organizationId: req.user.organizationId,
      deletedAt: null,
      assignedTo: req.user._id,
      status: { $nin: ['completed', 'cancelled'] }
    };

    const projection = { title: 1, dueDate: 1, status: 1 };

    const queryStartedAt = performance.now();
    const [overdueResult, dueTodayResult, upcomingResult] = await Promise.all([
      measureTaskSummaryQuery('summary-overdue', Task.find({
        ...baseQuery,
        dueDate: { $lt: today }
      }).sort({ dueDate: 1 }).limit(10).select(projection).lean()),
      measureTaskSummaryQuery('summary-today', Task.find({
        ...baseQuery,
        dueDate: { $gte: today, $lt: tomorrow }
      }).sort({ dueDate: 1 }).limit(10).select(projection).lean()),
      measureTaskSummaryQuery('summary-upcoming', Task.find({
        ...baseQuery,
        dueDate: { $gte: tomorrow, $lte: nextWeek }
      }).sort({ dueDate: 1 }).limit(10).select(projection).lean())
    ]);
    timings.push(...(req.taskSummaryTimings || []));
    timings.push({ name: 'db', duration: performance.now() - queryStartedAt, description: 'Task summary queries' });
    timings.push({ name: 'db_overdue', duration: overdueResult.duration, description: 'Overdue tasks' });
    timings.push({ name: 'db_today', duration: dueTodayResult.duration, description: 'Due today tasks' });
    timings.push({ name: 'db_upcoming', duration: upcomingResult.duration, description: 'Upcoming tasks' });

    const overdue = overdueResult.data;
    const dueToday = dueTodayResult.data;
    const upcoming = upcomingResult.data;

    const totalDuration = performance.now() - requestStartedAt;
    timings.push({ name: 'handler', duration: performance.now() - handlerStartedAt, description: 'Task summary controller' });
    timings.push({ name: 'total', duration: totalDuration, description: 'Task summary request' });
    res.set('Server-Timing', formatServerTiming(timings));

    if (totalDuration > 500) {
      console.warn('[getTaskSummary] slow request', {
        durationMs: Math.round(totalDuration),
        dbMs: Math.round(timings.find((timing) => timing.name === 'db')?.duration || 0),
        overdueMs: Math.round(overdueResult.duration),
        dueTodayMs: Math.round(dueTodayResult.duration),
        upcomingMs: Math.round(upcomingResult.duration),
        organizationId: req.user.organizationId,
        userId: req.user._id,
        counts: {
          overdue: overdue.length,
          dueToday: dueToday.length,
          upcoming: upcoming.length
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        overdue,
        dueToday,
        upcoming
      }
    });
  } catch (error) {
    console.error('Get task summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task summary',
      error: error.message
    });
  }
};

// @desc    Get single task by ID
// @route   GET /api/tasks/:id
// @access  Private
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    })
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .populate('subtasks.completedBy', 'firstName lastName');

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    res.status(200).json({
      success: true,
      data: flattenCustomFieldsForResponse(task)
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task',
      error: error.message
    });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
const updateTask = async (req, res) => {
  try {
    delete req.body.source;
    let task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Validate field-level write access
    const ModuleDefinition = require('../models/ModuleDefinition');
    const { validateFieldWrite } = require('../utils/fieldAccessControl');
    
    const moduleDef = await ModuleDefinition.findOne({
      organizationId: req.user.organizationId,
      key: 'tasks'
    });
    
    if (moduleDef && Array.isArray(moduleDef.fields)) {
      const fieldViolations = [];
      
      // Validate each field being updated
      for (const [fieldKey, fieldValue] of Object.entries(req.body)) {
        // Skip system fields and metadata
        if (['_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy'].includes(fieldKey)) {
          continue;
        }
        // Tags are a shared record-page capability and must remain editable
        // even if module field metadata does not explicitly define them.
        if (fieldKey === 'tags') {
          continue;
        }
        
        const validation = validateFieldWrite(fieldKey, moduleDef.fields, req.user, 'tasks');
        if (!validation.allowed) {
          fieldViolations.push({
            field: fieldKey,
            reason: validation.reason
          });
        }
      }
      
      // If any field violations, reject the entire update
      if (fieldViolations.length > 0) {
        return res.status(403).json({
          success: false,
          message: 'Field access denied',
          code: 'FIELD_ACCESS_DENIED',
          violations: fieldViolations
        });
      }

      const { validatePicklistDependencyValues } = require('../utils/dependencyEvaluation');
      const taskObj = task.toObject ? task.toObject() : { ...task };
      const mergedForPicklist = {
        ...taskObj,
        ...req.body,
        customFields: {
          ...(taskObj.customFields || {}),
          ...(req.body.customFields || {})
        }
      };
      const picklistErrors = validatePicklistDependencyValues(moduleDef.fields, mergedForPicklist);
      if (picklistErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed.',
          code: 'PICKLIST_DEPENDENCY_VIOLATION',
          validationErrors: picklistErrors
        });
      }
    }

    // Fast path: tags-only update should not be blocked by unrelated task
    // validators. Keep tag add/remove reliable across all records.
    const nonSystemKeys = Object.keys(req.body || {}).filter(
      (fieldKey) => !['_id', '__v', 'organizationId', 'createdAt', 'updatedAt', 'createdBy'].includes(fieldKey)
    );
    if (nonSystemKeys.length === 1 && nonSystemKeys[0] === 'tags') {
      const nextTags = Array.isArray(req.body.tags)
        ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
        : [];
      task.tags = nextTags;
      if (task.customFields && Object.prototype.hasOwnProperty.call(task.customFields, 'tags')) {
        delete task.customFields.tags;
        task.markModified('customFields');
      }
      await task.save();
      const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
      return res.status(200).json({
        success: true,
        data: flattenCustomFieldsForResponse(task)
      });
    }

    // Validate assignedTo if being updated
    if (req.body.assignedTo && req.body.assignedTo !== task.assignedTo.toString()) {
      const assignee = await User.findOne({
        _id: req.body.assignedTo,
        organizationId: req.user.organizationId
      });
      
      if (!assignee) {
        return res.status(404).json({
          success: false,
          message: 'Assigned user not found in your organization'
        });
      }
    }

    const oldStatus = task.status;
    const oldAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;

    // Update fields and build field-level change logs
    const requestedFields = TASK_ALLOWED_UPDATES.filter((field) => req.body[field] !== undefined);
    const oldValuesByField = requestedFields.reduce((acc, field) => {
      acc[field] = task[field];
      return acc;
    }, {});

    TASK_ALLOWED_UPDATES.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    // When description changes, push previous content to descriptionVersions (retain 365 days)
    if (requestedFields.includes('description') && !areTaskFieldValuesEqual(oldValuesByField.description, task.description)) {
      if (!Array.isArray(task.descriptionVersions)) {
        task.descriptionVersions = [];
      }
      const prevContent = oldValuesByField.description;
      if (prevContent !== undefined && prevContent !== null) {
        task.descriptionVersions.push({
          content: typeof prevContent === 'string' ? prevContent : '',
          createdAt: new Date(),
          createdBy: req.user._id
        });
      }
      const retentionCutoff = new Date();
      retentionCutoff.setDate(retentionCutoff.getDate() - 365);
      task.descriptionVersions = task.descriptionVersions.filter((v) => v.createdAt >= retentionCutoff);
      task.markModified('descriptionVersions');
    }

    const actorName = getActorDisplayName(req.user);
    const userIdsToResolve = new Set();
    if (oldValuesByField.assignedTo) userIdsToResolve.add(String(oldValuesByField.assignedTo));
    if (task.assignedTo) userIdsToResolve.add(String(task.assignedTo));

    let userNameById = {};
    if (userIdsToResolve.size > 0) {
      const userRows = await User.find({
        _id: { $in: Array.from(userIdsToResolve) },
        organizationId: req.user.organizationId
      }).select('firstName lastName username email').lean();
      userNameById = userRows.reduce((acc, userRow) => {
        acc[String(userRow._id)] = [userRow.firstName, userRow.lastName].filter(Boolean).join(' ').trim() || userRow.username || userRow.email || String(userRow._id);
        return acc;
      }, {});
    }

    const fieldChangeLogs = [];
    requestedFields.forEach((field) => {
      const previousValue = oldValuesByField[field];
      const nextValue = task[field];
      if (areTaskFieldValuesEqual(previousValue, nextValue)) return;

      const entry = buildFieldChangeLogEntry({
        actorName,
        actorId: req.user._id,
        field,
        oldValue: previousValue,
        newValue: nextValue,
        userNameById
      });
      if (entry) fieldChangeLogs.push(entry);
    });

    if (fieldChangeLogs.length > 0) {
      if (!Array.isArray(task.activityLogs)) {
        task.activityLogs = [];
      }
      task.activityLogs.push(...fieldChangeLogs);
    }

    // Merge custom fields from payload (user-defined via Settings → Modules & Fields)
    const { extractCustomFields, flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    const { customFieldsSet } = extractCustomFields(req.body, Task);
    if (Object.keys(customFieldsSet).length > 0) {
      task.customFields = { ...(task.customFields || {}), ...customFieldsSet };
      task.markModified('customFields');
    }
    // If tags are updated via canonical field, ensure stale customFields.tags
    // cannot resurrect old values on flattened responses.
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'tags') && task.customFields && Object.prototype.hasOwnProperty.call(task.customFields, 'tags')) {
      delete task.customFields.tags;
      task.markModified('customFields');
    }

    await task.save();

    if (requestedFields.includes('status') && !areTaskFieldValuesEqual(oldStatus, task.status)) {
      try {
        const { syncDealPlaybookFromActivity } = require('../services/playbookExecutionService');
        await syncDealPlaybookFromActivity({
          activityId: task._id,
          activityType: 'task',
          organizationId: req.user.organizationId,
          activityDoc: task
        });
      } catch (playbookErr) {
        console.error('[taskController] playbook sync on update failed:', playbookErr?.message || playbookErr);
      }
    }

    try {
      const { runImmediateAssignmentForSalesRecord } = require('../services/assignmentExecutionService');
      const { enqueueAssignmentJobsForSalesRecord } = require('../services/assignmentSchedulingService');
      const assignDoc = await Task.findById(task._id);
      if (assignDoc) {
        await runImmediateAssignmentForSalesRecord({
          record: assignDoc,
          moduleKey: 'tasks',
          actorId: req.user._id,
          triggerSource: 'immediate',
          changedFields: requestedFields
        });
        await enqueueAssignmentJobsForSalesRecord({
          record: assignDoc,
          moduleKey: 'tasks',
          actorId: req.user._id,
          changedFields: requestedFields
        });
      }
    } catch (assignErr) {
      console.error('[taskController] assignment on update failed:', assignErr?.message || assignErr);
    }

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    // Emit domain events for task updates (non-blocking)
    const newAssignedTo = task.assignedTo ? task.assignedTo.toString() : null;
    
    // Emit TASK_ASSIGNED if assignment changed
    if (newAssignedTo && newAssignedTo !== oldAssignedTo) {
      emitNotification({
        eventType: domainEvents.TASK_ASSIGNED,
        entity: {
          type: 'Task',
          id: task._id.toString(),
          title: task.title,
          status: task.status,
          priority: task.priority
        },
        organizationId: req.user.organizationId,
        triggeredBy: req.user._id,
        sourceAppKey: 'SALES'
      }).catch(err => {
        console.error('[taskController] Error emitting TASK_ASSIGNED notification:', err);
      });
    }

    // Emit TASK_STATUS_CHANGED if status changed
    if (task.status && task.status !== oldStatus) {
      emitTaskDomainEvent({
        task,
        eventType: 'task.status.changed',
        previousState: { status: oldStatus, assignedTo: oldAssignedTo },
        currentState: { status: task.status, assignedTo: task.assignedTo },
        triggeredBy: req.user._id
      });
      emitTaskDomainEvent({
        task,
        eventType: 'task.updated',
        previousState: { status: oldStatus, assignedTo: oldAssignedTo },
        currentState: { status: task.status, assignedTo: task.assignedTo },
        triggeredBy: req.user._id
      });
      emitNotification({
        eventType: domainEvents.TASK_STATUS_CHANGED,
        entity: {
          type: 'Task',
          id: task._id.toString(),
          title: task.title,
          status: task.status,
          priority: task.priority
        },
        organizationId: req.user.organizationId,
        triggeredBy: req.user._id,
        sourceAppKey: 'SALES'
      }).catch(err => {
        console.error('[taskController] Error emitting TASK_STATUS_CHANGED notification:', err);
      });
    }

    res.status(200).json({
      success: true,
      data: flattenCustomFieldsForResponse(updatedTask)
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task',
      error: error.message
    });
  }
};

// @desc    Update task tags only
// @route   PATCH /api/tasks/:id/tags
// @access  Private
const updateTaskTags = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const nextTags = Array.isArray(req.body?.tags)
      ? req.body.tags.map((tag) => String(tag || '').trim()).filter(Boolean)
      : [];
    task.tags = nextTags;

    if (task.customFields && Object.prototype.hasOwnProperty.call(task.customFields, 'tags')) {
      delete task.customFields.tags;
      task.markModified('customFields');
    }

    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    const { flattenCustomFieldsForResponse } = require('../utils/customFieldsExtractor');
    return res.status(200).json({
      success: true,
      data: flattenCustomFieldsForResponse(updatedTask)
    });
  } catch (error) {
    console.error('Update task tags error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error updating task tags',
      error: error.message
    });
  }
};

// @desc    Delete task (move to trash)
// @route   DELETE /api/tasks/:id
// @access  Private
const deleteTask = async (req, res) => {
  try {
    const deletionService = require('../services/deletionService');
    const result = await deletionService.moveToTrash({
      moduleKey: 'tasks',
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
        message: result.message || 'Failed to delete task'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Task moved to trash',
      retentionExpiresAt: result.retentionExpiresAt
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting task',
      error: error.message
    });
  }
};

// @desc    Update task status (quick action)
// @route   PATCH /api/tasks/:id/status
// @access  Private
const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status || typeof status !== 'string' || !status.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const previousStatus = task.status;
    task.status = status;
    if (status === 'completed' && !task.completedDate) {
      task.completedDate = new Date();
    } else if (status !== 'completed') {
      task.completedDate = null;
    }

    if (!areTaskFieldValuesEqual(previousStatus, status)) {
      if (!Array.isArray(task.activityLogs)) {
        task.activityLogs = [];
      }
      task.activityLogs.push({
        user: getActorDisplayName(req.user),
        userId: req.user._id,
        action: 'status_changed',
        details: {
          field: 'status',
          fieldLabel: TASK_FIELD_LABELS.status,
          from: formatTaskFieldValueForLog('status', previousStatus),
          to: formatTaskFieldValueForLog('status', status)
        },
        timestamp: new Date()
      });
    }

    await task.save();

    if (!areTaskFieldValuesEqual(previousStatus, status)) {
      try {
        const { syncDealPlaybookFromActivity } = require('../services/playbookExecutionService');
        await syncDealPlaybookFromActivity({
          activityId: task._id,
          activityType: 'task',
          organizationId: req.user.organizationId,
          activityDoc: task
        });
      } catch (playbookErr) {
        console.error('[taskController] playbook sync on status failed:', playbookErr?.message || playbookErr);
      }
    }

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    console.error('Update task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating task status',
      error: error.message
    });
  }
};

// @desc    Toggle subtask completion
// @route   PATCH /api/tasks/:id/subtasks/:subtaskId
// @access  Private
const toggleSubtask = async (req, res) => {
  try {
    const { id, subtaskId } = req.params;
    const { completed } = req.body;

    const task = await Task.findOne({
      _id: id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const subtask = task.subtasks.id(subtaskId);
    if (!subtask) {
      return res.status(404).json({
        success: false,
        message: 'Subtask not found'
      });
    }

    const previousCompleted = !!subtask.completed;
    subtask.completed = completed;
    if (completed) {
      subtask.completedAt = new Date();
      subtask.completedBy = req.user._id;
    } else {
      subtask.completedAt = null;
      subtask.completedBy = null;
    }

    if (previousCompleted !== !!completed) {
      if (!Array.isArray(task.activityLogs)) {
        task.activityLogs = [];
      }
      task.activityLogs.push({
        user: getActorDisplayName(req.user),
        userId: req.user._id,
        action: 'subtask_changed',
        details: {
          field: 'subtasks',
          title: subtask.title || 'Subtask',
          from: previousCompleted ? 'Completed' : 'Incomplete',
          to: completed ? 'Completed' : 'Incomplete'
        },
        timestamp: new Date()
      });
    }

    await task.save();

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Toggle subtask error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating subtask',
      error: error.message
    });
  }
};

// @desc    Get task statistics
// @route   GET /api/tasks/stats/summary
// @access  Private
const getTaskStats = async (req, res) => {
  try {
    const { assignedTo } = req.query;
    let query = { organizationId: req.user.organizationId };

    if (assignedTo) {
      if (assignedTo === 'unassigned') {
        query = {
          $and: [
            query,
            { $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] }
          ]
        };
      } else {
        query.assignedTo = assignedTo === 'me' ? req.user._id : assignedTo;
      }
    }

    // Get counts by status
    const statusCounts = await Task.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Get counts by priority
    const priorityCounts = await Task.aggregate([
      { $match: query },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Get overdue count
    const overdueCount = await Task.countDocuments({
      ...query,
      dueDate: { $lt: new Date() },
      status: { $nin: ['completed', 'cancelled'] }
    });

    // Get due today count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueTodayCount = await Task.countDocuments({
      ...query,
      dueDate: { $gte: today, $lt: tomorrow },
      status: { $nin: ['completed', 'cancelled'] }
    });

    // Format response
    const stats = {
      byStatus: {},
      byPriority: {},
      overdue: overdueCount,
      dueToday: dueTodayCount,
      total: await Task.countDocuments(query)
    };

    statusCounts.forEach(item => {
      stats.byStatus[item._id] = item.count;
    });

    priorityCounts.forEach(item => {
      stats.byPriority[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get task stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching task statistics',
      error: error.message
    });
  }
};

// @desc    Get activity logs for a task (derived from task metadata)
// @route   GET /api/tasks/:id/activity-logs
// @access  Private
const getTaskActivityLogs = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    })
      .populate('createdBy', 'firstName lastName username')
      .populate('assignedTo', 'firstName lastName username')
      .populate('activityLogs.userId', 'firstName lastName username email')
      .lean();
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const logs = [];
    const getUserName = (u) => {
      if (!u) return 'System';
      if (typeof u === 'string') return u;
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
      return name || u.username || u.email || 'User';
    };

    const persistedLogs = Array.isArray(task.activityLogs)
      ? task.activityLogs.map((entry) => ({
        timestamp: entry.timestamp || task.updatedAt || task.createdAt,
        user: entry.user || getUserName(entry.userId),
        userId: entry.userId?._id || entry.userId || null,
        action: entry.action || 'updated',
        details: entry.details || {}
      }))
      : [];

    if (persistedLogs.length > 0) {
      logs.push(...persistedLogs);
      const hasCreatedLog = persistedLogs.some((entry) => entry.action === 'created');
      if (!hasCreatedLog && task.createdAt) {
        logs.push({
          timestamp: task.createdAt,
          user: getUserName(task.createdBy),
          userId: task.createdBy?._id || task.createdBy,
          action: 'created',
          details: {}
        });
      }
    } else {
      // Legacy fallback for records that predate activityLogs.
      if (task.createdAt) {
        logs.push({
          timestamp: task.createdAt,
          user: getUserName(task.createdBy),
          userId: task.createdBy?._id || task.createdBy,
          action: 'created',
          details: {}
        });
      }
      if (task.updatedAt && task.createdAt &&
          new Date(task.updatedAt).getTime() !== new Date(task.createdAt).getTime()) {
        logs.push({
          timestamp: task.updatedAt,
          user: 'System',
          action: 'updated',
          details: {}
        });
      }
      if (task.status === 'completed' && task.completedDate) {
        logs.push({
          timestamp: task.completedDate,
          user: getUserName(task.assignedTo),
          userId: task.assignedTo?._id || task.assignedTo,
          action: 'status_changed',
          details: {
            field: 'status',
            fieldLabel: TASK_FIELD_LABELS.status,
            from: 'Unknown',
            to: 'Completed'
          }
        });
      }
    }

    logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('Get task activity logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
};

// @desc    Get comments for a task
// @route   GET /api/tasks/:id/comments
// @access  Private
const normalizeReactionEmoji = (value) => String(value || '').trim();

const toReactionUserPayload = (user) => {
  if (!user) return null;
  const rawId = typeof user === 'object' ? (user._id || user.id) : user;
  if (!rawId) return null;
  const id = String(rawId);
  if (typeof user !== 'object') {
    return { id, name: 'Unknown', avatar: '' };
  }
  const name = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || user.username || user.email || 'Unknown';
  return {
    id,
    name,
    avatar: user.avatar || ''
  };
};

const buildTaskCommentResponse = (comment, currentUserId = null) => {
  const currentUserIdString = currentUserId ? String(currentUserId) : null;
  const reactions = Array.isArray(comment?.reactions) ? comment.reactions : [];

  const summarizedReactions = reactions
    .map((reaction) => {
      const emoji = normalizeReactionEmoji(reaction?.emoji);
      if (!emoji) return null;

      const users = Array.isArray(reaction?.users) ? reaction.users : [];
      const dedupedUsers = [];
      const seenUserIds = new Set();
      users.forEach((user) => {
        const payload = toReactionUserPayload(user);
        if (!payload || seenUserIds.has(payload.id)) return;
        seenUserIds.add(payload.id);
        dedupedUsers.push(payload);
      });

      return {
        emoji,
        count: dedupedUsers.length,
        userIds: dedupedUsers.map((user) => user.id),
        reactors: dedupedUsers
      };
    })
    .filter((reaction) => reaction && reaction.count > 0);

  const myReactions = currentUserIdString
    ? summarizedReactions
      .filter((reaction) => reaction.userIds.includes(currentUserIdString))
      .map((reaction) => reaction.emoji)
    : [];

  const reactionSummary = summarizedReactions.reduce((acc, reaction) => {
    acc[reaction.emoji] = reaction.count;
    return acc;
  }, {});

  return {
    _id: comment._id,
    content: comment.content,
    author: comment.author,
    parentCommentId: comment.parentCommentId || null,
    attachments: comment.attachments || [],
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    editedAt: comment.editedAt,
    reactions: summarizedReactions.map(({ emoji, count, reactors }) => ({ emoji, count, reactors })),
    reactionSummary,
    myReactions,
    likesCount: reactionSummary['👍'] || 0
  };
};
exports.buildTaskCommentResponse = buildTaskCommentResponse;

const getTaskComments = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const comments = await TaskComment.find({ taskId: req.params.id })
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .sort({ createdAt: 1 })
      .lean();

    res.json({
      success: true,
      data: comments.map((comment) => buildTaskCommentResponse(comment, req.user?._id))
    });
  } catch (error) {
    console.error('Get task comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching comments',
      error: error.message
    });
  }
};

// @desc    Upload a file for a task comment attachment
// @route   POST /api/tasks/:id/comment-attachments
// @access  Private
const uploadTaskCommentAttachment = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const uploadResult = await persistMulterUpload(req, 'comments');
    let documentId = null;
    try {
      const documentService = require('../services/documentService');
      const registration = await documentService.registerCommentAttachmentAsDocument({
        organizationId: req.user.organizationId,
        userId: req.user._id,
        moduleKey: 'tasks',
        recordId: req.params.id,
        appKey: 'platform',
        uploadResult,
        file: req.file
      });
      documentId = registration?.document?._id ? String(registration.document._id) : null;
    } catch (registerError) {
      console.error('Task comment attachment document registration failed:', registerError.message);
    }
    res.json({
      success: true,
      url: uploadResult.url,
      storagePath: uploadResult.storagePath,
      filename: uploadResult.storedFileName,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      documentId
    });
  } catch (error) {
    console.error('Upload task comment attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading attachment',
      error: error.message
    });
  }
};

// @desc    Create a comment on a task
// @route   POST /api/tasks/:id/comments
// @access  Private
const createTaskComment = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const { content, attachments, parentCommentId } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    const validAttachments = Array.isArray(attachments)
      ? attachments
        .filter((a) => a && typeof a.url === 'string' && typeof a.filename === 'string')
        .slice(0, 10)
        .map((a) => {
          const row = {
            url: a.url,
            filename: a.filename,
            size: a.size || 0,
            mimetype: a.mimetype || ''
          };
          if (a.documentId && mongoose.Types.ObjectId.isValid(a.documentId)) {
            row.documentId = a.documentId;
          }
          return row;
        })
      : [];

    let validatedParentCommentId = null;
    if (parentCommentId) {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) {
        return res.status(400).json({ success: false, message: 'Invalid parent comment id' });
      }
      const parentComment = await TaskComment.findOne({
        _id: parentCommentId,
        taskId: req.params.id,
        organizationId: req.user.organizationId
      }).select('_id');
      if (!parentComment) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
      validatedParentCommentId = parentComment._id;
    }

    const comment = await TaskComment.create({
      taskId: req.params.id,
      organizationId: req.user.organizationId,
      content: content.trim(),
      author: req.user._id,
      parentCommentId: validatedParentCommentId,
      attachments: validAttachments
    });

    const populated = await TaskComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    // Notify @mentioned users and group members (fire-and-forget)
    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'tasks',
      entityId: String(req.params.id),
      entityType: 'Task',
      recordTitle: task.title || 'Task',
      commentId: String(comment._id),
      commentContent: content.trim(),
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Comment mention notifications error:', err));

    // Legacy Astra Super Agent comment-mention trigger removed with Astra v2 cutover.

    res.status(201).json({
      success: true,
      data: buildTaskCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Create task comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating comment',
      error: error.message
    });
  }
};

// @desc    Update a comment
// @route   PUT /api/tasks/:id/comments/:commentId
// @access  Private
const updateTaskComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await TaskComment.findOne({ _id: commentId, taskId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own comments' });
    }

    const rawContent = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const hasAttachmentsPayload = Array.isArray(req.body?.attachments);
    const validAttachments = hasAttachmentsPayload
      ? req.body.attachments
        .filter((a) => a && typeof a.url === 'string' && typeof a.filename === 'string')
        .slice(0, 10)
      : comment.attachments;

    if (!rawContent && (!Array.isArray(validAttachments) || validAttachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Comment content is required' });
    }

    comment.content = rawContent || 'Attached file(s)';
    if (hasAttachmentsPayload) {
      comment.attachments = validAttachments;
    }
    comment.editedAt = new Date();
    await comment.save();

    const populated = await TaskComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    const author = populated.author;
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Someone'
      : 'Someone';
    processCommentMentions({
      organizationId: String(req.user.organizationId),
      appKey: req.appKey || 'SALES',
      moduleKey: 'tasks',
      entityId: String(taskId),
      entityType: 'Task',
      recordTitle: task.title || 'Task',
      commentId: String(comment._id),
      commentContent: comment.content,
      authorId: String(req.user._id),
      authorName
    }).catch((err) => console.error('Comment mention notifications error:', err));

    res.json({
      success: true,
      data: buildTaskCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Update task comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating comment',
      error: error.message
    });
  }
};

// @desc    Toggle an emoji reaction for a comment
// @route   POST /api/tasks/:id/comments/:commentId/reactions
// @access  Private
const toggleTaskCommentReaction = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const emoji = normalizeReactionEmoji(req.body?.emoji);

    if (!emoji || emoji.length > 16) {
      return res.status(400).json({
        success: false,
        message: 'A valid emoji is required'
      });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await TaskComment.findOne({ _id: commentId, taskId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (!Array.isArray(comment.reactions)) {
      comment.reactions = [];
    }

    const currentUserId = String(req.user._id);
    let reaction = comment.reactions.find((entry) => normalizeReactionEmoji(entry?.emoji) === emoji);

    if (!reaction) {
      comment.reactions.push({
        emoji,
        users: [req.user._id]
      });
    } else {
      const userIndex = reaction.users.findIndex((userId) => String(userId) === currentUserId);
      if (userIndex >= 0) {
        reaction.users.splice(userIndex, 1);
      } else {
        reaction.users.push(req.user._id);
      }

      if (!reaction.users.length) {
        comment.reactions = comment.reactions.filter((entry) => String(entry._id) !== String(reaction._id));
      }
    }

    comment.markModified('reactions');
    await comment.save();

    const populated = await TaskComment.findById(comment._id)
      .populate('author', 'firstName lastName email avatar username')
      .populate('reactions.users', 'firstName lastName email avatar username')
      .lean();

    res.json({
      success: true,
      data: buildTaskCommentResponse(populated, req.user?._id)
    });
  } catch (error) {
    console.error('Toggle task comment reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling reaction',
      error: error.message
    });
  }
};

// @desc    Delete a comment
// @route   DELETE /api/tasks/:id/comments/:commentId
// @access  Private
const deleteTaskComment = async (req, res) => {
  try {
    const { id: taskId, commentId } = req.params;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const comment = await TaskComment.findOne({ _id: commentId, taskId });
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }
    if (comment.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own comments' });
    }

    await TaskComment.findByIdAndDelete(commentId);

    res.json({
      success: true,
      data: { _id: commentId }
    });
  } catch (error) {
    console.error('Delete task comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message
    });
  }
};

// @desc    Get custom fields for a task
// @route   GET /api/tasks/:id/custom-fields
// @access  Private
const getTaskCustomFields = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .select('customFields organizationId')
      .lean();
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }
    if (task.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const customFieldsData = task.customFields || {};
    const schemaPaths = new Set(Object.keys(Task.schema.paths || {}));
    const normalizeKey = (k) => String(k || '').toLowerCase().replace(/\s/g, '').replace(/-/g, '');
    const schemaPathsNormalized = new Set([...schemaPaths].map(normalizeKey));

    // System/schema fields to never return as "custom" (avoids duplicates and system field exposure)
    const RESERVED_CUSTOM_KEYS = new Set([
      'relatedto', 'relatedtotype', 'relatedtoid', 'completedat', 'deletedat', 'deletedby',
      'deletionreason', 'createdat', 'updatedat', 'createdby', 'organizationid'
    ]);

    // Get module definition for custom field definitions (org override first, then platform)
    const ModuleDefinition = require('../models/ModuleDefinition');
    const orgModule = await ModuleDefinition.findOne({
      organizationId: req.user.organizationId,
      key: 'tasks'
    })
      .select('fields')
      .lean();
    const platformModule = await ModuleDefinition.findOne({
      appKey: 'platform',
      moduleKey: 'tasks',
      organizationId: null
    })
      .select('fields')
      .lean();

    const moduleDef = orgModule || platformModule;
    const customFieldDefs = [];
    const seenNormalized = new Set();
    if (moduleDef && Array.isArray(moduleDef.fields)) {
      for (const f of moduleDef.fields) {
        if (!f || !f.key) continue;
        const keyNorm = normalizeKey(f.key);
        if (schemaPaths.has(f.key) || schemaPathsNormalized.has(keyNorm)) continue;
        if (RESERVED_CUSTOM_KEYS.has(keyNorm)) continue;
        if (seenNormalized.has(keyNorm)) continue;
        seenNormalized.add(keyNorm);
        customFieldDefs.push({ key: f.key, label: f.label || f.key });
      }
    }

    if (customFieldDefs.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Build response: all custom fields from module, with values from task (or empty)
    const customByKeyLower = new Map();
    Object.entries(customFieldsData).forEach(([k, v]) => {
      customByKeyLower.set(String(k).toLowerCase().trim(), v);
    });
    const data = customFieldDefs.map(({ key, label }) => {
      const value = customFieldsData[key] ?? customByKeyLower.get(String(key).toLowerCase().trim());
      let displayValue = value;
      if (value === undefined || value === null || value === '') {
        displayValue = '';
      } else if (value instanceof Date) {
        displayValue = value.toISOString();
      } else if (Array.isArray(value)) {
        displayValue = value.map((v) => (v && typeof v === 'object' && v.label != null ? v.label : v)).join(', ');
      } else if (value && typeof value === 'object' && !(value instanceof Date)) {
        displayValue = value.name || value.label || value.title || value._id || JSON.stringify(value);
      } else {
        displayValue = String(value);
      }
      return { key, label, value: displayValue != null ? String(displayValue) : '' };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('Get task custom fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching custom fields',
      error: error.message
    });
  }
};

const DESCRIPTION_VERSION_RETENTION_DAYS = 365;

// @desc    Get task description version history
// @route   GET /api/tasks/:id/description-versions
// @access  Private
const getDescriptionVersions = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    }).select('description descriptionVersions').lean();

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const versions = (task.descriptionVersions || [])
      .map((v) => ({
        content: v.content,
        createdAt: v.createdAt,
        createdBy: v.createdBy
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const createdByIds = [...new Set(versions.map((v) => v.createdBy).filter(Boolean))];
    let createdByMap = {};
    if (createdByIds.length > 0) {
      const users = await User.find({
        _id: { $in: createdByIds },
        organizationId: req.user.organizationId
      })
        .select('firstName lastName')
        .lean();
      users.forEach((u) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        createdByMap[String(u._id)] = name || 'Unknown';
      });
    }

    const list = versions.map((v) => ({
      content: v.content,
      createdAt: v.createdAt,
      createdBy: v.createdBy ? createdByMap[String(v.createdBy)] || 'Unknown' : 'Unknown',
      createdById: v.createdBy
    }));

    res.status(200).json({
      success: true,
      data: {
        currentDescription: task.description || '',
        versions: list
      }
    });
  } catch (error) {
    console.error('Get description versions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching description versions',
      error: error.message
    });
  }
};

// @desc    Restore a task description version
// @route   POST /api/tasks/:id/description-versions/restore
// @body    { versionIndex: number } (0 = most recent version in list)
// @access  Private
const restoreDescriptionVersion = async (req, res) => {
  try {
    const task = await Task.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId,
      deletedAt: null
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    const { versionIndex } = req.body;
    if (typeof versionIndex !== 'number' || versionIndex < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid versionIndex'
      });
    }

    const versions = (task.descriptionVersions || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const version = versions[versionIndex];
    if (!version) {
      return res.status(404).json({
        success: false,
        message: 'Version not found'
      });
    }

    const previousDescription = task.description;
    task.description = version.content || '';
    if (!Array.isArray(task.descriptionVersions)) {
      task.descriptionVersions = [];
    }
    if (previousDescription !== undefined && previousDescription !== null) {
      task.descriptionVersions.push({
        content: typeof previousDescription === 'string' ? previousDescription : '',
        createdAt: new Date(),
        createdBy: req.user._id
      });
    }
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - DESCRIPTION_VERSION_RETENTION_DAYS);
    task.descriptionVersions = task.descriptionVersions.filter((v) => v.createdAt >= retentionCutoff);
    await task.save();

    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('assignedBy', 'firstName lastName')
      .populate('createdBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    console.error('Restore description version error:', error);
    res.status(500).json({
      success: false,
      message: 'Error restoring description version',
      error: error.message
    });
  }
};

const getTasksListMeta = async (req, res) => {
  try {
    const query = buildTasksListQuery(req);
    const meta = await fetchListMeta(Task, query);
    sendListMetaResponse(res, meta);
  } catch (error) {
    console.error('[getTasksListMeta] error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch task list meta' });
  }
};

const getTaskRecordMeta = async (req, res) => {
  try {
    const meta = await fetchRecordUpdatedAtMeta(Task, {
      organizationId: req.user.organizationId,
      recordId: req.params.id,
    });
    sendRecordMetaResponse(res, meta);
  } catch (error) {
    console.error('[getTaskRecordMeta] error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch task record meta' });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTasksListMeta,
  getTaskRecordMeta,
  getTaskSummary,
  getTaskById,
  updateTask,
  updateTaskTags,
  deleteTask,
  updateTaskStatus,
  toggleSubtask,
  getTaskStats,
  getTaskActivityLogs,
  getTaskComments,
  createTaskComment,
  updateTaskComment,
  toggleTaskCommentReaction,
  deleteTaskComment,
  uploadTaskCommentAttachment,
  getTaskCustomFields,
  getDescriptionVersions,
  restoreDescriptionVersion,
  buildTaskCommentResponse
};
