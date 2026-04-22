-- CredPay Database Schema
-- PostgreSQL (v14+)
-- This file documents the complete schema for production deployment

-- =====================
-- Users & Authentication
-- =====================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone_number TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user', -- user, admin, support
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  daily_transaction_limit NUMERIC(20, 0) DEFAULT 500000, -- 5000 INR in paise
  profile_photo_url TEXT,
  last_login_at TIMESTAMP WITH TIME ZONE,
  last_ip_address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  suspension_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_active ON users(is_active);

-- =====================
-- Sessions & Auth
-- =====================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  refresh_token TEXT NOT NULL UNIQUE,
  device_id TEXT,
  device_name TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_active ON sessions(is_active);

-- =====================
-- Wallets
-- =====================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, FROZEN, CLOSED
  currency TEXT NOT NULL DEFAULT 'INR',
  total_topup_paise NUMERIC(20, 0) DEFAULT 0,
  total_payout_paise NUMERIC(20, 0) DEFAULT 0,
  total_fee_paise NUMERIC(20, 0) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wallets_user ON wallets(user_id);
CREATE INDEX idx_wallets_status ON wallets(status);

-- =====================
-- Ledger (Double-Entry Accounting)
-- =====================

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- USER, PLATFORM, FEE
  owner_id UUID,
  normal_side TEXT NOT NULL DEFAULT 'CREDIT', -- DEBIT or CREDIT
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_accounts_type ON ledger_accounts(type);
CREATE INDEX idx_ledger_accounts_owner ON ledger_accounts(owner_id);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  direction TEXT NOT NULL, -- DEBIT or CREDIT
  amount_paise NUMERIC(20, 0) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_entries_tx ON ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_account ON ledger_entries(account_id);

-- =====================
-- Transactions
-- =====================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- PAYMENT, PAYOUT, TRANSFER, REVERSAL
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  amount_paise NUMERIC(20, 0) NOT NULL,
  fee_paise NUMERIC(20, 0) NOT NULL DEFAULT 0,
  net_paise NUMERIC(20, 0) NOT NULL,
  description TEXT,
  reference_id TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_transactions_idem ON transactions(user_id, idempotency_key);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- =====================
-- Payments (Credit Card)
-- =====================

