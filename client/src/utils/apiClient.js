import { getApiUrlForFetch } from '@/config/apiBase';
import { useAuthStore } from '@/stores/authRegistry';
import { isOnPublicShellRoute, isPortalAuthLifecycleRoute } from '@/utils/standaloneRoutes';

// Request deduplication: map of in-flight requests by URL+method
const _inFlightRequests = new Map();
const _metadataResponseCache = new Map();
const _idempotencyKeyCache = new Map();

const METADATA_CACHE_TTL_MS = 5 * 60 * 1000;
const PEOPLE_LIST_CACHE_TTL_MS = 30 * 1000;
const RECORD_CONTEXT_CACHE_TTL_MS = 30 * 1000;
const IDEMPOTENCY_KEY_TTL_MS = 30 * 1000;
const CACHEABLE_GET_PATHS = [
    /^\/modules(?:$|\?)/,
    /^\/settings\/core-modules(?:$|\/|\?)/,
    /^\/settings\/integrations(?:$|\/|\?)/,
    /^\/ui\/apps(?:$|\/|\?)/,
    /^\/ui\/registry(?:$|\?)/,
    /^\/ui\/entities(?:$|\?)/,
    /^\/ui\/routes(?:$|\?)/,
    /^\/people(?:$|\?)/,
    // Do not cache GET /people/:id — soft refetch after save/process must see fresh data
    /^\/activity\/[^/?]+\/[^/?]+(?:$|\?)/,
    /^\/communications\/threads(?:$|\?)/,
    /^\/relationships\/(?:record-context|links)(?:$|\?)/,
    /^\/modules\/[^/?]+\/records\/[^/?]+\/neighbors(?:$|\?)/,
    /^\/organizations\/list(?:$|\?)/,
    /^\/v2\/organization(?:$|\?)/,
    /^\/users\/list(?:$|\?)/,
    /^\/groups(?:$|\?)/,
];

const INVALIDATING_PATHS = [
    /^\/modules(?:$|\/|\?)/,
    /^\/settings\/core-modules(?:$|\/|\?)/,
    /^\/settings\/integrations(?:$|\/|\?)/,
    /^\/ui(?:$|\/|\?)/,
    /^\/people(?:$|\/|\?)/,
    /^\/activity(?:$|\/|\?)/,
    /^\/communications(?:$|\/|\?)/,
    /^\/relationships(?:$|\/|\?)/,
    /^\/organizations(?:$|\/|\?)/,
    /^\/v2\/organization(?:$|\/|\?)/,
    /^\/users(?:$|\/|\?)/,
    /^\/groups(?:$|\/|\?)/,
];

function authSessionKey(authStore) {
    const user = authStore.user || {};
    const orgId =
        user.organizationId ||
        authStore.organization?._id ||
        user.organization?._id ||
        '';
    return `${user._id || ''}:${orgId}`;
}

function serializeQueryParamValue(value) {
    if (value === null) return 'null';
    return value;
}

function normalizeParams(params = {}) {
    const entries = Object.entries(params || {}).filter(([, value]) => value !== undefined);
    if (!entries.length) return '';
    return new URLSearchParams(
        entries
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => [key, serializeQueryParamValue(value)])
    ).toString();
}

function getPathWithSearch(fullUrl) {
    try {
        const parsed = new URL(fullUrl, window.location.origin);
        return `${parsed.pathname.replace(/^\/api/, '')}${parsed.search || ''}`;
    } catch {
        return String(fullUrl || '').replace(/^\/api/, '');
    }
}

function isCacheableMetadataGet(pathWithSearch) {
    return CACHEABLE_GET_PATHS.some((pattern) => pattern.test(pathWithSearch));
}

function cacheTtlForGet(pathWithSearch) {
    if (/^\/settings\/integrations(?:$|\/|\?)/.test(pathWithSearch)) {
        return 30 * 1000;
    }
    if (isPersistentShortCacheGet(pathWithSearch)) {
        if (/^\/people(?:$|\?)/.test(pathWithSearch)) {
            return PEOPLE_LIST_CACHE_TTL_MS;
        }
        return RECORD_CONTEXT_CACHE_TTL_MS;
    }
    return METADATA_CACHE_TTL_MS;
}

function isPersistentShortCacheGet(pathWithSearch) {
    return [
        /^\/people(?:$|\?)/,
        // Single-record people GETs are intentionally uncached (see CACHEABLE_GET_PATHS)
        /^\/activity\/[^/?]+\/[^/?]+(?:$|\?)/,
        /^\/communications\/threads(?:$|\?)/,
        /^\/relationships\/(?:record-context|links)(?:$|\?)/,
        /^\/modules\/[^/?]+\/records\/[^/?]+\/neighbors(?:$|\?)/,
        /^\/organizations\/list(?:$|\?)/,
        /^\/v2\/organization(?:$|\?)/,
        /^\/users\/list(?:$|\?)/,
        /^\/groups(?:$|\?)/,
    ].some((pattern) => pattern.test(pathWithSearch));
}

