# 🚀 Getting Started with Arivu

Welcome to Arivu! This guide will help you get your multi-instance CRM platform up and running.

---

## 📋 What You Have

You now have a complete, production-ready multi-instance CRM platform with:

✅ **Multi-instance architecture** - Each customer gets their own isolated instance  
✅ **Automated provisioning** - One-click deployment of new customer instances  
✅ **Instance management dashboard** - Monitor and manage all instances  
✅ **Health monitoring** - Automated health checks every 5 minutes  
✅ **Metrics collection** - Track usage and analytics  
✅ **CI/CD pipelines** - Automated builds and deployments  
✅ **Docker containers** - Ready for deployment anywhere  
✅ **Kubernetes Helm charts** - Production-grade orchestration  
✅ **Complete documentation** - Technical specs, deployment guides, and more  

---

## 🎯 Choose Your Path

### Path 1: Local Development & Testing (Fastest) ⚡

**Perfect for:** Testing, development, learning how it works

```bash
# 1. Start everything with Docker Compose
cd /Users/Prabhu/Documents/GitHub/Arivu
docker-compose up -d

# 2. Access the application
# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
# MongoDB:  localhost:27017

# 3. Create your first account
# Go to http://localhost:5173 and register
# This will create your organization and make you the Owner

# 4. Submit a demo request (from landing page)
# Then login and convert it to an instance

# 5. View your instances at /instances
```

**Time to get started:** 5 minutes ⏱️

---

### Path 2: AWS Production Deployment (Recommended for Real Use) 🌐

**Perfect for:** Production deployment, real customers

Follow these steps in order:

#### Step 1: Install Dependencies (10 minutes)

```bash
cd /Users/Prabhu/Documents/GitHub/Arivu/server
npm install @kubernetes/client-node aws-sdk bull redis yaml axios
```

#### Step 2: Set Up AWS Infrastructure (1-2 days)

Follow the [production deployment runbook](ARIVU_PRODUCTION_DEPLOYMENT.md) for:

1. ☁️ Create AWS EKS cluster
2. 🔧 Install ingress-nginx controller
3. 🔒 Install cert-manager (SSL)
4. 🌐 Configure Route 53 DNS
5. 📦 Build and push Docker images
6. 🚀 Deploy with Helm

#### Step 3: Configure Environment Variables (15 minutes)

```bash
cd server
cp .env.example .env
nano .env  # Update with your values
```

**Critical variables to set:**
- `MONGO_URI` - Your MongoDB connection string
- `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`
- `ROUTE53_HOSTED_ZONE_ID`
- `BASE_DOMAIN` (e.g., `arivu.com`)
- `JWT_SECRET` & `REFRESH_TOKEN_SECRET`

#### Step 4: Test Instance Provisioning (30 minutes)

1. Access your deployed master control plane
2. Register as the first user (becomes Owner)
3. Submit a demo request
4. Convert it to an organization
5. Watch the magic happen! ✨

---

## 📚 Essential Documentation

Before you begin, familiarize yourself with these documents:

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[README.md](../README.md)** | Project overview and quick start | Start here! |
| **[TECHNICAL_SPEC.md](TECHNICAL_SPEC.md)** | Complete technical specification | Understanding the system |
| **[MULTI_INSTANCE_STATUS.md](MULTI_INSTANCE_STATUS.md)** | Multi-instance provisioning status | Building features |
| **[ARIVU_PRODUCTION_DEPLOYMENT.md](ARIVU_PRODUCTION_DEPLOYMENT.md)** | Production deployment runbook | Going to production |

---

## 🛠️ Common Tasks

### Start Local Development
```bash
# Backend
cd server
npm install
npm start

# Frontend (in new terminal)
cd client
npm install
npm run dev
```

### Build Docker Images
```bash
# Backend
docker build -f Dockerfile.backend -t arivu-backend:latest .

# Frontend
docker build -f Dockerfile.frontend -t arivu-frontend:latest .
```

### Test Kubernetes Deployment (Local)
```bash
# Validate Helm chart
helm lint ./helm/arivu

# Dry run
helm install arivu-test ./helm/arivu --dry-run --debug

# Deploy to local Kubernetes
helm install arivu-local ./helm/arivu
```

### View Logs
```bash
# Local (Docker Compose)
docker-compose logs -f

# Kubernetes
kubectl logs -n arivu-master -l app=arivu-backend -f
```

---

## 🔍 Testing Your Setup

