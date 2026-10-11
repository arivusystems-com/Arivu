/**
 * Parse docs/testing/Automation_Testing.md → catalog/index.json
 * Usage: node catalog/sync.mjs [--check]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const MARKDOWN_PATH = path.join(ROOT, 'docs', 'testing', 'Automation_Testing.md');
const OUT_PATH = path.join(__dirname, 'index.json');
const EXECUTORS_DIR = path.resolve(__dirname, '../runner/executors');

const TC_PREFIX = '(?:API|UI|E2E|PUB|SEC|ASYNC|LOAD|PERF)';
const TC_ID_RE = new RegExp(`\\b(TC-${TC_PREFIX}-[A-Z0-9]+(?:-\\d+)?)\\b`, 'g');

const LAYER_FROM_PREFIX = {
  'TC-API': 'api',
  'TC-UI': 'ui',
  'TC-E2E': 'e2e',
  'TC-PUB': 'public',
  'TC-SEC': 'security',
  'TC-ASYNC': 'async',
  'TC-LOAD': 'load',
  'TC-PERF': 'perf',
};

const CATALOG_EXCLUDED_IDS = new Set(['TC-API-EXAMPLE-001']);

const REGISTRY_ORPHAN_META = {
  'TC-ASYNC-004': { title: 'CSV import — queue job and poll until complete', section: 'Async' },
  'TC-ASYNC-010': { title: 'Cron digest trigger (manual UAT)', section: 'Async' },
  'TC-ASYNC-011': { title: 'Cron digest trigger B (manual UAT)', section: 'Async' },
};

/** Runnable case IDs end with -NNN (excludes section headers like TC-SEC-MT). */
export function isRunnableCatalogId(id) {
  if (CATALOG_EXCLUDED_IDS.has(id)) return false;
  if (/^TC-(?:LOAD|PERF)-(?:\d{3}|[A-Z]\d{3})$/.test(id)) return true;
  if (/^TC-ASYNC-\d{3}$/.test(id)) return true;
  return new RegExp(`^TC-(?:API|UI|E2E|PUB|SEC)-[A-Z0-9]+-\\d{3}$`).test(id);
}

function layerFromId(id) {
  for (const [prefix, layer] of Object.entries(LAYER_FROM_PREFIX)) {
    if (id.startsWith(prefix)) return layer;
  }
  return 'unknown';
}

function domainFromId(id) {
  const parts = id.split('-');
  if (parts.length >= 3) return parts[2];
  return 'GENERAL';
}

function parseSectionDomain(line) {
  const m = line.match(/^#{2,3}\s+(?:\d+(?:\.\d+)*\s+)?(.+?)(?:\s+—|$)/);
  if (!m) return null;
  return m[1].trim().replace(/\s+/g, ' ').slice(0, 80);
}

function parseTableRow(line) {
  if (!line.startsWith('|')) return null;
  const cells = line
    .split('|')
    .map((c) => c.trim())
    .filter((_, i, arr) => i > 0 && i < arr.length);
  if (cells.length < 2) return null;
  if (cells[0] === 'ID' || cells[0].includes('---')) return null;

  const idMatch = cells.join(' ').match(new RegExp(`\\b(TC-${TC_PREFIX}-[A-Z0-9-]+)\\b`));
  if (!idMatch) return null;

  const id = idMatch[1];
  if (!isRunnableCatalogId(id)) return null;
  return {
    id,
    layer: layerFromId(id),
    domain: domainFromId(id),
    title: cells.slice(1).join(' — ').replace(/\s+/g, ' ').trim().slice(0, 500),
    rawCells: cells,
  };
}

function expandRangeIds(text) {
  const rangeRe = new RegExp(`(TC-${TC_PREFIX}-[A-Z0-9]+)-(\\d+)–(\\d+)`, 'g');
  const ids = [];
  let m;
  while ((m = rangeRe.exec(text)) !== null) {
    const [, prefix, start, end] = m;
    for (let i = Number(start); i <= Number(end); i += 1) {
      ids.push(`${prefix}-${String(i).padStart(3, '0')}`);
    }
  }
  return ids;
}

function findExecutorPath(caseId) {
  const slug = caseId.toLowerCase().replace(/^tc-/, '').replace(/-/g, '/');
  const candidates = [
    path.join(EXECUTORS_DIR, `${slug}.test.mjs`),
    path.join(EXECUTORS_DIR, `${caseId.toLowerCase()}.test.mjs`),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return path.relative(path.join(__dirname, '..'), p);
  }
  const walk = (dir, parts = []) => {
    if (!fs.existsSync(dir)) return null;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) {
        const found = walk(full, [...parts, name]);
        if (found) return found;
      } else if (name.endsWith('.test.mjs') && name.includes(caseId.toLowerCase().replace(/-/g, ''))) {
        return path.relative(path.join(__dirname, '..'), full);
      }
    }
    return null;
  };
  return walk(EXECUTORS_DIR);
}

function scanExecutors() {
  const map = new Map();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.test.mjs')) {
        const mod = path.relative(path.join(__dirname, '..'), full);
        map.set(full, mod);
      }
    }
  };
  walk(EXECUTORS_DIR);
  return map;
}

