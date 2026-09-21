/**
 * Security Headers Middleware
 * Adds security headers to all responses
 */

const securityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS protection (legacy but still useful)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy - control referrer information
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 
        'geolocation=(), microphone=(self), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
    );
    
    const extraConnect = (process.env.CSP_EXTRA_CONNECT_SRC || '')
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    // API + Sentry + PostHog (set origins explicitly in env for your tenant)
    const defaultConnect = [
        "'self'",
        'https://arivusystems.com',
        'https://www.arivusystems.com',
        'https://app.arivusystems.com',
        'https://*.sentry.io',
        'https://o*.ingest.sentry.io',
        'https://us.i.posthog.com',
        'https://eu.i.posthog.com',
        'https://app.posthog.com',
    ];
    const connectSrc = Array.from(new Set([...defaultConnect, ...extraConnect]));

    const recaptchaScriptSrc = 'https://www.google.com https://www.gstatic.com';
    const recaptchaFrameSrc = 'https://www.google.com https://www.recaptcha.net https://recaptcha.google.com';

    // Content-Security-Policy: primarily protects HTML responses; JSON API still gets the header
    const csp = [
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${recaptchaScriptSrc}`,
        "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
        "img-src 'self' data: https: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrc.join(' ')}`,
        `frame-src 'self' ${recaptchaFrameSrc}`,
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'"
    ].join('; ');
    
    res.setHeader('Content-Security-Policy', csp);
    
    // Strict Transport Security (HSTS) - behind Cloudflare / Railway, trust X-Forwarded-Proto
    const isHttps =
        process.env.FORCE_HTTPS_HSTS === 'true' ||
        (process.env.NODE_ENV === 'production' && (req.secure || req.get('X-Forwarded-Proto') === 'https'));
    if (isHttps) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Remove X-Powered-By header (don't reveal we're using Express)
    res.removeHeader('X-Powered-By');
    
    next();
};

module.exports = securityHeaders;

