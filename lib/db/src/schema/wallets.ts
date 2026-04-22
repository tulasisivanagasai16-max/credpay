import { pgTable, text, timestamp, uuid, numeric, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Wallets Table
 * Represents user wallets (balance is calculated from ledger entries, not stored directly)
 * This is just a reference table; actual balance comes from double-entry ledger
 */
export const walletsTable = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique().references(() => usersTable.id),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE, FROZEN, CLOSED
    currency: text("currency").notNull().default("INR"),
    totalTopupPaise: numeric("total_topup_paise", { precision: 20, scale: 0 }).default("0"), // Total money added
    totalPayoutPaise: numeric("total_payout_paise", { precision: 20, scale: 0 }).default("0"), // Total money withdrawn
    totalFeePaise: numeric("total_fee_paise", { precision: 20, scale: 0 }).default("0"), // Total fees charged
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("wallets_user_idx").on(t.userId),
    statusIdx: index("wallets_status_idx").on(t.status),
  }),
);

export type Wallet = typeof walletsTable.$inferSelect;
export type InsertWallet = typeof walletsTable.$inferInsert;
