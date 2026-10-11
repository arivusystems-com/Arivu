# Arivu CRM - Technical Specification Document

## 1. Executive Summary

**Project Name:** Arivu CRM  
**Type:** Multi-Instance SaaS CRM Platform (White-Label Ready)  
**Tech Stack:** Vue 3 + Node.js/Express + MongoDB + Docker + Kubernetes  
**Architecture:** MERN Stack with JWT Authentication + Container Orchestration

**Current Status:** Phase 1 Complete ✅  
**Deployment Model:** Separate Instance Per Organization  
**Onboarding Model:** Demo Request → Instance Provisioning → Organization Creation  

**🚨 CRITICAL ARCHITECTURE:**
- Each converted organization gets a **dedicated instance**
- Isolated: Database + Application + Subdomain
- Provisioned automatically via orchestration
- Complete data and infrastructure isolation

---

## 2. System Architecture

### 2.1 Multi-Instance Deployment Model
**Approach:** Separate Instance Per Organization (White-Label Architecture)

**⚠️ IMPORTANT:** Unlike traditional multi-tenant SaaS (shared infrastructure), Arivu uses a **multi-instance** architecture where each organization gets its own:
- ✅ **Dedicated Database** (MongoDB instance)
- ✅ **Dedicated Application Server** (Node.js + Express)
- ✅ **Dedicated Frontend** (Vue.js deployment)
- ✅ **Unique Subdomain** (e.g., `acme.arivu.com`, `beta.arivu.com`)
- ✅ **Isolated Resources** (CPU, Memory, Storage)

**Why This Architecture?**
- Complete data isolation at infrastructure level
- Custom branding per organization (white-label ready)
- Performance isolation (one org's load doesn't affect others)
- Compliance and security requirements
- Ability to offer on-premise deployments later
- Client-specific customizations possible