export function parseCatalog(markdown = fs.readFileSync(MARKDOWN_PATH, 'utf8')) {
  const lines = markdown.split('\n');
  let currentSection = 'General';
  const byId = new Map();

  for (const line of lines) {
    if (line.startsWith('#')) {
      const section = parseSectionDomain(line);
      if (section) currentSection = section;
    }

    const row = parseTableRow(line);
    if (row) {
      byId.set(row.id, {
        ...row,
        section: currentSection,
        automated: false,
        executorPath: null,
      });
    }

    for (const id of expandRangeIds(line)) {
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          layer: layerFromId(id),
          domain: domainFromId(id),
          title: line.trim().slice(0, 500),
          section: currentSection,
          automated: false,
          executorPath: null,
        });
      }
    }

    let match;
    TC_ID_RE.lastIndex = 0;
    while ((match = TC_ID_RE.exec(line)) !== null) {
      const id = match[1];
      if (!isRunnableCatalogId(id)) continue;
      if (byId.has(id)) continue;
      if (!line.startsWith('|')) {
        byId.set(id, {
          id,
          layer: layerFromId(id),
          domain: domainFromId(id),
          title: line.trim().slice(0, 500),
          section: currentSection,
          automated: false,
          executorPath: null,
        });
      }
    }
  }

  for (const entry of byId.values()) {
    const executorPath = findExecutorPath(entry.id);
    if (executorPath) {
      entry.executorPath = executorPath;
      entry.automated = true;
    }
  }

  let entries = [...byId.values()].filter((e) => isRunnableCatalogId(e.id));
  entries.sort((a, b) => a.id.localeCompare(b.id));
  const hash = crypto.createHash('sha256').update(JSON.stringify(entries.map((e) => e.id))).digest('hex').slice(0, 16);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'docs/testing/Automation_Testing.md',
    hash,
    stats: {
      total: entries.length,
      automated: entries.filter((e) => e.automated).length,
      byLayer: entries.reduce((acc, e) => {
        acc[e.layer] = (acc[e.layer] || 0) + 1;
        return acc;
      }, {}),
    },
    entries,
  };
}

function main() {
  parseCatalogAsync().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function parseCatalogAsync() {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(MARKDOWN_PATH)) {
    console.error(`Missing ${MARKDOWN_PATH}`);
    process.exit(1);
  }

  const catalog = await buildCatalog();

  if (check) {
    if (!fs.existsSync(OUT_PATH)) {
      console.error('catalog/index.json missing — run npm run catalog:sync');
      process.exit(1);
    }
    const existing = fs.readFileSync(OUT_PATH, 'utf8');
    catalog.generatedAt = JSON.parse(existing).generatedAt;
    if (existing !== `${JSON.stringify(catalog, null, 2)}\n`) {
      console.error('catalog/index.json is stale — run npm run catalog:sync');
      process.exit(1);
    }
    console.log(`Catalog OK (${catalog.stats.total} cases, ${catalog.stats.automated} automated)`);
    return;
  }

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  Total: ${catalog.stats.total}`);
  console.log(`  Automated: ${catalog.stats.automated}`);
  console.log(`  Layers: ${JSON.stringify(catalog.stats.byLayer)}`);
}

function mergePerfCatalog(base) {
  const perfPath = path.join(__dirname, 'perf-catalog.json');
  if (!fs.existsSync(perfPath)) return base;
  const extra = JSON.parse(fs.readFileSync(perfPath, 'utf8'));
  const byId = new Map(base.entries.map((e) => [e.id, e]));
  for (const entry of extra.entries || []) {
    if (!isRunnableCatalogId(entry.id)) continue;
    byId.set(entry.id, {
      executorPath: null,
      automated: false,
      ...entry,
    });
  }
  base.entries = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
  base.stats.total = base.entries.length;
  base.stats.byLayer = base.entries.reduce((acc, e) => {
    acc[e.layer] = (acc[e.layer] || 0) + 1;
    return acc;
  }, {});
  return base;
}

function mergeRegistryOrphans(base, automatedIds) {
  const byId = new Map(base.entries.map((e) => [e.id, e]));
  for (const id of automatedIds) {
    if (!isRunnableCatalogId(id) || byId.has(id)) continue;
    const meta = REGISTRY_ORPHAN_META[id] || { title: id, section: 'Automated (registry)' };
    byId.set(id, {
      id,
      layer: layerFromId(id),
      domain: domainFromId(id),
      title: meta.title,
      section: meta.section,
      rawCells: [id, meta.title],
      automated: true,
      executorPath: null,
    });
  }
  base.entries = [...byId.values()]
    .filter((e) => isRunnableCatalogId(e.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  base.stats.total = base.entries.length;
  base.stats.byLayer = base.entries.reduce((acc, e) => {
    acc[e.layer] = (acc[e.layer] || 0) + 1;
    return acc;
  }, {});
  return base;
}

async function buildCatalog() {
  const markdown = fs.readFileSync(MARKDOWN_PATH, 'utf8');
  const base = mergePerfCatalog(parseCatalog(markdown));
  try {
    const { listAutomatedCaseIds } = await import('../runner/registry.mjs');
    const automatedIds = await listAutomatedCaseIds();
    const automatedSet = new Set(automatedIds);
    for (const entry of base.entries) {
      if (automatedSet.has(entry.id)) entry.automated = true;
    }
    mergeRegistryOrphans(base, automatedSet);
    base.stats.automated = base.entries.filter((e) => e.automated).length;
  } catch {
    /* ignore */
  }

  const { attachDocumentation } = await import('./lib/mergeCaseDocs.mjs');
  await attachDocumentation(base);
  return base;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
