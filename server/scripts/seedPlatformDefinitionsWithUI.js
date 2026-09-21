#!/usr/bin/env node

/**
 * Seed Platform App & Module Definitions with UI Metadata (Phase 0D)
 * 
 * This script seeds the platform-level metadata for apps and modules,
 * including UI composition metadata for dynamic UI rendering.
 * 
 * This is PLATFORM metadata, not tenant data.
 * 
 * Run this once when setting up the platform or after schema changes.
 * 
 * Usage: node scripts/seedPlatformDefinitionsWithUI.js
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');
const { registerDefaultTaskRelationships } = require('../services/taskRelationshipInitializer');
const getMasterDatabaseUri = require('../utils/getMasterDatabaseUri');

// Platform App Definitions with UI Metadata (Phase 0D)
const APP_DEFINITIONS = [
  {
    appKey: 'sales',
    name: 'Sales',
    description: 'Sales application for managing contacts, pipeline entities, and sales pipeline',
    icon: '💼',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 1,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: true,
      usesAutomation: true
    },
    settingsSchema: null,
    // Phase 0D: UI Metadata
    ui: {
      sidebarOrder: 1,
      icon: '💼',
      defaultRoute: '/dashboard',
      showInAppSwitcher: true
    }
  },
  {
    appKey: 'audit',
    name: 'Audit',
    description: 'Audit management application for managing audit visits, findings, and corrective actions',
    icon: 'shield-check',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 2,
    capabilities: {
      usesPeople: false,
      usesOrganization: true,
      usesTransactions: false,
      usesAutomation: true
    },
    settingsSchema: null,
    // Phase 2D: UI Metadata - Updated defaultRoute
    ui: {
      sidebarOrder: 2,
      icon: 'shield-check',
      defaultRoute: '/audit/dashboard',
      showInAppSwitcher: true
    }
  },
  {
    appKey: 'helpdesk',
    name: 'Helpdesk',
    description: 'Case-centric support application for service execution and SLA commitments',
    icon: 'lifebuoy',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 3,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: true,
      usesAutomation: true
    },
    settingsSchema: null,
    ui: {
      sidebarOrder: 3,
      icon: 'lifebuoy',
      defaultRoute: '/dashboard/helpdesk',
      showInAppSwitcher: true
    }
  },
  {
    appKey: 'marketing',
    name: 'Marketing',
    description: 'Email campaigns, audiences, templates, and marketing analytics',
    icon: 'megaphone',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 4,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: false,
      usesAutomation: true
    },
    settingsSchema: null,
    ui: {
      sidebarOrder: 4,
      icon: 'megaphone',
      defaultRoute: '/dashboard/marketing',
      showInAppSwitcher: true
    },
    marketplace: {
      category: 'Sales',
      beta: true,
      comingSoon: false,
      shortDescription: 'Create email campaigns, manage audiences, and measure engagement via AMDS delivery'
    }
  },
  {
    appKey: 'inventory',
    name: 'Inventory',
    description: 'Stock ledger, locations, reservations, and fulfillment operations',
    icon: 'cube',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 5,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: true,
      usesAutomation: true
    },
    settingsSchema: null,
    ui: {
      sidebarOrder: 5,
      icon: 'cube',
      defaultRoute: '/dashboard/inventory',
      showInAppSwitcher: true
    }
  },
  {
    appKey: 'portal',
    name: 'Portal',
    description: 'Customer/Partner self-service portal',
    icon: '🌐',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 6,
    capabilities: {
      usesPeople: true,
      usesOrganization: false,
      usesTransactions: false,
      usesAutomation: false
    },
    settingsSchema: null,
    // Phase 2D: UI Metadata - Updated defaultRoute
    ui: {
      sidebarOrder: 4,
      icon: '🌐',
      defaultRoute: '/portal/dashboard',
      showInAppSwitcher: true
    }
  },
  {
    appKey: 'lms',
    name: 'Learning',
    description: 'An intelligent learning platform for your people, customers, and partners',
    icon: 'academic-cap',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 7,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: false,
      usesAutomation: true
    },
    settingsSchema: null,
    ui: {
      sidebarOrder: 7,
      icon: 'academic-cap',
      defaultRoute: '/learning',
      showInAppSwitcher: true
    },
    marketplace: {
      category: 'People',
      beta: true,
      comingSoon: false,
      shortDescription: 'Courses, paths, assessments, and certificates priced by learner seats'
    }
  },
  {
    appKey: 'control_plane',
    name: 'Control Plane',
    description: 'Platform control plane for system administration (internal only)',
    icon: '⚙️',
    category: 'SYSTEM',
    owner: 'PLATFORM',
    enabled: true,
    order: 999,
    capabilities: {
      usesPeople: false,
      usesOrganization: false,
      usesTransactions: false,
      usesAutomation: false
    },
    settingsSchema: null,
    // Phase 2D: UI Metadata - Must remain hidden from tenants
    ui: {
      sidebarOrder: 999,
      icon: '⚙️',
      defaultRoute: '/control-plane',
      showInAppSwitcher: false  // Never visible to tenants
    }
  }
];

// Platform Module Definitions with UI Metadata (Phase 0D)
const MODULE_DEFINITIONS = [
  // ===== SALES APP MODULES =====
  {
    moduleKey: 'people',
    appKey: 'platform', // Core entity - shared across apps
    label: 'People',
    pluralLabel: 'People',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: ['Lead', 'Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['Lead', 'Contact']
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/people',
      icon: '👥',
      showInSidebar: true,
      sidebarOrder: 1,
      createLabel: 'Create Person', // Keep singular for create action
      listLabel: 'All People',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'organizations',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Organization',
    pluralLabel: 'Organizations',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/organizations',
      icon: '🏢',
      showInSidebar: true,
      sidebarOrder: 2,
      createLabel: 'Create Organization',
      listLabel: 'All Organizations',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'deals',
    appKey: 'sales',
    label: 'Deal',
    pluralLabel: 'Deals',
    entityType: 'TRANSACTION',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'stage',
      allowedStatuses: ['Qualification', 'Proposal', 'Negotiation', 'Contract Sent', 'Closed Won', 'Closed Lost', 'Lead', 'Qualified']
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/deals',
      icon: '💼',
      showInSidebar: true,
      sidebarOrder: 3,
      createLabel: 'Create Deal',
      listLabel: 'All Deals'
    }
  },
  {
    moduleKey: 'quotes',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Quote',
    pluralLabel: 'Quotes',
    entityType: 'TRANSACTION',
    primaryField: 'quoteTitle',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [
        'Draft',
        'Pending Approval',
        'Approved',
        'Sent',
        'Viewed',
        'Accepted',
        'Partially Accepted',
        'Rejected',
        'Expired',
        'Cancelled',
        'Converted'
      ]
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/quotes',
      icon: 'document-text',
      showInSidebar: true,
      sidebarOrder: 8,
      createLabel: 'Create Quote',
      listLabel: 'All Quotes',
      // Navigation intent: Core Modules section (shared platform capability)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'sales_orders',
    appKey: 'platform',
    label: 'Sales Order',
    pluralLabel: 'Sales Orders',
    entityType: 'TRANSACTION',
    primaryField: 'orderTitle',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: [
        'Draft',
        'Confirmed',
        'On Hold',
        'In Fulfillment',
        'Partially Fulfilled',
        'Fulfilled',
        'Cancelled',
        'Closed'
      ]
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    ui: {
      routeBase: '/sales-orders',
      icon: 'shopping-cart',
      showInSidebar: true,
      sidebarOrder: 9,
      createLabel: 'Create Sales Order',
      listLabel: 'All Sales Orders',
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'tasks',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Task',
    pluralLabel: 'Tasks',
    entityType: 'ACTIVITY',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['Not Started', 'In Progress', 'Completed', 'Cancelled']
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/tasks',
      icon: '✅',
      showInSidebar: true,
      sidebarOrder: 4,
      createLabel: 'Create Task',
      listLabel: 'All Tasks',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'documents',
    appKey: 'platform',
    label: 'Document',
    pluralLabel: 'Documents',
    entityType: 'CORE',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['draft', 'pending_review', 'approved', 'published', 'archived']
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    ui: {
      routeBase: '/documents',
      icon: 'document-duplicate',
      showInSidebar: true,
      sidebarOrder: 9,
      createLabel: 'New Document',
      listLabel: 'Documents',
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'events',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Event',
    pluralLabel: 'Events',
    entityType: 'ACTIVITY',
    primaryField: 'eventName',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['Planned', 'Completed', 'Cancelled']
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/events',
      icon: '📅',
      showInSidebar: true,
      sidebarOrder: 5,
      createLabel: 'Create Event',
      listLabel: 'All Events',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'items',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Item',
    pluralLabel: 'Items',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/items',
      icon: '📦',
      showInSidebar: true,
      sidebarOrder: 6,
      createLabel: 'Create Item',
      listLabel: 'All Items',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'forms',
    appKey: 'platform', // Core entity - shared across apps
    label: 'Form',
    pluralLabel: 'Forms',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/forms',
      icon: '📝',
      showInSidebar: true,
      sidebarOrder: 7,
      createLabel: 'Create Form',
      listLabel: 'All Forms',
      // Navigation intent: Entities section (shared system primitives)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'templates',
    appKey: 'platform',
    label: 'Template',
    pluralLabel: 'Templates',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['draft', 'published', 'archived']
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true,
      publish: true,
      archive: true,
      render: true
    },
    ui: {
      routeBase: '/templates',
      icon: 'rectangle-stack',
      showInSidebar: true,
      sidebarOrder: 10,
      createLabel: 'New Template',
      listLabel: 'Templates',
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'imports',
    appKey: 'platform', // Cross-functional capability — shared across apps
    label: 'Import',
    pluralLabel: 'Imports',
    entityType: 'CORE',
    primaryField: 'fileName',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['processing', 'completed', 'failed', 'partial']
    },
    supports: {
      ownership: false,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: false,
      delete: false,
      view: true
    },
    // Phase 0D: UI Metadata
    ui: {
      routeBase: '/imports',
      icon: '📥',
      showInSidebar: true,
      sidebarOrder: 9,
      createLabel: 'New Import',
      listLabel: 'Import History',
      // Navigation intent: Core Modules section (cross-functional, not Sales-specific)
      navigationEntity: true,
      excludeFromApps: true
    }
  },
  {
    moduleKey: 'inventory',
    appKey: 'inventory',
    label: 'Inventory',
    pluralLabel: 'Inventory',
    entityType: 'TRANSACTION',
    primaryField: 'locationCode',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['active', 'inactive']
    },
    supports: {
      ownership: false,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    ui: {
      routeBase: '/inventory',
      icon: 'cube',
      showInSidebar: false,
      sidebarOrder: 1,
      createLabel: 'Stock Operations',
      listLabel: 'Inventory'
    }
  },
  {
    moduleKey: 'cases',
    appKey: 'helpdesk',
    label: 'Cases',
    pluralLabel: 'Cases',
    entityType: 'TRANSACTION',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['New', 'Assigned', 'In Progress', 'On Hold', 'Waiting for Customer', 'Resolved', 'Closed']
    },
    supports: {
      ownership: true,
      assignment: true,
      comments: true,
      attachments: true,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true
    },
    ui: {
      routeBase: '/helpdesk/cases',
      icon: 'ticket',
      showInSidebar: true,
      sidebarOrder: 1,
      createLabel: 'Create Case',
      listLabel: 'All Cases'
    }
  },
  {
    moduleKey: 'articles',
    appKey: 'helpdesk',
    label: 'Articles',
    pluralLabel: 'Articles',
    entityType: 'CORE',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['draft', 'review', 'scheduled', 'published', 'archived']
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true,
      publish: true,
    },
    ui: {
      routeBase: '/helpdesk/articles',
      icon: 'book-open',
      showInSidebar: true,
      sidebarOrder: 2,
      createLabel: 'New Article',
      listLabel: 'Articles'
    }
  },
  {
    moduleKey: 'campaigns',
    appKey: 'marketing',
    label: 'Campaign',
    pluralLabel: 'Campaigns',
    entityType: 'TRANSACTION',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'archived', 'sending', 'sent', 'failed']
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: false,
      automation: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    ui: {
      routeBase: '/marketing/campaigns',
      icon: 'megaphone',
      showInSidebar: true,
      sidebarOrder: 1,
      createLabel: 'Create Campaign',
      listLabel: 'Campaigns'
    }
  },
  {
    moduleKey: 'blog',
    appKey: 'marketing',
    label: 'Blog',
    pluralLabel: 'Blog Posts',
    entityType: 'CORE',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['draft', 'review', 'scheduled', 'published', 'archived']
    },
    supports: {
      ownership: true,
      assignment: false,
      comments: true,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true,
      publish: true
    },
    ui: {
      routeBase: '/marketing/blog',
      icon: 'document-text',
      showInSidebar: true,
      sidebarOrder: 2,
      createLabel: 'New Post',
      listLabel: 'Blog'
    }
  },
  {
    moduleKey: 'audiences',
    appKey: 'marketing',
    label: 'Audience',
    pluralLabel: 'Audiences',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true,
      import: true,
      export: true
    },
    ui: {
      routeBase: '/marketing/audiences',
      icon: 'users',
      showInSidebar: true,
      sidebarOrder: 2,
      createLabel: 'Create Audience',
      listLabel: 'Audiences'
    }
  },
  {
    moduleKey: 'segments',
    appKey: 'marketing',
    label: 'Segment',
    pluralLabel: 'Segments',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: {
      allowedTypes: ['Contact'],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    ui: {
      routeBase: '/marketing/segments',
      icon: 'funnel',
      showInSidebar: true,
      sidebarOrder: 3,
      createLabel: 'Create Segment',
      listLabel: 'Segments'
    }
  },
  {
    moduleKey: 'assets',
    appKey: 'marketing',
    label: 'Asset',
    pluralLabel: 'Assets',
    entityType: 'CORE',
    primaryField: 'filename',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: null,
    supports: {
      ownership: true,
      assignment: false,
      comments: false,
      attachments: false,
      automation: false
    },
    permissions: {
      create: true,
      edit: true,
      delete: true,
      view: true
    },
    ui: {
      routeBase: '/marketing/assets',
      icon: 'photo',
      showInSidebar: true,
      sidebarOrder: 4,
      createLabel: 'Upload Asset',
      listLabel: 'Assets'
    }
  },
  // Responses: Platform execution domain + entity (paired with Forms)
  {
    moduleKey: 'responses',
    appKey: 'platform',
    label: 'Response',
    pluralLabel: 'Responses',
    entityType: 'TRANSACTION',
    primaryField: 'responseId',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: false
    },
    lifecycle: {
      statusField: 'reviewStatus',
      allowedStatuses: ['Pending Corrective Action', 'Needs Auditor Review', 'Approved', 'Rejected', 'Closed'],
      executionDriven: true,
      immutableAfter: 'executionStatus:Submitted'
    },
    supports: {
      ownership: false,
      assignment: false,
      comments: false,
      attachments: true,
      automation: true,
      correctiveActions: true,
      approvalFlow: true,
      auditReview: true,
      reporting: true
    },
    permissions: {
      create: true,
      edit: true,
      delete: false,
      view: true,
      execution: true,
      review: true,
      approve: true
    },
    ui: {
      routeBase: '/responses',
      icon: 'clipboard-document-list',
      showInSidebar: true,
      sidebarOrder: 7.5,
      showAsTabUnder: ['forms'],
      createLabel: 'New Response',
      listLabel: 'All Responses',
      navigationEntity: true,
      excludeFromApps: true
    }
  }
];

async function seedPlatformDefinitionsWithUI(useExistingConnection = false) {
  try {
    console.log('🚀 Seeding Platform App & Module Definitions with UI Metadata (Phase 0D)...\n');

    // Connect to database if not using existing connection
    if (!useExistingConnection) {
      // Get master database URI (always uses arivu_master)
      const masterUri = getMasterDatabaseUri();
      console.log('🔗 Connecting to MongoDB master database (arivu_master)...');
      await mongoose.connect(masterUri);
      console.log('✅ Connected to MongoDB master database (arivu_master)\n');
    }

    // Seed Apps
    console.log('📦 Seeding App Definitions...');
    let appsCreated = 0;
    let appsUpdated = 0;

    for (const appData of APP_DEFINITIONS) {
      const existingApp = await AppDefinition.findOne({ appKey: appData.appKey });
      
      if (existingApp) {
        // Update existing app, preserving any custom fields
        await AppDefinition.updateOne(
          { appKey: appData.appKey },
          { $set: appData }
        );
        appsUpdated++;
        if (!useExistingConnection) {
          console.log(`  ✅ Updated app: ${appData.appKey} (${appData.name})`);
        }
      } else {
        await AppDefinition.create(appData);
        appsCreated++;
        if (!useExistingConnection) {
          console.log(`  ✅ Created app: ${appData.appKey} (${appData.name})`);
        }
      }
    }

    // Keep legacy tenant metadata aligned with canonical app icons.
    // HELPDESK may exist in older environments even when not seeded by this script.
    await AppDefinition.updateOne(
      { appKey: 'helpdesk' },
      { $set: { icon: 'lifebuoy', 'ui.icon': 'lifebuoy' } }
    );

    if (!useExistingConnection) {
      console.log(`\n📊 Apps: ${appsCreated} created, ${appsUpdated} updated\n`);
    }

    // Seed Modules
    console.log('📦 Seeding Module Definitions...');
    let modulesCreated = 0;
    let modulesUpdated = 0;

    for (const moduleData of MODULE_DEFINITIONS) {
      const existingModule = await ModuleDefinition.findOne({
        appKey: moduleData.appKey,
        moduleKey: moduleData.moduleKey,
        organizationId: moduleData.organizationId || null
      });
      
      if (existingModule) {
        // Update existing module, preserving any custom fields
        await ModuleDefinition.updateOne(
          { appKey: moduleData.appKey, moduleKey: moduleData.moduleKey, organizationId: moduleData.organizationId || null },
          { $set: moduleData }
        );
        modulesUpdated++;
        if (!useExistingConnection) {
          console.log(`  ✅ Updated module: ${moduleData.appKey}.${moduleData.moduleKey} (${moduleData.label})`);
        }
      } else {
        await ModuleDefinition.create(moduleData);
        modulesCreated++;
        if (!useExistingConnection) {
          console.log(`  ✅ Created module: ${moduleData.appKey}.${moduleData.moduleKey} (${moduleData.label})`);
        }
      }
    }

    if (!useExistingConnection) {
      console.log(`\n📊 Modules: ${modulesCreated} created, ${modulesUpdated} updated\n`);
    }

    // Inventory workbench ModuleDefinitions (PO, RN, DN, stockrooms, …)
    try {
      const {
        ensureInventoryAppModuleDefinitions
      } = require('../services/inventoryModuleBootstrapService');
      const { results: invResults } = await ensureInventoryAppModuleDefinitions();
      const invCreated = invResults.filter((r) => r.created).length;
      const invUpdated = invResults.filter((r) => r.updated).length;
      modulesCreated += invCreated;
      modulesUpdated += invUpdated;
      if (!useExistingConnection) {
        console.log(
          `  ✅ Inventory modules: ${invCreated} created, ${invUpdated} updated, ${invResults.length} total`
        );
      }
    } catch (invErr) {
      console.warn('  ⚠️  Inventory module bootstrap failed:', invErr.message);
    }

    // Register default Task relationships (safe/idempotent)
    await registerDefaultTaskRelationships();

    // Summary
    if (!useExistingConnection) {
      console.log('✅ Platform definitions with UI metadata seeded successfully!');
      console.log(`\n📈 Summary:`);
      console.log(`   - Apps: ${appsCreated + appsUpdated} total`);
      console.log(`   - Modules: ${modulesCreated + modulesUpdated} total`);
      console.log(`\n💡 Next Steps:`);
      console.log(`   1. Ensure organizations have enabledApps set (default: ['SALES'])`);
      console.log(`   2. Create TenantModuleConfiguration records for enabled modules`);
      console.log(`   3. Test UI composition by logging in and checking /api/ui/sidebar\n`);
    }

    // Only close connection if we opened it
    if (!useExistingConnection) {
      await mongoose.connection.close();
      console.log('🔌 Disconnected from MongoDB');
      process.exit(0);
    }

    return { appsCreated, appsUpdated, modulesCreated, modulesUpdated };

  } catch (error) {
    console.error('❌ Error seeding platform definitions:', error);
    if (!useExistingConnection) {
      await mongoose.connection.close();
      process.exit(1);
    }
    throw error; // Re-throw if using existing connection
  }
}

// Run if called directly
if (require.main === module) {
  seedPlatformDefinitionsWithUI();
}

module.exports = seedPlatformDefinitionsWithUI;
