/**
 * Search relevance scoring: prefix matches rank above substring matches.
 * Lower score = better match.
 */

const NO_MATCH_SCORE = 99;

function escapeSearchRegex(term) {
  return String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchTerm(term) {
  return String(term || '').trim();
}

/**
 * Split a search query into individual terms. Commas act as OR separators.
 * Single-value queries (no comma) return one term — same behavior as before.
 * @param {string} query
 * @returns {string[]}
 */
function parseSearchTerms(query) {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return [];
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildContainsRegex(term) {
  const escaped = escapeSearchRegex(normalizeSearchTerm(term));
  return new RegExp(escaped, 'i');
}

function buildPrefixRegex(term) {
  const escaped = escapeSearchRegex(normalizeSearchTerm(term));
  return new RegExp(`^${escaped}`, 'i');
}

/**
 * @param {string} text
 * @param {string} query
 * @returns {number} 0 = prefix, 1 = word-boundary prefix, 2 = contains, 99 = no match
 */
function scoreTextMatch(text, query) {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return NO_MATCH_SCORE;

  const value = String(text ?? '').trim();
  if (!value) return NO_MATCH_SCORE;

  const lowerValue = value.toLowerCase();
  const lowerQuery = normalized.toLowerCase();

  if (lowerValue.startsWith(lowerQuery)) return 0;

  const wordBoundaryRegex = new RegExp(`(?:^|\\s)${escapeSearchRegex(normalized)}`, 'i');
  if (wordBoundaryRegex.test(value)) return 1;

  if (lowerValue.includes(lowerQuery)) return 2;

  return NO_MATCH_SCORE;
}

/**
 * @param {object} record
 * @param {string} query
 * @param {Array<{ getValue: (record: object) => string, primary?: boolean }>} fieldGetters
 */
function scoreRecordMatch(record, query, fieldGetters) {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return NO_MATCH_SCORE;

  let best = NO_MATCH_SCORE;

  for (const term of terms) {
    for (const { getValue, primary = false } of fieldGetters) {
      const textScore = scoreTextMatch(getValue(record), term);
      if (textScore === NO_MATCH_SCORE) continue;

      const weightOffset = primary ? 0 : 3;
      best = Math.min(best, textScore + weightOffset);
    }
  }

  return best;
}

function sortBySearchRelevance(items, query, fieldGetters) {
  if (parseSearchTerms(query).length === 0 || !Array.isArray(items) || items.length === 0) {
    return items;
  }

  return [...items].sort((a, b) => {
    const scoreA = scoreRecordMatch(a, query, fieldGetters);
    const scoreB = scoreRecordMatch(b, query, fieldGetters);
    if (scoreA !== scoreB) return scoreA - scoreB;
    return 0;
  });
}

function rankAndLimit(items, query, fieldGetters, limit) {
  return sortBySearchRelevance(items, query, fieldGetters).slice(0, limit);
}

/**
 * Build Mongo $or conditions: each term matches any of the given fields (term OR term, field OR field).
 * @param {string} query
 * @param {string[]} fieldNames
 */
function buildSearchOrConditions(query, fieldNames) {
  const terms = parseSearchTerms(query);
  if (terms.length === 0 || fieldNames.length === 0) return [];

  const conditions = [];
  for (const term of terms) {
    const regex = buildContainsRegex(term);
    for (const field of fieldNames) {
      conditions.push({ [field]: regex });
    }
  }
  return conditions;
}

/**
 * People name search: full-string field matches plus first/last token AND pairs.
 * Without this, "Prabhu Balu" never matches first_name=Prabhu + last_name=Balu.
 * @param {string} query
 * @param {string[]} [fieldNames]
 */
function buildPeopleNameOrConditions(
  query,
  fieldNames = ['first_name', 'last_name', 'email', 'phone', 'mobile'],
) {
  const conditions = buildSearchOrConditions(query, fieldNames);
  const parts = normalizeSearchTerm(query).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return conditions;

  const first = parts[0];
  const last = parts.slice(1).join(' ');
  conditions.push({
    $and: [
      { first_name: buildContainsRegex(first) },
      { last_name: buildContainsRegex(last) },
    ],
  });
  conditions.push({
    $and: [
      { first_name: buildContainsRegex(last) },
      { last_name: buildContainsRegex(first) },
    ],
  });
  return conditions;
}

function mongoFieldScoreExpr(fieldExpr, escapedQuery, { primary = true } = {}) {
  const prefixScore = primary ? 0 : 3;
  const wordScore = primary ? 1 : 4;
  const containsScore = primary ? 2 : 5;
  const strField = { $toString: { $ifNull: [fieldExpr, ''] } };

  return {
    $cond: [
      { $regexMatch: { input: strField, regex: `^${escapedQuery}`, options: 'i' } },
      prefixScore,
      {
        $cond: [
          { $regexMatch: { input: strField, regex: `(?:^|\\s)${escapedQuery}`, options: 'i' } },
          wordScore,
          {
            $cond: [
              { $regexMatch: { input: strField, regex: escapedQuery, options: 'i' } },
              containsScore,
              NO_MATCH_SCORE
            ]
          }
        ]
      }
    ]
  };
}

/**
 * @param {string} query
 * @param {Array<{ expr: string | object, primary?: boolean }>} fieldSpecs
 */
function buildMongoRelevanceScoreExpr(query, fieldSpecs) {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return NO_MATCH_SCORE;

  const termScores = terms.map((term) => {
    const escaped = escapeSearchRegex(term);
    const fieldScores = fieldSpecs.map((spec) =>
      mongoFieldScoreExpr(spec.expr, escaped, { primary: spec.primary !== false })
    );
    return { $min: fieldScores };
  });

  return termScores.length === 1 ? termScores[0] : { $min: termScores };
}

function buildSearchAwareSort(searchTerm, fallbackSort = { createdAt: -1 }) {
  if (parseSearchTerms(searchTerm).length === 0) return fallbackSort;
  return { _searchScore: 1, ...fallbackSort };
}

function isSearchActive(searchTerm) {
  return parseSearchTerms(searchTerm).length > 0;
}

/**
 * Aggregate $match does not cast string ObjectIds the way Model.find() does.
 * Without casting, filters like assignedTo=<userId string> return zero hits while
 * countDocuments (which casts) still reports matches — search appears broken under
 * My Tasks / assignee filters but works on All.
 */
function castMatchQueryForAggregate(Model, matchQuery) {
  if (!matchQuery || typeof matchQuery !== 'object') return matchQuery || {};
  if (!Model || typeof Model.find !== 'function') return matchQuery;
  try {
    const query = Model.find(matchQuery);
    if (typeof query.cast === 'function') {
      query.cast(Model);
    } else if (typeof query._castConditions === 'function') {
      query._castConditions();
    }
    if (typeof query.getFilter === 'function') {
      return query.getFilter();
    }
  } catch {
    /* keep raw matchQuery */
  }
  return matchQuery;
}

/**
 * Ranked page fetch: aggregate for relevance order, then hydrate with populate.
 */
async function fetchRankedSearchPage(Model, options) {
  const {
    matchQuery,
    searchTerm,
    fieldSpecs,
    skip = 0,
    limit = 20,
    fallbackSort = { createdAt: -1 },
    populate = [],
    lean = true,
    select = null
  } = options;

  const terms = parseSearchTerms(searchTerm);
  if (terms.length === 0) {
    let q = Model.find(matchQuery);
    if (select) q = q.select(select);
    for (const p of populate) q = q.populate(p);
    return q.sort(fallbackSort).skip(skip).limit(limit).lean(lean);
  }

  const castedMatch = castMatchQueryForAggregate(Model, matchQuery);
  const sort = buildSearchAwareSort(searchTerm, fallbackSort);
  const pipeline = [
    { $match: castedMatch },
    { $addFields: { _searchScore: buildMongoRelevanceScoreExpr(searchTerm, fieldSpecs) } },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
    { $project: { _id: 1 } }
  ];

  const ranked = await Model.aggregate(pipeline);
  if (ranked.length === 0) return [];

  const ids = ranked.map((r) => r._id);
  let findQuery = Model.find({ _id: { $in: ids } });
  if (select) findQuery = findQuery.select(select);
  for (const p of populate) findQuery = findQuery.populate(p);

  const docs = await findQuery.lean(lean);
  const docMap = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => docMap.get(String(id))).filter(Boolean);
}

const PEOPLE_FULL_NAME_EXPR = {
  $trim: {
    input: {
      $concat: [
        { $ifNull: ['$first_name', ''] },
        ' ',
        { $ifNull: ['$last_name', ''] }
      ]
    }
  }
};

function parseFilterQueryAst(raw) {
  if (!raw) return null;
  let current = raw;
  for (let depth = 0; depth < 2; depth += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) return current;
    if (typeof current !== 'string') return null;
    try {
      current = JSON.parse(String(current));
    } catch {
      return null;
    }
  }
  return current && typeof current === 'object' && !Array.isArray(current) ? current : null;
}

