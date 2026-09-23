const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const Deal = require('../models/Deal');
const Event = require('../models/Event');

const APP_KEYS = ['SALES', 'AUDIT', 'PORTAL', 'HELPDESK', 'PLATFORM'];
const { canAccessLiveChatNotifications } = require('../utils/liveChatNotificationAccess');
const { serializeEntityForClient } = require('../utils/notificationEntityDisplay');

/**
 * Enrich notification items with entity titles (Task title, Event eventName, etc.)
 * so the client can show "Latest: Design logo" instead of "Latest: Task".
 */
async function enrichWithEntityTitles(items, organizationId) {
  const taskIds = [];
  const dealIds = [];
  const eventIds = [];
  const itemIndexByKey = new Map(); // 'Task_<id>' -> [indices]

  items.forEach((item, idx) => {
    if (!item.entity?.id || !mongoose.isValidObjectId(item.entity.id)) return;
    const type = item.entity.type;
    const id = item.entity.id;
    const key = `${type}_${id}`;
    if (!itemIndexByKey.has(key)) itemIndexByKey.set(key, []);
    itemIndexByKey.get(key).push(idx);

    if (type === 'Task') taskIds.push(id);
    else if (type === 'Deal') dealIds.push(id);
    else if (type === 'Audit' || type === 'Event') eventIds.push(id);
  });

  const titleByKey = new Map();

  if (taskIds.length > 0) {
    const tasks = await Task.find({
      _id: { $in: taskIds.map((id) => new mongoose.Types.ObjectId(id)) },
      organizationId
    })
      .select('_id title')
      .lean();
    for (const t of tasks) {
      titleByKey.set(`Task_${t._id.toString()}`, t.title || null);
    }
  }

  if (dealIds.length > 0) {
    const deals = await Deal.find({
      _id: { $in: dealIds.map((id) => new mongoose.Types.ObjectId(id)) },
      organizationId
    })
      .select('_id name')
      .lean();
    for (const d of deals) {
      titleByKey.set(`Deal_${d._id.toString()}`, d.name || null);
    }
  }

  if (eventIds.length > 0) {
    const events = await Event.find({
      _id: { $in: eventIds.map((id) => new mongoose.Types.ObjectId(id)) },
      organizationId
    })
      .select('_id eventName')
      .lean();
    for (const e of events) {
      titleByKey.set(`Event_${e._id.toString()}`, e.eventName || null);
      titleByKey.set(`Audit_${e._id.toString()}`, e.eventName || null);
    }
  }

  const result = items.map((item) => ({ ...item }));
  for (const [key, indices] of itemIndexByKey) {
    const title = titleByKey.get(key);
    if (title != null) {
      for (const idx of indices) {
        if (result[idx].entity) result[idx].entity.title = title;
      }
    }
  }
  return result;
}

function normalizeAppKey(req) {
  const fromQuery = req.query.appKey;
  const fromBody = req.body?.appKey;
  const fromContext = req.appKey || req.appContext?.appKey;
  const appKey = fromQuery || fromBody || fromContext;
  if (!appKey || !APP_KEYS.includes(appKey)) {
    return null;
  }
  return appKey;
}

// GET /api/notifications
exports.listNotifications = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const cursor = req.query.cursor;

  const query = {
    userId: req.user._id,
    organizationId: req.user.organizationId,
    appKey,
    channel: 'IN_APP'  // Only show in-app notifications in the panel; EMAIL/PUSH/etc. are delivery channels
  };

  if (unreadOnly) {
    query.readAt = null;
  }

  if (cursor && mongoose.isValidObjectId(cursor)) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  try {
    const items = await Notification.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1); // fetch one extra to compute nextCursor

    let nextCursor = null;
    if (items.length > limit) {
      const next = items.pop();
      nextCursor = String(next._id);
    }

    let responseItems = items.map(n => ({
      id: String(n._id),
      eventType: n.eventType,
      title: n.title,
      body: n.body,
      priority: n.priority,
      entity: serializeEntityForClient(n.entity),
      readAt: n.readAt,
      createdAt: n.createdAt
    }));

    responseItems = await enrichWithEntityTitles(responseItems, req.user.organizationId);

    // If unreadOnly is true, also include the total unread count
    let unreadCount = null;
    if (unreadOnly) {
      unreadCount = await Notification.countDocuments({
        userId: req.user._id,
        organizationId: req.user.organizationId,
        appKey,
        channel: 'IN_APP',
        readAt: null
      });
    }

    return res.json({
      items: responseItems,
      nextCursor,
      ...(unreadCount !== null && { unreadCount })
    });
  } catch (err) {
    console.error('[notificationController:listNotifications] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list notifications' });
  }
};

// POST /api/notifications/:id/read
exports.markRead = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  const id = req.params.id;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification id' });
  }

  try {
    const notification = await Notification.findOne({
      _id: id,
      userId: req.user._id,
      organizationId: req.user.organizationId,
      appKey
    });

    if (!notification) {
      // Do not leak existence; treat as success
      return res.json({ success: true });
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[notificationController:markRead] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read' });
  }
};

// POST /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  const appKey = normalizeAppKey(req);
  if (!appKey) {
    return res.status(400).json({ success: false, message: 'appKey is required' });
  }

  try {
    const result = await Notification.updateMany(
      {
        userId: req.user._id,
        organizationId: req.user.organizationId,
        appKey,
        channel: 'IN_APP',
        readAt: null
      },
      { $set: { readAt: new Date() } }
    );

    return res.json({
      success: true,
      updated: result.modifiedCount || 0
    });
  } catch (err) {
    console.error('[notificationController:markAllRead] Error:', err);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications as read' });
  }
};


