import DOMPurify from 'dompurify';
import {
  resolveAssetDownloadUrl,
  stripAuthTokenFromDownloadUrl
} from '@/modules/template/composables/useCompanyLogoAsset';

/** Tags produced by TaskDescriptionEditor (TipTap) for record descriptions. */
export const ALLOWED_RICH_DESCRIPTION_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'blockquote',
  'img',
  'pre',
  'code'
];

export const ALLOWED_RICH_DESCRIPTION_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'class',
  'width',
  'height',
  'data-width',
  'data-reply-quote',
  'data-collapsed',
  'data-type'
];

const SAFE_IMAGE_SRC_PATTERN = /^(https?:|\/)/i;

export const ALLOWED_DESCRIPTION_IMAGE_WIDTHS = new Set(['25%', '50%', '75%', '100%']);

function isSafeImageSrc(src: string): boolean {
  const trimmed = String(src || '').trim();
  if (!trimmed) return false;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return false;
  return SAFE_IMAGE_SRC_PATTERN.test(trimmed);
}

/**
 * After DOMPurify, ensure real hyperlinks open in a new tab. Skips fragment-only anchors.
 */
export function withLinksOpenInNewTab(html: string): string {
  if (!html || !html.includes('<a') || typeof document === 'undefined') return html;

  const tpl = document.createElement('template');
  tpl.innerHTML = html;

  tpl.content.querySelectorAll('a[href]').forEach((anchor) => {
    const href = (anchor.getAttribute('href') || '').trim();
    if (!href || href.startsWith('#')) return;

    anchor.setAttribute('target', '_blank');
    const rel = new Set(
      (anchor.getAttribute('rel') || '')
        .split(/\s+/)
        .filter(Boolean)
    );
    rel.add('noopener');
    rel.add('noreferrer');
    anchor.setAttribute('rel', [...rel].join(' '));
  });

  return tpl.innerHTML;
}

const IMG_SRC_ATTR_PATTERN = /\ssrc=(["'])([^"']+)\1/gi;

/** Rewrite managed /api/files/download img srcs for split-origin media (API host + token). */
export function withResolvedDescriptionImageUrls(html: string): string {
  const str = String(html || '');
  if (!str.includes('<img') || !str.includes('/files/download')) return str;

  return str.replace(IMG_SRC_ATTR_PATTERN, (full, quote, src) => {
    const resolved = resolveAssetDownloadUrl(src);
    if (!resolved || resolved === src) return full;
    return ` src=${quote}${resolved}${quote}`;
  });
}

/** Persist token-free download URLs (tokens are display-only). */
export function stripDescriptionImageAuthTokens(html: string): string {
  const str = String(html || '');
  if (!str.includes('<img') || !str.includes('token=')) return str;

  return str.replace(IMG_SRC_ATTR_PATTERN, (full, quote, src) => {
    const stripped = stripAuthTokenFromDownloadUrl(src);
    if (!stripped || stripped === src) return full;
    return ` src=${quote}${stripped}${quote}`;
  });
}

/**
 * Restricted sanitization matching the RTE, then new-tab behavior for links.
 */
export function sanitizeRichDescriptionHtml(raw: string): string {
  const str = String(raw || '');
  if (!str.trim()) return '';

  const clean = DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ALLOWED_RICH_DESCRIPTION_TAGS,
    ALLOWED_ATTR: ALLOWED_RICH_DESCRIPTION_ATTR
  });

  if (typeof document === 'undefined' || !clean.includes('<img')) {
    return withLinksOpenInNewTab(clean);
  }

  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  tpl.content.querySelectorAll('img').forEach((img) => {
    const src = (img.getAttribute('src') || '').trim();
    if (!isSafeImageSrc(src)) {
      img.remove();
      return;
    }
    const resolved = resolveAssetDownloadUrl(src);
    if (resolved) img.setAttribute('src', resolved);
    img.setAttribute('loading', 'lazy');
    if (!img.getAttribute('alt')) img.setAttribute('alt', '');
    const width = (img.getAttribute('data-width') || img.getAttribute('width') || '').trim();
    if (width && !ALLOWED_DESCRIPTION_IMAGE_WIDTHS.has(width)) {
      img.removeAttribute('data-width');
      img.removeAttribute('width');
    } else if (width) {
      img.setAttribute('data-width', width);
      img.removeAttribute('width');
    }
  });

  return withLinksOpenInNewTab(tpl.innerHTML);
}
