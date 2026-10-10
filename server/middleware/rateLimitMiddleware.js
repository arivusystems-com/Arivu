/**
 * Rate Limiting Middleware
 * Prevents brute force attacks and API abuse
 * 
 * 🔓 SECURITY DISABLED FOR DEVELOPMENT
 * Set DISABLE_SECURITY=true in .env to bypass all rate limiting
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const {
    createRateLimitStore,
    shouldPassOnRateLimitStoreError,
    resolveSharedRateLimitFailureMode,
} = require('./rateLimitRedisStore');

// 🔓 SECURITY DISABLED: Bypass all rate limiting
const SECURITY_DISABLED = process.env.DISABLE_SECURITY === 'true' || process.env.NODE_ENV !== 'production';
const isProduction = process.env.NODE_ENV === 'production';
const bypassDisabled = process.env.BYPASS_RATE_LIMIT === 'false';

const parsePositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

const RATE_LIMIT_WINDOW_MS = parsePositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, ONE_MINUTE_MS);
const AUTHENTICATED_API_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.AUTHENTICATED_API_RATE_LIMIT_MAX_REQUESTS
        ?? process.env.GENERAL_API_RATE_LIMIT_MAX_REQUESTS
        ?? process.env.RATE_LIMIT_MAX_REQUESTS,
    300
);
const ANONYMOUS_API_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.ANONYMOUS_API_RATE_LIMIT_MAX_REQUESTS,
    60
);
const ORGANIZATION_SETTINGS_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.ORGANIZATION_SETTINGS_RATE_LIMIT_WINDOW_MS,
    FIFTEEN_MINUTES_MS
);
const ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS,
    600
);
const SESSION_BOOTSTRAP_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.SESSION_BOOTSTRAP_RATE_LIMIT_WINDOW_MS,
    FIFTEEN_MINUTES_MS
);
const SESSION_BOOTSTRAP_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.SESSION_BOOTSTRAP_RATE_LIMIT_MAX_REQUESTS,
    600
);
const SEARCH_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.SEARCH_RATE_LIMIT_WINDOW_MS,
    ONE_MINUTE_MS
);
const SEARCH_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS,
    60
);
const FILE_UPLOAD_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
    ONE_HOUR_MS
);
const FILE_UPLOAD_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.FILE_UPLOAD_RATE_LIMIT_MAX_REQUESTS,
    20
);
const EXPORT_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.EXPORT_RATE_LIMIT_WINDOW_MS,
    ONE_HOUR_MS
);
const EXPORT_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.EXPORT_RATE_LIMIT_MAX_REQUESTS,
    5
);
const AI_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.AI_RATE_LIMIT_WINDOW_MS,
    ONE_MINUTE_MS
);
const AI_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.AI_RATE_LIMIT_MAX_REQUESTS,
    60
);
const IMPORT_CREATION_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.IMPORT_CREATION_RATE_LIMIT_WINDOW_MS,
    ONE_HOUR_MS
);
const IMPORT_CREATION_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.IMPORT_CREATION_RATE_LIMIT_MAX_REQUESTS,
    10
);
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    ONE_HOUR_MS
);
const PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
    3
);
// Token validate/confirm must tolerate email-security link prefetchers (Safe Links, etc.)
const AUTH_TOKEN_ACTION_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.AUTH_TOKEN_ACTION_RATE_LIMIT_WINDOW_MS,
    ONE_HOUR_MS
);
const AUTH_TOKEN_ACTION_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.AUTH_TOKEN_ACTION_RATE_LIMIT_MAX_REQUESTS,
    30
);
const AUTH_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    isProduction ? 15 * 60 * 1000 : 5 * 60 * 1000
);
const AUTH_RATE_LIMIT_MAX_REQUESTS = parsePositiveInteger(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    // Failed attempts only (see skipSuccessfulRequests). Progressive throttle
    // remains the primary soft block (~8); this is a harder per-account ceiling.
    isProduction ? 20 : 30
);
/**
 * Shared API/route limits.
 * Production with REDIS_URL defaults to fail-closed so a Redis error rejects the request.
 * Development, or production without Redis, stays fail-open so a missing local Redis does not block the API.
 * Auth and sensitive limiters stay fail-closed.
 *
 * Production env (these two match the default when NODE_ENV=production and REDIS_URL is set):
 *   GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
 *   ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE=fail-closed
 *   RATE_LIMIT_REDIS_REQUIRED=true
 *   REDIS_URL=redis://...
 */
const GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE
    || resolveSharedRateLimitFailureMode();
const AUTH_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.AUTH_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-closed';
const ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE
    || resolveSharedRateLimitFailureMode();
const SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE = process.env.SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE || 'fail-closed';

const isHealthCheckPath = (req) => {
    const p = req.path || '';
    return (
        p === '/health' ||
        p === '/health/' ||
        p === '/health/live' ||
        p === '/health/ready' ||
        p === '/health/status' ||
        p === '/api/health'
    );
};

const hasBypassHeader = (req) => {
    const bypassHeader = req.headers['x-bypass-rate-limit'];
    const testHeader = req.headers['x-test-mode'];
    return bypassHeader === 'true' || testHeader === 'true';
};

const isAuthPath = (req) => {
    const originalUrl = req.originalUrl || '';
    const path = req.path || '';
    return originalUrl.startsWith('/api/auth/') || path.startsWith('/auth/');
};

const isOrganizationSettingsReadPath = (req) => {
    const originalUrl = (req.originalUrl || '').split('?')[0];
    return req.method === 'GET' && originalUrl === '/api/settings/organization';
};

/** In-app notification list + SSE are user-scoped and polled infrequently; exclude from the general API bucket. */
const isNotificationReadPath = (req) => {
    const pathOnly = (req.originalUrl || req.path || '').split('?')[0];
    if (req.method === 'GET' && pathOnly === '/api/notifications/stream') {
        return true;
    }
    if (req.method === 'GET' && pathOnly === '/api/notifications') {
        return true;
    }
    return false;
};

/** GET /api/modules/:moduleKey/records/:recordId/(activity|comments|neighbors|description-versions) */
const MODULE_RECORD_SHELL_GET =
    /^\/api\/modules\/[^/]+\/records\/[^/]+\/(activity|comments|neighbors|description-versions)$/;

/**
 * Read-heavy session bootstrap endpoints (profile, UI shell, core module settings).
 * Excluded from the general API bucket and tracked on a relaxed per-user limiter.
 */
const isSessionBootstrapReadPath = (req) => {
    if (req.method !== 'GET') {
        return false;
    }

    const pathOnly = (req.originalUrl || req.path || '').split('?')[0];
    if (pathOnly === '/api/users/profile') {
        return true;
    }
    if (pathOnly.startsWith('/api/ui/')) {
        return true;
    }
    if (
        pathOnly === '/api/settings/core-modules' ||
        pathOnly.startsWith('/api/settings/core-modules/')
    ) {
        return true;
    }
    if (pathOnly === '/api/modules' || pathOnly === '/api/modules/people/quick-create') {
        return true;
    }
    if (MODULE_RECORD_SHELL_GET.test(pathOnly)) {
        return true;
    }
    // Org list used for lookup dropdowns on record pages (not single-record GET /:id).
    if (pathOnly === '/api/v2/organization') {
        return true;
    }

    return false;
};

const getBearerToken = (req) => {
    const authorization = req.headers.authorization || '';
    if (!authorization.startsWith('Bearer ')) {
        return null;
    }
    return authorization.slice('Bearer '.length).trim();
};

const getClientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const getAuthenticatedUserIdFromRequest = (req) => {
    if (req.user?._id) {
        return String(req.user._id);
    }

    const token = getBearerToken(req);
    if (!token || !process.env.JWT_SECRET) {
        return null;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded?.id ? String(decoded.id) : null;
    } catch (_error) {
        // Invalid tokens fall back to the network identity and are rejected by auth later.
        return null;
    }
};

const getRateLimitKey = (req, namespace = 'api') => {
    const userId = getAuthenticatedUserIdFromRequest(req);
    if (userId) {
        return `${namespace}:user:${userId}`;
    }

    return `${namespace}:ip:${getClientIp(req)}`;
};

const resolveGeneralApiMaxRequests = (req) => (
    getAuthenticatedUserIdFromRequest(req)
        ? AUTHENTICATED_API_RATE_LIMIT_MAX_REQUESTS
        : ANONYMOUS_API_RATE_LIMIT_MAX_REQUESTS
);

