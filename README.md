# 🎓 AI Study Planner

<div align="center">

[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB?logo=react&logoColor=white&style=for-the-badge)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express%20%7C%20MongoDB-339933?logo=nodedotjs&logoColor=white&style=for-the-badge)](https://nodejs.org)
[![Groq AI](https://img.shields.io/badge/AI-Groq%20Llama%203.1-purple?logo=meta&logoColor=white&style=for-the-badge)](https://groq.com)
[![CI](https://img.shields.io/github/actions/workflow/status/beingUbaid/AI-Study-Planner/ci.yml?style=for-the-badge&label=CI)](https://github.com/beingUbaid/AI-Study-Planner/actions)

**An adaptive AI-powered study platform that converts unstructured course syllabi into optimized, spaced-repetition study schedules.**

[🚀 View Demo](https://github.com/beingUbaid/AI-Study-Planner) · [📖 Deployment Guide](./DEPLOYMENT.md)

</div>

---

## 📖 Overview

AI Study Planner helps students convert disorganized course materials into structured study plans through two distinct layers:

1. **Deterministic Scheduling Engine** — A pure-logic engine implementing Leitner spaced repetition, topological chapter dependency sorting, burnout guardrails and exam-proximity compression. This layer never calls an LLM and produces reproducible, testable schedules.

2. **LLM Assistance Layer (Groq)** — Used only for natural-language tasks: extracting chapter titles from uploaded PDFs, generating flashcards/quizzes, powering the study chatbot and writing schedule explanations. All LLM outputs are validated by strict Zod schemas with automatic retry-and-feedback loops.

---

## 🏗️ Architecture

```
┌─────────────────────┐     HTTPS     ┌──────────────────────┐
│   React 19 SPA      │◄─────────────►│   Express API        │
│   (Vite / Vercel)   │               │   (Node 20 / Render) │
└─────────────────────┘               └──────────┬───────────┘
                                                 │ Mongoose
                                      ┌──────────▼───────────┐
                                      │   MongoDB Atlas       │
                                      │   (shared database)   │
                                      └──────────┬───────────┘
                                                 │ Mongoose
                                      ┌──────────▼───────────┐
                                      │   Background Worker  │
                                      │   (Render / Railway) │
                                      └──────────────────────┘
```

The **API** and **Worker** are separate Node processes sharing the same MongoDB database.  
The Worker runs node-cron jobs for daily exam reminders using distributed DB locks and idempotent `NotificationDelivery` records.

---

## ✨ Features

| Category | Feature |
|----------|---------|
| **Scheduling** | Leitner Box spaced repetition, prerequisite topological sort, burnout detection, break day insertion |
| **AI** | PDF syllabus extraction, adaptive flashcards, interactive quizzes, study chatbot with auto-rebalance |
| **Auth** | Email verification, bcrypt passwords, hashed refresh token families (RTR), account lockout |
| **Reminders** | Daily exam reminders via SMTP with distributed locks and idempotent delivery |
| **Security** | Helmet CSP, CORS allowlist, NoSQL sanitization, rate limiting, magic-byte PDF validation |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS, React Router v7 |
| Backend | Node.js 20, Express 5, Mongoose 9, Winston |
| Database | MongoDB Atlas (production), mongodb-memory-server (tests) |
| AI | Groq SDK (`llama-3.1-8b-instant`), Zod response validation |
| Auth | JWT (access 15m / refresh 7d), SHA-256 token hashing, HttpOnly cookies |
| Infra | Docker, Nginx (unprivileged), GitHub Actions CI |
| Testing | Jest + Supertest (backend), Vitest (frontend), Playwright (E2E) |

---

## 📁 Repository Structure

```
AI-Study-Planner/
├── .github/workflows/ci.yml       # CI: lint → test → build → E2E
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # MongoDB connection with retry/backoff
│   │   │   ├── env.js             # Zod startup environment validation
│   │   │   └── passport.js        # Google OAuth (optional)
│   │   ├── controllers/           # Auth, AI, Subjects, Planner, Analytics
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js     # Per-route rate limits
│   │   │   └── uploadValidator.js # PDF magic-byte + page-count validation
│   │   ├── models/
│   │   │   ├── NotificationDelivery.js  # Idempotent reminder tracking
│   │   │   ├── RefreshToken.js          # Hashed token families + TTL
│   │   │   └── Lock.js                  # Distributed cron locks
│   │   ├── services/
│   │   │   ├── aiService.js       # Groq calls with Zod validation + retries
│   │   │   └── tokenService.js    # JWT generation, cookie helpers
│   │   └── utils/
│   │       ├── cronJobs.js        # runExamReminders() — fully testable
│   │       ├── plannerLogic.js    # Deterministic scheduling engine
│   │       └── logger.js          # Winston with PII redaction
│   ├── tests/                     # Jest integration tests
│   ├── app.js                     # Express app (no server binding)
│   ├── index.js                   # API entry point
│   └── worker.js                  # Standalone cron worker entry point
├── frontend/
│   ├── src/
│   │   ├── components/            # Reusable UI + ErrorBoundary
│   │   ├── pages/                 # Dashboard, Calendar, Subjects, etc.
│   │   └── services/              # Axios with transparent token refresh
│   ├── tests-e2e/                 # Playwright E2E tests
│   └── vercel.json                # SPA rewrite rules
├── docker-compose.yml             # Full local stack
└── DEPLOYMENT.md                  # Production deployment guide
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- MongoDB running locally or an Atlas URI

### 1. Clone
```bash
git clone https://github.com/beingUbaid/AI-Study-Planner.git
cd AI-Study-Planner
```

### 2. Backend
```bash
cd backend
npm ci
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET, JWT_REFRESH_SECRET, GROQ_API_KEY
npm run dev
```

### 3. Worker (separate terminal)
```bash
cd backend
node worker.js
```

### 4. Frontend
```bash
cd frontend
npm ci
cp .env.example .env
# Ensure VITE_API_URL=http://localhost:5000/api
npm run dev
```

### 5. Using Docker (full stack)
```bash
# Create a .env file in root with all required secrets (see DEPLOYMENT.md)
docker-compose up --build
```

API: `http://localhost:5000` · Frontend: `http://localhost:8080`

---

## 🧪 Testing

### Backend (Jest + Supertest)
```bash
cd backend
npm test                    # run all tests
npm run test:coverage       # with coverage report
```

### Frontend (Vitest)
```bash
cd frontend
npm test
```

### End-to-End (Playwright)
```bash
cd frontend
npx playwright test
```

---

## 🌐 Health Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/health` | GET | Process liveness — always returns 200 if running |
| `/ready`  | GET | Readiness — returns 200 only when MongoDB is connected |
| `/version`| GET | Returns `APP_VERSION` from environment |

---

## 🔒 Security Highlights

- **Secrets**: All environment variables validated by Zod on startup — server refuses to start with placeholders or weak values
- **Tokens**: SHA-256 hashed refresh tokens; full family revocation on reuse detection
- **Cookies**: `HttpOnly`, `Secure` (production), `SameSite=None` for cross-origin API setups
- **Uploads**: Magic-byte validation (`%PDF`), 5 MB size limit, 15-page limit, guaranteed `finally` cleanup
- **Logs**: Winston with recursive PII redaction — no emails, passwords, tokens, IPs or AI prompts in logs

---

## 📄 License

MIT — see [LICENSE](./LICENSE)