**Architecture Layers:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Master Control Plane                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Instance Provisioning Service                           │ │
│  │ - Creates new instances on demo conversion              │ │
│  │ - Manages instance lifecycle                            │ │
│  │ - Monitors all instances                                │ │
│  │ - Handles billing & subscription                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Master Database                                         │ │
│  │ - DemoRequests                                          │ │
│  │ - InstanceRegistry (subdomain, status, resources)      │ │
│  │ - Billing & Subscription tracking                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                    [Orchestration]
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
┌───▼────────┐    ┌───────▼──────┐    ┌────────▼────┐
│ Instance 1 │    │ Instance 2   │    │ Instance N  │
│ Acme Corp  │    │ Beta Inc     │    │ Gamma LLC   │
│            │    │              │    │             │
│ acme.lite  │    │ beta.lite    │    │ gamma.lite  │
│ desk.com   │    │ desk.com     │    │ desk.com    │
├────────────┤    ├──────────────┤    ├─────────────┤
│ Frontend   │    │ Frontend     │    │ Frontend    │
│ (Vue.js)   │    │ (Vue.js)     │    │ (Vue.js)    │
├────────────┤    ├──────────────┤    ├─────────────┤
│ Backend    │    │ Backend      │    │ Backend     │
│ (Node.js)  │    │ (Node.js)    │    │ (Node.js)   │
├────────────┤    ├──────────────┤    ├─────────────┤
│ Database   │    │ Database     │    │ Database    │
│ (MongoDB)  │    │ (MongoDB)    │    │ (MongoDB)   │
└────────────┘    └──────────────┘    └─────────────┘
```

**Instance Lifecycle:**
1. **Demo Request** → Submitted via landing page
2. **Review** → Admin reviews in master control panel
3. **Conversion** → Admin clicks "Convert to Instance"
4. **Provisioning** (Automated):
   - Generate unique subdomain
   - Create isolated database
   - Deploy containerized application
   - Configure SSL certificate
   - Set up DNS routing
   - Initialize with owner credentials
5. **Active** → Organization uses their dedicated instance
6. **Monitoring** → Master control plane monitors health
7. **Billing** → Usage and subscription tracked centrally

### 2.2 Dual-Layer Architecture

**Layer 1: Master Control Plane (Single Deployment)**
```
┌─────────────────────────────────────────────────────────┐
│            Master Control Plane (arivu.com)          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Admin Dashboard (Vue 3)                            │ │
│  │ - Demo Requests Management                         │ │
│  │ - Instance Provisioning UI                         │ │
│  │ - Instance Monitoring                              │ │
│  │ - Billing Dashboard                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Provisioning Service (Node.js)                     │ │
│  │ - Kubernetes API Integration                       │ │
│  │ - Database Provisioning                            │ │
│  │ - DNS Management (Route 53)                        │ │
│  │ - SSL Certificate Automation (Let's Encrypt)       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Master MongoDB                                     │ │
│  │ - DemoRequests                                     │ │
│  │ - InstanceRegistry                                 │ │
│  │ - SubscriptionTracking                             │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Layer 2: Customer Instances (Multiple Deployments)**
```
┌─────────────────────────────────────────────────────────┐
│      Customer Instance (acme.arivu.com)              │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Frontend (Vue 3) - Containerized                   │ │
│  │ - Auth Module                                      │ │
│  │ - CRM Modules (Contacts, Deals, etc.)              │ │
│  │ - Settings & RBAC                                  │ │
│  │ - Reports & Automation                             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Backend (Node.js/Express) - Containerized          │ │
│  │ - JWT Authentication                               │ │
│  │ - RBAC Middleware                                  │ │
│  │ - CRM Services                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Dedicated MongoDB Instance                         │ │
│  │ - Users, Contacts, Deals, Projects, Tasks, etc.    │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design

### 3.1 Core Models

#### 3.1.1 Organization (Tenant)
```javascript
{
  _id: ObjectId,
  name: String,                    // "Acme Corporation"
  slug: String,                    // "acme-corp" (unique, URL-friendly)
  industry: String,                // Business vertical
  
  // Subscription Management
  subscription: {
    status: String,                // 'trial' | 'active' | 'expired' | 'cancelled'
    tier: String,                  // 'trial' | 'starter' | 'professional' | 'enterprise'
    trialStartDate: Date,
    trialEndDate: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    autoRenew: Boolean
  },
  
  // Limits & Features
  limits: {
    maxUsers: Number,              // Based on subscription tier
    maxContacts: Number,
    maxDeals: Number,
    maxStorageGB: Number
  },
  
  enabledModules: [String],        // ['contacts', 'deals', 'projects', ...]
  
  // Settings
  settings: {
    dateFormat: String,
    timeZone: String,
    currency: String,
    logoUrl: String,
    primaryColor: String
  },
  
  // Metadata
  createdAt: Date,
  updatedAt: Date,
  isActive: Boolean
}
```

#### 3.1.2 User (Enhanced) ✅ Implemented
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,        // Reference to Organization
  
  // Basic Info
  username: String,
  email: String,                   // Unique within organization
  password: String,                // Bcrypt hashed
  
  // Profile
  firstName: String,
  lastName: String,
  phoneNumber: String,
  avatar: String,
  
  // Role & Permissions
  role: String,                    // 'owner' | 'admin' | 'manager' | 'user' | 'viewer'
  permissions: {
    contacts: {
      view: Boolean,
      create: Boolean,
      edit: Boolean,
      delete: Boolean,
      viewAll: Boolean
    },
    deals: { /* same structure */ },
    projects: { /* same structure */ },
    tasks: { /* same structure */ },
    events: { /* same structure */ },
    items: { /* same structure */ },
    documents: { /* same structure */ },
    transactions: { /* same structure */ },
    settings: {
      read: Boolean,
      update: Boolean,
      delete: Boolean
    }
  },
  
  // Status
  status: String,                  // 'active' | 'inactive' | 'suspended'
  isOwner: Boolean,                // True for the user who created the org
  
  // Activity
  lastLogin: Date,
  createdAt: Date,
  updatedAt: Date
}

// Helper Methods
setPermissionsByRole(role)         // Auto-assigns permissions based on role
hasPermission(module, action)      // Check if user has specific permission
```

#### 3.1.3 DemoRequest ✅ Implemented (Master DB)
```javascript
{
  _id: ObjectId,
  
  // Company Information
  companyName: String,
  industry: String,
  companySize: String,             // '1-10' | '11-50' | '51-200' | '201-500' | '500+'
  
  // Contact Information
  contactName: String,
  email: String,                   // Unique
  phone: String,
  jobTitle: String,
  
  // Demo Details
  preferredDemoDate: Date,
  timeZone: String,
  message: String,
  
  // Lead Tracking
  status: String,                  // 'pending' | 'contacted' | 'demo_scheduled' | 'demo_completed' | 'converted' | 'rejected'
  source: String,                  // Default: 'website'
  
  // Follow-up
  assignedTo: ObjectId,            // User who handles this request
  notes: String,
  
  // Conversion
  convertedToInstanceId: ObjectId, // Links to InstanceRegistry
  convertedAt: Date,
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}

// Indexes
email: unique
status: 1
createdAt: -1
```

#### 3.1.4 InstanceRegistry 🆕 (Master DB)
```javascript
{
  _id: ObjectId,
  
  // Instance Identification
  instanceName: String,            // "Acme Corporation"
  subdomain: String,               // "acme" → acme.arivu.com (UNIQUE)
  customDomain: String,            // Optional: "crm.acme.com"
  
  // Technical Details
  kubernetesNamespace: String,     // "instance-acme"
  deploymentName: String,          // "arivu-acme"
  serviceName: String,             // "arivu-acme-svc"
  
  // Database
  databaseConnection: {
    host: String,                  // MongoDB host
    port: Number,                  // MongoDB port
    database: String,              // "arivu_acme"
    username: String,              // DB user
    passwordSecret: String         // Kubernetes secret name
  },
  
  // Resources
  resources: {
    cpu: String,                   // "500m" (millicores)
    memory: String,                // "1Gi"
    storage: String,               // "10Gi"
    replicas: Number               // Number of pods (default: 2)
  },
  
  // Status
  status: String,                  // 'provisioning' | 'active' | 'suspended' | 'terminated'
  provisioningStage: String,       // 'database' | 'deployment' | 'dns' | 'ssl' | 'complete'
  healthStatus: String,            // 'healthy' | 'degraded' | 'unhealthy'
  lastHealthCheck: Date,
  
  // Subscription & Billing
  subscription: {
    tier: String,                  // 'trial' | 'starter' | 'professional' | 'enterprise'
    status: String,                // 'trial' | 'active' | 'past_due' | 'canceled'
    trialStartDate: Date,
    trialEndDate: Date,
    currentPeriodStart: Date,
    currentPeriodEnd: Date,
    mrr: Number                    // Monthly Recurring Revenue
  },
  
  // Owner Information (from demo request)
  ownerEmail: String,
  ownerName: String,
  
  // Metrics
  metrics: {
    totalUsers: Number,
    totalContacts: Number,
    totalDeals: Number,
    storageUsedGB: Number,
    apiCallsThisMonth: Number
  },
  
  // Configuration
  config: {
    timezone: String,
    currency: String,
    language: String,
    features: [String],            // Enabled features
    branding: {
      logoUrl: String,
      primaryColor: String,
      companyName: String
    }
  },
  
  // URLs
  urls: {
    frontend: String,              // https://acme.arivu.com
    api: String,                   // https://api-acme.arivu.com
    admin: String                  // Instance admin panel
  },
  
  // Lifecycle
  provisionedAt: Date,
  activatedAt: Date,
  suspendedAt: Date,
  terminatedAt: Date,
  
  // Links
  demoRequestId: ObjectId,         // Original demo request
  
  // Metadata
  createdBy: ObjectId,             // Admin who provisioned
  createdAt: Date,
  updatedAt: Date
}

// Indexes
subdomain: unique
status: 1
'subscription.status': 1
healthStatus: 1
createdAt: -1
```

### 3.2 CRM Modules

#### 3.2.1 Contacts ✅ Implemented
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Information
  firstName: String,
  lastName: String,
  email: String,
  phone: String,
  mobile: String,
  
  // Organization Link
  organizationContactId: ObjectId, // Link to Organization/Company
  jobTitle: String,
  department: String,
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String
  },
  
  // Social & Web
  linkedin: String,
  twitter: String,
  website: String,
  
  // Classification
  type: String,                    // 'lead' | 'customer' | 'vendor' | 'partner'
  status: String,                  // 'active' | 'inactive' | 'do_not_contact'
  source: String,                  // 'website' | 'referral' | 'social' | 'event'
  tags: [String],
  
  // Relationship
  assignedTo: ObjectId,            // User who manages this contact
  
  // Custom Fields
  customFields: Map,               // Flexible schema for custom data
  
  // Activity Tracking
  lastContactedDate: Date,
  notes: String,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.2 Organizations (Companies/Accounts)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,        // Tenant
  
  // Basic Info
  name: String,
  industry: String,
  type: String,                    // 'customer' | 'vendor' | 'partner' | 'competitor'
  
  // Contact Details
  email: String,
  phone: String,
  website: String,
  
  // Address
  billingAddress: { /* same as contact */ },
  shippingAddress: { /* same as contact */ },
  
  // Business Info
  numberOfEmployees: Number,
  annualRevenue: Number,
  taxId: String,
  
  // Relationship
  accountOwner: ObjectId,          // Assigned user
  parentCompany: ObjectId,         // For hierarchies
  
  // Social & Web
  linkedin: String,
  twitter: String,
  
  // Classification
  status: String,                  // 'active' | 'inactive' | 'suspended'
  rating: Number,                  // 1-5 stars
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.3 Deals (Opportunities)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // Relationships
  contactId: ObjectId,
  organizationContactId: ObjectId, // Related company
  assignedTo: ObjectId,
  
  // Deal Details
  value: Number,
  currency: String,
  probability: Number,             // 0-100%
  
  // Pipeline
  stage: String,                   // 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost'
  pipeline: String,                // 'sales' | 'partnership' | custom
  
  // Dates
  expectedCloseDate: Date,
  actualCloseDate: Date,
  
  // Classification
  source: String,
  type: String,                    // 'new_business' | 'existing_business' | 'renewal'
  lostReason: String,
  tags: [String],
  
  // Products/Items
  lineItems: [{
    itemId: ObjectId,
    quantity: Number,
    price: Number,
    discount: Number,
    total: Number
  }],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.4 Projects
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // Relationships
  clientId: ObjectId,              // Organization or Contact
  dealId: ObjectId,                // Related deal
  
  // Team
  projectManager: ObjectId,
  teamMembers: [ObjectId],
  
  // Timeline
  startDate: Date,
  endDate: Date,
  status: String,                  // 'not_started' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
  
  // Budget
  budgetedHours: Number,
  actualHours: Number,
  budgetedCost: Number,
  actualCost: Number,
  
  // Progress
  progressPercentage: Number,
  priority: String,                // 'low' | 'medium' | 'high' | 'urgent'
  
  // Classification
  type: String,
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.5 Tasks
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  title: String,
  description: String,
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization'
    id: ObjectId
  },
  projectId: ObjectId,
  
  // Assignment
  assignedTo: ObjectId,
  assignedBy: ObjectId,
  
  // Status & Priority
  status: String,                  // 'todo' | 'in_progress' | 'waiting' | 'completed' | 'cancelled'
  priority: String,                // 'low' | 'medium' | 'high' | 'urgent'
  
  // Timeline
  dueDate: Date,
  startDate: Date,
  completedDate: Date,
  estimatedHours: Number,
  actualHours: Number,
  
  // Checklist
  subtasks: [{
    title: String,
    completed: Boolean
  }],
  
  // Classification
  tags: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.6 Events (Calendar)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  title: String,
  description: String,
  location: String,
  
  // Type
  type: String,                    // 'meeting' | 'call' | 'email' | 'task' | 'deadline' | 'other'
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization'
    id: ObjectId
  },
  
  // Participants
  organizer: ObjectId,
  attendees: [{
    userId: ObjectId,
    contactId: ObjectId,
    email: String,
    status: String                 // 'pending' | 'accepted' | 'declined' | 'tentative'
  }],
  
  // Timing
  startDateTime: Date,
  endDateTime: Date,
  isAllDay: Boolean,
  timeZone: String,
  
  // Recurrence
  isRecurring: Boolean,
  recurrenceRule: String,          // iCal RRULE format
  
  // Reminders
  reminders: [{
    type: String,                  // 'email' | 'notification' | 'sms'
    minutesBefore: Number
  }],
  
  // Meeting Details
  meetingUrl: String,              // Zoom/Meet link
  conferenceType: String,          // 'zoom' | 'meet' | 'teams'
  
  // Status
  status: String,                  // 'scheduled' | 'completed' | 'cancelled'
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.7 Items (Products/Services)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  sku: String,
  description: String,
  
  // Type
  type: String,                    // 'product' | 'service'
  category: String,
  
  // Pricing
  unitPrice: Number,
  currency: String,
  costPrice: Number,
  taxRate: Number,
  
  // Inventory (for products)
  stockQuantity: Number,
  lowStockThreshold: Number,
  trackInventory: Boolean,
  
  // Service Details (for services)
  billingType: String,             // 'hourly' | 'fixed' | 'recurring'
  defaultDuration: Number,         // In hours
  
  // Status
  isActive: Boolean,
  
  // Media
  images: [String],
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.8 Documents
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  name: String,
  description: String,
  
  // File Details
  fileName: String,
  fileType: String,                // 'pdf' | 'docx' | 'xlsx' | 'image' | etc.
  fileSize: Number,                // In bytes
  fileUrl: String,                 // Cloud storage URL
  
  // Relationships
  relatedTo: {
    type: String,                  // 'contact' | 'deal' | 'project' | 'organization' | 'task'
    id: ObjectId
  },
  
  // Classification
  category: String,                // 'contract' | 'proposal' | 'invoice' | 'report' | 'other'
  tags: [String],
  
  // Version Control
  version: Number,
  previousVersions: [{
    version: Number,
    fileUrl: String,
    uploadedBy: ObjectId,
    uploadedAt: Date
  }],
  
  // Access Control
  isPrivate: Boolean,
  sharedWith: [ObjectId],          // User IDs
  
  // Metadata
  uploadedBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 3.2.9 Transactions (Invoices/Payments)
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Basic Info
  transactionNumber: String,       // Auto-generated
  type: String,                    // 'invoice' | 'payment' | 'credit_note' | 'estimate'
  
  // Relationships
  contactId: ObjectId,
  organizationContactId: ObjectId,
  dealId: ObjectId,
  projectId: ObjectId,
  
  // Financial Details
  lineItems: [{
    itemId: ObjectId,
    description: String,
    quantity: Number,
    unitPrice: Number,
    taxRate: Number,
    discount: Number,
    total: Number
  }],
  
  subtotal: Number,
  taxTotal: Number,
  discountTotal: Number,
  grandTotal: Number,
  currency: String,
  
  // Dates
  issueDate: Date,
  dueDate: Date,
  paidDate: Date,
  
  // Status
  status: String,                  // 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled'
  paymentStatus: String,           // 'pending' | 'partial' | 'paid' | 'refunded'
  
  // Payment Details
  paymentMethod: String,           // 'cash' | 'card' | 'bank_transfer' | 'check'
  paymentReference: String,
  
  // Notes
  notes: String,
  termsAndConditions: String,
  
  // Custom Fields
  customFields: Map,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### 3.3 Supporting Models

