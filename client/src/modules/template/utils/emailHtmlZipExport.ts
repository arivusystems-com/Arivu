import JSZip from 'jszip';
import { getApiUrlForFetch } from '@/config/apiBase';

const MAX_ASSETS = 50;
const MAX_ASSET_BYTES = 2 * 1024 * 1024;

export interface EmailHtmlZipLogEntry {
  url: string;
  status: 'included' | 'skipped' | 'failed';
  detail?: string;
}

export interface EmailHtmlZipExportResult {
  blob: Blob;
  log: EmailHtmlZipLogEntry[];
  includedCount: number;
  skippedCount: number;
  failedCount: number;
}

/** Extract image/CSS asset URLs from an HTML document string. */
export function extractAssetReferences(html: string): string[] {
  const source = String(html || '');
  const urls = new Set<string>();

  const imgRegex = /<img\b[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi;
  let match = imgRegex.exec(source);
  while (match) {
    const src = match[1]?.trim();
    if (src) urls.add(src);
    match = imgRegex.exec(source);
  }

  const cssUrlRegex = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;
  match = cssUrlRegex.exec(source);
  while (match) {
    const candidate = match[1]?.trim() ?? '';
    if (candidate && !candidate.startsWith('#')) {
      urls.add(candidate);
    }
    match = cssUrlRegex.exec(source);
  }

  return [...urls];
}

function extensionFromMime(mimeType: string): string {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('svg')) return 'svg';
  return 'bin';
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url, 'https://placeholder.local').pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {
    // ignore
  }
  return 'bin';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAssetUrl(html: string, from: string, to: string): string {
  if (!from || from === to) return html;
  const pattern = new RegExp(escapeRegExp(from), 'g');
  return html.replace(pattern, to);
}

function parseDataUri(dataUri: string): { bytes: Uint8Array; extension: string } | null {
  const match = String(dataUri).match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  try {
    if (isBase64) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return { bytes, extension: extensionFromMime(mimeType) };
    }
    const decoded = decodeURIComponent(payload);
    const bytes = new TextEncoder().encode(decoded);
    return { bytes, extension: extensionFromMime(mimeType) };
  } catch {
    return null;
  }
}

function resolveFetchUrl(rawUrl: string): string | null {
  const source = String(rawUrl || '').trim();
  if (!source) return null;
  const lower = source.toLowerCase();
  if (
    lower.startsWith('javascript:')
    || lower.startsWith('cid:')
    || lower.startsWith('blob:')
    || lower.startsWith('file:')
  ) {
    return null;
  }

  if (source.startsWith('data:')) {
    return source;
  }

  try {
    const resolved = new URL(source, window.location.origin);
    if (!['http:', 'https:'].includes(resolved.protocol)) return null;
    if (resolved.origin === window.location.origin) {
      return getApiUrlForFetch(`${resolved.pathname}${resolved.search}`);
    }
    return resolved.toString();
  } catch {
    if (source.startsWith('/')) {
      return getApiUrlForFetch(source);
    }
    return null;
  }
}

async function fetchAssetBytes(url: string): Promise<{ bytes: Uint8Array; extension: string } | null> {
  if (url.startsWith('data:')) {
    return parseDataUri(url);
  }

  const response = await fetch(url, {
    credentials: 'include',
    mode: 'cors'
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_ASSET_BYTES) {
    throw new Error('Asset exceeds 2 MB limit');
  }

  const mimeType = response.headers.get('content-type') || '';
  const extension = extensionFromMime(mimeType) !== 'bin'
    ? extensionFromMime(mimeType)
    : extensionFromUrl(url);

  return { bytes: new Uint8Array(buffer), extension };
}

function buildExportLogText(log: EmailHtmlZipLogEntry[]): string {
  const lines = ['Email template export log', '=======================', ''];
  for (const entry of log) {
    const suffix = entry.detail ? ` — ${entry.detail}` : '';
    lines.push(`${entry.status.toUpperCase()}: ${entry.url}${suffix}`);
  }
  if (log.length === 0) {
    lines.push('No external assets referenced.');
  }
  return `${lines.join('\n')}\n`;
}

export async function buildEmailHtmlZip(
  documentHtml: string,
  _baseName: string
): Promise<EmailHtmlZipExportResult> {
  const zip = new JSZip();
  const log: EmailHtmlZipLogEntry[] = [];
  let rewrittenHtml = String(documentHtml || '');
  const references = extractAssetReferences(documentHtml).slice(0, MAX_ASSETS);
  let assetIndex = 0;

  for (const rawUrl of references) {
    const fetchUrl = resolveFetchUrl(rawUrl);
    if (!fetchUrl) {
      log.push({ url: rawUrl, status: 'skipped', detail: 'Unsupported URL scheme' });
      continue;
    }

    try {
      const asset = await fetchAssetBytes(fetchUrl);
      if (!asset) {
        log.push({ url: rawUrl, status: 'failed', detail: 'Could not decode asset' });
        continue;
      }

      assetIndex += 1;
      const filename = `assets/image-${assetIndex}.${asset.extension}`;
      zip.file(filename, asset.bytes);
      rewrittenHtml = replaceAssetUrl(rewrittenHtml, rawUrl, filename);
      log.push({ url: rawUrl, status: 'included', detail: filename });
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Fetch failed';
      log.push({ url: rawUrl, status: 'failed', detail });
    }
  }

  zip.file('index.html', rewrittenHtml);

  const failedCount = log.filter((entry) => entry.status === 'failed').length;
  const skippedCount = log.filter((entry) => entry.status === 'skipped').length;
  const includedCount = log.filter((entry) => entry.status === 'included').length;

  if (failedCount > 0 || skippedCount > 0) {
    zip.file('export-log.txt', buildExportLogText(log));
  }

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return {
    blob,
    log,
    includedCount,
    skippedCount,
    failedCount
  };
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadEmailHtmlZip(documentHtml: string, baseName: string): Promise<EmailHtmlZipExportResult> {
  const result = await buildEmailHtmlZip(documentHtml, baseName);
  downloadBlobFile(`${baseName}.zip`, result.blob);
  return result;
}
