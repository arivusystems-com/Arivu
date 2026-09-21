#!/usr/bin/env node

/**
 * Seed Platform App & Module Definitions
 * 
 * This script seeds the platform-level metadata for apps and modules.
 * This is PLATFORM metadata, not tenant data.
 * 
 * Run this once when setting up the platform or after schema changes.
 * 
 * Usage: node scripts/seedPlatformDefinitions.js
 */

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const AppDefinition = require('../models/AppDefinition');
const ModuleDefinition = require('../models/ModuleDefinition');
const { registerDefaultTaskRelationships } = require('../services/taskRelationshipInitializer');

// Support both MONGODB_URI and MONGO_URI
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_URI_LOCAL;

// Platform App Definitions
const APP_DEFINITIONS = [
  {
    appKey: 'platform',
    name: 'Platform',
    description: 'Core platform modules (tasks, events, forms) shared across apps',
    icon: 'platform',
    category: 'SYSTEM',
    owner: 'PLATFORM',
    enabled: true,
    order: 0,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: false,
      usesAutomation: true
    },
    settingsSchema: null
  },
  {
    appKey: 'sales',
    name: 'Sales',
    description: 'Sales CRM application for managing leads, contacts, deals, and sales pipeline',
    icon: 'sales',
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
    settingsSchema: null
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
    settingsSchema: null
  },
  {
    appKey: 'portal',
    name: 'Portal',
    description: 'Customer/Partner self-service portal',
    icon: 'portal',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 3,
    capabilities: {
      usesPeople: true,
      usesOrganization: false,
      usesTransactions: false,
      usesAutomation: false
    },
    settingsSchema: null
  },
  {
    appKey: 'lms',
    name: 'Learning',
    description: 'An intelligent learning platform for your people, customers, and partners',
    icon: 'academic-cap',
    category: 'BUSINESS',
    owner: 'PLATFORM',
    enabled: true,
    order: 8,
    capabilities: {
      usesPeople: true,
      usesOrganization: true,
      usesTransactions: false,
      usesAutomation: true
    },
    settingsSchema: null,
    ui: {
      sidebarOrder: 8,
      icon: 'academic-cap',
      defaultRoute: '/learning',
      showInAppSwitcher: true
    }
  }
];

// Platform Module Definitions
const MODULE_DEFINITIONS = [
  // ===== PLATFORM APP MODULES (for relationship definitions: deal_tasks, deal_events, deal_forms) =====
  {
    moduleKey: 'tasks',
    appKey: 'platform',
    key: 'tasks',
    label: 'Task',
    pluralLabel: 'Tasks',
    entityType: 'ACTIVITY',
    primaryField: 'title',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
    lifecycle: { statusField: 'status', allowedStatuses: ['Not Started', 'In Progress', 'Completed', 'Cancelled'] },
    supports: { ownership: true, assignment: true, comments: true, attachments: true, automation: true },
    permissions: { create: true, edit: true, delete: true, view: true },
    organizationId: null
  },
  {
    moduleKey: 'events',
    appKey: 'platform',
    key: 'events',
    label: 'Event',
    pluralLabel: 'Events',
    entityType: 'ACTIVITY',
    primaryField: 'eventName',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
    lifecycle: { statusField: 'status', allowedStatuses: ['Planned', 'Completed', 'Cancelled'] },
    supports: { ownership: true, assignment: true, comments: true, attachments: true, automation: true },
    permissions: { create: true, edit: true, delete: true, view: true },
    organizationId: null
  },
  {
    moduleKey: 'forms',
    appKey: 'platform',
    key: 'forms',
    label: 'Form',
    pluralLabel: 'Forms',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: { allowedTypes: [], required: false },
    organizationConstraints: { required: false },
    lifecycle: null,
    supports: { ownership: true, assignment: false, comments: true, attachments: true, automation: true },
    permissions: { create: true, edit: true, delete: true, view: true },
    organizationId: null
  },
  // ===== SALES APP MODULES =====
  {
    moduleKey: 'organizations',
    appKey: 'sales',
    key: 'organizations',
    label: 'Organization',
    pluralLabel: 'Organizations',
    entityType: 'CORE',
    primaryField: 'name',
    peopleConstraints: { allowedTypes: [], required: false },
    organizationConstraints: { required: false },
    lifecycle: null,
    supports: { ownership: true, assignment: true, comments: true, attachments: true, automation: true },
    permissions: { create: true, edit: true, delete: false, view: true },
    organizationId: null
  },
  {
    moduleKey: 'people',
    appKey: 'sales',
    label: 'Person',
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
    }
  },
  {
    moduleKey: 'quotes',
    appKey: 'platform',
    label: 'Quote',
    pluralLabel: 'Quotes',
    entityType: 'TRANSACTION',
    primaryField: 'quoteTitle',
    peopleConstraints: { allowedTypes: ['Contact'], required: false },
    organizationConstraints: { required: false },
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
    supports: { ownership: true, assignment: true, comments: true, attachments: true, automation: true },
    permissions: { create: true, edit: true, delete: false, view: true }
  },
  {
    moduleKey: 'tasks',
    appKey: 'sales',
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
    }
  },
  {
    moduleKey: 'events',
    appKey: 'sales',
    label: 'Meeting',
    pluralLabel: 'Meetings',
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
    }
  },

  // ===== AUDIT APP MODULES =====
  {
    moduleKey: 'audits',
    appKey: 'audit',
    label: 'Audit Visit',
    pluralLabel: 'Audit Visits',
    entityType: 'CORE',
    primaryField: 'eventName',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: true
    },
    lifecycle: {
      statusField: 'auditState',
      allowedStatuses: ['Ready to start', 'checked_in', 'submitted', 'pending_corrective', 'needs_review', 'approved', 'rejected', 'closed']
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
    }
  },
  {
    moduleKey: 'cases',
    appKey: 'audit',
    label: 'Finding',
    pluralLabel: 'Findings',
    entityType: 'TRANSACTION',
    primaryField: 'subject',
    peopleConstraints: {
      allowedTypes: [],
      required: false
    },
    organizationConstraints: {
      required: true
    },
    lifecycle: {
      statusField: 'status',
      allowedStatuses: ['New', 'Open', 'In Progress', 'Resolved', 'Closed']
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
    }
  },
  {
    moduleKey: 'tasks',
    appKey: 'audit',
    label: 'Corrective Action',
    pluralLabel: 'Corrective Actions',
    entityType: 'ACTIVITY',
    primaryField: 'title',
    peopleConstraints: {
      allowedTypes: [],
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
    }
  }
];

