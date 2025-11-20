# 🔐 Your Admin Credentials

## Admin Panel Access

**URL**: `http://localhost:5174/nexdev`  
**Password**: `AdminNexDevs2024!Secure`

## Default User Login

**Username**: `alihasnaat`  
**Password**: `password123`  
**Plan**: Enterprise

---

## Quick .env Configuration

Add these to your `backend/.env` file:

```env
# Admin Panel Password
ADMIN_PANEL_PASSWORD=AdminNexDevs2024!Secure

# Users (your existing user)
USERS=[{"username":"alihasnaat","password":"password123","email":"admin@nexd evs.com","plan":"enterprise"}]

# JWT Secret (generate new one with command below)
JWT_SECRET=6097aebc1c28ff1633da6c0f2c3daa76aaa253c1c6124ecf8223ddfd0e0c19a32

# Auth Rate Limit
AUTH_RATE_LIMIT_MAX_REQUESTS=20
```

---

## Generate New JWT Secret (if needed)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Next Steps

1. ✅ Add the credentials above to `backend/.env`
2. ✅ Restart your backend server
3. ✅ Go to `/nexdev` and login with admin password
4. ✅ Create new users or login with default user

**See `SETUP_GUIDE.md` for complete documentation!**
