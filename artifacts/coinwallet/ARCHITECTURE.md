# CoinWallet — Architecture

> A production-grade fintech wallet that lets users load INR via card and send to UPI/bank with a strict double-entry ledger, KYC-tiered limits, configurable fees, risk controls, and async payouts.

---

## 1. Service Topology (Logical Microservices)

In this monorepo we ship the services as modules within one Express app for fast iteration, but each is bounded by a service interface and is **deploy-independent**. In production each module becomes its own service (separate deployment, DB schema, on-call rotation).

```
                ┌─────────────────────────┐
                │       Web Client        │  React + Vite + TanStack Query
                │   (artifacts/coinwallet)│  (typed via OpenAPI codegen)
                └──────────────┬──────────┘
                               │ HTTPS / JWT
                ┌──────────────▼──────────┐
                │       API Gateway       │  rate-limit, auth, request-id
                └──┬─────┬─────┬─────┬────┘
   ┌───────────────┘     │     │     └─────────────────┐
   ▼                     ▼     ▼                       ▼
┌─────────┐   ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│  Auth   │   │   Wallet/    │  │    Risk &   │  │     KYC      │
│ Service │   │   Ledger     │  │  Fraud Eng. │  │   Service    │
└────┬────┘   │   Service    │  └──────┬──────┘  └──────┬───────┘
     │        └──────┬───────┘         │                │
     │               │                 │                │
     │        ┌──────▼───────┐         │                │
     │        │  Fees Engine │◄────────┘                │
     │        └──────┬───────┘                          │
     │               │                                  │
     │        ┌──────▼─────────────────────────────────▼─────┐
     │        │            PostgreSQL (per-service schema)    │
     │        └──────────────────────────────────────────────┘
     │
     │     ┌────────────────────────┐    ┌─────────────────────┐
     └────►│  Payment Gateway Adapt.│    │ Payout Gateway Adapt│
           │  (Razorpay/Stripe mock)│    │  (Cashfree mock)    │
           └─────────┬──────────────┘    └────────┬────────────┘
                     │ webhooks (HMAC)            │ async dispatch
                     ▼                            ▼
              External PSP                External payout rail (UPI/IMPS)
```

### 1.1 Service responsibilities

| Service | Responsibility | Key tables |
|---|---|---|
| **Auth** | Identify users, issue JWTs (demo: single seed user). | `users` |
| **Wallet/Ledger** | Source of truth for money. Enforces double-entry. Computes balances. | `wallets`, `ledger_accounts`, `ledger_entries`, `transactions` |
| **Payments** | Card-load lifecycle: intent → confirm → ledger post → webhook. | `payment_intents` |
| **Payouts** | UPI/bank dispatch, async processing, retries. | `payouts`, `payees` |
| **Fees** | Pure rules engine: bps + fixed, with min/max caps, per kind. | (config in code/DB) |
| **Risk** | Velocity, instant-withdrawal cooldown, threshold flagging. | `risk_flags` |
| **KYC** | Tiered daily limits (₹5k unverified / ₹50k verified). | `kyc_records` |
| **Admin/Reporting** | Ledger overview, risk queue. | reads only |

Async fan-out (production): every state change emits a domain event (`PaymentSucceeded`, `PayoutFailed`, `KycVerified`) onto Kafka. Risk, reporting, notifications are independent consumers.

---

## 2. Money Model — Double-Entry Ledger

> **Rule #1: balances are never updated directly.** Every value movement is a balanced set of entries (sum DEBIT = sum CREDIT).

### 2.1 Storage

* All amounts live in **paise** (smallest INR unit) as `numeric(20,0)` and are read into JS as `bigint`.
* No floats, anywhere. INR display is computed at the edge via `paiseToInr`.
* `1 coin = ₹1`. Coins are simply the user's USER-type ledger account balance.

### 2.2 Account types

| Type | Normal side | Example |
|---|---|---|
| `USER` | CREDIT (we owe the user) | each user's wallet |
| `PLATFORM` | DEBIT (we control the cash) | `PLATFORM_CASH` |
| `FEE` | CREDIT (revenue) | `FEE_REVENUE` |

### 2.3 Posting rules

**Card load** (user pays ₹X, gets ₹X − fee in coins):

```
DEBIT  PLATFORM_CASH    X        (cash arrived from PSP)
CREDIT USER_WALLET      X − fee  (user's coin balance grows)
CREDIT FEE_REVENUE      fee      (we keep the fee)
```

**Payout to UPI/bank** (user spends ₹X + fee in coins, payee receives ₹X):

```
DEBIT  USER_WALLET      X + fee  (user's coin balance shrinks)
CREDIT PLATFORM_CASH    X        (cash leaves to payout rail)
CREDIT FEE_REVENUE      fee      (we keep the fee)
```

The ledger service **rejects** any posting where DEBIT ≠ CREDIT (`LedgerImbalanceError`). The admin endpoint also exposes `doubleEntryBalanced` — a global invariant that should always be true.

### 2.4 Atomicity & idempotency

* All posts run inside a single SQL transaction (`db.transaction(...)`).
* Every transaction takes an optional `idempotencyKey`. A unique index on `(user_id, idempotency_key)` makes duplicate submissions safe — second call returns the original transaction id.
* Payment intents and payouts also accept idempotency keys end-to-end so a network retry never double-charges or double-pays.