const normalizeApiPath = (req) => (req.originalUrl || req.path || '').split('?')[0];

const isSearchPath = (req) => {
    if (req.method !== 'GET') {
        return false;
    }

    const pathOnly = normalizeApiPath(req);
    return pathOnly === '/api/search'
        || pathOnly.startsWith('/api/search/')
        || pathOnly.includes('/search');
};

const isFileUploadPath = (req) => {
    if (req.method !== 'POST') {
        return false;
    }

    const pathOnly = normalizeApiPath(req);
    if (pathOnly === '/api/upload' || pathOnly === '/api/csv/staging') {
        return true;
    }
    if (pathOnly === '/api/communications/upload' || pathOnly === '/api/communications/upload-oci') {
        return true;
    }
    if (pathOnly === '/api/documents/upload' || pathOnly === '/api/content-fonts/upload') {
        return true;
    }
    if (/^\/api\/documents\/[^/]+\/versions$/.test(pathOnly)) {
        return true;
    }

    return /^\/api\/files\/[^/]+\/[^/]+$/.test(pathOnly);
};

const isExportPath = (req) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return false;
    }

    return normalizeApiPath(req).includes('/export');
};

const isImportCreationPath = (req) => {
    if (req.method !== 'POST') {
        return false;
    }

    return /^\/api\/csv\/import\//.test(normalizeApiPath(req));
};

const logRateLimitHit = (limiterName, req) => {
    console.log('RATE LIMIT HIT:', getClientIp(req), req.originalUrl, {
        limiter: limiterName,
        method: req.method,
        xForwardedFor: req.headers['x-forwarded-for'] || null,
        forwarded: req.headers.forwarded || null,
        userAgent: req.headers['user-agent'] || null
    });
};

const makeRateLimitHandler = (limiterName, message) => (req, res) => {
    logRateLimitHit(limiterName, req);
    const payload = typeof message === 'string'
        ? { success: false, error: message, message }
        : {
            success: false,
            ...message,
            message: message.message || message.error
        };
    res.status(429).json(payload);
};

const RATE_LIMIT_APP_NAME = process.env.CACHE_APP_NAME || process.env.APP_NAME || 'arivu';
const RATE_LIMIT_ENV = process.env.CACHE_ENV || process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const RATE_LIMIT_PREFIX = process.env.RATE_LIMIT_REDIS_PREFIX || `${RATE_LIMIT_APP_NAME}:${RATE_LIMIT_ENV}:rate-limit:`;

const rateLimitHeadersAndStore = (limiterName, windowMs, failureMode) => ({
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    store: createRateLimitStore({
        prefix: `${RATE_LIMIT_PREFIX}${limiterName}:`,
        windowMs,
    }),
    passOnStoreError: shouldPassOnRateLimitStoreError(failureMode),
});

const shouldBypassRateLimit = (req, { logContext } = {}) => {
    if (isProduction || bypassDisabled) {
        return false;
    }

    if (hasBypassHeader(req)) {
        if (logContext) {
            console.warn(`⚠️  [DEV] Rate limiting bypassed for ${logContext}`);
        }
        return true;
    }

    return false;
};

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: (req) => resolveGeneralApiMaxRequests(req),
    ...rateLimitHeadersAndStore('api', RATE_LIMIT_WINDOW_MS, GENERAL_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => getRateLimitKey(req, 'api'),
    handler: makeRateLimitHandler('api', {
        error: 'Too many requests from this user or IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting for certain conditions
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        
        if (shouldBypassRateLimit(req)) {
            return true;
        }

        // Auth routes have dedicated, stricter limiters mounted on authRoutes.
        // Organization settings are read during normal settings navigation and
        // have a dedicated relaxed limiter after authentication.
        return (
            isHealthCheckPath(req) ||
            isAuthPath(req) ||
            isOrganizationSettingsReadPath(req) ||
            isNotificationReadPath(req) ||
            isSessionBootstrapReadPath(req) ||
            isSearchPath(req) ||
            isFileUploadPath(req) ||
            isExportPath(req) ||
            isImportCreationPath(req)
        );
    }
});