#### 3.3.1 Activity Log
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Activity Details
  action: String,                  // 'created' | 'updated' | 'deleted' | 'viewed' | 'sent'
  entityType: String,              // 'contact' | 'deal' | 'task' | etc.
  entityId: ObjectId,
  
  // Changes (for updates)
  changes: [{
    field: String,
    oldValue: Mixed,
    newValue: Mixed
  }],
  
  // User
  userId: ObjectId,
  userName: String,
  
  // Metadata
  ipAddress: String,
  userAgent: String,
  timestamp: Date
}
```

#### 3.3.2 Notes
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Note Content
  content: String,                 // Rich text/HTML
  
  // Relationships
  relatedTo: {
    type: String,
    id: ObjectId
  },
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  isPinned: Boolean
}
```

#### 3.3.3 Custom Fields Definition
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  // Field Definition
  fieldName: String,
  fieldLabel: String,
  fieldType: String,               // 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'multiselect'
  
  // Applied To
  entityType: String,              // 'contact' | 'deal' | 'project' | etc.
  
  // Options (for dropdown/multiselect)
  options: [String],
  
  // Validation
  isRequired: Boolean,
  defaultValue: Mixed,
  
  // Display
  displayOrder: Number,
  isActive: Boolean,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date
}
```

#### 3.3.4 Email Templates
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  subject: String,
  body: String,                    // HTML content with placeholders
  
  // Classification
  category: String,                // 'welcome' | 'follow_up' | 'proposal' | 'invoice'
  
  // Metadata
  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 4. Customer Onboarding System

### 4.1 Demo Request Model ✅ Implemented

**Current Approach:** Qualified lead generation through demo requests

#### 4.1.1 User Journey
1. **Visitor** lands on website → Sees "Request Demo" option
2. Fills out demo request form with:
   - Company information (name, industry, size)
   - Contact details (name, email, phone, job title)
   - Message/requirements
3. **System** creates DemoRequest record with status: 'pending'
4. **Owner/Admin** receives notification (future: email)
5. **Admin** reviews request in Demo Requests dashboard
6. **Admin** can:
   - Update status (contacted, demo_scheduled, demo_completed)
   - Add notes
   - Assign to team member
   - **Convert to Organization** with one click

#### 4.1.2 Conversion Process
When admin clicks "Convert to Organization":
1. Creates Organization with trial subscription (15 days)
2. Creates Owner user account with temporary password
3. Marks demo request as 'converted'
4. Links demo request to new organization
5. Sends welcome email with login credentials (future)

#### 4.1.3 Demo Request Statuses
- `pending` - Just submitted, awaiting contact
- `contacted` - Initial outreach completed
- `demo_scheduled` - Demo meeting scheduled
- `demo_completed` - Demo presented
- `converted` - Successfully converted to paying customer
- `rejected` - Not a good fit

#### 4.1.4 Future Enhancement: Dual Mode
When the company scales, enable both:
- **Demo Request** (for enterprise/high-touch sales)
- **Self-Service Signup** (for SMB/quick onboarding)

Controlled by Organization feature flag or global setting.

---

## 5. Role-Based Access Control (RBAC)

### 5.1 Role Hierarchy
```
Owner > Admin > Manager > User > Viewer
```

### 5.2 Default Role Permissions ✅ Implemented

| Module         | Owner | Admin | Manager | User | Viewer |
|----------------|-------|-------|---------|------|--------|
| Contacts       | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Organizations  | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Deals          | CRUD  | CRUD  | CRUD    | CRU  | R      |
| Projects       | CRUD  | CRUD  | CRU     | CRU  | R      |
| Tasks          | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Events         | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Items          | CRUD  | CRUD  | CRU     | R    | R      |
| Documents      | CRUD  | CRUD  | CRUD    | CRUD | R      |
| Transactions   | CRUD  | CRUD  | CRU     | R    | R      |
| Reports        | All   | All   | Custom  | Own  | None   |
| Settings       | All   | Most  | None    | None | None   |
| User Mgmt      | All   | CRUD  | None    | None | None   |
| Billing        | All   | R     | None    | None | None   |

*C=Create, R=Read, U=Update, D=Delete*

### 5.3 Permission Structure ✅ Implemented
```javascript
permissions: {
  contacts: {
    view: Boolean,
    create: Boolean,
    edit: Boolean,
    delete: Boolean,
    viewAll: Boolean,        // View all vs only assigned
    exportData: Boolean
  },
  deals: { /* same */ },
  // ... for each module
  
  settings: {
    manageUsers: Boolean,
    manageBilling: Boolean,
    manageIntegrations: Boolean,
    customizeFields: Boolean
  },
  
  reports: {
    viewStandard: Boolean,
    viewCustom: Boolean,
    createCustom: Boolean,
    exportReports: Boolean
  }
}
```

---

## 6. Subscription & Billing System

### 6.1 Subscription Tiers ✅ Trial Implemented

| Feature                | Trial (15 days) | Starter     | Professional | Enterprise  |
|------------------------|-----------------|-------------|--------------|-------------|
| Users                  | 3               | 5           | 25           | Unlimited   |
| Contacts               | 100             | 1,000       | 10,000       | Unlimited   |
| Deals                  | 50              | 500         | 5,000        | Unlimited   |
| Projects               | 10              | 50          | 500          | Unlimited   |
| Storage                | 1 GB            | 10 GB       | 100 GB       | 1 TB        |
| Custom Fields          | 5               | 20          | Unlimited    | Unlimited   |
| Form Builder           | ❌              | Basic       | Advanced     | Advanced    |
| Process Designer       | ❌              | ❌          | ✅           | ✅          |
| API Access             | ❌              | Basic       | Full         | Full        |
| Reports                | Basic           | Standard    | Advanced     | Custom      |
| Email Integration      | ❌              | ✅          | ✅           | ✅          |
| Support                | Email           | Email       | Priority     | Dedicated   |
| **Price/Month**        | **Free**        | **$29**     | **$99**      | **Custom**  |

### 6.2 Trial Management ✅ Implemented

```javascript
// Middleware to check trial status
const checkTrialStatus = async (req, res, next) => {
  const org = await Organization.findById(req.user.organizationId);
  
  if (org.subscription.status === 'trial') {
    const now = new Date();
    if (now > org.subscription.trialEndDate) {
      return res.status(403).json({ 
        message: 'Trial expired. Please upgrade to continue.',
        requiresUpgrade: true 
      });
    }
    
    // Calculate days remaining
    const daysLeft = Math.ceil((org.subscription.trialEndDate - now) / (1000 * 60 * 60 * 24));
    res.locals.trialDaysLeft = daysLeft;
  }
  
  next();
};
```

### 6.3 Feature Gating ✅ Implemented

```javascript
// Middleware to check feature access
const checkFeatureAccess = (featureName) => {
  return async (req, res, next) => {
    const org = await Organization.findById(req.user.organizationId);
    
    if (!org.enabledModules.includes(featureName)) {
      return res.status(403).json({ 
        message: `This feature requires ${getRequiredTier(featureName)} plan.`,
        upgradeRequired: true 
      });
    }
    
    next();
  };
};

