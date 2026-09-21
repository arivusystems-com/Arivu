'use strict';

const {
  formatCurrencyAmount,
  resolveCurrencyDisplayMode
} = require('../../../utils/currencyFormat');
const { fieldKeyVariants } = require('../../../utils/mergeTagRecordNormalizer');
const { normalizeMergeTagExpression } = require('../../../utils/mergeTagPathNormalizer');

const MERGE_TAG_PATTERN = /\{\{\s*([^}]+?)\s*\}\}/g;

const CURRENCY_LEAF_FIELDS = new Set([
  'unitprice',
  'linetotal',
  'linesubtotal',
  'subtotal',
  'taxtotal',
  'grandtotal',
  'sectiontotal',
  'sectionsubtotal',
  'sectiondiscounttotal',
  'amountdue',
  'unitpricesnapshot',
  'linediscounttotal',
  'globaldiscounttotal',
  'adjustmenttotal',
  'discountamount',
  'discounttotal'
]);

/**
 * @param {Record<string, unknown>} scope
 */
function resolveCurrencyCode(scope) {
  return String(
    scope?.parameters?.currency
    || scope?.Quote?.currency
    || scope?.Invoice?.currency
    || scope?.Record?.currency
    || scope?.record?.currency
    || scope?.line?.currencySnapshot
    || scope?.currencySnapshot
    || ''
  ).trim();
}

/**
 * @param {string} pathPart
 */
function inferCurrencyFormat(pathPart) {
  const leaf = String(pathPart || '').split('.').pop()?.toLowerCase() || '';
  return CURRENCY_LEAF_FIELDS.has(leaf) ? 'currency' : '';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatValue(value, formatSpec, context) {
  if (value == null || value === '') return '';

  const format = String(formatSpec || '').trim().toLowerCase();
  const currency = resolveCurrencyCode(context);

  switch (format) {
    case 'currency':
      return formatCurrency(value, currency, context);
    case 'date':
      return formatDate(value);
    case 'uppercase':
      return String(value).toUpperCase();
    case 'lowercase':
      return String(value).toLowerCase();
    default:
      return String(value);
  }
}

function formatCurrency(value, currency, context) {
  const locale = String(context?.parameters?.locale || context?.locale || 'en-US');
  return formatCurrencyAmount(
    value,
    currency,
    resolveCurrencyDisplayMode(context),
    locale
  );
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value ?? '');
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} path
 */
function resolveScopeKey(scope, part) {
  if (Object.prototype.hasOwnProperty.call(scope, part)) return part;

  const lower = String(part || '').toLowerCase();
  for (const key of Object.keys(scope || {})) {
    if (typeof key === 'string' && key.toLowerCase() === lower) {
      return key;
    }
  }

  return part;
}

function resolvePath(scope, path) {
  const parts = String(path || '')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return { found: false, value: undefined };
  }

  let current = scope;
  for (let index = 0; index < parts.length; index += 1) {
    let part = index === 0 ? resolveScopeKey(current, parts[index]) : parts[index];
    if (current == null || typeof current !== 'object') {
      return { found: false, value: undefined };
    }

    if (Object.prototype.hasOwnProperty.call(current, part)) {
      current = current[part];
      continue;
    }

    let resolved = false;
    for (const variant of fieldKeyVariants(part)) {
      if (Object.prototype.hasOwnProperty.call(current, variant)) {
        current = current[variant];
        resolved = true;
        break;
      }
    }

    if (!resolved) {
      return { found: false, value: undefined };
    }
  }

  return { found: true, value: current };
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} pathPart
 */
const LETTERHEAD_ORG_FIELD_KEYS = new Set([
  'address',
  'city',
  'state',
  'postalcode',
  'postal_code',
  'zip',
  'country',
  'phone',
  'email',
  'website',
  'logourl'
]);

function isLetterheadOrganizationField(pathPart) {
  const parts = String(pathPart || '').split('.').filter(Boolean);
  if (parts.length !== 2) return false;
  if (String(parts[0]).toLowerCase() !== 'organization') return false;
  const leaf = String(parts[1]).toLowerCase();
  return LETTERHEAD_ORG_FIELD_KEYS.has(leaf);
}