// Strict rate limiter for authentication endpoints
const AUTH_RATE_LIMIT_MESSAGE = {
    error: 'Too many login attempts for this account, please try again after a few minutes.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
};

const authLimiter = rateLimit({
    windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
    max: AUTH_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('auth', AUTH_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    // Count only failed auth responses so successful logins / session reads do not burn budget
    skipSuccessfulRequests: true,
    message: AUTH_RATE_LIMIT_MESSAGE,
    handler: makeRateLimitHandler('auth', AUTH_RATE_LIMIT_MESSAGE),
    // Per IP + email (not whole-building IP)
    keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        return `auth:ip:${getClientIp(req)}:email:${email}`;
    },
    // DEVELOPMENT ONLY: Skip rate limiting if bypass header is present
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        
        if (shouldBypassRateLimit(req, { logContext: `auth request from ${req.ip} (${req.body?.email || 'unknown user'})` })) {
            return true;
        }

        // Skip for health checks
        return isHealthCheckPath(req);
    }
});

// Strict rate limiter for password-reset / invite *request* endpoints (email-keyed)
const passwordResetLimiter = rateLimit({
    windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    max: PASSWORD_RESET_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('password-reset', PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many password reset attempts, please try again later.',
        code: 'PASSWORD_RESET_LIMIT_EXCEEDED'
    },
    handler: makeRateLimitHandler('password-reset', {
        error: 'Too many password reset attempts, please try again later.',
        code: 'PASSWORD_RESET_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        // 🔓 BYPASS: Skip all rate limiting if security is disabled
        if (SECURITY_DISABLED) {
            return true;
        }
        return process.env.NODE_ENV !== 'production';
    },
    keyGenerator: (req) => {
        const email = String(req.body?.email || '').trim().toLowerCase();
        return `password-reset:ip:${getClientIp(req)}:email:${email}`;
    }
});

// Separate limiter for token validate/confirm — do not share the 3/hr request bucket.
// Key by IP + token so prefetchers on one link do not block every other auth token on that IP.
const authTokenActionLimiter = rateLimit({
    windowMs: AUTH_TOKEN_ACTION_RATE_LIMIT_WINDOW_MS,
    max: AUTH_TOKEN_ACTION_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('auth-token-action', AUTH_TOKEN_ACTION_RATE_LIMIT_WINDOW_MS, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many attempts with this link, please try again later.',
        code: 'AUTH_TOKEN_ACTION_LIMIT_EXCEEDED'
    },
    handler: makeRateLimitHandler('auth-token-action', {
        error: 'Too many attempts with this link, please try again later.',
        code: 'AUTH_TOKEN_ACTION_LIMIT_EXCEEDED'
    }),
    skip: (req) => {
        if (SECURITY_DISABLED) {
            return true;
        }
        return process.env.NODE_ENV !== 'production';
    },
    keyGenerator: (req) => {
        const token = String(req.query?.token || req.body?.token || '').trim();
        const tokenKey = token
            ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16)
            : 'missing';
        return `auth-token-action:ip:${getClientIp(req)}:token:${tokenKey}`;
    }
});

