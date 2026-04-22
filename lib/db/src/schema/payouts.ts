import { pgTable, text, timestamp, uuid, numeric, integer } from "drizzle-orm/pg-core";

export const payoutsTable = pgTable("payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  payeeId: uuid("payee_id").notNull(),
  amountPaise: numeric("amount_paise", { precision: 20, scale: 0 }).notNull(),
  feePaise: numeric("fee_paise", { precision: 20, scale: 0 }).notNull(),
  totalDebitPaise: numeric("total_debit_paise", { precision: 20, scale: 0 }).notNull(),
  status: text("status").notNull().default("PENDING"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  transactionId: uuid("transaction_id"),
  note: text("note"),
  idempotencyKey: text("idempotency_key"),
  gateway: text("gateway").notNull().default("cashfree-mock"),
  gatewayRef: text("gateway_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export type Payout = typeof payoutsTable.$inferSelect;
