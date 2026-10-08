# Smart Blood Donor Management & Emergency Response System

A full-stack blood bank platform that registers and screens donors, tracks blood inventory with expiry control, matches donors to emergency requests in real time, and forecasts blood demand — with role-based access for **admins**, **hospitals/requesters**, and **donors**.

## Features

**Public**
- Home, live stock overview, donor search, eligibility pre-screen (with medical disclaimer)

**Donor**
- Dashboard (stats, nearby emergencies, donation history), profile & geo-location, eligibility questionnaire, appointments, rewards (points, streaks, referrals)

**Requester (hospital)**
- Emergency blood requests, live priority queue, request tracking with donor match visibility

**Admin**
- Dashboard & analytics, donors, inventory (FEFO batches, add/consume/discard), emergency oversight (match/fulfill/override priority), appointments, alerts, notifications broadcast, donor map (radius search), demand predictions, reports (CSV export), settings, audit-friendly admin tools

**Cross-cutting**
- JWT auth (header + cookie), RBAC, rate limiting, in-app + mock email/SMS notifications, scheduled jobs (expiry, reminders, re-engagement, prediction refresh, stale request expiry), Swagger API docs

## Architecture

```
Browser ──> React SPA (Vite, :5173)
              │  /api proxy
              ▼
         Express API (:5000)  ──────>  MongoDB (:27017)
              │
              │  cached demand forecasts
              ▼
         FastAPI ML service (:8000)  (numpy Holt / SMA forecaster)
```

| Service  | Tech | Port | Run from |
|----------|------|------|----------|
| Frontend | React 19, Vite, Tailwind 4, Recharts, Leaflet | 5173 | `frontend/` |
| Backend  | Node 24, Express, Mongoose, Swagger, node-cron | 5000 | `backend/` |
| ML       | Python 3.12+, FastAPI, numpy, pandas | 8000 | `ml-service/` |
| Database | MongoDB 7 | 27017 | — |

## Prerequisites

- Node.js ≥ 20 (tested on 24)
- MongoDB ≥ 7 running locally (or a connection string in `backend/.env`)
- Python ≥ 3.12 with `pip`

## Quick start

### 1. Database

```powershell
mongod --dbpath <your-db-path>   # any local MongoDB on mongodb://127.0.0.1:27017
```

### 2. Backend

```powershell
cd backend
npm install
copy .env.example .env           # set JWT_SECRET at minimum
npm run seed                     # demo data (drops + rebuilds the dev DB)
npm run dev                      # http://localhost:5000
```

- API docs (Swagger UI): <http://localhost:5000/api-docs>

### 3. ML service (optional but recommended)

