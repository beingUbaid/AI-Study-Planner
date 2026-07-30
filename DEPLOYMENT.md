# 🚀 Deployment Guide — AI Study Planner

This guide covers deploying the AI Study Planner to a production environment.  
The recommended architecture is **free/low-cost** and uses managed services that handle infrastructure automatically.

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     PUBLIC INTERNET                       │
└────────┬──────────────────────────────────────┬──────────┘
         │                                       │
    ┌────▼────────────┐              ┌────────────▼──────────┐
    │  Vercel          │              │  Render (or Railway)  │
    │  React SPA       │◄────────────►│  Express API          │
    │  (free tier)     │   REST/JSON  │  Port 5000            │
    └─────────────────┘              └────────────┬──────────┘
                                                  │
                                     ┌────────────▼──────────┐
                                     │  Render (or Railway)  │
                                     │  Background Worker    │
                                     │  node worker.js       │
                                     └────────────┬──────────┘
                                                  │ Mongoose
                                     ┌────────────▼──────────┐
                                     │  MongoDB Atlas         │
                                     │  Free M0 Tier         │
                                     └──────────────────────┘
```

> [!IMPORTANT]
> The **API** and **Worker** must be separate services but share the same `MONGO_URI`.  
> The Worker must **not** be scaled to multiple instances unless you verify distributed lock behavior.

---

## Step 1 — MongoDB Atlas

1. Create a free account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a **free M0 cluster** in your nearest region
3. Under **Database Access**: create a user with read/write on your database
4. Under **Network Access**: allow access from `0.0.0.0/0` (or restrict to Render/Railway IPs)
5. Click **Connect → Connect your application** and copy the connection string:
   ```
   mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/studyplanner?retryWrites=true&w=majority
   ```
6. Save this as `MONGO_URI` — you'll need it for both the API and Worker services

---

## Step 2 — Backend API (Render)

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect your GitHub repository and select the `Ai-study-planner` directory  
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci`
   - **Start Command**: `node index.js`
   - **Node Version**: `20`
3. Add all environment variables (see table below)
4. Note your service URL: `https://your-api.onrender.com`

### Health Check
Set Render's health check path to: `/health`

---

## Step 3 — Background Worker (Render)

1. **New Background Worker** (not a Web Service)
2. Same repository, same root directory `backend`
   - **Build Command**: `npm ci`
   - **Start Command**: `node worker.js`
   - **Node Version**: `20`
3. Use the **same environment variables** as the API (MONGO_URI, JWT secrets, GROQ_API_KEY, EMAIL_*)
4. Do **not** expose a public port

---

## Step 4 — Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **New Project** → Import from GitHub
2. Set the **Root Directory** to `frontend`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`
5. Add environment variable:
   ```
   VITE_API_URL = https://your-api.onrender.com/api
   ```
6. Note your frontend URL: `https://your-app.vercel.app`
7. The `vercel.json` in the repo already handles SPA routing rewrites

---

## Step 5 — Back-fill API Environment Variables

After getting your Vercel frontend URL, go back to the Render API service and add/update:

```
CLIENT_URL     = https://your-app.vercel.app
ALLOWED_ORIGINS = https://your-app.vercel.app
```

If you have a Google OAuth credential with `ENABLE_GOOGLE_OAUTH=true`:
```
GOOGLE_CALLBACK_URL = https://your-api.onrender.com/api/auth/google/callback
```

---

## Environment Variables Reference

### API Service (Required)

| Variable | Example | Notes |
|----------|---------|-------|
| `NODE_ENV` | `production` | Must be `production` on Render |
| `PORT` | `5000` | Render sets this automatically — set anyway |
| `MONGO_URI` | `mongodb+srv://...` | Atlas connection string |
| `JWT_SECRET` | 32+ random chars | Use `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | 32+ random chars | Different from JWT_SECRET |
| `GROQ_API_KEY` | `gsk_...` | From [console.groq.com](https://console.groq.com) |
| `CLIENT_URL` | `https://app.vercel.app` | Your Vercel URL |
| `ALLOWED_ORIGINS` | `https://app.vercel.app` | Comma-separated for multiple |
| `APP_VERSION` | `1.0.0` | Used by `/version` endpoint |

### API Service (Optional)

