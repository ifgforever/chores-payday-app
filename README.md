# Chores → Payday - Authentication System

A complete authentication system replacing the ADMIN_TOKEN with proper parent/child authentication.

## 🔑 Key Changes from Original

### What Was Removed
- `ADMIN_TOKEN` environment variable (no longer needed)
- Token storage in localStorage
- Bearer token authorization header
- All hardcoded tokens in frontend

### What Was Added
- **Parent accounts** with email/password authentication
- **Child login** with unique codes (no email required!)
- **HttpOnly session cookies** for secure auth
- **Role-based access control** (parent vs child)
- **Rate limiting** on login attempts
- **PIN protection** for children (optional)

## 📁 Project Structure

```
chores-auth/
├── index.html           # Landing page
├── login.html           # Parent login
├── signup.html          # Parent signup
├── parent.html          # Parent dashboard (protected)
├── child-login.html     # Child login (code + optional PIN)
├── child.html           # Child dashboard (protected)
├── schema.sql           # Database migration
├── assets/
│   ├── style.css        # Stylesheet
│   └── app.js           # Frontend JavaScript
└── functions/
    ├── _util.js         # Utility functions (hashing, etc.)
    ├── _auth.js         # Auth middleware
    └── api/
        ├── ping.js
        ├── auth/
        │   ├── signup.js, login.js, logout.js, me.js
        ├── parent/
        │   ├── children.js, chores.js, approvals.js, payday.js
        │   └── children/[id].js, chores/[id].js
        └── child/
            ├── login.js, chores.js, notifications.js
```

## 🗄️ Database Setup

Run the migration:
```bash
wrangler d1 execute YOUR_DB_NAME --file=./schema.sql
```

## 🔒 Security Features

- **PBKDF2** password hashing (100k iterations, SHA-256)
- **HttpOnly cookies** (not accessible to JavaScript)
- **Rate limiting** (5 attempts/15min, 30min lockout)
- **Random child codes** (8 chars, unambiguous)
- **Optional PIN** for children (4-6 digits, hashed)

## 🧪 Testing Checklist

### Parent Auth
- [ ] Signup with email/password works
- [ ] Cannot signup with existing email
- [ ] Login with correct credentials works
- [ ] Wrong password rejected
- [ ] Rate limited after 5 failures
- [ ] Logout clears session
- [ ] Cannot access /parent.html without login

### Child Auth
- [ ] Child created with unique code
- [ ] Child login with code works
- [ ] PIN required if enabled
- [ ] Wrong code/PIN rejected
- [ ] Child cannot access parent pages

### Dashboard
- [ ] Parent can add children/chores
- [ ] Child can view and submit chores
- [ ] Approvals work correctly
- [ ] Payday creates notifications

## 📝 API Endpoints

### Auth
- `POST /api/auth/signup` - Create parent account
- `POST /api/auth/login` - Parent login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Check auth status

### Parent (protected)
- `GET/POST /api/parent/children` - List/create children
- `GET/PUT/DELETE /api/parent/children/[id]` - Manage child
- `GET/POST /api/parent/chores` - List/create chores
- `GET/POST /api/parent/approvals` - View/process approvals
- `POST /api/parent/payday` - Run payday

### Child
- `POST /api/child/login` - Child login
- `GET/POST /api/child/chores` - View/submit chores (protected)
- `GET /api/child/notifications` - View notifications (protected)

## 🔄 Migration Guide

### Remove from old code:
```javascript
// DELETE these from app.js:
function token() { return localStorage.getItem("ADMIN_TOKEN"); }
headers["authorization"] = "Bearer " + token();
```

```html
<!-- DELETE from parent.html: -->
<input id="adminToken" placeholder="ADMIN_TOKEN">
```

### Remove environment variable:
- Delete `ADMIN_TOKEN` from Cloudflare Pages settings

No new env vars needed - auth is database-driven!

## 🚀 Deploy

```bash
wrangler d1 execute chores-db --file=./schema.sql
wrangler pages deploy .
```