### 1. Health Check
```bash
# Local
curl http://localhost:3000/health

# Production
curl https://app.yourdomain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-22T...",
  "service": "Arivu Master Control Plane",
  "database": {
    "connected": true,
    "state": "connected"
  }
}
```

### 2. System Status
```bash
curl http://localhost:3000/health/status
```

### 3. Frontend Access
Open your browser and navigate to:
- Local: `http://localhost:5173`
- Production: `https://app.yourdomain.com`

---

## 🎓 Learning Path

**Day 1: Understand the Architecture**
- Read `README.md`
- Review `TECHNICAL_SPEC.md` architecture section
- Explore the codebase structure

**Day 2: Local Development**
- Set up local environment with Docker Compose
- Create an account and explore the UI
- Submit and convert a demo request

**Day 3: Code Deep Dive**
- Study `server/models/InstanceRegistry.js`
- Review `server/services/provisioning/instanceProvisioner.js`
- Understand the provisioning workflow

**Day 4-5: AWS Setup**
- Follow `docs/ARIVU_PRODUCTION_DEPLOYMENT.md`
- Set up AWS infrastructure
- Deploy to production

**Day 6: Testing & Monitoring**
- Test instance provisioning end-to-end
- Set up monitoring and alerts
- Configure CI/CD pipelines

---

## 🆘 Troubleshooting

### Issue: Docker Compose won't start
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :5173
lsof -i :27017

# Kill conflicting processes
# Or change ports in docker-compose.yml
```

### Issue: MongoDB connection error
```bash
# Ensure MongoDB is running
docker-compose ps

# Check MongoDB logs
docker-compose logs mongodb

# Verify connection string in .env
```

### Issue: Frontend can't reach backend
```bash
# Check proxy configuration in client/vite.config.js
# Ensure backend is running on port 3000
curl http://localhost:3000/health
```

### Issue: Kubernetes deployment fails
```bash
# Check pod status
kubectl get pods -n arivu-master

# View pod logs
kubectl logs <pod-name> -n arivu-master

# Describe pod for events
kubectl describe pod <pod-name> -n arivu-master
```

---

## 📊 What Happens When You Convert a Demo?

Here's the complete flow:

1. **Admin clicks "Convert to Organization"** in Demo Requests dashboard
2. **Backend receives request** → `POST /api/demo/:id/convert`
3. **Instance Provisioner starts** working asynchronously
4. **Database Manager** creates a dedicated MongoDB database
5. **Kubernetes Manager** deploys containers (frontend, backend, MongoDB)
6. **DNS Manager** creates subdomain in Route 53
7. **SSL Certificate** is auto-provisioned by cert-manager
8. **Instance becomes active** and accessible at `https://customer.yourdomain.com`
9. **Customer receives email** with login credentials (when email is configured)
10. **Health checks begin** automatically monitoring the new instance

**Total time:** 5-10 minutes ⏱️

---

## 🎯 Next Steps

### Immediate (Today)
- [ ] Choose your path (Local or Production)
- [ ] Set up environment
- [ ] Create your first account
- [ ] Test demo conversion

### Short Term (This Week)
- [ ] Deploy to AWS (if going production)
- [ ] Configure monitoring
- [ ] Set up CI/CD
- [ ] Test instance provisioning end-to-end

### Medium Term (This Month)
- [ ] Integrate Stripe for payments
- [ ] Set up email notifications
- [ ] Add custom domain support
- [ ] Implement advanced analytics

### Long Term (This Quarter)
- [ ] Launch to first customers
- [ ] Gather feedback
- [ ] Iterate on features
- [ ] Scale infrastructure

---

## 💡 Pro Tips

1. **Start local first** - Understand how everything works before deploying to production
2. **Read the error logs** - Most issues have clear error messages in logs
3. **Use health checks** - Monitor `/health` and `/health/status` regularly
4. **Backup regularly** - Set up automated backups for MongoDB
5. **Scale gradually** - Start with small instance sizes, scale as needed
6. **Monitor costs** - Use AWS Cost Explorer to track spending
7. **Test in staging** - Always test major changes in a staging environment first

---

## 🎉 You're Ready!

You have everything you need to:
- ✅ Run a complete CRM locally
- ✅ Deploy to production on AWS
- ✅ Provision new customer instances automatically
- ✅ Monitor and manage all instances
- ✅ Scale as you grow

**This is an enterprise-grade, production-ready system!** 🚀

---

## 📞 Need Help?

- 📖 Check the documentation files
- 🐛 Create an issue on GitHub
- 💬 Join our Discord community
- ✉️ Email: support@arivu.com

---

**Let's build something amazing! 🎊**