function persistentCacheKey(requestKey) {
    return `arivu:api-cache:${requestKey}`;
}

function readPersistentCache(requestKey) {
    try {
        const raw = localStorage.getItem(persistentCacheKey(requestKey));
        const cached = raw ? JSON.parse(raw) : null;
        if (!cached || cached.expiresAt <= Date.now()) {
            if (cached) localStorage.removeItem(persistentCacheKey(requestKey));
            return null;
        }
        return cached.data;
    } catch {
        return null;
    }
}

function writePersistentCache(requestKey, data, ttlMs) {
    try {
        localStorage.setItem(persistentCacheKey(requestKey), JSON.stringify({
            data,
            expiresAt: Date.now() + ttlMs
        }));
    } catch {
        // Ignore storage failures; in-memory cache still handles same-session reuse.
    }
}

function clearPersistentShortCache() {
    try {
        const prefix = 'arivu:api-cache:';
        for (let i = localStorage.length - 1; i >= 0; i -= 1) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(prefix)) continue;
            if (
                key.includes('/people') ||
                key.includes('/activity') ||
                key.includes('/communications') ||
                key.includes('/relationships') ||
                key.includes('/organizations') ||
                key.includes('/v2/organization') ||
                key.includes('/users/list') ||
                key.includes('/groups') ||
                key.includes('/records/')
            ) {
                localStorage.removeItem(key);
            }
        }
    } catch {
        // Ignore storage failures.
    }
}

function invalidatesMetadata(pathWithSearch) {
    return INVALIDATING_PATHS.some((pattern) => pattern.test(pathWithSearch));
}

function clearMetadataResponseCache() {
    _metadataResponseCache.clear();
    clearPersistentShortCache();
}

function shouldAutoIdempotencyHeader(method, pathWithSearch) {
    return String(method || '').toUpperCase() === 'POST' && /^\/communications\/email(?:$|\?)/.test(pathWithSearch);
}

function getStableBodyFingerprint(body) {
    if (!body) return '';
    if (typeof body === 'string') return body;
    try {
        return JSON.stringify(body);
    } catch {
        return String(body);
    }
}

