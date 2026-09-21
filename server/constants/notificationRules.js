const domainEvents = require('./domainEvents');

/**
 * Notification rule registry:
 * - appKey: which app the notification belongs to
 * - recipients: semantic recipient keys to be resolved dynamically
 * - priority: LOW | NORMAL | HIGH
 * - defaultChannels: which channels to use when no user preference overrides
 * - channels: channel metadata specifying which external channels are allowed
 *   (Phase 13: External Notification Channels)
 */
module.exports = {
  [domainEvents.AUDIT_ASSIGNED]: {
    appKey: 'AUDIT',
    recipients: ['EVENT_AUDITOR'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: true, // HIGH priority - allow push
      whatsapp: true, // HIGH priority - allow WhatsApp
      sms: false
    }
  },
  [domainEvents.AUDIT_CHECKED_IN]: {
    appKey: 'AUDIT',
    recipients: ['EVENT_AUDITOR'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false, // NORMAL priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.AUDIT_SUBMITTED]: {
    appKey: 'AUDIT',
    recipients: ['SALES_ADMIN'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // NORMAL priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.AUDIT_APPROVED]: {
    appKey: 'AUDIT',
    recipients: ['EVENT_AUDITOR'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false, // NORMAL priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.AUDIT_REJECTED]: {
    appKey: 'AUDIT',
    recipients: ['EVENT_AUDITOR'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // NORMAL priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.CORRECTIVE_ACTION_CREATED]: {
    appKey: 'PORTAL',
    recipients: ['CORRECTIVE_OWNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // Portal doesn't use push
      whatsapp: true, // HIGH priority - allow WhatsApp
      sms: false
    }
  },
  [domainEvents.CORRECTIVE_ACTION_DUE_SOON]: {
    appKey: 'PORTAL',
    recipients: ['CORRECTIVE_OWNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false, // NORMAL priority - no WhatsApp
      sms: false
    }
  },
  [domainEvents.CORRECTIVE_ACTION_OVERDUE]: {
    appKey: 'PORTAL',
    recipients: ['CORRECTIVE_OWNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // Portal doesn't use push
      whatsapp: true, // HIGH priority - allow WhatsApp
      sms: true // Emergency/compliance use
    }
  },
  [domainEvents.EVIDENCE_UPLOADED]: {
    appKey: 'PORTAL',
    recipients: ['CORRECTIVE_OWNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.PORTAL_ACCOUNT_CREATED]: {
    appKey: 'PORTAL',
    recipients: ['PORTAL_CUSTOMER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.TASK_ASSIGNED]: {
    appKey: 'SALES',
    recipients: ['TASK_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.PEOPLE_ASSIGNED]: {
    appKey: 'SALES',
    recipients: ['PEOPLE_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.DEAL_ASSIGNED]: {
    appKey: 'SALES',
    recipients: ['DEAL_OWNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.ORGANIZATION_ASSIGNED]: {
    appKey: 'SALES',
    recipients: ['ORGANIZATION_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.TASK_CREATED]: {
    appKey: 'SALES',
    recipients: ['TASK_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.TASK_STATUS_CHANGED]: {
    appKey: 'SALES',
    recipients: ['TASK_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.TASK_DUE_SOON]: {
    appKey: 'SALES',
    recipients: ['TASK_ASSIGNEE'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.PLAYBOOK_ACTION_ALERT]: {
    appKey: 'SALES',
    recipients: ['PLAYBOOK_ALERT_RECIPIENTS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: true
    }
  },
  [domainEvents.RECORD_COMMENT_MENTION]: {
    appKey: '*',
    recipients: ['COMMENT_MENTION_RECIPIENTS'],
    priority: 'NORMAL',
    // Email is NOT delivered via notificationEngine — dedicated path only
    defaultChannels: ['IN_APP', 'PUSH'],
    channels: {
      inApp: true,
      email: false,
      push: true,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.CASE_CREATED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_EMAIL_RECEIVED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_CHAT_MESSAGE_RECEIVED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_PORTAL_AGENT_REPLY]: {
    appKey: 'PORTAL',
    recipients: ['PORTAL_CASE_REQUESTER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL', 'PUSH'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_PORTAL_STATUS_UPDATE]: {
    appKey: 'PORTAL',
    recipients: ['PORTAL_CASE_REQUESTER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.LIVE_CHAT_MESSAGE_RECEIVED]: {
    appKey: 'PLATFORM',
    recipients: ['LIVE_CHAT_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.LIVE_CHAT_SESSION_STARTED]: {
    appKey: 'PLATFORM',
    recipients: ['LIVE_CHAT_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.INTERNAL_CHAT_MENTIONED]: {
    appKey: 'PLATFORM',
    recipients: ['INTERNAL_CHAT_MENTION_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'PUSH'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.INTERNAL_CHAT_MESSAGE_POSTED]: {
    appKey: 'PLATFORM',
    recipients: ['INTERNAL_CHAT_SPACE_MEMBERS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.TELEPHONY_INCOMING_CALL]: {
    appKey: 'PLATFORM',
    recipients: ['TELEPHONY_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.TELEPHONY_CALL_MISSED]: {
    appKey: 'PLATFORM',
    recipients: ['TELEPHONY_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.TELEPHONY_RECORDING_READY]: {
    appKey: 'PLATFORM',
    recipients: ['TELEPHONY_NOTIFY_TARGETS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_ASSIGNED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_NOTIFY_TARGETS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_STATUS_CHANGED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_REOPENED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_ESCALATED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER', 'CRM_ADMIN'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: true, sms: false }
  },
  [domainEvents.CASE_SLA_WARNING]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_SLA_BREACHED]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER', 'CRM_ADMIN'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: true, sms: false }
  },
  [domainEvents.CASE_SLA_ESCALATION]: {
    appKey: 'HELPDESK',
    recipients: ['CASE_OWNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.CASE_SLA_LEADERSHIP_ESCALATION]: {
    appKey: 'HELPDESK',
    recipients: ['CRM_ADMIN'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.USER_ADDED_TO_APP]: {
    appKey: 'SALES',
    recipients: ['USER_SELF'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // NORMAL priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.SYSTEM_TRIAL_EXPIRING]: {
    appKey: 'SALES',
    recipients: ['TRIAL_OWNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: true, // HIGH priority - allow push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.SYSTEM_SUBSCRIPTION_SUSPENDED]: {
    appKey: 'SALES',
    recipients: ['SALES_ADMIN'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: true, // HIGH priority - allow push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.EMAIL_THREAD_SNOOZE_ENDED]: {
    appKey: 'SALES',
    recipients: ['INBOX_SNOOZE_USER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.WEBFORM_SUBMISSION]: {
    appKey: '*',
    recipients: ['WEBFORM_NOTIFY_RECIPIENTS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.DIGEST_DAILY]: {
    appKey: '*',
    recipients: ['USER_SELF'],
    priority: 'LOW',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false, // LOW priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.DIGEST_WEEKLY]: {
    appKey: '*',
    recipients: ['USER_SELF'],
    priority: 'LOW',
    defaultChannels: ['EMAIL'],
    channels: {
      inApp: false,
      email: true,
      push: false, // LOW priority - no push
      whatsapp: false,
      sms: false
    }
  },
  [domainEvents.MARKETING_CAMPAIGN_SUBMITTED_FOR_REVIEW]: {
    appKey: 'MARKETING',
    recipients: ['MARKETING_CAMPAIGN_REVIEWERS'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.MARKETING_CAMPAIGN_APPROVED]: {
    appKey: 'MARKETING',
    recipients: ['MARKETING_CAMPAIGN_CREATOR'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: { inApp: true, email: false, push: false, whatsapp: false, sms: false }
  },
  [domainEvents.MARKETING_CAMPAIGN_REJECTED]: {
    appKey: 'MARKETING',
    recipients: ['MARKETING_CAMPAIGN_CREATOR'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: { inApp: true, email: true, push: true, whatsapp: false, sms: false }
  },
  [domainEvents.LEARNING_ENROLLED]: {
    appKey: 'LMS',
    recipients: ['LEARNING_LEARNER'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false,
    },
  },
  [domainEvents.LEARNING_COURSE_PUBLISHED]: {
    appKey: 'LMS',
    recipients: ['LEARNING_ADMINS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      sms: false,
    },
  },
  [domainEvents.LEARNING_COURSE_COMPLETED]: {
    appKey: 'LMS',
    recipients: ['LEARNING_LEARNER', 'LEARNING_ADMINS'],
    priority: 'NORMAL',
    defaultChannels: ['IN_APP'],
    channels: {
      inApp: true,
      email: false,
      push: false,
      whatsapp: false,
      sms: false,
    },
  },
  [domainEvents.LEARNING_ASSIGNMENT_OVERDUE]: {
    appKey: 'LMS',
    recipients: ['LEARNING_LEARNER'],
    priority: 'HIGH',
    defaultChannels: ['IN_APP', 'EMAIL'],
    channels: {
      inApp: true,
      email: true,
      push: false,
      whatsapp: false,
      sms: false,
    },
  },
};

