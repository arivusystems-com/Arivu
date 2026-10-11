# MongoDB Setup Guide for Arivu

## Problem: start.sh exits after checking MongoDB setup

This happens when MongoDB is not installed locally and the `.env` file is configured for local MongoDB.

## Quick Solutions

### Option 1: Install MongoDB Locally (Recommended for Development)

#### On macOS:
```bash
# Install MongoDB via Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify it's running
mongosh --eval "db.version()"
```

#### On Ubuntu/Debian:
```bash
# Import MongoDB public key
curl -fsSL https://pgp.mongodb.com/server-6.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-6.0.gpg --dearmor

# Add MongoDB repository
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-6.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Verify it's running
mongosh --eval "db.version()"
```

#### On Windows:
1. Download MongoDB installer from: https://www.mongodb.com/try/download/community
2. Run the installer (choose Complete installation)
3. MongoDB will run as a Windows service automatically

### Option 2: Use MongoDB Atlas (Cloud - Free Tier Available)

1. **Create a free MongoDB Atlas account:**
   - Go to: https://www.mongodb.com/cloud/atlas/register
   - Sign up for free (no credit card required)

2. **Create a cluster:**
   - Choose "Shared" (free tier)
   - Select your preferred region
   - Click "Create Cluster"

3. **Set up database access:**
   - Go to "Database Access" in left menu
   - Click "Add New Database User"
   - Create username and password (save these!)
   - Grant "Read and write to any database" permission

4. **Set up network access:**
   - Go to "Network Access" in left menu
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Or add your specific IP address

5. **Get your connection string:**
   - Go to "Database" → Click "Connect"
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://username:password@cluster.xxxxx.mongodb.net/`)

6. **Update your `.env` file:**
   ```bash
   cd server
   nano .env  # or use your preferred editor
   ```
   
   Replace the `MONGO_URI` with your Atlas connection string:
   ```
   MONGO_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.xxxxx.mongodb.net/arivu?retryWrites=true&w=majority
   ```
   
   **Important:** Replace `YOUR_USERNAME` and `YOUR_PASSWORD` with actual values!

7. **Test the connection:**
   ```bash
   cd server
   node test-connection.js
   ```

## Verify Setup

After installing MongoDB or setting up Atlas, run:

```bash
./start.sh
```

The script will now:
- Detect your MongoDB configuration
- Start services accordingly
- Display helpful messages if there are still issues

## Still Having Issues?

### Check MongoDB Status (Local):

**macOS:**
```bash
brew services list | grep mongodb
```

**Linux:**
```bash
sudo systemctl status mongod
```

**Manual start (if needed):**
```bash
mongod --dbpath ~/data/db
```

### Check Connection String (Atlas):

Make sure your `.env` file has the correct format:
```
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster.xxxxx.mongodb.net/arivu?retryWrites=true&w=majority
```

Common mistakes:
- ❌ Forgot to replace `<password>` placeholder
- ❌ Password contains special characters (needs URL encoding)
- ❌ Wrong database name
- ❌ IP not whitelisted in Atlas

### View Logs:

If backend fails after MongoDB check:
```bash
tail -f backend.log
```

## What Changed in start.sh?

The script now:
1. Better handles missing MongoDB installations
2. Provides clearer error messages with solutions
3. Includes a 30-second timeout for the prompt
4. Shows platform-specific installation instructions
5. Won't exit silently - explains exactly what's wrong

## Need Help?

Check these resources:
- MongoDB Installation: https://docs.mongodb.com/manual/installation/
- MongoDB Atlas Setup: https://docs.atlas.mongodb.com/getting-started/
- Arivu Documentation: See `docs/` folder

