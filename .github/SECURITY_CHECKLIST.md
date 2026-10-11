# Security Checklist for Pull Requests

**⚠️ MANDATORY: All items must be checked before merging**

## Authentication & Authorization
- [ ] All new API routes protected with `protect` middleware
- [ ] Permission checks implemented (`checkPermission` middleware)
- [ ] Organization isolation enforced (`organizationIsolation` middleware)
- [ ] User ownership verified for user-specific resources
- [ ] Frontend route guards match backend permissions
- [ ] Role-based access control implemented where needed

## Input Validation & Sanitization
- [ ] All user inputs validated on the server
- [ ] No SQL/NoSQL injection vulnerabilities (using Mongoose parameterized queries)
- [ ] XSS prevention (Vue auto-escaping, sanitize HTML if needed)
- [ ] File upload validation (type, size, content scanning)
- [ ] URL parameter validation
- [ ] Request body validation

## Data Protection
- [ ] Passwords never logged or exposed
- [ ] Sensitive data excluded from responses (`.select('-password')`)
- [ ] Error messages don't leak sensitive information
- [ ] No secrets in code, comments, or logs
- [ ] Database queries use proper filtering (organizationId, userId)

## Environment Variables & Secrets
- [ ] No hardcoded secrets, API keys, or credentials
- [ ] All secrets use environment variables
- [ ] No fallback defaults for secrets (fail hard if missing)
- [ ] `.env` files properly gitignored
- [ ] Different secrets for dev/staging/production

## API Security
- [ ] Proper HTTP status codes (401 for auth, 403 for permissions, 404 for not found)
- [ ] No sensitive data in URL parameters (use POST body)
- [ ] Rate limiting considered for public endpoints
- [ ] CORS configured properly
- [ ] Request size limits enforced

## Frontend Security
- [ ] Route guards check authentication (`requiresAuth` meta)
- [ ] Permission checks before showing UI (`can()` method)
- [ ] Sensitive data not stored in localStorage unnecessarily
- [ ] XSS prevention (trust Vue's built-in escaping)
- [ ] No client-side security logic (backend always validates)

## Error Handling
- [ ] Errors don't expose internal structure
- [ ] Generic error messages for users
- [ ] Detailed errors logged server-side only
- [ ] No stack traces exposed to clients

## Testing
- [ ] Security tests included (auth, permissions, isolation)
- [ ] Edge cases tested (unauthorized access, invalid input)
- [ ] Manual security testing performed

## Code Review
- [ ] Security patterns followed (see docs/security/SECURITY_GUIDELINES.md)
- [ ] No security anti-patterns introduced
- [ ] Dependencies reviewed for vulnerabilities
- [ ] Code follows security best practices

---

**Reviewer Notes:**
- [ ] Security review completed
- [ ] All security concerns addressed
- [ ] Ready to merge

---

**If any item is unchecked, the PR cannot be merged until addressed.**