CREATE TABLE IF NOT EXISTS payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount_paise NUMERIC(20, 0) NOT NULL,
  fee_paise NUMERIC(20, 0) NOT NULL,
  net_paise NUMERIC(20, 0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUIRES_CONFIRMATION',
  gateway TEXT NOT NULL DEFAULT 'razorpay-mock',
  gateway_ref TEXT,
  card_last4 TEXT,
  cardholder_name TEXT,
  transaction_id UUID REFERENCES transactions(id),
  idempotency_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_intents_user ON payment_intents(user_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_gateway_ref ON payment_intents(gateway_ref);

-- =====================
-- Payouts (UPI/Bank)
-- =====================

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  payee_id UUID NOT NULL,
  amount_paise NUMERIC(20, 0) NOT NULL,
  fee_paise NUMERIC(20, 0) NOT NULL,
  total_debit_paise NUMERIC(20, 0) NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SUCCESS, FAILED
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  transaction_id UUID REFERENCES transactions(id),
  note TEXT,
  idempotency_key TEXT,
  gateway TEXT NOT NULL DEFAULT 'cashfree-mock',
  gateway_ref TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_payouts_user ON payouts(user_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_payouts_gateway_ref ON payouts(gateway_ref);

-- =====================
-- Payees (UPI/Bank Accounts)
-- =====================

CREATE TABLE IF NOT EXISTS payees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  label TEXT NOT NULL,
  type TEXT NOT NULL, -- UPI, BANK
  identifier TEXT NOT NULL, -- UPI ID or bank account
  ifsc TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payees_user ON payees(user_id);

-- =====================
-- KYC Management
-- =====================

CREATE TABLE IF NOT EXISTS kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED
  full_name TEXT,
  pan_masked TEXT,
  address_line TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_user ON kyc_records(user_id);
CREATE INDEX idx_kyc_status ON kyc_records(status);

-- =====================
-- Risk & Fraud Detection
-- =====================

CREATE TABLE IF NOT EXISTS risk_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, -- VELOCITY, INSTANT_WITHDRAWAL, THRESHOLD, MANUAL
  severity TEXT NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
  message TEXT NOT NULL,
  resolved TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, RESOLVED, FALSE_POSITIVE
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_flags_user ON risk_flags(user_id);
CREATE INDEX idx_risk_flags_severity ON risk_flags(severity);

-- =====================
-- Fees Configuration
-- =====================

CREATE TABLE IF NOT EXISTS fees_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL, -- CREDIT_CARD_LOAD, PAYOUT, TRANSFER
  fee_type TEXT NOT NULL, -- FLAT, PERCENTAGE, TIERED
  fee_value_paise NUMERIC(20, 0),
  fee_percentage NUMERIC(5, 2),
  min_fee_paise NUMERIC(20, 0) DEFAULT 0,
  max_fee_paise NUMERIC(20, 0),
  min_transaction_paise NUMERIC(20, 0) DEFAULT 0,
  max_transaction_paise NUMERIC(20, 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fees_type ON fees_config(transaction_type);
CREATE INDEX idx_fees_active ON fees_config(active);

-- =====================
-- Audit Logs (Immutable)
-- =====================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  target_user_id UUID,
  old_value JSONB,
  new_value JSONB,
  change_description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL, -- SUCCESS, FAILED
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at);

-- =====================
-- Notifications
-- =====================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  type TEXT NOT NULL, -- EMAIL, SMS, PUSH, IN_APP
  trigger TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, SENT, FAILED, READ
  sent_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  external_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_trigger ON notifications(trigger);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_date ON notifications(created_at);

-- =====================
-- Webhook Events (Inbound)
-- =====================

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL, -- razorpay, cashfree, stripe
  event_type TEXT NOT NULL,
  external_id TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, PROCESSED, FAILED
  processed_at TIMESTAMP WITH TIME ZONE,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_external_id ON webhook_events(external_id);

-- =====================
-- Reconciliation Logs
-- =====================

CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_type TEXT NOT NULL, -- PAYOUT, PAYMENT, LEDGER
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL, -- RUNNING, COMPLETED, FAILED
  records_processed TEXT,
  records_matched TEXT,
  discrepancies_found TEXT,
  discrepancy_details JSONB,
  failure_reason TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_recon_type ON reconciliation_logs(reconciliation_type);
CREATE INDEX idx_recon_status ON reconciliation_logs(status);
CREATE INDEX idx_recon_date ON reconciliation_logs(start_date);

-- =====================
-- Summary of Indexes for Query Performance
-- =====================
-- All high-cardinality foreign key columns are indexed
-- Status columns are indexed for filtering
-- Date columns are indexed for range queries
-- Unique columns have unique indexes

-- =====================
-- Default Fee Configuration (seed data)
-- =====================

INSERT INTO fees_config (transaction_type, fee_type, fee_percentage, min_fee_paise, active)
VALUES 
  ('CREDIT_CARD_LOAD', 'PERCENTAGE', 2.5, 0, TRUE), -- 2.5% fee
  ('PAYOUT', 'PERCENTAGE', 1.0, 0, TRUE), -- 1% fee
  ('TRANSFER', 'FLAT', NULL, 1000, TRUE) -- ₹10 flat fee
ON CONFLICT DO NOTHING;

-- =====================
-- Security Constraints
-- =====================
-- All customer data must be treated as sensitive
-- Masking rules:
-- - PAN: Show only last 4 digits masked as XXXXXXXX1234
-- - Account numbers: Show only last 4 digits
-- - API responses: Never return password_hash, sensitive PII
-- - Audit logs: Track all access to sensitive fields