// Usage:
router.post('/process', protect, checkFeature('process_designer'), createProcess);
```

---

## 7. Advanced Features

### 7.1 Form Builder

#### 7.1.1 Form Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Form Configuration
  targetEntity: String,            // 'contact' | 'lead' | 'custom'
  
  fields: [{
    id: String,
    type: String,                  // 'text' | 'email' | 'number' | 'dropdown' | 'checkbox' | 'file'
    label: String,
    placeholder: String,
    required: Boolean,
    validation: {
      type: String,
      pattern: String,
      min: Number,
      max: Number,
      options: [String]
    },
    order: Number
  }],
  
  // Styling
  theme: {
    primaryColor: String,
    backgroundColor: String,
    fontFamily: String
  },
  
  // Behavior
  submitAction: String,            // 'create_contact' | 'webhook' | 'email_notification'
  redirectUrl: String,
  successMessage: String,
  
  // Notifications
  notifyUsers: [ObjectId],
  emailNotification: Boolean,
  
  // Analytics
  submissionCount: Number,
  conversionRate: Number,
  
  // Status
  isActive: Boolean,
  isPublic: Boolean,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 7.1.2 Form Submissions
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  formId: ObjectId,
  
  // Submitted Data
  data: Map,                       // Key-value pairs of field responses
  
  // Metadata
  submittedAt: Date,
  ipAddress: String,
  userAgent: String,
  
  // Processing
  status: String,                  // 'new' | 'processed' | 'error'
  processedAt: Date,
  createdEntityId: ObjectId        // If it created a contact/lead
}
```

