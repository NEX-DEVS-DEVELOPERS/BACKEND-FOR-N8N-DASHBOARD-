# 🚀 Quick Start Guide - n8n Backend

## Prerequisites Checklist

Before starting the backend, you need:

- [  ] **Neon DB Account** - Sign up at [https://neon.tech](https://neon.tech)
- [ ] **Neon DB Connection String** - Get from dashboard after creating a database
- [ ] **Redis Instance** - Local or cloud (e.g., Redis Cloud, Upstash)
- [ ] **n8n Instance** - Running n8n with webhook access

---

## Step 1: Configure Environment

Create `.env` file from template:

```bash
cd backend
copy .env-template .env
```

Edit `.env` and update these **REQUIRED** fields:

```bash
# 🔴 REQUIRED: Get from https://console.neon.tech
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@ep-xxx.region.neon.tech/n8n_dashboard?sslmode=require

# 🔴 REQUIRED: Your Redis connection
REDIS_URL=redis://default:YOUR_PASSWORD@your-redis-host:6379

# 🔴 REQUIRED: Your n8n instance
N8N_BASE_URL=https://your-n8n-instance.com
N8N_WEBHOOK_DOMAIN_WHITELIST=https://your-n8n-instance.com
```

**Optional but recommended:**
- Generate new JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" `
- Update `CORS_ORIGIN` if deploying to production

---

## Step 2: Install Dependencies

```bash
npm install
```

This installs all required packages including eventsource, express, neon-db, redis, etc.

---

## Step 3: Start the Backend

```bash
npm run dev
```

**Expected output:**
```
🚀 Starting n8n Dashboard Backend...
✅ Neon DB connection successful
✅ Database schema initialized successfully
✅ Redis connection successful
✅ Default admin user created: alihasnaat
✅ Server running on http://0.0.0.0:3001
```

---

## Step 4: Test the Backend

### Health Check
```bash
curl http://localhost:3001/api/health
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"alihasnaat\",\"password\":\"password\"}"
```

---

## Common Issues & Solutions

### ❌ "Cannot connect to database"
- Check `DATABASE_URL` format includes `?sslmode=require`
- Verify database exists in Neon dashboard
- Check firewall/IP whitelist

### ❌ "Redis connection failed"
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_URL` format
- For local Redis: `redis://localhost:6379`

### ❌ "Missing dependencies"
- Run `npm install` again
- Check `package.json` exists and is valid
- Delete `node_modules` and reinstall

### ❌ "n8n connectivity unreachable"
- Update `N8N_BASE_URL` with your actual n8n instance
- Ensure n8n is accessible from backend server

---

## Production Deployment Checklist

- [ ] Generate secure `JWT_SECRET`
- [ ] Update `CORS_ORIGIN` with production URLs
- [ ] Set `NODE_ENV=production`
- [ ] Use strong database credentials
- [ ] Enable HTTPS/TLS
- [ ] Configure proper logging
- [ ] Set up monitoring
- [ ] Use environment-specific .env files

---

## Available Scripts

```bash
npm run dev          # Development with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Production server
npm test             # Run tests
npm run lint         # Check code quality
```

---

## API Endpoints

Once running, access the API at `http://localhost:3001/api/`

**Key endpoints:**
- `POST /api/auth/login` - Login
- `GET /api/agents` - Get agents
- `POST /api/agents` - Create agent
- `POST /api/agents/:id/trigger` - Trigger workflow
- `GET /api/sse/stream/:sessionId` - Stream logs
- `GET /api/health` - Health check

Full API documentation in README.md

---

## Next Steps

1. ✅ Configure .env file
2. ✅ Start backend server
3. ✅ Test API endpoints
4. 🔄 Configure frontend to use backend API
5. 🔄 Test end-to-end workflow

---

## Need Help?

- Check `README.md` for detailed documentation
- Review `walkthrough.md` for architecture details
- Check logs in `./logs/` directory
- Ensure all prerequisites are met

**Support:** Create an issue or contact admin@nexdevs.com
