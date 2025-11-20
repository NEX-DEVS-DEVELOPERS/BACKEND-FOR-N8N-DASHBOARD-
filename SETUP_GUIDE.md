# Complete Backend .env Configuration Guide

## Generated Secure Credentials

**Admin Panel Password** (for /nexdev access):
```
AdminNexDevs2024!Secure
```

**JWT Secret** (for token signing):
```
[Generate using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"]
```

---

## Complete .env File Template

Copy this to your `backend/.env` file and replace the placeholder values:

```env
# ==============================================
# N8N DASHBOARD BACKEND CONFIGURATION
# ==============================================

# ----------------------------------------------
# SERVER CONFIGURATION
# ----------------------------------------------
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# ----------------------------------------------
# DATABASE - NEON DB (Serverless PostgreSQL)
# ----------------------------------------------
# Get your connection string from: https://neon.tech
DATABASE_URL=postgresql://user:password@ep-xxx-xxx.us-east-2.aws.neon.tech/n8n_dashboard?sslmode=require

# ----------------------------------------------
# AUTHENTICATION & SECURITY
# ----------------------------------------------
# Generate a secure JWT secret with:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-generated-jwt-secret-here
JWT_EXPIRES_IN=12h
JWT_REFRESH_EXPIRES_IN=7d

# bcrypt password hashing rounds (10-12 recommended)
BCRYPT_ROUNDS=12

# ----------------------------------------------
# USERS CONFIGURATION
# ----------------------------------------------
# Define users as a JSON array. Each user object should have:
# - username: string (required)
# - password: string (required, min 8 characters)
# - email: string (optional)
# - plan: string (optional, defaults to 'free'. Options: 'free', 'pro', 'enterprise')
#
# Example with multiple users:
USERS=[{"username":"alihasnaat","password":"password123","email":"admin@nexdevs.com","plan":"enterprise"}]

# Admin Panel Password - Required to access /nexdev user management page
ADMIN_PANEL_PASSWORD=AdminNexDevs2024!Secure

# ----------------------------------------------
# N8N CONFIGURATION
# ----------------------------------------------
# Your n8n instance base URL
N8N_BASE_URL=https://your-n8n-instance.com

# n8n API key (if using n8n API endpoints)
N8N_API_KEY=your-n8n-api-key

# Allowed webhook domains (comma-separated for security)
N8N_WEBHOOK_DOMAIN_WHITELIST=https://your-n8n-instance.com,https://n8n.nexdevs.com

# ----------------------------------------------
# EMAIL SERVICE (Optional - for form notifications)
# ----------------------------------------------
# SMTP configuration for sending emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Email addresses for notifications
SUPPORT_EMAIL_ALI=ali@nexdevs.com
SUPPORT_EMAIL_HASSAM_FAIZAN=support@nexdevs.com
SUPPORT_EMAIL_MUDASSIR_USMAN=tech@nexdevs.com

# ----------------------------------------------
# CORS & SECURITY
# ----------------------------------------------
# Allowed origins for CORS (comma-separated)
CORS_ORIGIN=http://localhost:5174,https://yourdomain.com

# Allowed IP addresses (comma-separated, or * for all)
ALLOWED_IPS=*

# ----------------------------------------------
# RATE LIMITING
# ----------------------------------------------
# General API rate limit
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Auth endpoint rate limit (INCREASED TO 20)
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX_REQUESTS=20

# Form submission rate limit
FORM_RATE_LIMIT_WINDOW_MS=3600000
FORM_RATE_LIMIT_MAX_REQUESTS=10

# ----------------------------------------------
# LOGGING
# ----------------------------------------------
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# ----------------------------------------------
# FRONTEND URL
# ----------------------------------------------
FRONTEND_URL=http://localhost:5174

# ----------------------------------------------
# OPTIONAL: WEBHOOK SECRET FOR VERIFICATION
# ----------------------------------------------
# Shared secret with n8n for webhook signature verification
WEBHOOK_SECRET=your-webhook-secret-key
```

---

## Quick Setup Steps

### 1. **Update Your .env File**
- Copy the template above
- Replace `DATABASE_URL` with your Neon DB connection string
- Generate a JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Use the admin password: `AdminNexDevs2024!Secure`
- Update `N8N_BASE_URL` with your n8n instance URL

### 2. **Restart the Backend**
```bash
# Stop current server (Ctrl+C in terminal)
# Start again
npm run dev
```

### 3. **Verify User Sync**
Check the backend logs for:
```
✅ User created from environment variables: { username: 'alihasnaat' }
✅ Synced 1 user(s) from environment variables
```

### 4. **Access Admin Panel**
1. Go to `http://localhost:5174/nexdev`
2. Enter admin password: `AdminNexDevs2024!Secure`
3. Create new users via the form

### 5. **Login with User Credentials**
- Username: `alihasnaat`
- Password: `password123`

---

## Adding Multiple Users

To add more users to the `.env`:

```env
USERS=[{"username":"alihasnaat","password":"password123","email":"admin@nexdevs.com","plan":"enterprise"},{"username":"john","password":"john12345","email":"john@example.com","plan":"pro"},{"username":"jane","password":"jane12345","email":"jane@example.com","plan":"free"}]
```

**Important**: Use a JSON minifier/validator to ensure the JSON is valid on a single line.

---

## Security Recommendations

1. **Change passwords** before deploying to production
2. **Use strong JWT secret** (64+ characters recommended)
3. **Enable HTTPS** in production
4. **Restrict CORS_ORIGIN** to your actual domain
5. **Use environment-specific .env files** (.env.development, .env.production)
6. **Never commit .env** to version control (already in .gitignore)

---

## Troubleshooting

### Issue: "Invalid admin password"
- Check `.env` file has `ADMIN_PANEL_PASSWORD=AdminNexDevs2024!Secure`
- Restart backend after changing .env
- Clear browser cache/session storage

### Issue: "Invalid username or password" on login
- Verify user exists in `USERS` array
- Check backend logs for user sync messages
- Ensure backend restarted after .env changes

### Issue: JWT Errors
- Generate a new JWT_SECRET
- Must be at least 32 characters
- Restart backend after changing

---

## Current Configuration Summary

✅ Admin Panel Password: `AdminNexDevs2024!Secure`  
✅ Default User: `alihasnaat` / `password123` (enterprise plan)  
✅ Admin Panel URL: `http://localhost:5174/nexdev`  
✅ Auth Rate Limit: 20 requests per 15 minutes  
✅ Multi-user support via .env USERS array  
✅ Plan defaults to 'free' for new users  