### 7.2 Process Designer (Workflow Automation)

#### 7.2.1 Process Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Trigger
  trigger: {
    type: String,                  // 'record_created' | 'record_updated' | 'field_changed' | 'time_based' | 'webhook'
    entity: String,                // 'contact' | 'deal' | 'task'
    conditions: [{
      field: String,
      operator: String,            // 'equals' | 'contains' | 'greater_than' | 'less_than'
      value: Mixed
    }]
  },
  
  // Workflow Steps
  steps: [{
    id: String,
    type: String,                  // 'send_email' | 'create_task' | 'update_field' | 'webhook' | 'wait' | 'condition'
    order: Number,
    
    config: {
      // For send_email
      templateId: ObjectId,
      to: String,
      cc: String,
      
      // For create_task
      taskTitle: String,
      assignTo: ObjectId,
      dueInDays: Number,
      
      // For update_field
      fieldName: String,
      newValue: Mixed,
      
      // For webhook
      url: String,
      method: String,
      headers: Map,
      
      // For wait
      duration: Number,
      unit: String,                // 'minutes' | 'hours' | 'days'
      
      // For condition
      conditions: Array,
      trueStep: String,
      falseStep: String
    }
  }],
  
  // Status
  isActive: Boolean,
  
  // Analytics
  executionCount: Number,
  successRate: Number,
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

#### 7.2.2 Process Execution Log
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  processId: ObjectId,
  
  // Trigger Info
  triggeredBy: String,             // 'record_created' | 'manual' | 'schedule'
  entityId: ObjectId,
  
  // Execution
  steps: [{
    stepId: String,
    status: String,                // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    startedAt: Date,
    completedAt: Date,
    error: String,
    output: Mixed
  }],
  
  overallStatus: String,           // 'running' | 'completed' | 'failed'
  
  // Metadata
  startedAt: Date,
  completedAt: Date,
  duration: Number                 // In milliseconds
}
```

### 7.3 Report Builder

#### 7.3.1 Report Schema
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  
  name: String,
  description: String,
  
  // Report Configuration
  reportType: String,              // 'sales' | 'activity' | 'funnel' | 'custom'
  entity: String,                  // 'deals' | 'contacts' | 'tasks'
  
  // Filters
  filters: [{
    field: String,
    operator: String,
    value: Mixed
  }],
  
  // Date Range
  dateRange: {
    type: String,                  // 'custom' | 'last_7_days' | 'this_month' | 'this_quarter' | 'this_year'
    startDate: Date,
    endDate: Date
  },
  
  // Grouping & Aggregation
  groupBy: [String],               // ['assignedTo', 'stage']
  metrics: [{
    field: String,
    aggregation: String,           // 'sum' | 'avg' | 'count' | 'min' | 'max'
    label: String
  }],
  
  // Visualization
  chartType: String,               // 'table' | 'bar' | 'line' | 'pie' | 'funnel'
  
  // Sorting
  sortBy: String,
  sortOrder: String,               // 'asc' | 'desc'
  
  // Scheduling
  isScheduled: Boolean,
  schedule: {
    frequency: String,             // 'daily' | 'weekly' | 'monthly'
    recipients: [String],          // Email addresses
    nextRun: Date
  },
  
  // Access
  isPublic: Boolean,
  sharedWith: [ObjectId],
  
  // Metadata
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 8. API Structure

### 8.1 API Versioning
```
Base URL: /api (v1 prefix optional for future versioning)
```

### 8.2 Core Endpoints

#### 8.2.1 Authentication ✅ Implemented
```
POST   /api/auth/register          # Sign up new organization + owner
POST   /api/auth/login             # Login
POST   /api/auth/logout            # Logout
POST   /api/auth/refresh-token     # Refresh JWT (TODO)
POST   /api/auth/forgot-password   # Password reset request (TODO)
POST   /api/auth/reset-password    # Reset password (TODO)
```

#### 8.2.2 Demo Requests ✅ Implemented
```
# Public
POST   /api/demo/request              # Submit demo request

