# 🚀 Developer Setup Guide

Welcome to Arivu! This guide will help you get the application running on your local machine.

---

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20.19+ or v22.12+)
- **npm** (comes with Node.js)
- **MongoDB** (v6.0+)
- **Git**

---

## 🛠️ Quick Start (5 Minutes)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/Arivu.git
cd Arivu
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Setup MongoDB

**Mac:**
```bash
brew services start mongodb-community
```

**Linux:**
```bash
sudo systemctl start mongod
```

**Windows:**
- Start MongoDB service from Services panel

**Verify MongoDB is running:**
```bash
mongosh
# Should connect successfully
# Type 'exit' to exit
```

### 4. Configure Environment Variables

```bash
cd server
cp .env.example .env
```

**Edit `server/.env`** with your settings:

```env
# Server
PORT=3000

# Database
MONGO_URI=mongodb://localhost:27017/arivu

# JWT Secrets (change these!)
JWT_SECRET=your-super-secret-jwt-key-change-me
REFRESH_TOKEN_SECRET=your-super-secret-refresh-token-change-me

# Master API Key (for system operations)
MASTER_API_KEY=your-master-api-key-change-me

# Development Mode
NODE_ENV=development
ENABLE_HEALTH_CHECKER=false
ENABLE_METRICS_COLLECTOR=false

# Optional: Email (for later)
# AWS_SES_REGION=us-east-1
# AWS_SES_SENDER_EMAIL=noreply@yourdomain.com
# ENABLE_EMAIL_NOTIFICATIONS=false
```

### 5. Create Default Admin Account

This is **IMPORTANT** - creates your first admin user:

```bash
cd server
node scripts/createDefaultAdmin.js
```

You'll see:

```
============================================================
🎉 DEFAULT ADMIN ACCOUNT CREATED SUCCESSFULLY!
============================================================

📝 LOGIN CREDENTIALS:

   Email:    admin@arivu.com
   Password: Admin@123

⚠️  SECURITY WARNING:
   Please change this password immediately after first login!

============================================================
```

**Save these credentials!** You'll need them to login.

### 6. Start the Application

Open **TWO terminals**:

**Terminal 1 - Backend:**
```bash
cd server
npm start
# OR
node server.js

# You should see:
# ✅ MongoDB connected successfully
# ✅ Server running on http://localhost:3000
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev

# You should see:
# ➜  Local:   http://localhost:5173/
```

### 7. Login

1. Open browser: `http://localhost:5173`
2. Click **"Admin Login"** tab
3. Login with:
   - **Email:** `admin@arivu.com`
   - **Password:** `Admin@123`
4. 🎉 You're in!

---

## 🧪 Verify Everything Works

### Test 1: Dashboard
- Should see the dashboard with charts and stats

### Test 2: Create a Contact
- Go to **Contacts** → **New Contact**
- Fill in details and save
- Should appear in the contacts list

### Test 3: Submit Demo Request
1. Open incognito window: `http://localhost:5173`
2. Fill out "Request for Demo" form
3. Submit
4. Go back to admin → **Demo Requests**
5. Should see your demo request!

---

## 🔧 Useful Commands

### Backend

```bash
cd server

# Start server
node server.js

# Check database
node scripts/checkData.js

# Reset database (⚠️ DELETES ALL DATA)
node scripts/resetDatabase.js

# Create admin again
node scripts/createDefaultAdmin.js

# Check instances
node scripts/checkInstances.js
```

### Frontend

```bash
cd client

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## 📁 Project Structure

```
Arivu/
├── client/              # Vue.js frontend
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── views/       # Page components
│   │   ├── stores/      # Pinia state management
│   │   ├── router/      # Vue Router
│   │   └── utils/       # Utilities (apiClient)
│   └── package.json
│
├── server/              # Node.js/Express backend
│   ├── controllers/     # Request handlers
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── middleware/      # Auth, permissions, etc.
│   ├── scripts/         # Utility scripts
│   └── package.json
│
└── Documentation files
```

---

## 🐛 Troubleshooting

### Issue: MongoDB Connection Error

**Error:** `MongoServerError: Authentication failed`

**Solution:**
- For local development, remove auth from `MONGO_URI`:
  ```env
  MONGO_URI=mongodb://localhost:27017/arivu
  ```

### Issue: Port Already in Use

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:**
```bash
# Find and kill process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port in .env
PORT=3001
```

### Issue: Cannot Login

**Solution:**
1. Make sure you created the default admin:
   ```bash
   cd server
   node scripts/createDefaultAdmin.js
   ```
2. Use correct credentials: `admin@arivu.com` / `Admin@123`
3. Check backend is running (Terminal 1)
4. Clear browser cache and try again

### Issue: Blank Page After Login

**Solution:**
- Hard refresh: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + F5` (Windows)
- Clear cache completely
- Make sure both backend and frontend are running

### Issue: Frontend Shows "Failed to fetch"

**Solution:**
1. Check backend is running on `http://localhost:3000`
2. Check MongoDB is running
3. Check browser console for errors
4. Verify `.env` file exists in `server/`

---

## 🔐 Default Accounts

After running `createDefaultAdmin.js`, you'll have:

| Email | Password | Role | Organization |
|-------|----------|------|--------------|
| admin@arivu.com | Admin@123 | Owner | Arivu Master |

**⚠️ IMPORTANT:** Change this password immediately after first login!

Go to **Settings** → **Update Password**

---

## 🎯 What to Build First

Once logged in, try:

1. **Create Contacts** - Add some test contacts
2. **Create Deals** - Link deals to contacts
3. **Submit Demo Requests** - Test the public form
4. **View Organizations** - See all organizations
5. **Explore Dashboard** - Check out the analytics

---

## 📚 Additional Resources

- **Technical Spec:** See `TECHNICAL_SPEC.md`
- **API Documentation:** Check `server/routes/` for endpoints
- **Multi-instance:** See [MULTI_INSTANCE_STATUS.md](./MULTI_INSTANCE_STATUS.md)

---

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Look at console logs (backend terminal)
3. Check browser console (F12)
4. Review the scripts in `server/scripts/`

---

## 🎉 You're All Set!

Happy coding! 🚀

If you encounter any issues, check the troubleshooting section or create an issue on GitHub.

