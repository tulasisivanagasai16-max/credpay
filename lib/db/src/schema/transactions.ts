import { pgTable, text, timestamp, uuid, numeric, uniqueIndex } from "drizzle-orm/pg-core";

export const transactionsTable = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull(),
    status: text("status").notNull().default("PENDING"),
    amountPaise: numeric("amount_paise", { precision: 20, scale: 0 }).notNull(),
    feePaise: numeric("fee_paise", { precision: 20, scale: 0 }).notNull().default("0"),
    netPaise: numeric("net_paise", { precision: 20, scale: 0 }).notNull(),
    description: text("description"),
    referenceId: text("reference_id"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idemIdx: uniqueIndex("tx_user_idem_idx").on(t.userId, t.idempotencyKey),
  }),
);

export type Transaction = typeof transactionsTable.$inferSelect;