| Variable | Default | Notes |
|----------|---------|-------|
| `AI_MODEL` | `llama-3.1-8b-instant` | Groq model name |
| `AI_INPUT_COST_1M` | `0.05` | Cost estimate per 1M input tokens |
| `AI_OUTPUT_COST_1M` | `0.08` | Cost estimate per 1M output tokens |
| `ENABLE_EMAIL` | `true` | Set `false` to disable SMTP |
| `ENABLE_GOOGLE_OAUTH` | `false` | Set `true` to enable Google login |
| `COOKIE_DOMAIN` | (unset) | For cross-subdomain cookies only |
| `EMAIL_USER` | — | Gmail address for SMTP |
| `EMAIL_PASS` | — | [Gmail App Password](https://myaccount.google.com/apppasswords) (16 chars) |
| `GOOGLE_CLIENT_ID` | — | Google OAuth credential |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth credential |
| `GOOGLE_CALLBACK_URL` | — | `https://api.onrender.com/api/auth/google/callback` |

### Worker Service

Use the same variables as API **except** `PORT`, `CLIENT_URL`, `ALLOWED_ORIGINS`.  
The Worker needs: `MONGO_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `GROQ_API_KEY`, `EMAIL_*`, `ENABLE_EMAIL`, `AI_MODEL`.

### Frontend Service (Vercel)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://your-api.onrender.com/api` |

---

## Generating Secure Secrets

Run this on your local machine (Linux/Mac/WSL):
```bash
openssl rand -hex 32   # generates a 64-char hex string
```

Or using Node.js:
```javascript
require('crypto').randomBytes(32).toString('hex')
```

---

## Smoke Test After Deployment

```bash
# 1. Check API liveness
curl https://your-api.onrender.com/health
# → {"status":"UP","timestamp":"..."}

# 2. Check database connection
curl https://your-api.onrender.com/ready
# → {"status":"READY","database":"connected"}

# 3. Check version
curl https://your-api.onrender.com/version
# → {"version":"1.0.0"}

# 4. Verify CORS (from frontend origin)
curl -H "Origin: https://your-app.vercel.app" https://your-api.onrender.com/health
# → Response should include Access-Control-Allow-Origin header

# 5. Try protected endpoint without auth
curl https://your-api.onrender.com/api/subjects
# → 401 Unauthorized

# 6. Navigate to your Vercel URL
# → App loads, login works, dashboard visible
```

---

## Secret Rotation

If any secret was ever committed to a public repository:
1. **Immediately revoke** it at the source (Groq console, Google Cloud console, Gmail app passwords)
2. Generate new values with `openssl rand -hex 32`
3. Update Render and Vercel environment variables
4. Restart the API and Worker services
5. Force all users to re-login (delete all RefreshToken records in MongoDB)

---

## Database Indexes

These indexes are created automatically by Mongoose at startup. Do not drop them:

| Collection | Index | Purpose |
|-----------|-------|---------|
| `users` | `{ email: 1 }` unique | Fast login lookup |
| `subjects` | `{ user: 1, name: 1 }` unique | Prevent duplicate subjects |
| `subjects` | `{ user: 1, examDate: 1 }` | Calendar queries |
| `chapters` | `{ subject: 1, order: 1 }` | Ordered syllabus display |
| `refreshtokens` | `{ tokenHash: 1 }` unique | O(1) token lookup |
| `refreshtokens` | `{ familyId: 1 }` | Family revocation |
| `refreshtokens` | `{ expiresAt: 1 }` TTL | Auto-cleanup expired tokens |
| `locks` | `{ key: 1 }` unique | Distributed cron locking |
| `locks` | `{ expireAt: 1 }` TTL | Auto-release stale locks |
| `notificationdeliveries` | `{ user, subject, task, reminderType, scheduledDate }` unique | Idempotent delivery |
| `notificationdeliveries` | `{ status, nextRetryAt }` | Retry queries |

---

## Backup Recommendations

- Enable **MongoDB Atlas automated backups** (free tier: no point-in-time, paid: daily snapshots)
- For production: upgrade to M10+ for continuous backups and point-in-time restore
- Export critical data weekly: `mongodump --uri="$MONGO_URI" --out=backup-$(date +%Y%m%d)`

---

## Rollback

1. In Render: go to **Deploys** → click any past deploy → **Rollback to this deploy**
2. In Vercel: go to **Deployments** → click any past deployment → **Promote to Production**
3. If a database migration was involved: restore from Atlas backup before rollback

---

## Log Retention

- Render Free tier: 7 days of log streaming
- For longer retention: add a log drain to Papertrail, Datadog, or Logtail
- Logs are structured JSON in production — easy to parse and alert on
