'use strict';

const { emit: emitDomainEvent } = require('../domainEvents');

function emitDuplicateEvent({
  eventType,
  organizationId,
  moduleKey,
  entityId = null,
  triggeredBy = null,
  previousState = null,
  currentState = null,
}) {
  try {
    emitDomainEvent({
      entityType: String(moduleKey || 'record'),
      entityId: entityId ? String(entityId) : 'duplicate',
      eventType,
      appKey: 'PLATFORM',
      organizationId,
      triggeredBy,
      previousState,
      currentState,
      changedFields: [],
    });
  } catch (err) {
    console.warn('[duplicates/events] emit failed', err?.message);
  }
}

module.exports = {
  emitDuplicateEvent,
};