function resolveLetterheadOrganizationFallback(rootScope, pathPart) {
  if (!isLetterheadOrganizationField(pathPart)) {
    return { found: false, value: undefined };
  }

  const field = String(pathPart).split('.')[1];
  return resolvePath(rootScope, `CurrentOrganization.${field}`);
}

function hasMeaningfulOrganizationValue(scope, pathPart) {
  const result = resolvePath(scope, pathPart);
  return result.found && result.value != null && String(result.value).trim() !== '';
}

function normalizeLineItemPath(scope, pathPart) {
  const path = String(pathPart || '').trim();
  const lower = path.toLowerCase();

  // Builder sometimes emits Line.* / lines.*; row scope uses line.*
  if (
    (lower.startsWith('lines.') || lower.startsWith('line.'))
    && (scope?.line || scope?.item)
  ) {
    const field = path.includes('.') ? path.slice(path.indexOf('.') + 1) : path;
    if (scope?.line && Object.prototype.hasOwnProperty.call(scope.line, field)) {
      return `line.${field}`;
    }
    if (scope?.item && Object.prototype.hasOwnProperty.call(scope.item, field)) {
      return `line.${field}`;
    }
    if (lower.startsWith('line.') || lower.startsWith('lines.')) {
      return `line.${field}`;
    }
  }

  if (!lower.startsWith('lines.')) return path;
  if (!scope?.line && !scope?.item) return path;
  const field = path.slice('lines.'.length);
  if (scope?.line && Object.prototype.hasOwnProperty.call(scope.line, field)) {
    return `line.${field}`;
  }
  if (scope?.item && Object.prototype.hasOwnProperty.call(scope.item, field)) {
    return `line.${field}`;
  }
  return field;
}

/**
 * @param {Record<string, unknown>} scope
 * @param {string} expression
 */
function normalizeLogoMergePath(pathPart) {
  const lower = String(pathPart || '').trim().toLowerCase();
  if (
    lower === 'currentorganization.settings.logourl'
    || lower === 'currentorganization.logourl'
    || lower === 'organization.settings.logourl'
  ) {
    return 'CurrentOrganization.logoUrl';
  }
  return pathPart;
}

function resolveMergeExpression(rootScope, expression) {
  const raw = normalizeMergeTagExpression(String(expression || '').trim());
  if (!raw) {
    return { value: '', resolved: false, path: raw };
  }

  const [pathPart, ...formatParts] = raw.split('|').map((part) => part.trim());
  const explicitFormat = formatParts.join('|').replace(/^format:/i, '');
  const formatSpec = explicitFormat || inferCurrencyFormat(pathPart);
  const normalizedPath = normalizeLineItemPath(
    rootScope,
    normalizeLogoMergePath(pathPart)
  );

  let { found, value } = resolvePath(rootScope, normalizedPath);

  if (
    (!found || value == null || String(value).trim() === '')
    && isLetterheadOrganizationField(normalizedPath)
    && !hasMeaningfulOrganizationValue(rootScope, normalizedPath)
  ) {
    const letterhead = resolveLetterheadOrganizationFallback(rootScope, normalizedPath);
    if (letterhead.found) {
      found = true;
      value = letterhead.value;
    }
  }

  if (!found) {
    return { value: '', resolved: false, path: pathPart };
  }

  return {
    value: formatValue(value, formatSpec, rootScope),
    resolved: true,
    path: pathPart
  };
}

/**
 * @param {string} input
 * @param {Record<string, unknown>} scope
 * @param {{ collectIssues?: Array<object> }} [options]
 */
function resolveMergeTagsInString(input, scope, options = {}) {
  if (input == null) return '';
  const text = String(input);
  const issues = options.collectIssues;

  return text.replace(MERGE_TAG_PATTERN, (match, expression) => {
    const result = resolveMergeExpression(scope, expression);
    if (!result.resolved) {
      const issue = {
        severity: options.lenient ? 'warning' : 'error',
        code: 'MERGE_TAG_UNRESOLVED',
        message: `Merge tag could not be resolved: ${match}`,
        path: result.path
      };
      issues?.push(issue);
      return options.lenient ? match : '';
    }
    return result.value ?? '';
  });
}

module.exports = {
  MERGE_TAG_PATTERN,
  resolvePath,
  normalizeLineItemPath,
  resolveMergeExpression,
  resolveMergeTagsInString,
  formatValue,
  resolveCurrencyCode,
  inferCurrencyFormat
};
