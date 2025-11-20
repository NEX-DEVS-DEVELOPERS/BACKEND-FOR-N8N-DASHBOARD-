# 📋 Complete Configuration Guide - n8n Backend

## Overview

This guide provides **step-by-step** instructions to configure, optimize, and deploy your scalable n8n backend.

---

## Part 1: What the Backend Handles

### ✅ Backend Responsibilities

| Feature | Frontend (localStorage) | Backend (API) | Why Backend? |
|---------|------------------------|---------------|--------------|
| **Authentication** | ❌ Basic session | ✅ JWT tokens | Secure, server-side validation |
| **Agent CRUD** | ❌ Client storage | ✅ PostgreSQL | Multi-device sync, persistence |
| **Webhook Proxy** | ❌ Direct calls | ✅ Validated proxy | Security, rate limiting |
| **SSE Streaming** | ❌ Direct n8n | ✅ Aggregated proxy | Connection pooling, monitoring |
| **Support Requests** | ❌ localStorage | ✅ Database + n8n | Rate limiting, analytics |
| **Dashboard Stats** | ❌ Calculated | ✅ Cached aggregates | Performance, real-time |
| **Form Submissions** | ❌ N/A | ✅ DB + n8n webhooks | Persistence, workflows |

### ❌ Frontend-Only (No Backend Needed)

- **Chatbot**: Direct Gemini API integration
- **UI State**: Theme, modals, animations
- **Page Navigation**: React Router state

---

## Part 2: Step-by-Step Configuration

### Step 1: Get Neon DB Credentials (5 minutes)

```bash
# 1. Go to https://console.neon.tech
# 2. Sign up (free tier available)
# 3. Click "Create Project"
# 4. Wait 30 seconds for provisioning
# 5. Click "Connection Details"
#    6. Copy the connection string - looks like:
#    postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Example:**
```
postgresql://neondb_owner:abc123xyz@ep-cool-forest-12345.us-east-2.aws.neon.tech/neondb?sslmode=require
```

### Step 2: Get Redis URL (Choose One Option)

#### Option A: Local Redis (Development)
```bash
# Install Redis for Windows
# Download from: https://github.com/microsoftarchive/redis/releases

# After installation, Redis URL:
REDIS_URL=redis://localhost:6379
```

#### Option B: Cloud Redis - Upstash (Production - FREE)
```bash
# 1. Go to https://upstash.com
# 2. Sign up (GitHub/Google)
# 3. Click "Create Database"
# 4. Choose region closest to you
# 5. Copy "Redis URL" from dashboard

# Example:
REDIS_URL=redis://default:abc123xyz@us1-example-12345.upstash.io:6379
```

#### Option C: Redis Cloud (Alternative FREE)
```bash
# 1. Go to https://redis.com/try-free/
# 2. Create account
# 3. Create free database (30MB)
# 4. Copy connection string
```

### Step 3: Configure .env File

Open `.env` in backend folder and update these **3 critical values**:

```bash
# File: backend/.env

# 1. DATABASE (from Step 1)
DATABASE_URL=postgresql://YOUR_CREDENTIALS_HERE

# 2. REDIS (from Step 2)
REDIS_URL=redis://YOUR_REDIS_URL_HERE

# 3. N8N Instance
N8N_BASE_URL=https://your-n8n-instance.com
N8N_WEBHOOK_DOMAIN_WHITELIST=https://your-n8n-instance.com

# 4. (Optional but recommended) Generate new JWT secret
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=YOUR_GENERATED_SECRET_HERE
```

### Step 4: Install Dependencies
```bash
cd backend
npm install
```

#### Expected Output:
```
added 196 packages in 45s
found 0 vulnerabilities
```

### Step 5: Start the Server
```bash
npm run dev
```

#### ✅ Success Output:
```
🚀 Starting n8n Dashboard Backend...
Testing Neon DB connection...
✅ Neon DB connection successful
Initializing database schema...
✅ Database schema initialized successfully
Testing Redis connection...
✅ Redis connection successful
✅ Default admin user created: alihasnaat
✅ Server running on http://0.0.0.0:3001
Environment: development
```

#### ❌ Common Errors & Fixes:

**Error:** "Cannot connect to database"
```bash
# Fix: Check DATABASE_URL format
# Must have ?sslmode=require at the end
DATABASE_URL=postgresql://...?sslmode=require
```

**Error:** "Redis connection failed"
```bash
# Fix Option 1: Start local Redis
redis-server

