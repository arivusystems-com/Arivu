function resolveClientBaseUrl(req) {
  const origin = req?.get?.('origin');
  if (origin && /^https?:\/\//i.test(origin)) {
    return String(origin).replace(/\/$/, '');
  }
  const { resolveClientUrl } = require('./clientUrl');
  return resolveClientUrl();
}

function buildPublicQuoteUrl(token, req) {
  const base = resolveClientBaseUrl(req);
  const t = String(token || '').trim();
  if (!base || !t) return null;
  return `${base}/public/quotes/${t}`;
}

module.exports = {
  resolveClientBaseUrl,
  buildPublicQuoteUrl
};
