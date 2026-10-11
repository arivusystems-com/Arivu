# 🚀 Arivu - Multi-Instance CRM Platform

> **Enterprise-grade, white-label CRM with automated multi-instance architecture**

Arivu is a modern CRM platform built on a unique multi-instance architecture where each customer gets their own isolated application instance with dedicated database, subdomain, and independent scaling.

## 🔒 Security-First Development

**⚠️ CRITICAL: Security is the TOP PRIORITY for all development work**

- 📖 **[Security Guidelines](docs/security/SECURITY_GUIDELINES.md)** - Comprehensive security best practices
- ✅ **[Security Checklist](.github/SECURITY_CHECKLIST.md)** - PR security review checklist  
- 🚀 **[Quick Reference](docs/security/SECURITY_QUICK_REFERENCE.md)** - Security patterns cheat sheet
- 🚨 **[Incident Response Plan](docs/security/INCIDENT_RESPONSE_PLAN.md)** - Security incident runbook

**All developers must review security guidelines before writing code.**

---

## ✨ Features

### 🏢 Multi-Instance Architecture
- **Complete Isolation:** Each customer gets a dedicated application instance
- **Dedicated Database:** Separate MongoDB database per customer
- **Custom Subdomains:** Automatic subdomain provisioning (e.g., `acme.arivu.com`)
- **Independent Scaling:** Scale each customer instance independently
- **White-Label Ready:** Full customization per instance

### 🎯 Core CRM Features
- **Contact Management:** Organize and manage customer contacts
- **Deal Pipeline:** Visual sales pipeline with drag-and-drop
- **Task Management:** Track activities and follow-ups
- **Internal Tabs Navigation:** Multi-tasking with browser-like tabs for records and modules
- **Role-Based Access Control:** 5-tier permission system (Owner, Admin, Manager, User, Viewer)
- **Multi-Tenancy:** Organization-based data isolation
- **Subscription Management:** Built-in trial and subscription system

### 🔧 Admin Features
- **Demo Request System:** Capture and qualify leads
- **Instance Provisioning:** One-click conversion to full instance
- **Instance Management Dashboard:** Monitor all customer instances
- **Health Monitoring:** Automated health checks every 5 minutes
- **Metrics Collection:** Usage tracking and analytics
- **Subscription Management:** Manage tiers and billing

### 🛡️ Security & Compliance
- **JWT Authentication:** Secure token-based auth
- **Database-Level Isolation:** Complete data separation
- **Encrypted Connections:** SSL/TLS everywhere
- **RBAC:** Granular permission control
- **Audit Logging:** Track all user actions

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  Master Control Plane                        │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  Frontend  │  │   Backend    │  │  Master MongoDB  │    │
│  │  (Vue.js)  │  │  (Node.js)   │  │                  │    │
│  └────────────┘  └──────────────┘  └──────────────────┘    │
│         │                │                      │            │
│         └────────────────┴──────────────────────┘            │
│                          │                                   │
│         ┌────────────────────────────────┐                  │
│         │   Instance Provisioner         │                  │
│         │   - Kubernetes Manager         │                  │
│         │   - Database Manager           │                  │
│         │   - DNS Manager                │                  │
│         └────────────────────────────────┘                  │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │        Kubernetes Cluster            │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 1        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - acme.arivu.com        │    │
        │  └─────────────────────────────┘    │
        │                                      │
        │  ┌─────────────────────────────┐    │
        │  │  Customer Instance 2        │    │
        │  │  - Frontend (Nginx)         │    │
        │  │  - Backend (Node.js)        │    │
        │  │  - MongoDB                  │    │
        │  │  - corp.arivu.com        │    │
        │  └─────────────────────────────┘    │
        └──────────────────────────────────────┘
```

---

## 🚀 Quick Start

**New Developer?** → See **[Quick Start](docs/QUICK_START.md)** for 5-minute setup!

**Detailed Setup?** → See **[Developer setup](docs/DEVELOPER_SETUP.md)** for complete guide!

### Prerequisites
- Node.js 20.19+ or 22.12+
- MongoDB 6.0+
- npm (comes with Node.js)

### TL;DR - Get Running in 5 Minutes

```bash
# 1. Clone
git clone https://github.com/yourusername/arivu.git
cd arivu

# 2. Install
cd server && npm install
cd ../client && npm install

# 3. Setup MongoDB & .env
brew services start mongodb-community  # Mac
cd server && cp .env.example .env
# Edit .env: Set JWT_SECRET, REFRESH_TOKEN_SECRET, MASTER_API_KEY

# 4. Create Admin Account
node scripts/createDefaultAdmin.js

# 5. Start (2 terminals)
# Terminal 1: cd server && npm start
# Terminal 2: cd client && npm run dev

