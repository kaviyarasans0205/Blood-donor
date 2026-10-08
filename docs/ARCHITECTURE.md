# Architecture Notes

Companion to the root [README](../README.md). Describes data models, authorization rules, and the core algorithms.

## Services & data flow

- **React SPA** (`frontend/`) talks only to the Express API through `/api` (Vite dev proxy in development, same-origin in production builds). Auth: JWT stored in `localStorage` (`bb_token`) *and* a cookie; `AuthContext` hydrates `{ user, profile }` from `GET /api/auth/me`.
- **Express API** (`backend/`) owns all business rules, persistence, scheduled jobs, and the ML client.
- **MongoDB** holds 14 collections (models below).
- **FastAPI ML service** (`ml-service/`) exposes `/health`, `/predict-demand` (+ `/forecast` alias) and is called by the backend's prediction service; results are cached in `DemandPrediction` and refreshed by cron, never computed per page load. If the service is unreachable, the backend uses its local numpy-equivalent fallback so the UI still renders forecasts.

## Data models

| Model | Purpose | Key fields |
|-------|---------|------------|
| `User` | Accounts for all roles | `email`, `passwordHash`, `role` (`admin`/`donor`/`requester`), `status` |
| `Donor` | Donor profile | `bloodGroup`, `dateOfBirth`, geo (`latitude`/`longitude`), `availability`, `notificationConsent`, `lastDonationDate`, `points` |
| `Requester` | Hospital/organization | `organizationName`, `organizationType`, `city` |
| `EmergencyRequest` | Blood requests | `bloodGroup`, `requiredUnits`, `requiredAt`, `priority` (`CRITICAL`/`URGENT`/`NORMAL`), `priorityScore`, `status`, `patientName` |
| `BloodInventory` | Stock batches (FEFO) | `bloodGroup`, `units`, `collectionDate`, `expiryDate`, `status` (`available`/`consumed`/`expired`/`discarded`) |
| `Donation` | Donation records | donor, `units`, `date`, `camp` — 6 months of history feeds prediction |
| `Appointment` | Booking slots | `slot`, `status` (`Pending`/`Confirmed`/`Completed`/`Cancelled`/`No-show`) |
| `EligibilityCheck` | Questionnaire results | answers, `result` (`ELIGIBLE`/`NOT_ELIGIBLE`), `reasons`, `rulesVersion`, disclaimer |
| `Notification` | Per-user inbox | `userId`, `type`, `channel` (`inapp`/`email`/`sms`), `status`, `readAt` |
| `RewardTransaction` | Points ledger | `type`, `points` (+/-), running balance |
| `Alert` | Operational alerts | `type` (`low_stock`/`expiry_warning`/`expired`/`system`), `severity` (`info`/`warning`/`critical`) |
| `DemandPrediction` | Cached forecast | `bloodGroup`, model metadata, daily series |
| `SystemSettings` | Runtime configuration | compatibility rules, eligibility rules, stock thresholds, reward config, reminder windows |
| `AuditLog` | Security trail | actor, action, entity, IP/UA |

## Roles & access (RBAC)

| Capability | Public | Donor | Requester | Admin |
|---|:-:|:-:|:-:|:-:|
| Home/stock/search pages, eligibility pre-screen | ✓ | ✓ | ✓ | ✓ |
| Own profile, eligibility history, appointments, rewards | — | ✓ | — | ✓ |
| Create/track emergency requests, priority queue | — | — | ✓ | ✓ |
| Inventory add/consume/discard, alerts | — | — | — | ✓ |
| Donor directory, donor map, predictions, reports, settings, notifications broadcast | — | — | — | ✓ |
| Match/fulfill emergencies, override priority | — | — | — | ✓ |

Enforcement: `requireAuth` → `requireRole(...)` / `requireSelfOrRole(...)` in `backend/src/middleware/auth.js`; server-side filters always scope "own" queries to `req.user.id`.