# Fix Option 2: Use cloud Redis URL from Upstash
```

**Error:** "Invalid JWT_SECRET"
```bash
# Fix: Generate proper secret (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Paste output into JWT_SECRET in .env
```

### Step 6: Test the Backend

```bash
# Health check
curl http://localhost:3001/api/health

# Expected response:
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  ...
}

# Test login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alihasnaat","password":"password"}'

# Expected: JWT token in response
```

---

## Part 3: Production Optimizations

### Add Performance Dependencies

```bash
npm install --save compression rate-limiter-flexible ws
npm install --save-dev @types/compression
```

### Update .env for Production

```bash
# .env (production values)
NODE_ENV=production
PORT=3001

# Performance
RATE_LIMIT_MAX_REQUESTS=1000  # Increase from 100

# Logging
LOG_LEVEL=warn  # Less verbose

# CORS (your production domains)
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

---

## Part 4: Scalability Checklist

### ✅ Basic Features (Already Included)
- [x] Connection pooling (Neon DB)
- [x] Redis caching
- [x] Rate limiting
- [x] Input validation
- [x] Error handling
- [x] Health checks

### 🚀 Advanced Optimizations (Scalability Plan)
- [ ] Distributed rate limiting (rate-limiter-flexible)
- [ ] Response compression (gzip)
- [ ] Database indexing optimizations
- [ ] Prometheus metrics
- [ ] Load balancer (Nginx)
- [ ] Docker containers
- [ ] Horizontal scaling (3+ instances)

---

## Part 5: Frontend Integration

### Update Frontend to Use Backend API

**1. Create API client** (`frontend/services/api.ts`):

```typescript
const API_BASE = 'http://localhost:3001/api';

export const api = {
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    return res.json();
  },

  async getAgents(token: string) {
    const res = await fetch(`${API_BASE}/agents`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  },

  async createAgent(token: string, agent: any) {
    const res = await fetch(`${API_BASE}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(agent)
    });
    return res.json();
  },

  async triggerAgent(token: string, agentId: string) {
    const res = await fetch(`${API_BASE}/agents/${agentId}/trigger`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    return res.json();
  },

  // SSE connection for logs
  streamLogs(token: string, sessionId: string) {
    return new EventSource(
      `${API_BASE}/sse/stream/${sessionId}?token=${token}`
    );
  }
};
```

**2. Update App.tsx** to use API instead of localStorage:

```typescript
// OLD (localStorage):
const storedAgents = localStorage.getItem('n8n-agents');

// NEW (API):
const { data: { agents } } = await api.getAgents(token);
setAgents(agents);
```

---

## Part 6: Deployment

### Option A: Cloud Deployment (Easiest)

**Railway.app (FREE tier):**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Deploy
cd backend
railway init
railway up

# 4. Add environment variables in Railway dashboard
# DATABASE_URL, REDIS_URL, JWT_SECRET, etc.
```

**Render.com (FREE tier):**
1. Connect GitHub repo
2. Select `backend` folder
3. Set build command: `npm install && npm run build`
4. Set start command: `npm start`
5. Add environment variables

### Option B: VPS Deployment

```bash
# Install Node.js, PM2, Nginx
sudo apt update
sudo apt install nodejs npm nginx

npm install -g pm2

# Clone repo and install
git clone your-repo
cd backend
npm install
npm run build

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Part 7: Monitoring

### Check Backend Status

```bash
# Health check
curl http://localhost:3001/api/health

# View logs
pm2 logs

# Monitor performance
pm2 monit
```

### Metrics Dashboard

```bash
# Access Prometheus metrics
curl http://localhost:3001/metrics
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Start production | `npm start` |
| View logs | Check `logs/` directory |
| Health check | `GET /api/health` |
| Test login | See Step 6 above |

---

## Support

- **Setup Issues**: See SETUP-REQUIRED.md
- **Scalability**: See scalability_plan.md
- **API Docs**: See README.md
- **Architecture**: See walkthrough.md

**Next Step**: After configuration, start the backend and begin frontend integration!
