#!/usr/bin/env node
/**
 * Translate locale message fields from en → target language.
 * Preserves ICU placeholders; skips complex plural/select messages unless --force-icu.
 *
 * Usage:
 *   node scripts/i18n/translate-locale.mjs es
 *   node scripts/i18n/translate-locale.mjs es --namespaces=actions,common
 *   node scripts/i18n/translate-locale.mjs es --dry-run
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOCALES_DIR, SHARED_NAMESPACES } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const targetLang = args.find((a) => !a.startsWith('--')) || 'es';
const dryRun = args.includes('--dry-run');
const forceIcu = args.includes('--force-icu');
const nsArg = args.find((a) => a.startsWith('--namespaces='));
const namespaces = nsArg
  ? nsArg.split('=')[1].split(',').map((s) => s.trim())
  : [...SHARED_NAMESPACES];

const DELAY_MS = Number(process.env.I18N_TRANSLATE_DELAY_MS || 120);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldSkipIcu(message) {
  if (forceIcu) return false;
  return (
    /,\s*plural\b/.test(message) ||
    /,\s*select\b/.test(message) ||
    /#\s*,/.test(message) ||
    message.includes('#{')
  );
}

/** `{name}` placeholders and vue-i18n literals such as `{'@'}` / `{'}'}`. */
const PLACEHOLDER_RE = /\{'[^']*'\}|\{[^{}]+\}/g;

// Digits only: word tokens get translated (es turned `__ICU_0__` into `__UCI_0__`).
function maskPlaceholders(message) {
  const tokens = [];
  const masked = message.replace(PLACEHOLDER_RE, (match) => {
    const id = `__${tokens.length}__`;
    tokens.push({ id, match });
    return id;
  });
  return { masked, tokens };
}

function unmaskPlaceholders(text, tokens) {
  let out = text;
  for (const { id, match } of tokens) {
    out = out.replaceAll(id, match);
  }
  return out;
}

function placeholderSignature(message) {
  return [...(message.match(PLACEHOLDER_RE) || [])].sort().join('\u0000');
}

function pipeCount(message) {
  return message.replace(PLACEHOLDER_RE, '').split('|').length;
}

async function translateText(text, lang) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', lang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'Arivu-i18n-script/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data[0].map((part) => part[0]).join('');
}

async function translateMessage(message, lang) {
  if (!message?.trim() || message.length > 4500) return message;
  if (shouldSkipIcu(message)) return message;
  const { masked, tokens } = maskPlaceholders(message);
  const translated = unmaskPlaceholders(await translateText(masked, lang), tokens);
  if (
    /__\d+__/.test(translated) ||
    placeholderSignature(translated) !== placeholderSignature(message) ||
    pipeCount(translated) !== pipeCount(message)
  ) {
    throw new Error(`placeholders not preserved: ${JSON.stringify(translated)}`);
  }
  return translated;
}

async function main() {
  const enDir = path.join(LOCALES_DIR, 'en');
  const outDir = path.join(LOCALES_DIR, targetLang);
  fs.mkdirSync(outDir, { recursive: true });

  let translated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const ns of namespaces) {
    const enPath = path.join(enDir, `${ns}.json`);
    if (!fs.existsSync(enPath)) continue;

    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const outPath = path.join(outDir, `${ns}.json`);
    const existing = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};

    for (const [key, entry] of Object.entries(en)) {
      const enMsg = typeof entry === 'string' ? entry : entry?.message;
      if (!enMsg) continue;

      const cur = existing[key];
      const curMsg = typeof cur === 'string' ? cur : cur?.message;
      const needsWork = !curMsg || curMsg === enMsg;

      if (!needsWork) {
        unchanged += 1;
        continue;
      }

      if (shouldSkipIcu(enMsg)) {
        skipped += 1;
        if (!dryRun) {
          existing[key] = cur ?? entry;
        }
        continue;
      }

      if (dryRun) {
        translated += 1;
        continue;
      }

      try {
        const newMsg = await translateMessage(enMsg, targetLang);
        existing[key] =
          typeof entry === 'string'
            ? newMsg
            : { ...entry, message: newMsg };
        translated += 1;
        await sleep(DELAY_MS);
      } catch (e) {
        console.warn(`Skip ${ns}.${key}: ${e.message}`);
        existing[key] = cur ?? entry;
        skipped += 1;
      }

      if (translated > 0 && translated % 50 === 0) {
        fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
        console.log(`  checkpoint ${ns}.json (${translated} so far)`);
      }
    }

    if (!dryRun) {
      fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);
    }
    console.log(`✓ ${ns}.json — translated=${translated}, skipped=${skipped}, unchanged=${unchanged}`);
  }

  console.log(
    dryRun
      ? `Dry run: would translate ~${translated} messages to ${targetLang}`
      : `Done: translated ${translated}, skipped ${skipped}, unchanged ${unchanged}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
