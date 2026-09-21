/**
 * ============================================================================
 * App Registry: Single Source of Truth for App Configuration
 * ============================================================================
 *
 * userTypesAllowed: STANDARD | ADMIN | EXTERNAL
 * (INTERNAL kept as legacy synonym expanded in appAccessUtils)
 */

module.exports = {
  SALES: {
    roles: ['ADMIN', 'MANAGER', 'USER'],
    userTypesAllowed: ['STANDARD', 'ADMIN'],
    defaultRole: 'USER'
  },

  HELPDESK: {
    roles: ['ADMIN', 'MANAGER', 'USER', 'AGENT'],
    userTypesAllowed: ['STANDARD', 'ADMIN'],
    defaultRole: 'AGENT'
  },

  PROJECTS: {
    roles: ['ADMIN', 'MANAGER', 'USER'],
    userTypesAllowed: ['STANDARD', 'ADMIN'],
    defaultRole: 'USER'
  },

  AUDIT: {
    roles: ['AUDITOR'],
    userTypesAllowed: ['STANDARD', 'ADMIN', 'EXTERNAL'],
    defaultRole: 'AUDITOR'
  },

  PORTAL: {
    roles: ['CUSTOMER', 'VIEWER'],
    userTypesAllowed: ['EXTERNAL'],
    defaultRole: 'CUSTOMER'
  },

  INVENTORY: {
    roles: ['ADMIN', 'MANAGER', 'USER'],
    userTypesAllowed: ['STANDARD', 'ADMIN'],
    defaultRole: 'USER'
  },

  MARKETING: {
    roles: ['ADMIN', 'MANAGER', 'USER'],
    userTypesAllowed: ['STANDARD', 'ADMIN'],
    defaultRole: 'USER'
  },

  LMS: {
    roles: ['ADMIN', 'AUTHOR', 'LEARNER'],
    userTypesAllowed: ['STANDARD', 'ADMIN', 'EXTERNAL'],
    defaultRole: 'LEARNER'
  }
};
