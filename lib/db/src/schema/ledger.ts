import { pgTable, text, timestamp, uuid, numeric, index } from "drizzle-orm/pg-core";

// All amounts stored in paise (smallest INR unit) as bigint to avoid float math.
export const ledgerAccountsTable = pgTable("ledger_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // USER, PLATFORM, FEE
  type: text("type").notNull(),
  // For USER accounts, points to the wallet/user
  ownerId: uuid("owner_id"),
  normalSide: text("normal_side").notNull().default("CREDIT"), // liabilities (user balances) are CREDIT-normal
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerEntriesTable = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id").notNull(),
    accountId: uuid("account_id").notNull(),
    direction: text("direction").notNull(), // DEBIT | CREDIT
    amountPaise: numeric("amount_paise", { precision: 20, scale: 0 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    txIdx: index("ledger_entries_tx_idx").on(t.transactionId),
    acctIdx: index("ledger_entries_acct_idx").on(t.accountId),
  }),
);

export type LedgerAccount = typeof ledgerAccountsTable.$inferSelect;
export type LedgerEntry = typeof ledgerEntriesTable.$inferSelect;
