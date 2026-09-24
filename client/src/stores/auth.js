import { defineStore } from 'pinia';
import { logAuthAccessDebug, warnAuthAccessDebug } from '@/config/arivuDebug.js';
import { getApiUrlForFetch } from '@/config/apiBase';
import { isOnPublicShellRoute, isTrialExpiredShelllessRoute, isPortalAuthLifecycleRoute } from '@/utils/standaloneRoutes';
import { validateUserTypeForApp } from '@/utils/appUserTypeAccess';
import { identifyProductUser, captureUserLoggedIn, resetPosthog } from '@/config/posthogUser';
import {
    capturePortalLogin,
    capturePortalSelected,
    capturePortalSwitched
} from '@/config/posthogPortal';
import { registerUseAuthStore } from './authRegistry';
import { applyTrialSnapshotToOrganization } from '@/utils/trialStatus';

const PROFILE_REFRESHED_AT_KEY = 'arivu:user-profile-refreshed-at';
const PROFILE_REFRESH_FRESH_MS = 5 * 60 * 1000;
const TRIAL_SYNC_FRESH_MS = 30 * 1000;
const PROD_LOGOUT_REDIRECT_ORIGIN = (import.meta.env.VITE_MAIN_APP_ORIGIN || 'https://app.arivusystems.com').replace(/\/$/, '');

function isPrivilegedAuthUser(user) {
    if (!user) return false;
    if (user.isOwner === true) return true;
    const userType = String(user.userType || '').toUpperCase();
    if (userType === 'ADMIN' || userType === 'SYSTEM') return true;
    if (userType === 'EXTERNAL' || userType === 'PORTAL') return false;
    // STANDARD / INTERNAL / empty: heal system Admin/Owner role names only
    const role = String(user.role || '').toLowerCase();
    if (role === 'admin' || role === 'owner' || role === 'administrator') return true;
    return false;
}