function collectContainsRules(node, results = []) {
  if (!node || typeof node !== 'object') return results;
  const operator = String(node.operator || 'contains');
  if (node.fieldKey && operator === 'contains' && typeof node.value === 'string') {
    const trimmed = node.value.trim();
    if (trimmed) {
      results.push({ fieldKey: String(node.fieldKey), value: trimmed });
    }
    return results;
  }
  const children = Array.isArray(node.children) ? node.children : [];
  for (const child of children) {
    collectContainsRules(child, results);
  }
  return results;
}

const MODULE_PRIMARY_SEARCH_FILTER_FIELDS = {
  organizations: ['name'],
  people: ['name'],
  deals: ['name'],
  tasks: ['title'],
  cases: ['title'],
  documents: ['title'],
  events: ['eventName'],
  forms: ['name'],
  items: ['item_name'],
};

/**
 * When column filters use contains on a primary search field, treat like main search for ranking.
 * @param {string|object|null} filterQueryParam
 * @param {string[]} primaryFieldKeys
 */
function extractSearchTermFromFilterQuery(filterQueryParam, primaryFieldKeys = ['name']) {
  const ast = parseFilterQueryAst(filterQueryParam);
  if (!ast) return '';

  const allowed = new Set(primaryFieldKeys.map((key) => String(key).toLowerCase()));
  const rules = collectContainsRules(ast).filter((rule) =>
    allowed.has(String(rule.fieldKey).toLowerCase())
  );
  return rules[0]?.value || '';
}