---

## 3. Card Load Flow

```
Client                 API                    PSP (Razorpay-mock)
  │  POST /payments/intents (amount)
  │ ──────────────────────────►
  │                       quoteFee()
  │                       insert payment_intent (REQUIRES_CONFIRMATION)
  │ ◄────────────────────── { id, clientSecret, fee, net }
  │
  │  POST /payments/intents/:id/confirm (cardLast4, name)
  │ ──────────────────────────►
  │                       chargeCard() ───────────►
  │                                              │
  │                                            settle
  │                                              │
  │                       postTransaction(SUCCESS, postings) ◄── ledger
  │                       update intent → SUCCESS
  │ ◄────────────────────── { status, transactionId }
```

* PCI scope-out: only `cardLast4` and `cardholderName` are stored. PAN, CVV, expiry never touch our servers.
* Webhook endpoint `/payments/webhook` verifies HMAC-SHA256 with `GATEWAY_WEBHOOK_SECRET` (constant-time compare).
* Mock trigger: `cardLast4` starting with `0` simulates a declined card.

---

## 4. Payout Flow (Async)

```
Client                  API                     Cashfree-mock
  │  POST /payouts (payeeId, amount)
  │ ────────────────────────►
  │                  evaluatePayout (risk)
  │                  checkLimit (KYC)
  │                  getUserWalletBalance
  │                  insert payout (PENDING)
  │ ◄────────────────────── { id, status: PENDING }
  │                  setImmediate(processPayoutInternal)
  │                                          │
  │                  ┌───────────────────────┘
  │                  ▼
  │           dispatchPayout() ─────────────►
  │                                          settle
  │           postTransaction (PAYOUT, SUCCESS|FAILED, postings)
  │           update payout → SUCCESS|FAILED
```

* The HTTP request returns **immediately** with `PENDING`. Real workers (Kafka consumers) carry the dispatch — `setImmediate` is the demo stand-in.
* Failed payouts are retryable via `POST /payouts/:id/retry` (increments `retry_count`).
* Mock trigger: payee identifier starting with `fail` simulates a payout failure.

---

## 5. Fees Engine

Pure, deterministic, hot-swappable:

```
fee = clamp(amount * bps / 10000 + fixed, [min, max])
```

| Kind | bps | fixed | min | max |
|---|---|---|---|---|
| LOAD | 250 (2.5%) | ₹2 | ₹1 | ₹500 |
| PAYOUT | 100 (1.0%) | ₹5 | ₹2 | ₹300 |

Exposed via `POST /fees/quote` so the UI can show the user the exact net amount before they commit.

---

## 6. Risk & Fraud Rules

Implemented in `risk.service.ts`:

1. **Cooling-off after deposit** — payouts are blocked for 5 minutes after any successful card load (mitigates card-fraud cash-out).
2. **Velocity** — max 10 payouts per hour per user.
3. **High-value threshold** — payouts ≥ ₹50,000 are flagged (not blocked) for review.

Every triggered rule is recorded in `risk_flags` and surfaced on `/admin/risk/queue`.

---

## 7. KYC & Limits

| Tier | Daily load + payout |
|---|---|
| Unverified (`PENDING`/`REJECTED`) | ₹5,000 |
| Verified | ₹50,000 |

Computed at request time from `transactions` (sum of today's `SUCCESS` rows by type). PAN is masked on storage (`XXXXXX####`); the raw PAN never persists.

---

## 8. Security Posture

* **Secrets** — `GATEWAY_WEBHOOK_SECRET`, `SESSION_SECRET`, `DATABASE_URL` injected via env. Never logged.
* **Webhook verification** — HMAC-SHA256, constant-time compare, raw-body checked.
* **PCI** — only last4 + cardholder name; PAN/CVV/expiry never stored or proxied.
* **PII** — PAN masked on KYC submission.
* **AuthZ** — `requireUser` middleware on every mutating route; admin endpoints check role (extend in production).
* **Idempotency** — unique constraints + idempotency keys protect against duplicate writes from retries.

---

## 9. Deployment

* The API server is a Node 20 process (`node ./dist/index.mjs`).
* The web client is a static Vite build behind a CDN.
* PostgreSQL is the single shared store today; in production each service owns its schema. Migrations via `drizzle-kit push`.
* Health probe: `GET /api/health` for liveness/readiness.
* Stateless API — horizontal scale behind a load balancer.

To publish on Replit: click **Publish** in the workspace; the deployer builds, runs health checks, and serves both the API and SPA on a `.replit.app` domain (or your custom domain).

---

## 10. Repo Map

```
artifacts/
  coinwallet/      React SPA (dashboard, add money, send, payees, KYC, admin)
  api-server/
    src/
      routes/      thin HTTP layer (auth, wallet, payments, payouts, ...)
      services/    ledger, fees, risk, kyc, gateways, money helpers
      middlewares/ auth (JWT in prod / demo user here)
lib/
  api-spec/        OpenAPI single source of truth (codegen for FE + BE types)
  api-zod/         generated zod schemas
  api-client-react/generated TanStack-Query hooks
  db/              Drizzle ORM schema + migrations
```

The OpenAPI document under `lib/api-spec/openapi.yaml` is the contract — both client and server are generated from it; drift is impossible.