export const useAuthStore = defineStore('auth', {
    state: () => ({
        user: JSON.parse(localStorage.getItem('user')) || null,
        organization: JSON.parse(localStorage.getItem('organization')) || null,
        lastLoginResult: null,
        lastTrialSyncAt: 0,
        loading: false,
        error: null,
        sessionLimit: null,
    }),
    getters: {
        isAuthenticated: (state) => {
            const token = state.user?.token;
            return Boolean(
                state.user
                && token
                && token !== 'undefined'
                && token !== 'null'
            );
        },
        isOwner: (state) => state.user?.isOwner || false,
        userRole: (state) => state.user?.role || null,
        isAdminLike: (state) => isPrivilegedAuthUser(state.user),
        hasPermission: (state) => {
            return (module, action) => {
                if (isPrivilegedAuthUser(state.user)) return true;
                const normalized = module === 'people' ? 'contacts' : module;
                return state.user?.permissions?.[normalized]?.[action] || false;
            };
        },
        isTrialActive: (state) => state.organization?.subscription?.status === 'trial',
        isTrialExpired: (state) => {
            const subscription = state.organization?.subscription;
            if (!subscription || subscription.status !== 'trial') return false;
            if (!subscription.trialEndDate) return false;
            return new Date() > new Date(subscription.trialEndDate);
        },
        hasUsedTrialExtension: (state) => state.organization?.subscription?.trialExtensionUsed === true,
        subscriptionTier: (state) => state.organization?.subscription?.tier || 'trial',
        enabledModules: (state) => state.organization?.enabledModules || [],
        inventoryEnabled: (state) => state.organization?.capabilities?.inventory === true,
        isMasterOrganization: (state) => state.organization?.name === 'Arivu Master',
        isPlatformAdmin: (state) => {
            // Check if user is platform admin (Phase 0H)
            if (state.user?.isPlatformAdmin === true) return true;
            // Check if user has internal staff email
            const email = state.user?.email || '';
            const internalDomains = ['arivusystems.com', 'arivu.com', 'arivu.io'];
            return internalDomains.some(domain => email.toLowerCase().includes(`@${domain}`));
        },
        isExternalUser: (state) => {
            const t = String(state.user?.userType || 'STANDARD').toUpperCase();
            return t === 'EXTERNAL' || t === 'PORTAL';
        },
        needsPortalSelection: (state) => {
            const t = String(state.user?.userType || 'STANDARD').toUpperCase();
            if (t !== 'EXTERNAL' && t !== 'PORTAL') {
                return false;
            }
            if (state.user?.requiresPortalSelection === true) {
                return true;
            }
            const portals = Array.isArray(state.user?.portals) ? state.user.portals : [];
            return portals.length > 1 && !state.user?.activeExternalRoleId;
        },
        hasMultiplePortals: (state) => {
            const portals = Array.isArray(state.user?.portals) ? state.user.portals : [];
            return portals.length > 1;
        },
        activePortalLabel: (state) => state.user?.activePortal?.name || null,
        requiresEmailVerification: (state) => Boolean(state.user && !state.user.emailVerifiedAt),
        hasAppAccess: (state) => {
            return (appKey) => {
                const appKeyUpper = appKey.toUpperCase();
                const userType = state.user?.userType || 'INTERNAL';
                if (!validateUserTypeForApp(userType, appKeyUpper)) {
                    return false;
                }
                const allowedApps = (state.user?.allowedApps || []).map(app =>
                    typeof app === 'string' ? app.toUpperCase() : app
                );
                const hasExplicitUserAccess = allowedApps.includes(appKeyUpper);

                const normalizeOrgEnabledKeys = (enabledApps) => {
                    if (!enabledApps?.length) return [];
                    return enabledApps
                        .map((app) => {
                            if (typeof app === 'string') return app.toUpperCase();
                            if (app && typeof app === 'object') {
                                const key = app.appKey || app;
                                if (app.status && app.status !== 'ACTIVE') return null;
                                return typeof key === 'string' ? key.toUpperCase() : null;
                            }
                            return null;
                        })
                        .filter((k) => k !== null);
                };

                const isOwnerLike =
                    state.user?.isOwner === true ||
                    String(state.user?.role || '').toLowerCase() === 'owner';

                // Mirrors server uiCompositionService.getUIAppsForTenant: owners see org-enabled
                // apps that match their userType (INTERNAL users never get PORTAL in navigation).
                // Seat / role enforcement still happens inside each app.
                // IMPORTANT: do not prefer User.allowedApps over organization.enabledApps — that
                // caused the sidebar registry to keep only legacy defaults (e.g. SALES) and hide
                // the app switcher even after enabling HELPDESK/AUDIT on the org.
                if (isOwnerLike) {
                    const orgKeys = normalizeOrgEnabledKeys(state.organization?.enabledApps);
                    if (orgKeys.length > 0) {
                        const ok = orgKeys.includes(appKeyUpper);
                        logAuthAccessDebug(`[hasAppAccess] Owner-like org-enabled check for ${appKeyUpper}:`, {
                            orgKeys,
                            ok
                        });
                        return ok;
                    }

                    if (allowedApps.length > 0) {
                        logAuthAccessDebug(`[hasAppAccess] Owner-like explicit allowedApps (no org keys):`, {
                            allowedApps,
                            appKeyUpper,
                            hasAccess: hasExplicitUserAccess
                        });
                        return hasExplicitUserAccess;
                    }

                    warnAuthAccessDebug(`[hasAppAccess] Owner-like but no org enabledApps and empty allowedApps`, {
                        appKeyUpper
                    });
                    return false;
                }

                logAuthAccessDebug(`[hasAppAccess] Final check for ${appKeyUpper}:`, {
                    isOwner: state.user?.isOwner,
                    allowedApps,
                    hasAccess: hasExplicitUserAccess
                });

                return hasExplicitUserAccess;
            };
        },
        hasAssignedAppAccess: (state) => {
            return (appKey) => {
                const appKeyUpper = String(appKey || '').toUpperCase();
                if (!appKeyUpper) return false;
                const userType = state.user?.userType || 'INTERNAL';
                if (!validateUserTypeForApp(userType, appKeyUpper)) {
                    return false;
                }

                const allowedApps = Array.isArray(state.user?.allowedApps) ? state.user.allowedApps : [];
                const hasAllowedApps = allowedApps.length > 0;
                const normalizedAllowed = allowedApps
                    .map((app) => (typeof app === 'string' ? app.toUpperCase() : null))
                    .filter(Boolean);

                const appAccess = Array.isArray(state.user?.appAccess) ? state.user.appAccess : [];
                const hasAppAccessRows = appAccess.length > 0;
                const normalizedFromAccess = appAccess
                    .filter((entry) => entry && typeof entry === 'object')
                    .filter((entry) => String(entry.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
                    .map((entry) => (typeof entry.appKey === 'string' ? entry.appKey.toUpperCase() : null))
                    .filter(Boolean);

                const hasExplicitUserAppAccessData = hasAllowedApps || hasAppAccessRows;
                if (hasExplicitUserAppAccessData) {
                    const assigned = new Set([...normalizedAllowed, ...normalizedFromAccess]);
                    return assigned.has(appKeyUpper);
                }

                // Legacy fallback for older session payloads.
                const normalizeOrgEnabledKeys = (enabledApps) => {
                    if (!enabledApps?.length) return [];
                    return enabledApps
                        .map((app) => {
                            if (typeof app === 'string') return app.toUpperCase();
                            if (app && typeof app === 'object') {
                                const key = app.appKey || app;
                                if (app.status && app.status !== 'ACTIVE') return null;
                                return typeof key === 'string' ? key.toUpperCase() : null;
                            }
                            return null;
                        })
                        .filter((k) => k !== null);
                };
                const isOwnerLike =
                    state.user?.isOwner === true ||
                    String(state.user?.role || '').toLowerCase() === 'owner';
                if (isOwnerLike) {
                    const orgKeys = normalizeOrgEnabledKeys(state.organization?.enabledApps);
                    if (orgKeys.length > 0) return orgKeys.includes(appKeyUpper);
                }
                return normalizedAllowed.includes(appKeyUpper);
            };
        },
    },
    actions: {
        resolveAllowedApps(userData = {}, options = {}) {
            const { fallbackAllowedApps = [], organization = null } = options;

            const normalizeAppKeys = (apps) => {
                if (!Array.isArray(apps)) return [];
                const normalized = apps
                    .map((app) => {
                        if (typeof app === 'string') return app.toUpperCase();
                        if (app && typeof app === 'object') {
                            const key = app.appKey || app.key || app.name;
                            return typeof key === 'string' ? key.toUpperCase() : null;
                        }
                        return null;
                    })
                    .filter(Boolean);
                return Array.from(new Set(normalized));
            };

            const explicitAllowedApps = normalizeAppKeys(userData.allowedApps);
            const fromAppAccess = Array.isArray(userData.appAccess) && userData.appAccess.length > 0
                ? userData.appAccess
                    .filter((access) => {
                        if (!access || typeof access !== 'object') return false;
                        const status = String(access.status || 'ACTIVE').toUpperCase();
                        return status === 'ACTIVE';
                    })
                    .map((access) => (typeof access.appKey === 'string' ? access.appKey.toUpperCase() : null))
                    .filter(Boolean)
                : [];

            // IMPORTANT:
            // For non-owners, org enabledApps is tenant-level capability and must NOT
            // expand user-level app access. Owners inherit org-enabled apps so a newly
            // enabled app appears without requiring logout/login.
            const sourceOrganization = organization || userData.organization || userData.organizationId;
            const isOwnerUser =
                userData?.isOwner === true ||
                String(userData?.role || '').toLowerCase() === 'owner';
            const fromEnabledApps = [];
            if (isOwnerUser && sourceOrganization && Array.isArray(sourceOrganization.enabledApps)) {
                for (const app of sourceOrganization.enabledApps) {
                    if (typeof app === 'string') {
                        fromEnabledApps.push(app.toUpperCase());
                        continue;
                    }
                    if (app && typeof app === 'object') {
                        const status = String(app.status || 'ACTIVE').toUpperCase();
                        if (status !== 'ACTIVE') continue;
                        if (typeof app.appKey === 'string') {
                            fromEnabledApps.push(app.appKey.toUpperCase());
                        }
                    }
                }
            }

            if (isOwnerUser && fromEnabledApps.length > 0) {
                return Array.from(new Set([
                    ...explicitAllowedApps,
                    ...fromAppAccess,
                    ...fromEnabledApps,
                ]));
            }

            if (explicitAllowedApps.length > 0) {
                return explicitAllowedApps;
            }

            if (fromAppAccess.length > 0) {
                return Array.from(new Set(fromAppAccess));
            }

            return normalizeAppKeys(fallbackAllowedApps);
        },

        _isAuthRequestDebugEnabled() {
            if (!import.meta.env.DEV) return false;
            try {
                return localStorage.getItem('arivu:debug:authRequests') === '1';
            } catch (_e) {
                return false;
            }
        },

        setUser(userData) {
            // Derive allowedApps from explicit user access first; never default to SALES.
            const allowedApps = this.resolveAllowedApps(userData, {
                organization: userData.organization
            });
            const organizationId = userData.organization?._id
                ? String(userData.organization._id)
                : (userData.organizationId ? String(userData.organizationId) : undefined);

            this.user = {
                _id: userData._id,
                username: userData.username,
                email: userData.email,
                role: userData.role,
                userType: userData.userType || 'INTERNAL',
                isOwner: userData.isOwner,
                isPlatformAdmin: userData.isPlatformAdmin === true,
                permissions: userData.permissions,
                token: userData.token,
                organizationId,
                appAccess: userData.appAccess,
                allowedApps: allowedApps,
                emailVerifiedAt: userData.emailVerifiedAt || null,
                requiresEmailVerification: userData.requiresEmailVerification === true,
                mustChangePassword: userData.mustChangePassword === true,
                onboarding: userData.onboarding || null,
                requiresPortalSelection: userData.requiresPortalSelection === true,
                portals: Array.isArray(userData.portals) ? userData.portals : [],
                activeExternalRoleId: userData.activeExternalRoleId || null,
                activePortal: userData.activePortal || null,
                defaultExternalRoleId: userData.defaultExternalRoleId || null,
                firstName: userData.firstName,
                lastName: userData.lastName,
                avatar: userData.avatar || '',
                entitledAddons: userData.entitledAddons || null,
                language: userData.language ?? null,
                timeZone: userData.timeZone ?? null,
                dateFormat: userData.dateFormat ?? null,
                timeFormat: userData.timeFormat ?? null,
                displayPreferences: userData.displayPreferences || null,
            };
            
            if (userData.organization) {
                this.organization = userData.organization;
                localStorage.setItem('organization', JSON.stringify(userData.organization));
            }
            
            localStorage.setItem('user', JSON.stringify(this.user));
            identifyProductUser({
                _id: this.user._id,
                email: this.user.email,
                organizationId,
            });

            import('@/utils/addonNavigation').then(({ invalidateAddonNavigationCache }) => {
                invalidateAddonNavigationCache();
            }).catch(() => {});

            void this.syncI18nFromOrganization();
        },

        markEmailVerified() {
            if (!this.user) return;
            this.user = {
                ...this.user,
                emailVerifiedAt: new Date().toISOString(),
                requiresEmailVerification: false
            };
            localStorage.setItem('user', JSON.stringify(this.user));
        },

        updateOnboardingSummary(summary) {
            if (!this.user || !summary) return;
            this.user = {
                ...this.user,
                onboarding: {
                    redirectTo: summary.redirectTo ?? null,
                    persona: summary.persona ?? this.user.onboarding?.persona,
                    origin: summary.origin ?? this.user.onboarding?.origin,
                    completed: Boolean(summary.completedAt)
                }
            };
            localStorage.setItem('user', JSON.stringify(this.user));
        },

        async syncI18nFromOrganization() {
            try {
                const { upgradeI18nAfterLogin } = await import('@/i18n');
                const orgLang = this.organization?.settings?.language ?? null;
                const userLang = this.user?.language ?? null;
                await upgradeI18nAfterLogin({ orgLanguage: orgLang, userLanguage: userLang });
            } catch (_e) {
                /* i18n optional at bootstrap */
            }
            try {
                const { setLocaleFormatContext } = await import('@/utils/localeFormat');
                const { normalizeIanaTimezone } = await import('@/utils/orgRegionalOptions');
                const { resolveOrgCurrencyCode } = await import('@/utils/currencyOptions');
                const { LANGUAGE_TO_DEFAULT_LOCALE, DEFAULT_LOCALE } = await import('@/i18n/constants');
                const org = this.organization?.settings || {};
                const userTz = this.user?.timeZone;
                const userFmt = this.user?.dateFormat;
                const userTimeFmt = this.user?.timeFormat;
                const userPrefs = this.user?.displayPreferences || {};
                const orgCurrency = resolveOrgCurrencyCode(org) || 'USD';
                const preferred = String(userPrefs.preferredCurrency || '').trim().toUpperCase() || null;
                const showPreferred = userPrefs.showAmountsInPreferredCurrency === true;
                const userLang = this.user?.language || org.language || 'en';
                const base = String(userLang).split('-')[0];
                const locale =
                    (org.locale && String(org.locale).includes('-') && org.locale)
                    || LANGUAGE_TO_DEFAULT_LOCALE[base]
                    || DEFAULT_LOCALE;
                const orgCurrencies = Array.isArray(org.currencies)
                    ? org.currencies
                        .filter((row) => row && typeof row === 'object' && row.code)
                        .map((row) => ({
                            code: String(row.code).trim().toUpperCase(),
                            enabled: Boolean(row.enabled),
                            conversionRate: Number(row.conversionRate) > 0 ? Number(row.conversionRate) : 1,
                        }))
                    : [];
                setLocaleFormatContext({
                    locale,
                    timeZone: normalizeIanaTimezone(userTz || org.timeZone || 'UTC') || 'UTC',
                    dateFormat: String(userFmt || org.dateFormat || 'MM/DD/YYYY').trim() || 'MM/DD/YYYY',
                    timeFormat: userTimeFmt === '24h' ? '24h' : '12h',
                    currency: (showPreferred && preferred) ? preferred : orgCurrency,
                    baseCurrency: orgCurrency,
                    orgCurrencies,
                    displayPreferences: {
                        ...userPrefs,
                        preferredCurrency: preferred || orgCurrency,
                    },
                });
            } catch (_e) {
                /* format context optional at bootstrap */
            }
        },
        
        clearUser() {
            try {
                resetPosthog();
            } catch (_e) {
                /* optional */
            }
            this.user = null;
            this.organization = null;
            this.lastLoginResult = null;
            localStorage.removeItem('user');
            localStorage.removeItem('organization');
            // Legacy cleanup (older builds stored auth under 'auth')
            localStorage.removeItem('auth');
            try {
                sessionStorage.removeItem('arivu_redirect_after_login');
            } catch (_e) {
                /* optional */
            }
            this.error = null;
            
            // Phase 0D: Clear UI metadata on logout
            import('@/stores/appShell').then(({ useAppShellStore }) => {
                const appShellStore = useAppShellStore();
                appShellStore.clear();
            });
            import('@/utils/tenantSchemaApiCache').then((m) => m.invalidateTenantSchemaCaches()).catch(() => {});
            import('@/utils/addonNavigation').then(({ invalidateAddonNavigationCache }) => {
                invalidateAddonNavigationCache();
            }).catch(() => {});

            // Clear offline data (IndexedDB) on logout
            import('@/services/offlineDb.js').then(({ clearAllData }) => {
                clearAllData().catch(err => {
                    console.error('[Auth] Error clearing offline data:', err);
                });
            });

            // Clear list active-view (session state) so next login shows default list
            // Keeps default-view and saved-views; only clears active-view
            try {
                const keysToRemove = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('arivu-listview-') && key.endsWith('-active-view')) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            } catch (e) {
                console.warn('[Auth] Failed to clear list active-view keys:', e);
            }
        },

        buildSessionTransferPayload() {
            if (!this.user?.token || !this.user?._id) return null;
            const payload = {
                user: this.user,
                organization: this.organization || null,
                transferredAt: Date.now()
            };
            try {
                return btoa(encodeURIComponent(JSON.stringify(payload)));
            } catch (_error) {
                return null;
            }
        },

        applySessionTransferPayload(encodedPayload) {
            if (!encodedPayload) return false;
            try {
                const decoded = decodeURIComponent(atob(encodedPayload));
                const payload = JSON.parse(decoded);
                if (!payload?.user?.token || !payload?.user?._id) return false;

                const authMethod = payload.authMethod === 'google' ? 'google' : 'password';
                // Rebuild login-shaped payload for setUser / lastLoginResult
                const sessionData = {
                    ...payload.user,
                    organization: payload.organization || null,
                    trial: payload.trial || null,
                    instance: payload.instance || null,
                    onboarding: payload.onboarding || payload.user.onboarding || null,
                    authMethod
                };
                this._applyAuthenticatedSession(sessionData, 'login', { authMethod });
                return true;
            } catch (_error) {
                return false;
            }
        },

        /**
         * Apply cross-host session transfer from location hash before auth guards.
         * Hash key: ld_session=<base64 payload>
         */
        applySessionTransferFromLocationHash() {
            if (typeof window === 'undefined') return false;
            const raw = window.location.hash.startsWith('#')
                ? window.location.hash.slice(1)
                : window.location.hash;
            if (!raw || !raw.includes('ld_session=')) return false;
            try {
                const hashParams = new URLSearchParams(raw);
                const encoded = hashParams.get('ld_session');
                if (!encoded) return false;
                const applied = this.applySessionTransferPayload(encoded);
                if (applied) {
                    window.history.replaceState(
                        {},
                        '',
                        `${window.location.pathname}${window.location.search}`
                    );
                }
                return applied;
            } catch (_error) {
                return false;
            }
        },

        applyGoogleSessionLimitFromLocationHash() {
            if (typeof window === 'undefined') return false;
            const raw = window.location.hash.startsWith('#')
                ? window.location.hash.slice(1)
                : window.location.hash;
            if (!raw || !raw.includes('google_challenge=')) return false;
            try {
                const hashParams = new URLSearchParams(raw);
                const encoded = hashParams.get('google_challenge');
                if (!encoded) return false;
                const decoded = decodeURIComponent(atob(encoded));
                const data = JSON.parse(decoded);
                if (data?.code !== 'SESSION_LIMIT' || !data?.challengeId) return false;
                this._captureSessionLimit(data);
                window.history.replaceState(
                    {},
                    '',
                    `${window.location.pathname}${window.location.search}`
                );
                return true;
            } catch (_error) {
                return false;
            }
        },

    _applyAuthenticatedSession(data, endpoint, options = {}) {
            this.sessionLimit = null;
            this.setUser(data);
            if (endpoint === 'login' || endpoint === 'login/continue') {
                void import('@/platform/capacitor/initCapacitorNative')
                    .then((m) => m.syncCapacitorPushTokenAfterLogin())
                    .catch(() => undefined);
                this.lastLoginResult = data;
                if (data.trial) {
                    this.organization = applyTrialSnapshotToOrganization(this.organization, data.trial);
                    if (this.organization) {
                        localStorage.setItem('organization', JSON.stringify(this.organization));
                    }
                }
            }
            try {
                const method = options.authMethod || data.authMethod || 'password';
                captureUserLoggedIn({ method });
                if (data.userType === 'EXTERNAL') {
                    capturePortalLogin({
                        requires_portal_selection: data.requiresPortalSelection === true,
                        active_external_role_id: data.activeExternalRoleId || undefined
                    });
                }
            } catch (_e) {
                /* optional */
            }

            import('@/stores/appShell').then(({ useAppShellStore }) => {
                const appShellStore = useAppShellStore();
                appShellStore.loadUIMetadata().catch(err => {
                    console.error('[Auth] Error loading UI metadata:', err);
                });
            });
        },

        _captureSessionLimit(data) {
            this.sessionLimit = {
                challengeId: data.challengeId,
                deviceClass: data.deviceClass || data.usage?.deviceClass || 'desktop',
                limits: data.limits || { desktop: 2, mobile: 1 },
                usage: data.usage || null,
                sessions: Array.isArray(data.sessions) ? data.sessions : [],
                message: data.message || null
            };
            this.error = null;
        },

        async authenticate(endpoint, credentials) {
            this.loading = true;
            this.error = null;
            try {
                const url = getApiUrlForFetch(`/api/auth/${endpoint}`);
                if (this._isAuthRequestDebugEnabled()) {
                    logAuthAccessDebug('Auth request ->', url, credentials);
                }
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                    body: JSON.stringify(credentials),
                });

                const text = await response.text();
                if (this._isAuthRequestDebugEnabled()) {
                    logAuthAccessDebug('Auth response status', response.status);
                    logAuthAccessDebug('Auth response body:', text.slice(0, 1000)); // log first 1000 chars
                }

                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    throw new Error(`Server returned non-JSON response (status ${response.status})`);
                }

                const data = JSON.parse(text);
                if (response.status === 409 && data.code === 'SESSION_LIMIT' && data.challengeId) {
                    this._captureSessionLimit(data);
                    return { sessionLimit: true };
                }
                if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);

                this._applyAuthenticatedSession(data, endpoint);
                return true;
            } catch (err) {
                console.error('Auth error:', err);
                this.error = err.message || 'An unexpected error occurred';
                return false;
            } finally {
                this.loading = false;
            }
        },
        // --- Public Actions ---
        async register(userData) {
            return this.authenticate('register', userData);
        },
        async login(credentials) {
            this.sessionLimit = null;
            return this.authenticate('login', credentials);
        },

        async continueLoginAfterSessionRevoke() {
            if (!this.sessionLimit?.challengeId) {
                this.error = 'Session challenge expired. Please sign in again.';
                return false;
            }
            this.loading = true;
            this.error = null;
            try {
                const url = getApiUrlForFetch('/api/auth/login/continue');
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Login-Challenge': this.sessionLimit.challengeId
                    },
                    body: JSON.stringify({ challengeId: this.sessionLimit.challengeId })
                });
                const data = await response.json();
                if (response.status === 409 && data.code === 'SESSION_LIMIT' && data.challengeId) {
                    this._captureSessionLimit(data);
                    return { sessionLimit: true };
                }
                if (!response.ok) {
                    throw new Error(data.message || `HTTP ${response.status}`);
                }
                this._applyAuthenticatedSession(data, 'login/continue');
                return true;
            } catch (err) {
                this.error = err.message || 'Unable to continue sign-in';
                return false;
            } finally {
                this.loading = false;
            }
        },

        async revokeLoginSession(sessionId) {
            if (!this.sessionLimit?.challengeId || !sessionId) {
                return false;
            }
            this.loading = true;
            this.error = null;
            try {
                const url = getApiUrlForFetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`);
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-Login-Challenge': this.sessionLimit.challengeId
                    },
                    body: JSON.stringify({
                        challengeId: this.sessionLimit.challengeId,
                        deviceClass: this.sessionLimit.deviceClass
                    })
                });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.message || `HTTP ${response.status}`);
                }
                this.sessionLimit = {
                    ...this.sessionLimit,
                    sessions: Array.isArray(data.sessions) ? data.sessions : this.sessionLimit.sessions,
                    limits: data.limits || this.sessionLimit.limits,
                    usage: data.usage || this.sessionLimit.usage,
                    deviceClass: data.deviceClass || this.sessionLimit.deviceClass
                };
                return true;
            } catch (err) {
                this.error = err.message || 'Unable to sign out that session';
                return false;
            } finally {
                this.loading = false;
            }
        },

        clearSessionLimit() {
            this.sessionLimit = null;
        },

        canContinueAfterSessionLimit() {
            const limit = this.sessionLimit;
            if (!limit) return false;
            if (limit.usage && typeof limit.usage.used === 'number' && typeof limit.usage.max === 'number') {
                return limit.usage.used < limit.usage.max;
            }
            const deviceClass = limit.deviceClass === 'mobile' ? 'mobile' : 'desktop';
            const max = Number(limit.limits?.[deviceClass]) || (deviceClass === 'mobile' ? 1 : 2);
            const activeForClass = (limit.sessions || []).filter(
                (s) => (s.deviceClass === 'mobile' ? 'mobile' : 'desktop') === deviceClass
            ).length;
            return activeForClass < max;
        },

        getSessionLimitUsage() {
            const limit = this.sessionLimit;
            if (!limit) return null;
            if (limit.usage) return limit.usage;
            const deviceClass = limit.deviceClass === 'mobile' ? 'mobile' : 'desktop';
            const max = Number(limit.limits?.[deviceClass]) || (deviceClass === 'mobile' ? 1 : 2);
            const used = (limit.sessions || []).filter(
                (s) => (s.deviceClass === 'mobile' ? 'mobile' : 'desktop') === deviceClass
            ).length;
            return {
                deviceClass,
                used,
                max,
                needToFree: Math.max(0, used - max + 1)
            };
        },

        getRecommendedSessionToRevoke() {
            const sessions = this.sessionLimit?.sessions || [];
            const recommended = sessions.find((s) => s.recommended);
            if (recommended) return recommended;
            const deviceClass = this.sessionLimit?.deviceClass === 'mobile' ? 'mobile' : 'desktop';
            const conflicting = sessions.filter(
                (s) => (s.deviceClass === 'mobile' ? 'mobile' : 'desktop') === deviceClass
            );
            return conflicting.length ? conflicting[conflicting.length - 1] : null;
        },

        resolvePostLoginRoute() {
            const user = this.user;
            if (!user) {
                return { name: 'login' };
            }
            if (user.mustChangePassword) {
                return { name: 'portal-set-password' };
            }
            if (this.isExternalUser) {
                if (this.needsPortalSelection) {
                    return { name: 'portal-select' };
                }
                const hasPortal = this.hasAssignedAppAccess('PORTAL');
                const hasLms = this.hasAssignedAppAccess('LMS') || this.hasAppAccess('LMS');
                // Prefer Portal when entitled; Academy is a separate surface (locked invariant).
                if (hasPortal) {
                    return { name: 'portal-dashboard' };
                }
                if (hasLms) {
                    return { name: 'academy-home' };
                }
                // Do NOT return portal-select — loops after successful select when PORTAL
                // org app is suspended / missing from allowedApps.
                return { name: 'login' };
            }
            const onboardingRedirect = user.onboarding?.redirectTo
                || this.lastLoginResult?.onboarding?.redirectTo;
            if (onboardingRedirect && typeof onboardingRedirect === 'string') {
                return onboardingRedirect;
            }
            return { name: 'platform-home' };
        },

        applyPortalSession(data) {
            if (!data || typeof data !== 'object') return;
            const { success: _success, ...session } = data;
            this.setUser({
                ...this.user,
                ...session,
                organization: session.organization || this.organization
            });
            import('@/stores/appShell').then(({ useAppShellStore }) => {
                const appShellStore = useAppShellStore();
                appShellStore.loadUIMetadata().catch(() => {});
            }).catch(() => {});
        },

        async portalSessionRequest(method, path, body = null) {
            if (!this.user?.token) {
                throw new Error('Not authenticated');
            }
            const init = {
                method,
                headers: {
                    Authorization: `Bearer ${this.user.token}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                }
            };
            if (body != null) {
                init.body = JSON.stringify(body);
            }
            const response = await fetch(getApiUrlForFetch(`/api/auth/portal/${path}`), init);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            return data;
        },

        async selectPortal(roleId) {
            this.loading = true;
            this.error = null;
            try {
                const data = await this.portalSessionRequest('POST', 'select', { roleId });
                this.applyPortalSession(data);
                try {
                    capturePortalSelected(String(roleId));
                } catch (_e) {
                    /* optional */
                }
                return true;
            } catch (err) {
                this.error = err.message || 'Portal selection failed';
                return false;
            } finally {
                this.loading = false;
            }
        },

        async switchPortal(roleId) {
            this.loading = true;
            this.error = null;
            try {
                const data = await this.portalSessionRequest('POST', 'switch', { roleId });
                this.applyPortalSession(data);
                try {
                    capturePortalSwitched(String(roleId));
                } catch (_e) {
                    /* optional */
                }
                return true;
            } catch (err) {
                this.error = err.message || 'Portal switch failed';
                return false;
            } finally {
                this.loading = false;
            }
        },

        async setDefaultExternalRole(roleId) {
            await this.portalSessionRequest('PATCH', 'default-role', { roleId });
            if (this.user) {
                this.user = { ...this.user, defaultExternalRoleId: roleId };
                localStorage.setItem('user', JSON.stringify(this.user));
            }
        },

        async refreshPortals() {
            const data = await this.portalSessionRequest('GET', 'list');
            if (this.user) {
                this.user = {
                    ...this.user,
                    portals: data.portals || [],
                    defaultExternalRoleId: data.defaultExternalRoleId || null,
                    activeExternalRoleId: data.activeExternalRoleId || this.user.activeExternalRoleId,
                    requiresPortalSelection: data.requiresPortalSelection === true,
                };
                localStorage.setItem('user', JSON.stringify(this.user));
            }
            return data.portals || [];
        },
        
        async logout() {
            const token = this.user?.token;
            if (token && token !== 'undefined' && token !== 'null') {
                try {
                    await fetch(getApiUrlForFetch('/api/auth/logout'), {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            Accept: 'application/json'
                        }
                    });
                } catch (_error) {
                    // Client logout must proceed even if revoke fails.
                }
            }
            this.sessionLimit = null;
            this.clearUser();
            if (typeof window !== 'undefined') {
                try {
                    if (import.meta.env.PROD && PROD_LOGOUT_REDIRECT_ORIGIN) {
                        window.location.replace(`${PROD_LOGOUT_REDIRECT_ORIGIN}/login?logout=1`);
                        return;
                    }
                    const { protocol, hostname, port } = window.location;
                    const isSubdomainLocalhost =
                        hostname.endsWith('.localhost') && hostname !== 'localhost';
                    if (isSubdomainLocalhost) {
                        const host = port ? `localhost:${port}` : 'localhost';
                        window.location.replace(`${protocol}//${host}/login?logout=1`);
                        return;
                    }
                } catch (_error) {
                    // Fall back to router navigation.
                }
            }
            import('@/router').then(({ default: router }) => {
                if (router.currentRoute.value.name !== 'login') {
                    router.replace({ name: 'login' }).catch(() => {});
                }
            }).catch(() => {});
        },
        
        // Check if user has a specific permission
        can(module, action) {
            if (isPrivilegedAuthUser(this.user)) return true;
            const normalized = module === 'people'
                ? 'contacts'
                : module === 'settings-users'
                    ? 'users'
                    : module;
            const perms = this.user?.permissions?.[normalized];
            if (perms?.[action]) return true;
            if (action === 'read' && perms?.view) return true;
            if (action === 'view' && perms?.read) return true;
            // Responses inherits Forms access until roles are explicitly configured
            if (normalized === 'responses') {
                return this.user?.permissions?.forms?.[action] || false;
            }
            return false;
        },
        
        // Check if module is enabled for organization
        hasModule(moduleName) {
            return this.organization?.enabledModules?.includes(moduleName) || false;
        },
        
        // Refresh *tenant workspace* organization (settings, subscription, enabled apps).
        // Do NOT use GET /api/v2/organization — that is the CRM company list, not the tenant.
        async refreshOrganization() {
            try {
                const response = await fetch(getApiUrlForFetch('/api/organization'), {
                    headers: {
                        'Authorization': `Bearer ${this.user?.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    const org = data?.data;
                    // Guard: CRM list shape is an array; never replace workspace org with it.
                    if (org && typeof org === 'object' && !Array.isArray(org) && org._id) {
                        this.organization = org;
                        localStorage.setItem('organization', JSON.stringify(this.organization));
                    }
                }
            } catch (error) {
                console.error('Error refreshing organization:', error);
            }
        },

        async syncTrialSubscription(options = {}) {
            if (!this.user?.token) return false;

            const force = options.force === true;
            if (!force && this.lastTrialSyncAt && Date.now() - this.lastTrialSyncAt < TRIAL_SYNC_FRESH_MS) {
                return true;
            }

            try {
                const response = await fetch(getApiUrlForFetch('/api/settings/subscriptions/trial-status'), {
                    headers: {
                        Authorization: `Bearer ${this.user.token}`,
                        Accept: 'application/json'
                    }
                });
                const data = await response.json();
                if (!response.ok || !data.success) return false;

                const snapshot = data.data || {};
                if (this.organization) {
                    this.organization = applyTrialSnapshotToOrganization(this.organization, snapshot);
                    localStorage.setItem('organization', JSON.stringify(this.organization));
                }

                this.lastTrialSyncAt = Date.now();
                return snapshot;
            } catch (error) {
                console.error('Error syncing trial subscription:', error);
                return false;
            }
        },
        
        // Refresh user profile and permissions
        async refreshUser(options = {}) {
            if (!this.user?.token) {
                console.warn('No user token available for refresh');
                return false;
            }

            const force = options.force === true;
            if (!force) {
                const lastRefreshedAt = Number(localStorage.getItem(PROFILE_REFRESHED_AT_KEY) || 0);
                if (lastRefreshedAt && Date.now() - lastRefreshedAt < PROFILE_REFRESH_FRESH_MS) {
                    return true;
                }
            }
            
            try {
                logAuthAccessDebug('Refreshing user permissions...');
                const response = await fetch(getApiUrlForFetch('/api/users/profile'), {
                    headers: {
                        'Authorization': `Bearer ${this.user.token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data) {
                        // Normalize/derive permissions if missing from server
                        const deriveFromRole = (rolePerms) => {
                            if (!rolePerms) return null;
                            const contacts = {
                                view: !!rolePerms.contacts?.read,
                                create: !!rolePerms.contacts?.create,
                                edit: !!rolePerms.contacts?.update,
                                delete: !!rolePerms.contacts?.delete,
                                viewAll: !!rolePerms.contacts?.viewAll,
                                exportData: !!rolePerms.contacts?.export,
                            };
                            const organizations = {
                                view: !!rolePerms.organizations?.read,
                                create: !!rolePerms.organizations?.create,
                                edit: !!rolePerms.organizations?.update,
                                delete: !!rolePerms.organizations?.delete,
                                viewAll: !!rolePerms.organizations?.viewAll,
                                exportData: !!rolePerms.organizations?.export,
                            };
                            const deals = {
                                view: !!rolePerms.deals?.read,
                                create: !!rolePerms.deals?.create,
                                edit: !!rolePerms.deals?.update,
                                delete: !!rolePerms.deals?.delete,
                                viewAll: !!rolePerms.deals?.viewAll,
                                exportData: !!rolePerms.deals?.export,
                            };
                            const tasks = {
                                view: !!rolePerms.tasks?.read,
                                create: !!rolePerms.tasks?.create,
                                edit: !!rolePerms.tasks?.update,
                                delete: !!rolePerms.tasks?.delete,
                                viewAll: !!rolePerms.tasks?.viewAll,
                            };
                            const events = {
                                view: !!rolePerms.events?.read,
                                create: !!rolePerms.events?.create,
                                edit: !!rolePerms.events?.update,
                                delete: !!rolePerms.events?.delete,
                                viewAll: !!rolePerms.events?.viewAll,
                            };
                            const forms = {
                                view: !!rolePerms.forms?.read,
                                create: !!rolePerms.forms?.create,
                                edit: !!rolePerms.forms?.update,
                                delete: !!rolePerms.forms?.delete,
                                viewAll: !!rolePerms.forms?.viewAll,
                                exportData: !!rolePerms.forms?.export,
                            };
                            const items = {
                                view: !!rolePerms.items?.read,
                                create: !!rolePerms.items?.create,
                                edit: !!rolePerms.items?.update,
                                delete: !!rolePerms.items?.delete,
                                viewAll: !!rolePerms.items?.viewAll,
                                exportData: !!rolePerms.items?.export,
                            };
                            const imports = {
                                view: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                create: !!(rolePerms.contacts?.import || rolePerms.deals?.import),
                                delete: false,
                            };
                            const settings = {
                                view: !!rolePerms.settings?.view,
                                manageUsers: !!rolePerms.settings?.manageUsers,
                                manageBilling: !!rolePerms.settings?.manageBilling,
                                manageIntegrations: false,
                                customizeFields: !!rolePerms.settings?.edit,
                                edit: !!rolePerms.settings?.edit,
                            };
                            const reports = {
                                viewStandard: !!rolePerms.reports?.read,
                                viewCustom: !!rolePerms.reports?.read,
                                createCustom: !!rolePerms.reports?.create,
                                exportReports: !!rolePerms.reports?.export,
                            };
                            const built = { contacts, organizations, deals, tasks, events, forms, items, imports, settings, reports };
                            built.people = built.contacts;
                            return built;
                        };

                        const incoming = data.data;
                        // Safety: if the profile endpoint returns a different user than the one in memory,
                        // do NOT silently switch accounts (this can happen with stale/incorrect tokens).
                        if (this.user?._id && incoming?._id && String(incoming._id) !== String(this.user._id)) {
                            console.warn('Auth mismatch: profile returned a different user. Logging out for safety.', {
                                currentUserId: this.user._id,
                                incomingUserId: incoming._id,
                                currentEmail: this.user.email,
                                incomingEmail: incoming.email
                            });
                            this.logout();
                            return false;
                        }
                        const ensuredPermissions = incoming.permissions || deriveFromRole(incoming.roleId?.permissions) || {};
                        if (ensuredPermissions.contacts && !ensuredPermissions.people) {
                            ensuredPermissions.people = ensuredPermissions.contacts;
                        }
                        // Ensure newly added modules exist so the sidebar can render them immediately.
                        if (!ensuredPermissions.forms) ensuredPermissions.forms = { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false };
                        if (!ensuredPermissions.items) ensuredPermissions.items = { view: false, create: false, edit: false, delete: false, viewAll: false, exportData: false };
                        const incomingOrgObject = typeof incoming.organizationId === 'object' && incoming.organizationId?._id
                            ? incoming.organizationId
                            : null;
                        const incomingOrgId = incomingOrgObject?._id
                            ? String(incomingOrgObject._id)
                            : (incoming.organizationId ? String(incoming.organizationId) : this.user.organizationId);
                        // Update user data while preserving token and allowedApps
                        const token = this.user.token;
                        const existingAllowedApps = this.user.allowedApps;
                        const existingPortalSession = {
                            portals: Array.isArray(this.user.portals) ? this.user.portals : [],
                            requiresPortalSelection: this.user.requiresPortalSelection === true,
                            activeExternalRoleId: this.user.activeExternalRoleId || null,
                            activePortal: this.user.activePortal || null,
                            defaultExternalRoleId: this.user.defaultExternalRoleId || null,
                        };
                        this.user = {
                            ...incoming,
                            organizationId: incomingOrgId,
                            permissions: ensuredPermissions,
                            token: token,
                            allowedApps: this.resolveAllowedApps(incoming, {
                                fallbackAllowedApps: existingAllowedApps,
                                organization: incomingOrgObject || this.organization
                            }),
                            entitledAddons: incoming.entitledAddons ?? this.user?.entitledAddons ?? null,
                            // Profile API does not return portal-selection session fields.
                            portals: Array.isArray(incoming.portals)
                                ? incoming.portals
                                : existingPortalSession.portals,
                            requiresPortalSelection: typeof incoming.requiresPortalSelection === 'boolean'
                                ? incoming.requiresPortalSelection
                                : existingPortalSession.requiresPortalSelection,
                            activeExternalRoleId: incoming.activeExternalRoleId
                                ?? existingPortalSession.activeExternalRoleId,
                            activePortal: incoming.activePortal ?? existingPortalSession.activePortal,
                            defaultExternalRoleId: incoming.defaultExternalRoleId
                                ?? existingPortalSession.defaultExternalRoleId,
                        };
                        localStorage.setItem('user', JSON.stringify(this.user));
                        localStorage.setItem(PROFILE_REFRESHED_AT_KEY, String(Date.now()));
                        
                        // Update organization if included in response (for enabledApps)
                        if (incomingOrgObject) {
                            this.organization = incomingOrgObject;
                            localStorage.setItem('organization', JSON.stringify(this.organization));
                        }
                        identifyProductUser({
                            _id: this.user?._id,
                            email: this.user?.email,
                            organizationId: this.organization?._id
                                ? String(this.organization._id)
                                : undefined,
                        });
                        void this.syncI18nFromOrganization();
                        logAuthAccessDebug('User permissions refreshed successfully');
                        return true;
                    }
                } else if (response.status === 401) {
                    const onTrialExpiredShell = typeof window !== 'undefined'
                        && isTrialExpiredShelllessRoute(window.location.pathname);
                    const onPortalAuthLifecycle = typeof window !== 'undefined'
                        && isPortalAuthLifecycleRoute(window.location.pathname);
                    if (!isOnPublicShellRoute() && !onTrialExpiredShell && !onPortalAuthLifecycle) {
                        console.warn('Session expired, logging out');
                        this.logout();
                    }
                    return false;
                } else if (response.status === 403) {
                    let errorData = null;
                    try {
                        errorData = await response.json();
                    } catch (_parseError) {
                        return false;
                    }
                    if (errorData?.code === 'TRIAL_EXPIRED' && this.organization) {
                        this.organization = applyTrialSnapshotToOrganization(this.organization, {
                            expired: true,
                            trialEndDate: errorData.trialEndDate,
                            subscriptionStatus: 'trial'
                        });
                        localStorage.setItem('organization', JSON.stringify(this.organization));
                    }
                    return false;
                }
            } catch (error) {
                console.error('Error refreshing user:', error);
                return false;
            }
            return false;
        }
    },
});

registerUseAuthStore(useAuthStore);
