# 🌿 FreshSave — Project Setup Guide

Full-stack food waste marketplace.  
**Frontend:** Vanilla HTML/CSS/JS | **Backend:** Node.js + Express | **Database:** Supabase (PostgreSQL)

---

## 📁 Project Structure

```
freshsave/
├── frontend/
│   ├── index.html          ← Main app (all 3 pages: Auth, Marketplace, Admin)
│   ├── css/
│   │   └── styles.css      ← All styles
│   └── js/
│       ├── api.js          ← All API calls to backend (replaces localStorage)
│       └── app.js          ← All UI logic, rendering, admin functions
│
├── backend/
│   ├── server.js           ← Express entry point (run this)
│   ├── package.json        ← npm dependencies
│   ├── .env                ← Your secrets (SUPABASE_URL, JWT_SECRET, etc.)
│   ├── config/
│   │   └── supabase.js     ← Supabase client
│   ├── middleware/
│   │   └── auth.js         ← JWT auth middleware
│   └── routes/
│       ├── auth.js         ← POST /api/auth/login, /signup, GET /me
│       ├── listings.js     ← GET/POST/PATCH/DELETE /api/listings
│       ├── reservations.js ← GET/POST/PATCH /api/reservations
│       ├── users.js        ← GET/PATCH/DELETE /api/users (admin)
│       ├── reports.js      ← GET/POST/PATCH /api/reports
│       └── admin.js        ← GET /api/admin/stats, notifications, log
│
└── supabase/
    ├── schema.sql          ← Run first: creates all tables + RLS
    └── seed.sql            ← Run second: adds demo data
```

---

## 🚀 Step-by-Step Setup

### 1. Supabase Database

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Open **SQL Editor** → paste and run `supabase/schema.sql`
3. Run `supabase/seed.sql` to add demo data
4. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY`

### 2. Backend (Node.js)

```bash
cd backend
npm install
```

Edit `.env` and fill in your values:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
JWT_SECRET=any-long-random-string-here
PORT=4000
CLIENT_ORIGIN=http://localhost:5500
```

Start the backend:
```bash
# Development (auto-restarts on save):
npm run dev

# Production:
npm start
```

You should see:
```
✅ FreshSave backend running on http://localhost:4000
```

### 3. Frontend

Open `frontend/index.html` with **VS Code Live Server** (port 5500 by default).

> ⚠️ You must use Live Server or another local server — not just opening the file directly. This is because the JS fetches from `http://localhost:4000` and browsers block this from `file://` origins.

**Install Live Server in VS Code:**  
Extensions → search "Live Server" by Ritwick Dey → Install  
Then right-click `index.html` → **Open with Live Server**

---

## 🔑 Default Login Credentials

| Role   | Email                    | Password   |
|--------|--------------------------|------------|
| Admin  | admin@freshsave.com      | admin123   |
| Buyer  | maria@email.com          | pass123    |
| Buyer  | juan@email.com           | pass123    |
| Seller | sweetcrumb@email.com     | pass123    |

> Note: The seed.sql file does NOT hash passwords — you need to update them after running seed.
> Run this in SQL Editor to hash the demo passwords (using bcrypt rounds=12):
> OR just register fresh accounts via the Sign Up page — those will be properly hashed.

---

## 🌐 API Endpoints

| Method | Path                          | Auth     | Description                  |
|--------|-------------------------------|----------|------------------------------|
| POST   | /api/auth/login               | —        | Login, returns JWT           |
| POST   | /api/auth/signup              | —        | Register new user            |
| GET    | /api/auth/me                  | User     | Get current user             |
| GET    | /api/listings                 | —        | Public: approved listings    |
| GET    | /api/listings/all             | Admin    | All listings (any status)    |
| POST   | /api/listings                 | Seller   | Create listing               |
| PATCH  | /api/listings/:id             | Auth     | Edit listing                 |
| PATCH  | /api/listings/:id/approve     | Admin    | Approve listing              |
| PATCH  | /api/listings/:id/reject      | Admin    | Reject listing               |
| PATCH  | /api/listings/:id/feature     | Admin    | Feature/unfeature listing    |
| DELETE | /api/listings/:id             | Admin    | Delete listing               |
| POST   | /api/reservations             | Buyer    | Reserve item                 |
| GET    | /api/reservations/mine        | Buyer    | My orders                    |
| GET    | /api/reservations             | Admin    | All orders                   |
| PATCH  | /api/reservations/:id/pickup  | Admin    | Mark picked up               |
| PATCH  | /api/reservations/:id/cancel  | Admin    | Cancel order                 |
| PATCH  | /api/reservations/:id/dispute | Admin    | Flag dispute                 |
| PATCH  | /api/reservations/:id/resolve | Admin    | Resolve dispute              |
| GET    | /api/users                    | Admin    | All users                    |
| PATCH  | /api/users/:id                | Admin    | Edit user                    |
| PATCH  | /api/users/:id/suspend        | Admin    | Suspend user                 |
| PATCH  | /api/users/:id/restore        | Admin    | Restore user                 |
| DELETE | /api/users/:id                | Admin    | Delete user                  |
| PATCH  | /api/users/:id/verify         | Admin    | Verify seller                |
| GET    | /api/reports                  | Admin    | All reports                  |
| POST   | /api/reports                  | Buyer    | Submit report                |
| PATCH  | /api/reports/:id/resolve      | Admin    | Resolve report               |
| PATCH  | /api/reports/:id/warn         | Admin    | Warn seller                  |
| GET    | /api/admin/stats              | Admin    | Dashboard stats              |
| GET    | /api/admin/notifications      | Admin    | Sent notifications           |
| POST   | /api/admin/notifications      | Admin    | Send notification            |
| GET    | /api/admin/log                | Admin    | Security log                 |

---

## 🚢 Deploying to Production

**Backend options:** Railway, Render, Fly.io, Heroku  
**Frontend options:** Netlify, Vercel, GitHub Pages

When deploying:
1. Set environment variables on your host (same as `.env`)
2. Update `CLIENT_ORIGIN` in `.env` to your frontend's real URL
3. Update `API_BASE` in `frontend/js/api.js` from `http://localhost:4000/api` to your backend URL

---

## 🔧 Tech Stack

| Layer     | Technology              |
|-----------|-------------------------|
| Frontend  | HTML5, CSS3, Vanilla JS |
| Backend   | Node.js, Express        |
| Database  | Supabase (PostgreSQL)   |
| Auth      | JWT (jsonwebtoken)      |
| Passwords | bcryptjs                |