function getOrCreateIdempotencyKey(cacheKey) {
    const now = Date.now();
    const existing = _idempotencyKeyCache.get(cacheKey);
    if (existing && existing.expiresAt > now) {
        return existing.key;
    }
    const key =
        (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `${now}-${Math.random().toString(16).slice(2)}`;
    _idempotencyKeyCache.set(cacheKey, { key, expiresAt: now + IDEMPOTENCY_KEY_TTL_MS });

    // Opportunistic cleanup.
    if (Math.random() < 0.02) {
        for (const [k, v] of _idempotencyKeyCache.entries()) {
            if (!v || v.expiresAt <= now) _idempotencyKeyCache.delete(k);
        }
    }
    return key;
}

const apiClient = async (url, options = {}) => {
    const authStore = useAuthStore();
    const token = authStore.user?.token; // Get token from Pinia store
    const sessionKey = authSessionKey(authStore);

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        // Attach the JWT to the request header for protected routes
        headers['Authorization'] = `Bearer ${token}`; 
    }

    // Handle URL params for GET requests
    let fullUrl = getApiUrlForFetch(url);
    if (options.params) {
        const queryString = normalizeParams(options.params);
        if (queryString) {
            fullUrl += `?${queryString}`;
        }
    }

    // Request deduplication: only dedupe GET requests (safe idempotent operations)
    const method = options.method || 'GET';
    const pathWithSearch = getPathWithSearch(fullUrl);
    if (shouldAutoIdempotencyHeader(method, pathWithSearch) && !headers['X-Idempotency-Key']) {
        const fingerprint = getStableBodyFingerprint(options.body);
        const idempotencyCacheKey = `${sessionKey}:${method}:${pathWithSearch}:${fingerprint}`;
        headers['X-Idempotency-Key'] = getOrCreateIdempotencyKey(idempotencyCacheKey);
    }
    const cacheableMetadataGet = method === 'GET' && isCacheableMetadataGet(pathWithSearch) && options.cache !== 'no-store';
    const requestKey = `${sessionKey}:${method}:${fullUrl}`;
    
    if (cacheableMetadataGet) {
        const cached = _metadataResponseCache.get(requestKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.data;
        }
        if (cached) {
            _metadataResponseCache.delete(requestKey);
        }

        if (isPersistentShortCacheGet(pathWithSearch)) {
            const persistentCached = readPersistentCache(requestKey);
            if (persistentCached) {
                _metadataResponseCache.set(requestKey, {
                    data: persistentCached,
                    expiresAt: Date.now() + cacheTtlForGet(pathWithSearch)
                });
                return persistentCached;
            }
        }
    }
    
    // Do not dedupe cancellable GETs: callers using AbortSignal rely on distinct promises;
    // sharing one promise would tie unrelated sequential requests to an aborted fetch.
    const skipGetDedupe = method === 'GET' && options.signal != null;

    if (method === 'GET' && !skipGetDedupe && _inFlightRequests.has(requestKey)) {
        console.log(`[apiClient] Returning cached in-flight request: ${requestKey}`);
        return _inFlightRequests.get(requestKey);
    }

    if (method !== 'GET' && invalidatesMetadata(pathWithSearch)) {
        clearMetadataResponseCache();
    }

    const requestPromise = (async () => {
        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers,
                body: options.body,
            });

            if (response.status === 401) {
                const skipLogout = options.skipAuthLogout === true
                    || isOnPublicShellRoute()
                    || (typeof window !== 'undefined'
                        && isPortalAuthLifecycleRoute(window.location.pathname));
                // Only clear the session if this request used the *current* token.
                // Stale in-flight / other-tab requests with an old JWT must not wipe a fresh login.
                const tokenStillCurrent = Boolean(token) && authStore.user?.token === token;
                if (!skipLogout && tokenStillCurrent) {
                    authStore.logout();
                }
                const authError = new Error('Session expired. Please log in again.');
                authError.status = 401;
                throw authError;
            }

            // Transient infra (tenant DB blip) must not look like hard auth failure.
            if (response.status === 503) {
                const serviceError = new Error('Service temporarily unavailable. Please retry.');
                serviceError.status = 503;
                throw serviceError;
            }

            // Check for other errors
            if (!response.ok) {
                const is404 = response.status === 404;
                let errorMessage = `HTTP error! Status: ${response.status}`;
                let errorData = null;
                try {
                    // Clone response before reading to avoid "body stream already read" error
                    const clonedResponse = response.clone();
                    errorData = await clonedResponse.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (parseError) {
                    // HTML/nginx error pages must never become user-facing toast text.
                    try {
                        const clonedResponse = response.clone();
                        const textContent = await clonedResponse.text();
                        console.error('Non-JSON response received:', textContent.substring(0, 200));
                        errorMessage = `Request failed (${response.status})`;
                    } catch (textError) {
                        errorMessage = `Request failed (${response.status})`;
                    }
                }
                
                const error = new Error(errorMessage);
                error.status = response.status;
                error.is404 = is404;
                // Attach response data for 400 errors (validation errors)
                if (errorData) {
                    error.response = { data: errorData };
                }
                throw error;
            }

            if (response.status === 204 || response.status === 205) {
                return { success: true };
            }

            const data = await response.json();
            if (cacheableMetadataGet) {
                const ttlMs = cacheTtlForGet(pathWithSearch);
                _metadataResponseCache.set(requestKey, {
                    data,
                    expiresAt: Date.now() + ttlMs
                });
                if (isPersistentShortCacheGet(pathWithSearch)) {
                    writePersistentCache(requestKey, data, ttlMs);
                }
            }
            return data;
        } catch (error) {
            // Re-throw if it's already our custom error
            if (error.status !== undefined) {
                throw error;
            }
            // For network errors or other issues, wrap them
            const wrappedError = new Error(error.message || 'Network error');
            wrappedError.status = 0;
            wrappedError.is404 = false;
            throw wrappedError;
        } finally {
            // Clean up the in-flight request map
            if (method === 'GET') {
                _inFlightRequests.delete(requestKey);
            }
        }
    })();

    // Store the promise for GET requests to deduplicate
    if (method === 'GET') {
        _inFlightRequests.set(requestKey, requestPromise);
    }

    return requestPromise;
};

// Add convenient methods
apiClient.get = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'GET' });
};

/**
 * GET that returns null on 404 or 403 instead of throwing.
 * Use when the missing/forbidden case is expected (e.g. enriching related records that may be deleted or inaccessible).
 */
apiClient.getOptional = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'GET' }).catch((err) => {
        if (err?.status === 404 || err?.status === 403) return null;
        if (err?.status === 401 && options.skipAuthLogout === true) return null;
        throw err;
    });
};

apiClient.post = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'POST', body: JSON.stringify(data) });
};

/**
 * POST that returns null on expected enrichment failures (404/403/unsupported batch).
 */
apiClient.postOptional = (url, data, options = {}) => {
    return apiClient.post(url, data, options).catch((err) => {
        if (err?.status === 404 || err?.status === 403) return null;
        if (err?.status === 401 && options.skipAuthLogout === true) return null;
        const msg = String(err?.message || '').toLowerCase();
        if (err?.status === 400 && (msg.includes('batch not supported') || String(url || '').includes('/records/batch'))) {
            return null;
        }
        throw err;
    });
};

apiClient.put = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PUT', body: JSON.stringify(data) });
};

apiClient.patch = (url, data, options = {}) => {
    return apiClient(url, { ...options, method: 'PATCH', body: JSON.stringify(data) });
};

apiClient.delete = (url, options = {}) => {
    return apiClient(url, { ...options, method: 'DELETE' });
};

apiClient.clearMetadataResponseCache = clearMetadataResponseCache;

export default apiClient;
