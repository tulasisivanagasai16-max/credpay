# CoinWallet — Fintech Platform

A production-grade SaaS wallet for Indian users: load INR via card into a coin wallet (1 coin = ₹1), then send to UPI IDs or bank accounts.

## Highlights
- **Double-entry ledger** — balances are derived from balanced DEBIT/CREDIT entries, never updated directly. Global invariant exposed at `/api/admin/ledger`.
- **Microservice-ready** — bounded modules for Auth, Wallet/Ledger, Payments, Payouts, Fees, Risk, KYC; one Express app today, separate deploys tomorrow.
- **Money safety** — paise stored as `numeric(20,0)`, read as `bigint`, no floats anywhere.
- **Idempotency** — every transaction takes a key; unique `(user_id, idempotency_key)` index makes retries safe.
- **KYC tiers** — ₹5,000/day unverified, ₹50,000/day verified.
- **Risk engine** — instant-withdrawal cooldown, velocity, high-value flagging.
- **Mock gateways** — Razorpay-style card charge with HMAC-signed webhooks; Cashfree-style async UPI/bank payout.

## Layout
- `artifacts/coinwallet` — React+Vite SPA (dashboard, add money, send, payees, KYC, transactions, admin).
- `artifacts/api-server` — Express API (`/api/...`).
- `lib/api-spec` — OpenAPI contract; all FE+BE types are codegen'd from it.
- `lib/db` — Drizzle ORM schema (users, wallets, ledger_accounts, ledger_entries, transactions, payment_intents, payouts, payees, kyc_records, risk_flags).

## Demo triggers
- `cardLast4` starting with `0` → simulated card decline.
- Payee identifier starting with `fail` → simulated payout failure (retryable).
- Demo user is auto-seeded as `asha@coinwallet.demo` (admin role).

See `artifacts/coinwallet/ARCHITECTURE.md` for the full design.