async function seedPlatformDefinitions() {
  try {
    console.log('🚀 Seeding Platform App & Module Definitions...\n');

    // Validate MongoDB URI
    if (!MONGO_URI) {
      console.error('❌ Error: MONGODB_URI is not set in .env file!');
      process.exit(1);
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // Seed Apps
    console.log('📦 Seeding App Definitions...');
    let appsCreated = 0;
    let appsUpdated = 0;

    for (const appData of APP_DEFINITIONS) {
      const existingApp = await AppDefinition.findOne({ appKey: appData.appKey });
      
      if (existingApp) {
        await AppDefinition.updateOne({ appKey: appData.appKey }, appData);
        appsUpdated++;
        console.log(`  ✅ Updated app: ${appData.appKey}`);
      } else {
        await AppDefinition.create(appData);
        appsCreated++;
        console.log(`  ✅ Created app: ${appData.appKey}`);
      }
    }

    // Keep legacy tenant metadata aligned with canonical app icons.
    // HELPDESK may exist in older environments even when not seeded by this script.
    await AppDefinition.updateOne(
      { appKey: 'helpdesk' },
      { $set: { icon: 'lifebuoy', 'ui.icon': 'lifebuoy' } }
    );

    console.log(`\n📊 Apps: ${appsCreated} created, ${appsUpdated} updated\n`);

    // Seed Modules
    console.log('📦 Seeding Module Definitions...');
    let modulesCreated = 0;
    let modulesUpdated = 0;

    for (const moduleData of MODULE_DEFINITIONS) {
      const existingModule = await ModuleDefinition.findOne({
        appKey: moduleData.appKey,
        moduleKey: moduleData.moduleKey
      });
      
      if (existingModule) {
        await ModuleDefinition.updateOne(
          { appKey: moduleData.appKey, moduleKey: moduleData.moduleKey },
          moduleData
        );
        modulesUpdated++;
        console.log(`  ✅ Updated module: ${moduleData.appKey}.${moduleData.moduleKey}`);
      } else {
        await ModuleDefinition.create(moduleData);
        modulesCreated++;
        console.log(`  ✅ Created module: ${moduleData.appKey}.${moduleData.moduleKey}`);
      }
    }

    console.log(`\n📊 Modules: ${modulesCreated} created, ${modulesUpdated} updated\n`);

    // Register default Task relationships (safe/idempotent)
    await registerDefaultTaskRelationships();

    // Summary
    console.log('✅ Platform definitions seeded successfully!');
    console.log(`\n📈 Summary:`);
    console.log(`   - Apps: ${appsCreated + appsUpdated} total`);
    console.log(`   - Modules: ${modulesCreated + modulesUpdated} total\n`);

    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding platform definitions:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  seedPlatformDefinitions();
}

module.exports = seedPlatformDefinitions;