```powershell
cd ml-service
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The backend degrades gracefully: if the ML service is down it falls back to a local
statistical forecast, so predictions never hard-fail.

### 4. Frontend

```powershell
cd frontend
npm install
npm run dev                      # http://localhost:5173
```

## Login accounts

Two data modes (both target whatever `MONGO_URI` points at):

| Command | Result |
|---------|--------|
| `npm run reset` | **Clean database** — drops everything, then creates only the 3 login accounts below (no demo donors, stock, or requests) |
| `npm run seed` | **Full demo data** — the same 3 accounts plus 14 donors, inventory batches, emergency requests, 6 months of donation history, etc. |

| Role      | Email                  | Password      |
|-----------|------------------------|---------------|
| Admin     | `admin@lifeline.test`  | `Admin@12345` |
| Donor     | `donor@lifeline.test`  | `Donor@12345` |
| Hospital  | `hospital@lifeline.test` | `Hospital@12345` |

After `npm run seed`, all other seeded donor accounts also use `Donor@12345`. Self-registration is open for **donor** and **requester** roles only — admin accounts cannot be self-registered.

## Scripts

**Root (convenience wrappers)** — `npm run seed`, `npm run reset`, `npm run dev:backend`, `npm run dev:frontend`, `npm run dev:ml`, `npm run build`, `npm run lint`, `npm test` (runs backend + frontend + ML suites back to back)

**backend/** — `npm run dev` (watch), `npm start`, `npm run seed` (full demo data), `npm run reset` (clean DB + 3 login accounts), `npm test`, `npm run test:watch`

**frontend/** — `npm run dev`, `npm run build`, `npm run preview`, `npm run lint` (0 warnings allowed), `npm test`

**ml-service/** — `python -m uvicorn app.main:app --port 8000`, `python -m pytest`

## Tests

One-shot run of all three suites from the repo root: **`npm test`** (96 tests).

| Suite    | Command | Coverage |
|----------|---------|----------|
| Backend  | `cd backend && npm test` | 55 tests — unit (compatibility, eligibility, priority, haversine, prediction fallback) + integration via supertest against an in-memory MongoDB (auth, RBAC, emergency, inventory, eligibility, notifications, rewards, predictions, reports CSV) |
| Frontend | `cd frontend && npm test` | 17 tests — helpers/validators + core UI components (Vitest, Testing Library, jsdom) |
| ML       | `cd ml-service && python -m pytest` | 24 tests — forecaster models, backtesting, API contract |
| Lint     | `cd frontend && npm run lint` | ESLint with `--max-warnings 0` |

> Backend tests set `MONGOMS_SYSTEM_BINARY` to reuse a local `mongod` instead of downloading one.

## Environment variables

Copy `backend/.env.example` → `backend/.env` (the root `.env.example` is identical and kept for reference).

| Variable | Purpose |
|----------|---------|
| `PORT`, `NODE_ENV` | Server |
| `MONGO_URI` | MongoDB connection |
| `MONGO_DNS_SERVERS` | Optional. Comma-separated DNS servers for Node's resolver. Set this if SRV/`mongodb+srv://` lookups fail with `ECONNREFUSED _mongodb._tcp.…` — some VPN/security tools (e.g. McAfee WebAdvisor) leave c-ares with no servers so it defaults to dead `127.0.0.1`. Example: `10.71.128.129` |
| `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_COOKIE_MAX_AGE` | Auth |
| `CORS_ORIGIN` | Allowed origin (default `http://localhost:5173`) |
| `EMAIL_*`, `SMS_*` | Leave blank → **mock mode** (notifications report `mocked: true`) |
| `ML_SERVICE_URL` | Default `http://localhost:8000` |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX` | Rate limiting |

## Scheduled jobs (node-cron)

| Schedule | Job |
|----------|-----|
| Hourly | Expire overdue inventory batches, refresh stock/expiry alerts |
| Every 6 h | Appointment reminders (24 h ahead) |
| Daily 03:00 | Donor re-engagement (inactive 6+ months) |
| Daily 04:00 | Refresh cached demand predictions |
| Every 15 min | Expire stale emergency requests past `requiredAt` |

## Known limitations

- **ML models are numpy-only (no scikit-learn):** an Application Control policy on the target machine blocks scipy DLLs, so `scikit-learn` was removed from `ml-service/requirements.txt`. Forecasting uses Holt linear/damped-trend (with holdout backtest MAPE/R² and auto model selection) plus simple moving average, all on numpy/pandas. Predictions are statistical estimates for decision support only — never autonomous medical decisions, and they are **cached** (cron-refreshed) rather than computed per page load.
- **Email/SMS are mocked** until real `EMAIL_*`/`SMS_*` credentials are configured; responses carry `mocked: true`.
- **Eligibility is a screening aid**, not a diagnosis — every result carries a disclaimer and final clearance belongs to authorized medical staff.
- Blood compatibility rules follow common red-cell transfusion practice and are configuration-driven (`SystemSettings`), but **must be validated by blood-bank personnel** before real use.
- Seed data is realistic but fictional (Indian cities/coordinates).

## Project structure

```
├── backend/          Express API (src/{config,controllers,middleware,models,routes,services,jobs,utils})
├── frontend/         React SPA (src/{components,pages,context,hooks,services,utils,api})
├── ml-service/       FastAPI forecast service (app/, tests/)
├── database-seed/    seed.js — demo data for every module
├── tests/            Backend integration/unit suites (Jest, run from backend/)
├── docs/             Architecture notes
├── package.json      Root convenience scripts (seed/dev/test/lint)
├── .gitignore
└── .env.example      Backend environment template (copy to backend/.env)
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for data models, RBAC, matching/scoring rules, and notification flow.