/**
 * Resolve effective list search term from query params (main search or column contains on primary field).
 * @param {Record<string, unknown>} params
 * @param {string} [moduleKey]
 */
function resolveListSearchTerm(params, moduleKey) {
  const direct = params?.search || params?.name;
  if (direct && String(direct).trim()) {
    return String(direct).trim();
  }
  const primaryFields = MODULE_PRIMARY_SEARCH_FILTER_FIELDS[moduleKey] || ['name'];
  return extractSearchTermFromFilterQuery(params?.filterQuery, primaryFields);
}

const SEARCH_FIELD_PRESETS = {
  people: [
    { expr: '$first_name', primary: true },
    { expr: '$last_name', primary: true },
    { expr: PEOPLE_FULL_NAME_EXPR, primary: true },
    { expr: '$email', primary: false },
    { expr: '$phone', primary: false },
    { expr: '$mobile', primary: false }
  ],
  organizations: [{ expr: '$name', primary: true }],
  deals: [
    { expr: '$name', primary: true },
    { expr: '$description', primary: false }
  ],
  tasks: [
    { expr: '$title', primary: true },
    { expr: '$description', primary: false }
  ],
  events: [
    { expr: '$eventName', primary: true },
    { expr: '$location', primary: false }
  ],
  forms: [
    { expr: '$name', primary: true },
    { expr: '$description', primary: false }
  ],
  items: [
    { expr: '$item_name', primary: true },
    { expr: '$item_code', primary: false },
    { expr: '$item_id', primary: false },
    { expr: '$description', primary: false }
  ]
};

module.exports = {
  NO_MATCH_SCORE,
  escapeSearchRegex,
  normalizeSearchTerm,
  parseSearchTerms,
  buildContainsRegex,
  buildPrefixRegex,
  scoreTextMatch,
  scoreRecordMatch,
  sortBySearchRelevance,
  rankAndLimit,
  buildSearchOrConditions,
  buildPeopleNameOrConditions,
  buildMongoRelevanceScoreExpr,
  buildSearchAwareSort,
  castMatchQueryForAggregate,
  fetchRankedSearchPage,
  isSearchActive,
  extractSearchTermFromFilterQuery,
  resolveListSearchTerm,
  MODULE_PRIMARY_SEARCH_FILTER_FIELDS,
  SEARCH_FIELD_PRESETS
};