# 6. Login at http://localhost:5173
# Email: admin@arivu.com
# Password: Admin@123
```

**That's it!** 🎉 You're ready to start developing.

### For Production Deployment

See **[Production deployment](docs/ARIVU_PRODUCTION_DEPLOYMENT.md)** for the current hosting runbook (Vercel + Railway + Atlas).

---

## 📚 Documentation

### Getting Started
- **[Quick Start Guide](docs/QUICK_START.md)** - Get running in 5 minutes ⚡
- **[Developer Setup Guide](docs/DEVELOPER_SETUP.md)** - Complete developer onboarding 📖
- **[Getting Started](docs/GETTING_STARTED.md)** - Platform walkthrough and common tasks
- **[MongoDB Setup Guide](docs/MONGODB_SETUP_GUIDE.md)** - MongoDB installation and configuration 🗄️
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and fixes

### People and OrganizationV2 (New Models)

The app uses People (replaces legacy Contact) and OrganizationV2 by default.

- Server endpoints
  - People: `/api/people`
  - Organization v2: `/api/v2/organization`
  - CSV aliases: people endpoints available under `/api/csv/*` alongside contacts (compat)

- Feature flags (defaults in `server/server.js`; override via env):
  - `FEATURE_CONTACTS_USE_PEOPLE=true`
  - `FEATURE_READ_THROUGH_PEOPLE=true`
  - `FEATURE_ORG_USE_V2=true`
  - `FEATURE_READ_THROUGH_ORG=true`

- Client
  - Navigate People at `/people` (old `/contacts` redirects)
  - Org refresh uses `/api/v2/organization`

- Notes
  - Permissions still use module key `contacts`; middleware aliases `people → contacts`.
  - CSV import/export retains `contacts` naming; `/people` aliases added.

Quick verify
1) node server/scripts/createDefaultAdmin.js
2) node server/scripts/seedPeopleAndOrgV2.js
3) GET /api/people, POST /api/people
4) GET /api/v2/organization, PUT /api/organization
5) Frontend: open /people
6) CSV: GET /api/csv/export/people

### Email Integration 📧
- **[AWS SES Setup Guide](docs/AWS_SES_SETUP_GUIDE.md)** - Complete SES implementation walkthrough
- **[Email Service Comparison](docs/EMAIL_SERVICE_COMPARISON.md)** - SES vs SendGrid vs Mailgun
- **[Email Implementation Checklist](docs/EMAIL_IMPLEMENTATION_CHECKLIST.md)** - 8-phase task breakdown
- **[Email Quick Reference](docs/EMAIL_QUICK_REFERENCE.md)** - Commands, costs, troubleshooting

### User Interface & Navigation
- **[Tabs Quick Reference](docs/TABS_QUICK_REFERENCE.md)** - Developer guide for tabs integration

### Technical Documentation  
- **[Architecture Document](docs/Architecture_Document.md)** - Platform architecture source of truth
- **[Technical Specification](docs/TECHNICAL_SPEC.md)** - Complete technical details
- **[Automation Testing Catalog](docs/testing/Automation_Testing.md)** - Test case catalog used by ATP
- **[Multi-instance status](docs/MULTI_INSTANCE_STATUS.md)** - Provisioning status and architecture notes
- **[Production deployment](docs/ARIVU_PRODUCTION_DEPLOYMENT.md)** - Vercel, Railway, Atlas, and related runbooks

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Database:** MongoDB 7.0
- **Authentication:** JWT + bcrypt
- **Cloud SDK:** AWS SDK (S3, SES, Route 53)
- **Kubernetes:** @kubernetes/client-node
- **Queue:** Bull + Redis (optional)

### Frontend
- **Framework:** Vue.js 3 (Composition API)
- **State Management:** Pinia
- **Routing:** Vue Router
- **Styling:** Tailwind CSS
- **UI Components:** Headless UI

### Infrastructure
- **Containerization:** Docker
- **Hosting:** OCI VM instance pools (API + Worker) behind an OCI load balancer
- **Web Server:** Nginx
- **SSL:** cert-manager + Let's Encrypt
- **DNS:** AWS Route 53
- **Storage:** AWS S3
- **Email:** AWS SES

### CI/CD
- **GitHub Actions** - Tests, i18n gates, Docker build check, scheduled health monitoring
- Production deployment is **manual** (no deploy workflow)

---

## 🚢 Deployment

### Production Deployment to OCI

Production runs on OCI VMs. Deployment is manual; no GitHub Actions workflow deploys production.

- Provisioning and release procedure: [OCI_VM_DEPLOYMENT.md](docs/OCI_VM_DEPLOYMENT.md) (section 18, "Deploy a later release")
- Overview and smoke tests: [production deployment runbook](docs/ARIVU_PRODUCTION_DEPLOYMENT.md)

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

```bash
# Server
PORT=3000
NODE_ENV=production

# Database
MONGO_URI=your_mongodb_connection_string

# Authentication
JWT_SECRET=your_jwt_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret

# AWS
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
ROUTE53_HOSTED_ZONE_ID=your_hosted_zone_id
BASE_DOMAIN=arivu.com

# Kubernetes
KUBECONFIG_PATH=/path/to/kubeconfig
INGRESS_LOADBALANCER_DNS=your-loadbalancer-dns

# Monitoring (optional)
ENABLE_HEALTH_CHECKER=true
ENABLE_METRICS_COLLECTOR=true
```

---

## 📊 Project Structure

```
arivu/
├── server/                          # Backend Node.js application
│   ├── models/                      # Mongoose models
│   │   ├── User.js
│   │   ├── Organization.js
│   │   ├── People.js
│   │   ├── DemoRequest.js
│   │   └── InstanceRegistry.js      # Multi-instance registry
│   ├── controllers/                 # Request handlers
│   ├── routes/                      # API routes
│   ├── middleware/                  # Auth, RBAC, etc.
│   ├── services/                    # Business logic
│   │   ├── provisioning/            # Instance provisioning
│   │   │   ├── instanceProvisioner.js
│   │   │   ├── managers/            # K8s, DB, DNS managers
│   │   │   └── utils/
│   │   └── monitoring/              # Health checks, metrics
│   └── server.js                    # Entry point
├── client/                          # Frontend Vue.js application
│   ├── src/
│   │   ├── components/              # Reusable components
│   │   ├── views/                   # Page components
│   │   │   ├── Dashboard.vue
│   │   │   ├── DemoRequests.vue
│   │   │   └── InstanceManagement.vue
│   │   ├── stores/                  # Pinia stores
│   │   ├── router/                  # Vue Router
│   │   └── utils/                   # Utilities
│   └── vite.config.js
├── helm/                            # Kubernetes Helm charts
│   └── arivu/
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/               # K8s resource templates
├── .github/
│   └── workflows/                   # GitHub Actions CI (no production deploy)
│       ├── test.yml
│       └── monitoring.yml
├── Dockerfile.backend               # Backend container
├── Dockerfile.frontend              # Frontend container
├── docker-compose.yml               # Local development
├── nginx.conf                       # Nginx configuration
└── README.md                        # This file
```

---

## 🧪 Testing

```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd client
npm test

# Test Docker builds
docker-compose up --build

# Test Kubernetes deployment (local)
helm install arivu-test ./helm/arivu --dry-run --debug
```

---

## 📈 Monitoring

### Health Checks
- **Master Control Plane:** `https://your-domain.com/health`
- **System Status:** `https://your-domain.com/health/status`
- **Automated checks:** Every 5 minutes

### Metrics
- **Instance Dashboard:** View in admin UI `/instances`
- **Aggregated Metrics:** API endpoint `/api/metrics/aggregated`
- **Collection frequency:** Every 15 minutes

### Logs
```bash
# Master control plane logs
kubectl logs -n arivu-master -l app=arivu-backend -f

# Customer instance logs
kubectl logs -n arivu-{customer-slug} -l app=arivu-backend -f
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- Code follows existing style guidelines
- All tests pass
- Documentation is updated
- No linter errors

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🆘 Support

- **Documentation:** [docs.arivu.com](https://docs.arivu.com)
- **Issues:** [GitHub Issues](https://github.com/yourusername/arivu/issues)
- **Email:** support@arivu.com
- **Community:** [Discord](https://discord.gg/arivu)

---

## 🎯 Roadmap

### ✅ Completed
- [x] Multi-tenant CRM with RBAC
- [x] Demo request system
- [x] Multi-instance architecture
- [x] Automated provisioning
- [x] Instance management dashboard
- [x] Health monitoring
- [x] Metrics collection
- [x] Docker containerization
- [x] Kubernetes Helm charts
- [x] CI/CD pipelines

### 🚧 In Progress
- [ ] Stripe payment integration
- [ ] Email automation (trial reminders, etc.)
- [ ] Custom domain support

### 📅 Planned
- [ ] Advanced analytics dashboard
- [ ] API rate limiting per instance
- [ ] Automated backups
- [ ] Instance cloning/templates
- [ ] Multi-region support
- [ ] Mobile app
- [ ] Webhooks
- [ ] Integration marketplace

---

## 🙏 Acknowledgments

- Built with ❤️ using modern web technologies
- Inspired by enterprise SaaS best practices
- Community-driven and open-source

---

## 📞 Contact

**Project Maintainer:** Your Name
- Website: [arivu.com](https://arivusystems.com)
- Email: hello@arivusystems.com
- Twitter: [@arivu](https://twitter.com/arivu)

---

**⭐ Star this repo if you find it helpful!**

**Made with 💙 by developers, for developers**