# Protected (Owner/Admin only)
GET    /api/demo/requests             # List all demo requests (with filters)
GET    /api/demo/requests/stats       # Get statistics
GET    /api/demo/requests/:id         # Get single demo request
PATCH  /api/demo/requests/:id         # Update demo request status
POST   /api/demo/requests/:id/convert # Convert demo to organization
DELETE /api/demo/requests/:id         # Delete demo request
```

#### 8.2.3 Organization & Users ✅ Implemented
```
GET    /api/organization              # Get current org details
PUT    /api/organization              # Update org settings
GET    /api/users                     # List all users
POST   /api/users                     # Invite new user
PUT    /api/users/:id                 # Update user role/permissions
DELETE /api/users/:id                 # Deactivate user
```

#### 8.2.4 Subscription
```
GET    /api/v1/subscription           # Get subscription status
POST   /api/v1/subscription/upgrade   # Upgrade plan
POST   /api/v1/subscription/cancel    # Cancel subscription
GET    /api/v1/subscription/invoice   # Get invoices
```

#### 8.2.5 CRM Modules (Standard CRUD pattern)
```
# Contacts
GET    /api/v1/contacts               # List (with pagination, filters, search)
POST   /api/v1/contacts               # Create
GET    /api/v1/contacts/:id           # Get single
PUT    /api/v1/contacts/:id           # Update
DELETE /api/v1/contacts/:id           # Delete
POST   /api/v1/contacts/import        # Bulk import
POST   /api/v1/contacts/export        # Export to CSV

# Organizations, Deals, Projects, Tasks, Events, Items, Documents, Transactions
# Follow same pattern as contacts
```

#### 7.2.5 Advanced Features
```
# Forms
GET    /api/v1/forms
POST   /api/v1/forms
GET    /api/v1/forms/:id
PUT    /api/v1/forms/:id
DELETE /api/v1/forms/:id
POST   /api/v1/forms/:id/submissions  # Public endpoint for form submissions

# Processes
GET    /api/v1/processes
POST   /api/v1/processes
GET    /api/v1/processes/:id
PUT    /api/v1/processes/:id
DELETE /api/v1/processes/:id
POST   /api/v1/processes/:id/execute  # Manually trigger
GET    /api/v1/processes/:id/logs     # Execution history

