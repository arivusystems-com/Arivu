const mongoose = require('mongoose');

const MASTER_DB = process.env.MASTER_DB_NAME || 'arivu_master';
const MAX_ATTEMPTS = Number(process.env.MONGO_CONNECT_RETRIES) || 5;
const DELAY_MS = Number(process.env.MONGO_CONNECT_RETRY_DELAY_MS) || 3000;

function invalidMongoUri(reason) {
  const err = new Error(
    `MONGODB_URI is invalid: ${reason}. Percent-encode special characters in the username/password `
    + '(e.g. encodeURIComponent: @ → %40, / → %2F, ? → %3F, : → %3A, % → %25)',
  );
  err.code = 'MONGODB_CONFIG_INVALID';
  return err;
}

/**
 * Structural checks that would otherwise make the host/db split below silently wrong.
 * Error messages never include the URI (it may contain credentials).
 */
function assertValidMongoUri(uri) {
  const match = /^(mongodb(?:\+srv)?):\/\/([^/?]*)([^?]*)(\?.*)?$/.exec(uri);
  if (!match) {
    throw invalidMongoUri('expected mongodb:// or mongodb+srv:// scheme');
  }
  const [, , authority, pathPart, query = ''] = match;
  const at = authority.lastIndexOf('@');
  if (pathPart.includes('@') || (at === -1 && query.includes('@'))) {
    throw invalidMongoUri('unencoded "/" or "?" in credentials');
  }
  const userInfo = at === -1 ? '' : authority.slice(0, at);
  const hosts = at === -1 ? authority : authority.slice(at + 1);
  if (!hosts) {
    throw invalidMongoUri('missing host');
  }
  if (userInfo) {
    if (userInfo.includes('@')) throw invalidMongoUri('unencoded "@" in credentials');
    if ((userInfo.match(/:/g) || []).length > 1) throw invalidMongoUri('unencoded ":" in password');
    if (/%(?![0-9A-Fa-f]{2})/.test(userInfo)) throw invalidMongoUri('invalid percent-encoding in credentials');
  }
}

/**
 * Same URI resolution as the historical server entry (MONGODB_URI / MONGO_URI / prod|local).
 * @param {NodeJS.ProcessEnv} [env]
 */
function getMongoUris(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const MONGO_URI =
    env.MONGODB_URI ||
    env.MONGO_URI ||
    (isProduction
      ? env.MONGO_URI_PRODUCTION
      : env.MONGO_URI_LOCAL);

  if (!MONGO_URI) {
    const err = new Error(
      'MONGODB_URI (or MONGO_URI) is not set. Set it in your environment (Atlas connection string in production).',
    );
    err.code = 'MONGODB_CONFIG_MISSING';
    throw err;
  }

  assertValidMongoUri(MONGO_URI);
  const masterDbName = env.MASTER_DB_NAME || 'arivu_master';

  const [mongoUriWithoutQuery, mongoUriQueryPart] = MONGO_URI.split('?');
  const mongoQueryString = mongoUriQueryPart ? `?${mongoUriQueryPart}` : '';
  const pathParts = mongoUriWithoutQuery.split('/');
  // mongodb://host:port or mongodb+srv://cluster — no DB in path; mongodb://host/db has one
  const hasDbInPath = pathParts.length > 3 && Boolean(pathParts[3]);
  const baseUri = hasDbInPath
    ? pathParts.slice(0, -1).join('/')
    : mongoUriWithoutQuery.replace(/\/$/, '');
  const masterUri = `${baseUri}/${masterDbName}${mongoQueryString}`;

  return { MONGO_URI, mongoQueryString, baseUri, masterUri, masterDbName };
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Connect to the master database with retry (Atlas / transient network blips).
 */
async function connectMasterWithRetry(masterUri) {
  const pool = Number(process.env.MONGO_MAX_POOL_SIZE) || 10;
  const serverSelection = Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 30000;

  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await mongoose.connect(masterUri, {
        serverSelectionTimeoutMS: serverSelection,
        maxPoolSize: pool,
        retryWrites: true,
        autoIndex: process.env.NODE_ENV !== 'production',
      });
      return;
    } catch (err) {
      lastErr = err;
      console.error(
        `[mongo] connection attempt ${attempt}/${MAX_ATTEMPTS} failed:`,
        err.message,
      );
      if (attempt < MAX_ATTEMPTS) {
        await wait(DELAY_MS);
      }
    }
  }
  throw lastErr;
}

module.exports = {
  getMongoUris,
  connectMasterWithRetry,
  MASTER_DB,
};