// Strict rate limiter for registration
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit to 3 registrations per hour per IP
    ...rateLimitHeadersAndStore('registration', 60 * 60 * 1000, AUTH_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many registration attempts, please try again later.',
        code: 'REGISTRATION_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => `registration:ip:${getClientIp(req)}`,
    handler: makeRateLimitHandler('registration', {
        error: 'Too many registration attempts, please try again later.',
        code: 'REGISTRATION_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

// Strict rate limiter for sensitive operations (delete, update critical data)
const sensitiveOperationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit to 10 sensitive operations per 15 minutes
    ...rateLimitHeadersAndStore('sensitive-operation', 15 * 60 * 1000, SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many sensitive operations, please try again later.',
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => getRateLimitKey(req, 'sensitive'),
    handler: makeRateLimitHandler('sensitive-operation', {
        error: 'Too many sensitive operations, please try again later.',
        code: 'SENSITIVE_OPERATION_LIMIT_EXCEEDED'
    }),
    // Skip rate limiting in development mode
    skip: (req) => {
        return process.env.NODE_ENV !== 'production';
    }
});

const createUserScopedRouteLimiter = ({
    limiterName,
    windowMs,
    max,
    failureMode,
    message,
    code,
}) => rateLimit({
    windowMs,
    max,
    ...rateLimitHeadersAndStore(limiterName, windowMs, failureMode),
    message: {
        error: message,
        code,
    },
    keyGenerator: (req) => getRateLimitKey(req, limiterName),
    handler: makeRateLimitHandler(limiterName, {
        error: message,
        code,
    }),
    skip: (req) => {
        if (SECURITY_DISABLED) {
            return true;
        }
        return shouldBypassRateLimit(req);
    },
});

const searchLimiter = createUserScopedRouteLimiter({
    limiterName: 'search',
    windowMs: SEARCH_RATE_LIMIT_WINDOW_MS,
    max: SEARCH_RATE_LIMIT_MAX_REQUESTS,
    failureMode: ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many search requests, please try again later.',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED',
});

/** SMTP credential verify / connect — prevent brute-force of mailbox passwords. */
const smtpVerifyLimiter = createUserScopedRouteLimiter({
    limiterName: 'smtp-verify',
    windowMs: 15 * 60 * 1000,
    max: 20,
    failureMode: ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many SMTP connection tests. Please try again later.',
    code: 'SMTP_VERIFY_RATE_LIMIT_EXCEEDED',
});

const fileUploadLimiter = createUserScopedRouteLimiter({
    limiterName: 'file-upload',
    windowMs: FILE_UPLOAD_RATE_LIMIT_WINDOW_MS,
    max: FILE_UPLOAD_RATE_LIMIT_MAX_REQUESTS,
    failureMode: SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many file uploads, please try again later.',
    code: 'FILE_UPLOAD_RATE_LIMIT_EXCEEDED',
});

const exportLimiter = createUserScopedRouteLimiter({
    limiterName: 'export',
    windowMs: EXPORT_RATE_LIMIT_WINDOW_MS,
    max: EXPORT_RATE_LIMIT_MAX_REQUESTS,
    failureMode: SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many export requests, please try again later.',
    code: 'EXPORT_RATE_LIMIT_EXCEEDED',
});

/** Per-user limiter for /api/ai ability routes (platform + BYOK). */
const aiLimiter = createUserScopedRouteLimiter({
    limiterName: 'ai',
    windowMs: AI_RATE_LIMIT_WINDOW_MS,
    max: AI_RATE_LIMIT_MAX_REQUESTS,
    failureMode: ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many AI requests, please try again later.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
});

const importCreationLimiter = createUserScopedRouteLimiter({
    limiterName: 'import-creation',
    windowMs: IMPORT_CREATION_RATE_LIMIT_WINDOW_MS,
    max: IMPORT_CREATION_RATE_LIMIT_MAX_REQUESTS,
    failureMode: SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE,
    message: 'Too many import jobs created, please try again later.',
    code: 'IMPORT_CREATION_RATE_LIMIT_EXCEEDED',
});

const routeRateLimitMiddleware = (req, res, next) => {
    if (SECURITY_DISABLED || shouldBypassRateLimit(req)) {
        return next();
    }

    if (isSearchPath(req)) {
        return searchLimiter(req, res, next);
    }
    if (isFileUploadPath(req)) {
        return fileUploadLimiter(req, res, next);
    }
    if (isExportPath(req)) {
        return exportLimiter(req, res, next);
    }
    if (isImportCreationPath(req)) {
        return importCreationLimiter(req, res, next);
    }

    return next();
};

// Relaxed limiter for session bootstrap reads (UI shell, profile, core modules).
// Mounted after auth on dedicated routes so page loads do not exhaust the general API bucket.
const sessionBootstrapLimiter = rateLimit({
    windowMs: SESSION_BOOTSTRAP_RATE_LIMIT_WINDOW_MS,
    max: SESSION_BOOTSTRAP_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('session-bootstrap', SESSION_BOOTSTRAP_RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many session bootstrap requests, please try again later.',
        code: 'SESSION_BOOTSTRAP_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        if (req.user?._id) {
            return `session-bootstrap:user:${req.user._id}`;
        }
        return getRateLimitKey(req, 'session-bootstrap');
    },
    handler: makeRateLimitHandler('session-bootstrap', {
        error: 'Too many session bootstrap requests, please try again later.',
        code: 'SESSION_BOOTSTRAP_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => {
        if (SECURITY_DISABLED) {
            return true;
        }
        return shouldBypassRateLimit(req);
    }
});

// Relaxed limiter for a read-heavy settings bootstrap endpoint.
// Mounted after auth, so req.user is available and tenants/users do not share
// one bucket just because a proxy presents the same network IP.
const organizationSettingsLimiter = rateLimit({
    windowMs: ORGANIZATION_SETTINGS_RATE_LIMIT_WINDOW_MS,
    max: ORGANIZATION_SETTINGS_RATE_LIMIT_MAX_REQUESTS,
    ...rateLimitHeadersAndStore('organization-settings', ORGANIZATION_SETTINGS_RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many organization settings requests, please try again later.',
        code: 'ORGANIZATION_SETTINGS_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        if (req.user?._id) {
            return `organization-settings:user:${req.user._id}`;
        }
        return getRateLimitKey(req, 'organization-settings');
    },
    handler: makeRateLimitHandler('organization-settings', {
        error: 'Too many organization settings requests, please try again later.',
        code: 'ORGANIZATION_SETTINGS_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => {
        if (SECURITY_DISABLED) {
            return true;
        }
        return shouldBypassRateLimit(req);
    }
});

const MAILROOM_PUBLIC_RATE_LIMIT_MAX = parsePositiveInteger(
    process.env.MAILROOM_PUBLIC_RATE_LIMIT_MAX,
    120
);
const MAILROOM_PORTAL_RATE_LIMIT_MAX = parsePositiveInteger(
    process.env.MAILROOM_PORTAL_RATE_LIMIT_MAX,
    180
);
const MAILROOM_CONNECTOR_WINDOW_MS = parsePositiveInteger(
    process.env.MAILROOM_CONNECTOR_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);

const mailroomPublicIngestLimiter = rateLimit({
    windowMs: MAILROOM_CONNECTOR_WINDOW_MS,
    max: MAILROOM_PUBLIC_RATE_LIMIT_MAX,
    ...rateLimitHeadersAndStore('mailroom-public', MAILROOM_CONNECTOR_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many Mailroom public API requests, please try again later.',
        code: 'MAILROOM_PUBLIC_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const orgId = req.headers['x-organization-id'] || req.headers['x-org-id'] || 'unknown-org';
        return `mailroom-public:${orgId}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('mailroom-public', {
        error: 'Too many Mailroom public API requests, please try again later.',
        code: 'MAILROOM_PUBLIC_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);
const PUBLIC_QUOTE_VIEW_MAX = parsePositiveInteger(process.env.PUBLIC_QUOTE_VIEW_MAX, 120);
const PUBLIC_QUOTE_ACTION_MAX = parsePositiveInteger(process.env.PUBLIC_QUOTE_ACTION_MAX, 20);

const PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS = parsePositiveInteger(
    process.env.PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000
);
const PUBLIC_WEBFORM_VIEW_MAX = parsePositiveInteger(process.env.PUBLIC_WEBFORM_VIEW_MAX, 180);
const PUBLIC_WEBFORM_SUBMIT_MAX = parsePositiveInteger(process.env.PUBLIC_WEBFORM_SUBMIT_MAX, 30);

const publicWebformViewLimiter = rateLimit({
    windowMs: PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_WEBFORM_VIEW_MAX,
    ...rateLimitHeadersAndStore('public-webform-view', PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many requests for this webform. Please try again later.',
        code: 'PUBLIC_WEBFORM_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const slug = String(req.params?.slug || 'unknown').slice(0, 64).toLowerCase();
        return `public-webform:view:${slug}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-webform-view', {
        error: 'Too many requests for this webform. Please try again later.',
        code: 'PUBLIC_WEBFORM_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const publicWebformSubmitLimiter = rateLimit({
    windowMs: PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_WEBFORM_SUBMIT_MAX,
    ...rateLimitHeadersAndStore('public-webform-submit', PUBLIC_WEBFORM_RATE_LIMIT_WINDOW_MS, SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many submissions for this webform. Please try again later.',
        code: 'PUBLIC_WEBFORM_SUBMIT_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const slug = String(req.params?.slug || 'unknown').slice(0, 64).toLowerCase();
        return `public-webform:submit:${slug}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-webform-submit', {
        error: 'Too many submissions for this webform. Please try again later.',
        code: 'PUBLIC_WEBFORM_SUBMIT_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const publicQuoteViewLimiter = rateLimit({
    windowMs: PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_QUOTE_VIEW_MAX,
    ...rateLimitHeadersAndStore('public-quote-view', PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many requests for this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const token = String(req.params?.token || 'unknown').slice(0, 64);
        return `public-quote:view:${token}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-quote-view', {
        error: 'Too many requests for this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const publicQuoteActionLimiter = rateLimit({
    windowMs: PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS,
    max: PUBLIC_QUOTE_ACTION_MAX,
    ...rateLimitHeadersAndStore('public-quote-action', PUBLIC_QUOTE_RATE_LIMIT_WINDOW_MS, SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many actions on this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_ACTION_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const token = String(req.params?.token || 'unknown').slice(0, 64);
        return `public-quote:action:${token}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-quote-action', {
        error: 'Too many actions on this quote link. Please try again later.',
        code: 'PUBLIC_QUOTE_ACTION_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const mailroomPortalIngestLimiter = rateLimit({
    windowMs: MAILROOM_CONNECTOR_WINDOW_MS,
    max: MAILROOM_PORTAL_RATE_LIMIT_MAX,
    ...rateLimitHeadersAndStore('mailroom-portal', MAILROOM_CONNECTOR_WINDOW_MS, ROUTE_RATE_LIMIT_REDIS_FAILURE_MODE),
    message: {
        error: 'Too many Mailroom portal requests, please try again later.',
        code: 'MAILROOM_PORTAL_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        if (req.user?._id) {
            return `mailroom-portal:user:${req.user._id}`;
        }
        return getRateLimitKey(req, 'mailroom-portal');
    },
    handler: makeRateLimitHandler('mailroom-portal', {
        error: 'Too many Mailroom portal requests, please try again later.',
        code: 'MAILROOM_PORTAL_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

const publicMarketingPreferenceLimiter = rateLimit({
    windowMs: parsePositiveInteger(process.env.PUBLIC_MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS, ONE_HOUR_MS),
    max: parsePositiveInteger(process.env.PUBLIC_MARKETING_PREFERENCE_RATE_LIMIT_MAX, 30),
    ...rateLimitHeadersAndStore(
        'public-marketing-preference',
        parsePositiveInteger(process.env.PUBLIC_MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS, ONE_HOUR_MS),
        SENSITIVE_RATE_LIMIT_REDIS_FAILURE_MODE
    ),
    message: {
        error: 'Too many preference center requests. Please try again later.',
        code: 'PUBLIC_MARKETING_PREFERENCE_RATE_LIMIT_EXCEEDED'
    },
    keyGenerator: (req) => {
        const token = String(req.params?.token || req.body?.token || 'unknown').slice(0, 64);
        return `public-marketing-preference:${token}:${getClientIp(req)}`;
    },
    handler: makeRateLimitHandler('public-marketing-preference', {
        error: 'Too many preference center requests. Please try again later.',
        code: 'PUBLIC_MARKETING_PREFERENCE_RATE_LIMIT_EXCEEDED'
    }),
    skip: (req) => SECURITY_DISABLED || shouldBypassRateLimit(req)
});

module.exports = {
    apiLimiter,
    authLimiter,
    passwordResetLimiter,
    authTokenActionLimiter,
    registrationLimiter,
    sensitiveOperationLimiter,
    searchLimiter,
    fileUploadLimiter,
    exportLimiter,
    importCreationLimiter,
    aiLimiter,
    routeRateLimitMiddleware,
    sessionBootstrapLimiter,
    organizationSettingsLimiter,
    mailroomPublicIngestLimiter,
    mailroomPortalIngestLimiter,
    publicQuoteViewLimiter,
    publicQuoteActionLimiter,
    publicMarketingPreferenceLimiter,
    publicWebformViewLimiter,
    publicWebformSubmitLimiter,
    smtpVerifyLimiter
};
