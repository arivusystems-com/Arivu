'use strict';

const DEV_CLIENT_URL = 'http://localhost:5173';

function isLocalhostClientUrl(value) {
  try {
    const host = new URL(String(value)).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost');
  } catch (_err) {
    return false;
  }
}

/**
 * First usable frontend origin.
 * Production ignores localhost and throws when CLIENT_URL is missing.
 * Development uses http://localhost:5173 only when no candidate is set.
 * @param {Array<string|undefined|null>} [candidates]
 */
function resolveClientUrl(candidates) {
  const list = Array.isArray(candidates) && candidates.length
    ? candidates
    : [process.env.CLIENT_URL];
  const production = process.env.NODE_ENV === 'production';

  for (const candidate of list) {
    const value = String(candidate || '').trim().replace(/\/$/, '');
    if (!value) continue;
    if (production && isLocalhostClientUrl(value)) continue;
    return value;
  }

  if (production) {
    throw new Error('CLIENT_URL must be the production frontend URL');
  }
  return DEV_CLIENT_URL;
}

function productionClientUrlError(env = process.env) {
  if (env.NODE_ENV !== 'production') return null;
  const clientUrl = String(env.CLIENT_URL || '').trim();
  if (!clientUrl || isLocalhostClientUrl(clientUrl)) {
    return 'production requires CLIENT_URL set to the frontend origin (not localhost)';
  }
  return null;
}

module.exports = {
  DEV_CLIENT_URL,
  isLocalhostClientUrl,
  resolveClientUrl,
  productionClientUrlError,
};