# Reports
GET    /api/v1/reports
POST   /api/v1/reports
GET    /api/v1/reports/:id
PUT    /api/v1/reports/:id
DELETE /api/v1/reports/:id
POST   /api/v1/reports/:id/run        # Execute report
POST   /api/v1/reports/:id/export     # Export results
```

#### 7.2.6 Activity & Notes
```
GET    /api/v1/activities             # Get activity log
POST   /api/v1/notes                  # Add note
GET    /api/v1/:entity/:id/notes      # Get notes for entity
```

### 7.3 Response Format

#### Success Response
```json
{
  "success": true,
  "data": { /* ... */ },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  }
}
```

---

## 9. Security Considerations

### 9.1 Authentication & Authorization ✅ Implemented
- ✅ JWT tokens with 1-day expiration
- ✅ Refresh tokens with 30-day expiration
- ✅ Password hashing with bcrypt (10+ rounds)
- ✅ Organization isolation middleware
- ✅ Permission-based access control
- ✅ Rate limiting on auth endpoints

### 9.2 Data Security
- ✅ Input validation on all endpoints
- ✅ SQL/NoSQL injection prevention
- ✅ XSS protection
- ✅ CSRF tokens for state-changing operations
- ✅ Encrypted sensitive data at rest
- ✅ HTTPS only in production
- ✅ Regular security audits

### 9.3 Privacy & Compliance
- ✅ GDPR compliance (data export, deletion)
- ✅ Data retention policies
- ✅ Audit logs for sensitive operations
- ✅ Privacy policy & terms of service

---

## 10. Implementation Phases

### Phase 1: Foundation ✅ COMPLETED
**Goal:** Multi-tenancy & RBAC

- [x] Update User model with organizationId and roles
- [x] Create Organization model with subscription
- [x] Implement trial system (15 days)
- [x] Build organization isolation middleware
- [x] Create permission checking system
- [x] Update auth flow to create org on signup
- [x] Build user management (Settings page)
- [x] Implement role assignment UI
- [x] Demo Request system (replacing signup)
- [x] Demo-to-Organization conversion workflow

**Deliverables:** ✅ All Complete
- ✅ Working multi-tenant system
- ✅ Admin can invite users with roles
- ✅ Trial countdown visible in dashboard
- ✅ Demo request form on landing page
- ✅ Admin view for managing demo requests
- ✅ One-click conversion from demo to organization

### Phase 2: Core CRM (Weeks 3-5)
**Goal:** Complete basic CRM modules

- [ ] Contacts (enhance existing)
- [ ] Organizations/Companies
- [ ] Deals pipeline
- [ ] Tasks management
- [ ] Events/Calendar
- [ ] Activity logging
- [ ] Notes system

**Deliverables:**
- Fully functional contact management
- Deal pipeline with stages
- Task assignment and tracking
- Calendar integration

### Phase 3: Project Management (Weeks 6-7)
**Goal:** Project tracking

- [ ] Projects module
- [ ] Items/Products catalog
- [ ] Documents management
- [ ] File upload & storage
- [ ] Project time tracking

**Deliverables:**
- Project creation and management
- Product catalog
- Document repository

### Phase 4: Financial (Weeks 8-9)
**Goal:** Invoicing & payments

- [ ] Transactions model
- [ ] Invoice generation
- [ ] Payment tracking
- [ ] Basic reporting

**Deliverables:**
- Invoice creation & sending
- Payment recording
- Financial reports

### Phase 5: Advanced Features - Part 1 (Weeks 10-11)
**Goal:** Form Builder

- [ ] Form builder UI (drag-drop)
- [ ] Form rendering engine
- [ ] Form submissions handling
- [ ] Form analytics
- [ ] Public form links

**Deliverables:**
- Working form builder
- Embeddable forms
- Submission tracking

### Phase 6: Advanced Features - Part 2 (Weeks 12-13)
**Goal:** Process Designer

- [ ] Visual workflow builder
- [ ] Trigger configuration
- [ ] Action library
  - Send email
  - Create task
  - Update field
  - Webhook call
- [ ] Execution engine
- [ ] Process logs

**Deliverables:**
- Visual workflow designer
- Automated processes
- Execution monitoring

### Phase 7: Reporting (Weeks 14-15)
**Goal:** Report generation

- [ ] Report builder UI
- [ ] Pre-built report templates
  - Sales reports
  - Activity reports
  - Funnel analysis
- [ ] Custom report creation
- [ ] Chart visualizations
- [ ] Export to PDF/Excel
- [ ] Scheduled reports

**Deliverables:**
- Interactive reports
- Export functionality
- Scheduled delivery

### Phase 8: Subscription & Billing (Weeks 16-17)
**Goal:** Monetization

- [ ] Subscription tier enforcement
- [ ] Feature gating
- [ ] Upgrade/downgrade flows
- [ ] Payment integration (Stripe)
- [ ] Billing dashboard
- [ ] Invoice generation
- [ ] Usage tracking

**Deliverables:**
- Working subscription system
- Payment processing
- Billing management

### Phase 9: Polish & Optimization (Weeks 18-20)
**Goal:** Production readiness

- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] Email notifications
- [ ] Search improvements
- [ ] Import/Export functionality
- [ ] API documentation
- [ ] User onboarding flow
- [ ] Help documentation
- [ ] Security audit
- [ ] Load testing

**Deliverables:**
- Production-ready application
- Complete documentation
- Onboarding materials

---

## 11. Technology Stack

### 11.1 Current Stack ✅ Implemented
- **Frontend:** Vue 3 + Vite + Tailwind CSS + Pinia
- **Backend:** Node.js + Express
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT

### 11.2 Additional Libraries Needed

#### Frontend
```json
{
  "vue-router": "^4.x",           // ✅ Already installed
  "pinia": "^2.x",                // ✅ Already installed
  "@vueuse/core": "^10.x",        // Vue composition utilities
  "vue-chartjs": "^5.x",          // Charts for reports
  "chart.js": "^4.x",             // Chart library
  "date-fns": "^2.x",             // Date manipulation
  "vue-draggable-next": "^2.x",   // For form/process builder
  "@tiptap/vue-3": "^2.x",        // Rich text editor
  "vue-advanced-cropper": "^2.x", // Image cropping
  "pdfmake": "^0.x",              // PDF generation
  "xlsx": "^0.x"                  // Excel export
}
```

#### Backend
```json
{
  "express": "^4.x",              // ✅ Already installed
  "mongoose": "^7.x",             // ✅ Already installed
  "bcrypt": "^5.x",               // ✅ Already installed
  "jsonwebtoken": "^9.x",         // ✅ Already installed
  "dotenv": "^16.x",              // ✅ Already installed
  "cors": "^2.x",                 // ✅ Already installed
  "express-validator": "^7.x",    // Input validation
  "express-rate-limit": "^6.x",   // Rate limiting
  "helmet": "^7.x",               // Security headers
  "multer": "^1.x",               // File uploads
  "aws-sdk": "^2.x",              // S3 for file storage
  "nodemailer": "^6.x",           // Email sending
  "node-cron": "^3.x",            // Scheduled tasks
  "stripe": "^12.x",              // Payment processing
  "bull": "^4.x",                 // Job queue for workflows
  "redis": "^4.x",                // Cache & queue backend
  "winston": "^3.x",              // Logging
  "morgan": "^1.x"                // HTTP request logging
}
```

### 11.3 Infrastructure

#### Development
- Node.js v18+
- MongoDB 6.x
- Redis 7.x (for queues & cache)

#### Production (Confirmed Stack)
- **Hosting:** AWS (EC2 or ECS)
- **Database:** MongoDB Atlas
- **File Storage:** AWS S3
- **Email:** AWS SES
- **Payment:** Stripe
- **Caching:** Redis (ElastiCache)
- **CDN:** AWS CloudFront
- **Monitoring:** AWS CloudWatch + Sentry
- **Analytics:** Mixpanel or PostHog

---

## 12. Performance Considerations

### 12.1 Database Optimization
- Indexes on frequently queried fields
  - `organizationId` on all collections
  - `email` on Users and Contacts
  - `status`, `assignedTo`, `createdAt`
- Compound indexes for common queries
- Pagination on all list endpoints (default 20 per page)
- Aggregation pipelines for reports

### 12.2 Caching Strategy
- Redis cache for:
  - User sessions
  - Organization settings
  - Frequently accessed lists
  - Report results (5-minute TTL)
- Cache invalidation on updates

### 12.3 File Management
- Store files in S3/Cloudinary (not MongoDB)
- Generate signed URLs for secure access
- Image optimization and resizing
- CDN for static assets

### 12.4 Background Jobs
- Use Bull + Redis for:
  - Email sending
  - Report generation
  - Process automation
  - Data imports/exports
  - Scheduled tasks

---

## 13. API Rate Limits

| Tier          | Requests/Hour | Burst Limit |
|---------------|---------------|-------------|
| Trial         | 100           | 10/min      |
| Starter       | 1,000         | 50/min      |
| Professional  | 10,000        | 200/min     |
| Enterprise    | Unlimited     | 500/min     |

---

## 14. Testing Strategy

### 14.1 Unit Tests
- Controller functions
- Middleware logic
- Utility functions
- Target: 80% coverage

### 14.2 Integration Tests
- API endpoints
- Database operations
- Authentication flow
- Permission checking

### 14.3 E2E Tests
- Critical user flows:
  - Sign up → Create contact → Create deal
  - User invitation → Role assignment
  - Trial expiry → Upgrade

### 14.4 Load Testing
- 100 concurrent users
- 1000 requests/second
- Database query optimization

---

## 15. Documentation Requirements

### 15.1 User Documentation
- [ ] Getting Started Guide
- [ ] Module-specific tutorials
- [ ] Video walkthroughs
- [ ] FAQ section
- [ ] Best practices

### 15.2 API Documentation
- [ ] Interactive API docs (Swagger/Postman)
- [ ] Authentication guide
- [ ] Webhook documentation
- [ ] Rate limits & errors
- [ ] Code examples (multiple languages)

### 15.3 Developer Documentation
- [ ] Setup instructions
- [ ] Architecture overview
- [ ] Database schema
- [ ] Contributing guidelines
- [ ] Deployment guide

---

## 16. Launch Checklist

### Pre-Launch
- [ ] Security audit completed
- [ ] Load testing passed
- [ ] Backup strategy in place
- [ ] Monitoring & alerts configured
- [ ] Terms of Service & Privacy Policy
- [ ] GDPR compliance verified
- [ ] Payment processing tested
- [ ] Email deliverability tested
- [ ] Error tracking configured
- [ ] Analytics implemented

### Launch Day
- [ ] DNS configured
- [ ] SSL certificate active
- [ ] Production database seeded
- [ ] Environment variables set
- [ ] Monitoring active
- [ ] Support channels ready

### Post-Launch
- [ ] Monitor error rates
- [ ] Track user onboarding
- [ ] Collect feedback
- [ ] Fix critical bugs
- [ ] Optimize based on usage

---

## 17. Future Enhancements (Post-MVP)

### Integrations
- Email (Gmail, Outlook)
- Calendar (Google Calendar, Outlook)
- Communication (Slack, Teams)
- Payment (Stripe, PayPal, Razorpay)
- Storage (Dropbox, Google Drive)
- Marketing (Mailchimp, SendGrid)
- Social (LinkedIn, Facebook)

### Advanced Features
- AI-powered insights
- Predictive analytics
- Lead scoring
- Email tracking & engagement
- Mobile apps (iOS, Android)
- WhatsApp integration
- SMS campaigns
- Advanced workflows (conditional branching)
- Custom dashboards
- White-labeling
- Multi-language support
- Advanced permissions (field-level)

---

## 18. Key Technical Decisions

### 18.1 Why Multi-Tenancy?
- Data isolation per organization
- Easier to manage and scale
- Clear billing boundaries
- Better security

### 18.2 Why JWT?
- Stateless authentication
- Easy to scale horizontally
- Works well with SPA architecture
- Can include user metadata

### 18.3 Why MongoDB?
- Flexible schema for custom fields
- Easy to iterate during development
- Good performance for document-based data
- Built-in aggregation for reports

### 18.4 Why Vue 3?
- ✅ Already in use
- Excellent composition API
- Great TypeScript support
- Rich ecosystem

---

## 19. Estimated Effort

| Phase | Duration | Developer Effort |
|-------|----------|------------------|
| Phase 1: Foundation | 2 weeks | 80 hours |
| Phase 2: Core CRM | 3 weeks | 120 hours |
| Phase 3: Projects | 2 weeks | 80 hours |
| Phase 4: Financial | 2 weeks | 80 hours |
| Phase 5: Form Builder | 2 weeks | 80 hours |
| Phase 6: Process Designer | 2 weeks | 80 hours |
| Phase 7: Reporting | 2 weeks | 80 hours |
| Phase 8: Billing | 2 weeks | 80 hours |
| Phase 9: Polish | 3 weeks | 120 hours |
| **Total** | **20 weeks** | **800 hours** |

*For a team of 2 developers, this is approximately 5 months.*

---

## 20. Success Metrics

### Technical Metrics
- API response time < 200ms (p95)
- Uptime > 99.9%
- Error rate < 0.1%
- Page load time < 2s

### Business Metrics
- Trial-to-paid conversion > 15%
- Monthly active users (MAU) growth
- Feature adoption rates
- Customer satisfaction (NPS > 50)
- Churn rate < 5%

---

## 21. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Strict phase planning, MVP focus |
| Performance issues | Medium | Early load testing, caching strategy |
| Security breach | High | Security audits, penetration testing |
| Data loss | High | Regular backups, disaster recovery plan |
| Payment processing errors | Medium | Thorough testing, fallback mechanisms |
| Third-party API failures | Medium | Circuit breakers, retry logic |

---

## Appendix A: Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database
MONGO_URI=mongodb+srv://...

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1d
REFRESH_TOKEN_SECRET=another-secret
REFRESH_TOKEN_EXPIRES_IN=30d

# Redis
REDIS_URL=redis://...

# AWS S3
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=arivu-files
AWS_REGION=us-east-1

# AWS SES (Email)
AWS_SES_REGION=us-east-1
FROM_EMAIL=noreply@arivu.com
FROM_NAME=Arivu CRM

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend
VITE_API_URL=https://api.arivu.com
VITE_APP_URL=https://app.arivu.com
```

