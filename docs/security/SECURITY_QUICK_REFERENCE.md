# Security Quick Reference Card

**Print this and keep it handy while coding!**

---

## 🚨 Critical Rules (Never Break These)

1. **JWT_SECRET**: Never use defaults, fail hard if missing
2. **Authentication**: Every API route needs `protect` middleware
3. **Permissions**: Check permissions on every sensitive operation
4. **Organization Isolation**: Always filter by `organizationId`
5. **Input Validation**: Never trust client input, always validate server-side
6. **Secrets**: Never hardcode, always use environment variables

---

## ✅ Quick Security Checklist

### Before Writing Code
- [ ] What permissions are needed?
- [ ] What organization isolation is required?
- [ ] What input validation is needed?
- [ ] Are there any secrets involved?

### While Writing Code
- [ ] Protected route? → Add `protect` middleware
- [ ] Sensitive operation? → Add `checkPermission`
- [ ] Database query? → Filter by `organizationId`
- [ ] User input? → Validate and sanitize
- [ ] Returning data? → Exclude passwords/secrets

### Before Committing
- [ ] No secrets in code?
- [ ] All routes protected?
- [ ] Permissions checked?
- [ ] Organization isolation enforced?
- [ ] Input validated?

---

## 🔧 Common Security Patterns

### Protected API Route
```javascript
router.post('/api/resource',
    protect,                    // Auth
    organizationIsolation,      // Org context
    checkPermission('module', 'action'), // Permissions
    controllerFunction
);
```

### Secure Database Query
```javascript
const resource = await Resource.findOne({
    _id: req.params.id,
    organizationId: req.user.organizationId // Always filter!
}).select('-password'); // Exclude sensitive fields
```

### Frontend Route Guard
```javascript
meta: { 
    requiresAuth: true,
    requiresPermission: { module: 'module', action: 'view' }
}
```

### Secure Token Generation
```javascript
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be configured');
}
jwt.sign(payload, process.env.JWT_SECRET);
```

---

## 🚫 Security Anti-Patterns (Never Do These)

❌ `jwt.verify(token, process.env.JWT_SECRET || 'default')`  
❌ `await Resource.findById(id)` (no org filter)  
❌ `res.json({ user })` (includes password)  
❌ `const query = "SELECT * WHERE id = " + req.params.id`  
❌ `if (userRole === 'admin') { delete() }` (client-side only)  
❌ `console.log('Password:', password)`  
❌ `const apiKey = 'sk_live_1234567890'` (hardcoded secret)

---

## 📞 Security Questions?

1. Check `SECURITY_GUIDELINES.md` for detailed patterns
2. Review existing secure code for examples
3. When in doubt, ask: "What's the secure way to do this?"

---

**Security is everyone's responsibility. When in doubt, be more secure.**

