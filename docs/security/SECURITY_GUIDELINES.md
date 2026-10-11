# Security-First Development Guidelines

**⚠️ CRITICAL: Security is the TOP PRIORITY for all development work**

This document outlines security requirements and best practices that MUST be followed for all code changes in Arivu.

---

## 🔒 Core Security Principles

1. **Never trust client-side data** - Always validate and sanitize on the server
2. **Fail securely** - If security checks fail, deny access by default
3. **Least privilege** - Users should only have access to what they need
4. **Defense in depth** - Multiple layers of security checks
5. **Never expose secrets** - No hardcoded secrets, API keys, or credentials

---

## ✅ Security Checklist for Every Feature

Before submitting any code, verify:

### Authentication & Authorization
- [ ] All API routes protected with `protect` middleware
- [ ] Permission checks implemented for sensitive operations
- [ ] User ownership verified for user-specific resources
- [ ] Organization isolation enforced (users can't access other orgs' data)
- [ ] Role-based access control (RBAC) implemented where needed
- [ ] Frontend route guards match backend permissions

### Input Validation
- [ ] All user inputs validated on the server
- [ ] SQL injection prevention (use parameterized queries)
- [ ] XSS prevention (sanitize user-generated content)
- [ ] No direct database queries from user input
- [ ] File upload validation (type, size, content)
- [ ] URL parameter validation

### Data Protection
- [ ] Passwords never logged or exposed
- [ ] Sensitive data encrypted in transit (HTTPS)
- [ ] JWT tokens stored securely (not in localStorage for sensitive apps)
- [ ] Database queries use `.select('-password')` to exclude passwords
- [ ] Error messages don't leak sensitive information
- [ ] No secrets in code, logs, or error messages

### API Security
- [ ] Rate limiting implemented for public endpoints
- [ ] CORS configured properly
- [ ] Request size limits enforced
- [ ] Proper HTTP status codes (401 for auth, 403 for permissions)
- [ ] No sensitive data in URL parameters (use POST body)
- [ ] API responses don't expose internal structure

### Environment Variables
- [ ] No hardcoded secrets or API keys
- [ ] All secrets use environment variables
- [ ] `.env` files in `.gitignore`
- [ ] No fallback defaults for secrets (fail hard if missing)
- [ ] Different secrets for dev/staging/production