## Blood compatibility

Centralized in `compatibilityService.js` (data-driven, stored in `SystemSettings`, default table below). `compatibleRecipients(donorGroup)` = groups that may receive that donor's red cells; `compatibleDonors(recipientGroup)` = inverse lookup.

```
O-  → O- O+ A- A+ B- B+ AB- AB+        A-  → A- A+ AB- AB+
O+  → O+ A+ B+ AB+                     A+  → A+ AB+
B-  → B- B+ AB- AB+                    B+  → B+ AB+
AB- → AB- AB+                          AB+ → AB+
```

## Emergency priority

`priorityService.classifyPriority()` scores urgency: time-to-`requiredAt` (≤2 h → +60, ≤6 h → +40, ≤24 h → +20), level hint (critical +50 / urgent +30), and clinical keywords in notes (trauma, ICU, haemorrhage… → +30). Score ≥ 80 ⇒ `CRITICAL`, ≥ 40 ⇒ `URGENT`, else `NORMAL`. Queue tie-break: same priority ⇒ earliest `createdAt` (score is *not* a tie-break).

## Donor matching

`POST /api/emergency-requests/:id/match` (optional `?notify=true`):

1. **Compatibility** — donors whose group can donate to the request's group.
2. **Eligibility** — deferral window since last donation (56 days default).
3. **Distance** — Haversine from request coordinates; `?radiusKm=` filters via `filterByRadius` (items with missing coordinates are excluded, not crashed on).
4. **Score** — `50·eligible + 20·available + 10·consent + (30 − min(dist,30)) + min(daysSinceDonation/10, 10)`.

Inventory fulfillment (`/fulfill`) allocates **FEFO** (earliest expiry first); admin tools can also consume FIFO or discard batches.

## Eligibility screening

Rule-driven (`eligibilityService` + `SystemSettings.eligibility_rules`): age 18–65, ≥ 50 kg, 56-day whole-blood interval, deferrals for recent illness (14 d), tattoo (90 d), surgery (90 d), plus questionnaire answers. Every result includes `DISCLAIMER` — screening aid only, not medical advice.

## Notifications

- Types: `emergency_request`, `donor_match`, `appointment_confirmation`, `appointment_reminder`, `low_stock`, `expiry_warning`, `reengagement_reminder`, `reward_earned`, `general`.
- Channels: in-app (always), email/SMS (mocked unless `EMAIL_*`/`SMS_*` configured — responses then report `mocked: true`).
- `POST /api/notifications/send` (admin) validates `userId`, `title`, `message` (400 otherwise) and enforces in-app + optional email/SMS fan-out per user.

## Demand prediction

- Backend `predictionService` → `ML_SERVICE_URL` (`np_holt_linear` / `np_holt_damped` / `np_sma` selected by holdout backtest MAPE, quality metrics returned) → cached in `DemandPrediction` (6 h TTL, cron-refreshed daily 04:00) → local statistical fallback if the service is down.
- Responses include a disclaimer: statistical estimate for decision support only.

## Security

- bcrypt password hashes; JWT (header + cookie, 7 d) with `setUnauthorizedHandler` on 401.
- Global rate limit + stricter auth limit; `helmet`, `express-mongo-sanitize`, payload size limits, centralized error handler (no stack traces in production).
- Validation via schema middleware; every response is `{ success, message, data, meta }`.

## Frontend structure

- `context/AuthContext` (session), `context/ToastContext` (toasts), `hooks/useApi` (loading/error/refetch with dependency-driven refetch).
- Routes in `src/App.jsx`: public (4), auth (2), donor (5), requester (3), admin (12), shared (`/notifications`, `/search`), error pages.
- Design system: `components/ui/{Cards,States,StatusBadge,Modal,DataTable}`, Tailwind theme (`medical`/`brand` palettes), shared helpers in `utils/helpers.js`.
