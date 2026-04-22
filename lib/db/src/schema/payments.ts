import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";

export const paymentIntentsTable = pgTable("payment_intents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  amountPaise: numeric("amount_paise", { precision: 20, scale: 0 }).notNull(),
  feePaise: numeric("fee_paise", { precision: 20, scale: 0 }).notNull(),
  netPaise: numeric("net_paise", { precision: 20, scale: 0 }).notNull(),
  status: text("status").notNull().default("REQUIRES_CONFIRMATION"),
  gateway: text("gateway").notNull().default("razorpay-mock"),
  gatewayRef: text("gateway_ref"),
  cardLast4: text("card_last4"),
  cardholderName: text("cardholder_name"),
  transactionId: uuid("transaction_id"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PaymentIntent = typeof paymentIntentsTable.$inferSelect;