### Frontend Security
- [ ] Route guards check authentication
- [ ] Permission checks before showing UI elements
- [ ] Sensitive data not stored in localStorage (use httpOnly cookies if needed)
- [ ] XSS prevention (use Vue's built-in escaping)
- [ ] CSRF protection for state-changing operations
- [ ] Content Security Policy (CSP) headers

---

## 🚨 Critical Security Rules

### 1. JWT_SECRET Must Never Have Defaults

**❌ WRONG:**
```javascript
jwt.verify(token, process.env.JWT_SECRET || 'YOUR_SUPER_SECRET')
```

**✅ CORRECT:**
```javascript
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured');
}
jwt.verify(token, process.env.JWT_SECRET)
```

### 2. Always Validate User Ownership

**❌ WRONG:**
```javascript
// User can access any resource by changing ID
const resource = await Resource.findById(req.params.id);
```

**✅ CORRECT:**
```javascript
// Verify user owns the resource or has permission
const resource = await Resource.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId
});
if (!resource) {
    return res.status(404).json({ message: 'Resource not found' });
}
```

### 3. Always Use Permission Middleware

**❌ WRONG:**
```javascript
router.post('/api/deals', protect, createDeal);
```

**✅ CORRECT:**
```javascript
router.post('/api/deals', 
    protect, 
    organizationIsolation,
    checkPermission('deals', 'create'),
    createDeal
);
```

### 4. Never Trust Client-Side Validation Alone

**❌ WRONG:**
```javascript
// Frontend only
if (userRole === 'admin') {
    deleteResource();
}
```

**✅ CORRECT:**
```javascript
// Backend always validates
router.delete('/api/resource/:id', 
    protect,
    checkPermission('resource', 'delete'),
    deleteResource
);
```

### 5. Sanitize User Input

**❌ WRONG:**
```javascript
const query = `SELECT * FROM users WHERE name = '${req.body.name}'`;
```

**✅ CORRECT:**
```javascript
// Use parameterized queries or Mongoose (which does this automatically)
const users = await User.find({ name: req.body.name });
```

### 6. Never Expose Sensitive Data

**❌ WRONG:**
```javascript
res.json({ user: user }); // Includes password hash!
```

**✅ CORRECT:**
```javascript
const user = await User.findById(id).select('-password');
res.json({ user });
```

---

## 🔐 Security Patterns

### Pattern 1: Protected Route with Permissions

```javascript
// server/routes/exampleRoutes.js
const { protect } = require('../middleware/authMiddleware');
const { organizationIsolation } = require('../middleware/organizationMiddleware');
const { checkPermission } = require('../middleware/permissionMiddleware');

router.post('/api/example',
    protect,                    // 1. Check authentication
    organizationIsolation,      // 2. Set organization context
    checkPermission('module', 'action'), // 3. Check permissions
    controllerFunction          // 4. Execute with security
);
```

### Pattern 2: User-Specific Resource Access

```javascript
// In controller
exports.getResource = async (req, res) => {
    const resource = await Resource.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId // Organization isolation
    });
    
    if (!resource) {
        return res.status(404).json({ message: 'Resource not found' });
    }
    
    // Additional ownership check if needed
    if (resource.userId && resource.userId.toString() !== req.user._id.toString()) {
        // Check if user has permission to view others' resources
        if (!req.user.permissions?.module?.viewAll) {
            return res.status(403).json({ message: 'Access denied' });
        }
    }
    
    res.json({ resource });
};
```

### Pattern 3: Frontend Route Guard

```javascript
// client/src/router/index.js
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    
    // Check authentication
    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        next({ name: 'landing' });
        return;
    }
    
    // Check permissions
    if (to.meta.requiresPermission) {
        const { module, action } = to.meta.requiresPermission;
        if (!authStore.can(module, action)) {
            alert('Insufficient permissions');
            next({ name: 'dashboard' });
            return;
        }
    }
    
    next();
});
```

### Pattern 4: Secure API Client

```javascript
// client/src/utils/apiClient.js
const apiClient = async (url, options = {}) => {
    const authStore = useAuthStore();
    const token = authStore.user?.token;
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`/api${url}`, {
        ...options,
        headers,
    });
    
    if (response.status === 401) {
        authStore.logout();
        throw new Error('Session expired');
    }
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
    }
    
    return response.json();
};
```

---

## 🛡️ Common Vulnerabilities to Prevent

### 1. SQL/NoSQL Injection
- ✅ Use Mongoose (parameterized queries)
- ✅ Never concatenate user input into queries
- ✅ Validate input types

### 2. Cross-Site Scripting (XSS)
- ✅ Vue automatically escapes template data
- ✅ Sanitize user-generated HTML
- ✅ Use Content Security Policy headers

### 3. Cross-Site Request Forgery (CSRF)
- ✅ Use SameSite cookies
- ✅ Verify origin headers
- ✅ Use CSRF tokens for state-changing operations

### 4. Authentication Bypass
- ✅ Always verify JWT tokens
- ✅ Check token expiration
- ✅ Verify user still exists
- ✅ Never skip authentication middleware

### 5. Authorization Bypass
- ✅ Check permissions on every request
- ✅ Verify organization isolation
- ✅ Check resource ownership
- ✅ Never trust client-side role checks

### 6. Sensitive Data Exposure
- ✅ Never log passwords or tokens
- ✅ Use `.select('-password')` in queries
- ✅ Don't expose internal errors to clients
- ✅ Sanitize error messages

### 7. Insecure Direct Object References
- ✅ Always verify user has access to resource
- ✅ Check organization isolation
- ✅ Verify ownership or permissions

---

## 🔍 Security Review Checklist

Before merging any PR, review:

1. **Authentication**: Are all new routes protected?
2. **Authorization**: Are permissions checked?
3. **Input Validation**: Is user input validated?
4. **Data Protection**: Is sensitive data protected?
5. **Error Handling**: Do errors leak information?
6. **Secrets**: Are any secrets hardcoded?
7. **Dependencies**: Are dependencies up to date?
8. **Logging**: Are secrets logged anywhere?
9. **Frontend**: Are route guards in place?
10. **Testing**: Are security tests included?

---

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Vue.js Security](https://vuejs.org/guide/best-practices/security.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)

---

## 🚨 Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. Contact the security team immediately
3. Provide detailed information about the vulnerability
4. Wait for confirmation before disclosing

---

## 📝 Security-First Development Workflow

1. **Plan**: Identify security requirements before coding
2. **Design**: Include security in architecture decisions
3. **Code**: Follow security patterns and checklists
4. **Review**: Security review before merge
5. **Test**: Include security tests
6. **Deploy**: Verify environment variables are set
7. **Monitor**: Watch for security events

---

**Remember: Security is not optional. Every feature must be secure by design.**