---

## Appendix B: Database Indexes

```javascript
// Users
db.users.createIndex({ organizationId: 1, email: 1 });
db.users.createIndex({ email: 1 }, { unique: true });

// Contacts
db.contacts.createIndex({ organizationId: 1, email: 1 });
db.contacts.createIndex({ organizationId: 1, status: 1 });
db.contacts.createIndex({ organizationId: 1, assignedTo: 1 });
db.contacts.createIndex({ organizationId: 1, createdAt: -1 });

// Deals
db.deals.createIndex({ organizationId: 1, stage: 1 });
db.deals.createIndex({ organizationId: 1, assignedTo: 1 });
db.deals.createIndex({ organizationId: 1, expectedCloseDate: 1 });

// Tasks
db.tasks.createIndex({ organizationId: 1, assignedTo: 1, status: 1 });
db.tasks.createIndex({ organizationId: 1, dueDate: 1 });

// Activity Logs
db.activityLogs.createIndex({ organizationId: 1, entityType: 1, entityId: 1 });
db.activityLogs.createIndex({ organizationId: 1, timestamp: -1 });
```

---

## Conclusion

This technical specification provides a comprehensive roadmap for building Arivu CRM. The phased approach ensures steady progress while maintaining quality. Start with the foundation (multi-tenancy & RBAC), build core CRM features, then add advanced capabilities.

**Next Steps:**
1. Review and approve this specification
2. Set up project management (Jira/Linear/Trello)
3. Begin Phase 1: Foundation
4. Weekly progress reviews

**Technical Stack Decisions (Confirmed):**
- ✅ Payment gateway: **Stripe**
- ✅ File storage: **AWS S3**
- ✅ Email service: **AWS SES**
- ✅ Hosting platform: **AWS**
- ✅ Database: **MongoDB Atlas**

**Outstanding Questions:**
- Budget for third-party services?
- AWS region preference?
- Estimated user base at launch?

---

## Current Implementation Status

### ✅ Completed Features (Phase 1)

**Multi-Tenancy & RBAC**
- Organization model with subscription management
- User model with role-based permissions (Owner, Admin, Manager, User, Viewer)
- Organization isolation middleware
- Permission checking middleware
- Trial system (15-day countdown)
- Feature gating based on subscription tier

**Authentication System**
- User registration with organization creation
- JWT-based authentication
- Password hashing with bcrypt
- Protected route middleware
- Login/logout functionality

**Demo Request System**
- Public demo request form
- Demo request management dashboard (Owner/Admin only)
- Status tracking (pending → contacted → demo_scheduled → demo_completed → converted/rejected)
- One-click conversion to organization with trial
- Statistics dashboard

**User Management**
- Settings page with user management
- Role assignment and permissions
- User invitation system
- Organization details display

**Frontend**
- Landing page with demo request form
- Dashboard with trial countdown
- Settings page with tabs
- Navigation with role-based menu items
- Dark mode support
- Responsive design

### 🔧 Implemented Middleware
- `protect` - JWT authentication
- `organizationIsolation` - Multi-tenant data isolation
- `checkTrialStatus` - Trial expiry enforcement
- `checkFeatureAccess` - Subscription tier gating
- `checkPermission` - RBAC enforcement
- `filterByOwnership` - Data visibility control

### 📊 Current Database Models
- User (with permissions & roles)
- Organization (with subscription & limits)
- Contact (with organization isolation)
- DemoRequest (lead management)
- Process (automation - schema only)

### 🚀 Ready for Phase 2
Next steps: Core CRM modules (Contacts, Organizations/Companies, Deals, Tasks, Events)

---

*Document Version: 2.0*  
*Last Updated: October 22, 2025*  
*Author: Arivu Development Team*  
*Status: Phase 1 Complete ✅ - Demo Request System Live*

