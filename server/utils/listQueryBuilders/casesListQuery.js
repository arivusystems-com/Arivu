const mongoose = require('mongoose');
const Case = require('../../models/Case');
const { parseCaseListQuery } = require('../caseListQuery');
const {
  CASE_PRIORITIES,
  CASE_TYPES,
  CASE_CHANNELS,
  CASE_STATUSES,
} = require('../../constants/caseLifecycle');

const OPEN_CASE_STATUSES = ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer'];

function casesQueryAnd(baseQuery, clause) {
  if (!baseQuery || Object.keys(baseQuery).length === 0) {
    return clause;
  }
  return { $and: [baseQuery, clause] };
}

/**
 * Full-result stats for list UI cards (same Mongo filter as the list query).
 * Keys: open, unassigned, slaBreached (+ totalCases/myCases set by caller).
 */
async function computeCasesListStatistics(query) {
  const openStatus = { status: { $in: OPEN_CASE_STATUSES } };
  const unassignedClause = {
    $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
  };

  const [open, unassigned, slaBreached] = await Promise.all([
    Case.countDocuments(casesQueryAnd(query, openStatus)),
    Case.countDocuments(casesQueryAnd(query, unassignedClause)),
    Case.countDocuments(
      casesQueryAnd(query, {
        ...openStatus,
        slaBreached: true,
      })
    ),
  ]);

  return { open, unassigned, slaBreached };
}

function buildCasesListQuery(req) {
  const queryParams = { ...(req.query || {}) };
  if (queryParams.assignedTo === 'me') {
    queryParams.assignedTo = req.user?._id;
  }

  const openOnly =
    String(queryParams.open ?? '').trim().toLowerCase() === 'true';
  delete queryParams.open;

  const assignedRaw = queryParams.assignedTo;
  const unassignedAssignee =
    assignedRaw === 'unassigned'
    || assignedRaw === 'null'
    || assignedRaw === null;
  if (unassignedAssignee) {
    delete queryParams.assignedTo;
  }

  const parsedQuery = parseCaseListQuery(queryParams, {
    CASE_STATUSES: Case.CASE_STATUSES || CASE_STATUSES || [],
    CASE_PRIORITIES,
    CASE_TYPES,
    CASE_CHANNELS,
  });
  if (parsedQuery.errors.length > 0) {
    const error = new Error(parsedQuery.errors[0]);
    error.statusCode = 400;
    throw error;
  }
  if (parsedQuery.filters.assignedTo && !mongoose.Types.ObjectId.isValid(parsedQuery.filters.assignedTo)) {
    const error = new Error('Invalid assignedTo filter');
    error.statusCode = 400;
    throw error;
  }

  let query = {
    organizationId: req.user.organizationId,
    deletedAt: null,
    ...parsedQuery.filters,
  };

  if (unassignedAssignee) {
    query = casesQueryAnd(query, {
      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
    });
  }

  if (openOnly && query.status == null) {
    query.status = { $in: OPEN_CASE_STATUSES };
  } else if (openOnly && query.status != null) {
    query = casesQueryAnd(query, { status: { $in: OPEN_CASE_STATUSES } });
  }

  const { applyListSharingToQuery } = require('../sharingQueryUtils');
  applyListSharingToQuery(query, req, 'cases');

  const { buildSearchOrConditions, resolveListSearchTerm } = require('../searchRelevance');
  const searchTerm = resolveListSearchTerm(req.query || {}, 'cases');
  if (searchTerm) {
    const searchOr = buildSearchOrConditions(searchTerm, [
      'title',
      'caseId',
      'description',
      'requesterEmail',
    ]);
    if (searchOr.length > 0) {
      query = {
        ...query,
        $and: [...(query.$and || []), { $or: searchOr }],
      };
    }
  }

  const { applyListFilterQueryParam } = require('../listFilterQuery');
  return applyListFilterQueryParam(query, req.query, 'cases', { userId: req.user?._id });
}

module.exports = {
  buildCasesListQuery,
  computeCasesListStatistics,
  OPEN_CASE_STATUSES,
};
