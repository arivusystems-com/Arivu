const NO_MATCH_SCORE = 99;

function escapeSearchRegex(term: string): string {
  return String(term || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeSearchTerm(term: string): string {
  return String(term || '').trim();
}

/** Comma-separated values are treated as OR terms. */
export function parseSearchTerms(query: string): string[] {
  const normalized = normalizeSearchTerm(query);
  if (!normalized) return [];
  return normalized
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Lower score = better match.
 * 0 = prefix, 1 = word-boundary prefix, 2 = contains, 99 = no match
 */
export function scoreTextMatch(text: string, query: string): number {
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

export function scoreRecordTexts(texts: string[], query: string, primary = true): number {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return NO_MATCH_SCORE;

  let best = NO_MATCH_SCORE;
  const offset = primary ? 0 : 3;

  for (const term of terms) {
    for (const text of texts) {
      const textScore = scoreTextMatch(text, term);
      if (textScore === NO_MATCH_SCORE) continue;
      best = Math.min(best, textScore + offset);
    }
  }

  return best;
}

export function matchesAnySearchTerm(text: string, query: string): boolean {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) return false;
  const lowerValue = String(text ?? '').toLowerCase();
  return terms.some((term) => lowerValue.includes(term.toLowerCase()));
}

type FilterQueryNode = {
  fieldKey?: string;
  operator?: string;
  value?: unknown;
  children?: FilterQueryNode[];
};

const MODULE_PRIMARY_SEARCH_FILTER_FIELDS: Record<string, string[]> = {
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

function parseFilterQueryAst(raw: unknown): FilterQueryNode | null {
  if (!raw) return null;
  let current: unknown = raw;
  for (let depth = 0; depth < 2; depth += 1) {
    if (current && typeof current === 'object' && !Array.isArray(current)) {
      return current as FilterQueryNode;
    }
    if (typeof current !== 'string') return null;
    try {
      current = JSON.parse(current);
    } catch {
      return null;
    }
  }
  return current && typeof current === 'object' && !Array.isArray(current)
    ? (current as FilterQueryNode)
    : null;
}

function collectContainsRules(node: FilterQueryNode | null | undefined, results: Array<{ fieldKey: string; value: string }> = []) {
  if (!node || typeof node !== 'object') return results;
  const operator = String(node.operator || 'contains');
  if (node.fieldKey && operator === 'contains' && typeof node.value === 'string') {
    const trimmed = node.value.trim();
    if (trimmed) results.push({ fieldKey: String(node.fieldKey), value: trimmed });
  }
  for (const child of node.children || []) {
    collectContainsRules(child, results);
  }
  return results;
}

/** Extract search term from column filterQuery contains on primary module fields. */
export function extractSearchTermFromFilterQuery(
  filterQueryParam: unknown,
  primaryFieldKeys: string[] = ['name']
): string {
  const ast = parseFilterQueryAst(filterQueryParam);
  if (!ast) return '';
  const allowed = new Set(primaryFieldKeys.map((key) => key.toLowerCase()));
  const rules = collectContainsRules(ast).filter((rule) =>
    allowed.has(rule.fieldKey.toLowerCase())
  );
  return rules[0]?.value || '';
}

/** Resolve list search term from API params (main search or column contains on primary field). */
export function resolveListSearchTerm(
  params: { search?: unknown; name?: unknown; title?: unknown; filterQuery?: unknown },
  moduleKey?: string
): string {
  const direct = params.search ?? params.name ?? params.title;
  if (direct && String(direct).trim()) return String(direct).trim();
  const primaryFields = (moduleKey && MODULE_PRIMARY_SEARCH_FILTER_FIELDS[moduleKey]) || ['name'];
  return extractSearchTermFromFilterQuery(params.filterQuery, primaryFields);
}

/** Apply contains rules from filterQuery AST into a flat filters map (ListView external sync). */
export function applyFilterQueryContainsToFlatFilters(
  filterQueryRaw: unknown,
  target: Record<string, unknown>,
  primaryFieldKeys: string[] = ['name', 'title']
): boolean {
  const ast = parseFilterQueryAst(filterQueryRaw);
  if (!ast) return false;
  const allowed = new Set(primaryFieldKeys.map((key) => key.toLowerCase()));
  const rules = collectContainsRules(ast).filter((rule) =>
    allowed.has(rule.fieldKey.toLowerCase())
  );
  if (rules.length === 0) return false;
  for (const rule of rules) {
    target[rule.fieldKey] = rule.value;
  }
  return true;
}

export function sortBySearchRelevance<T>(
  items: T[],
  query: string,
  getSearchableTexts: (item: T) => { texts: string[]; primary?: boolean }[]
): T[] {
  if (parseSearchTerms(query).length === 0 || items.length === 0) return items;

  return [...items].sort((a, b) => {
    const scoreA = Math.min(
      ...getSearchableTexts(a).map(({ texts, primary = true }) =>
        scoreRecordTexts(texts, query, primary)
      )
    );
    const scoreB = Math.min(
      ...getSearchableTexts(b).map(({ texts, primary = true }) =>
        scoreRecordTexts(texts, query, primary)
      )
    );
    return scoreA - scoreB;
  });
}
