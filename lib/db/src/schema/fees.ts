import {
  pgTable,
  text,
  uuid,
  timestamp,
  numeric,
  boolean,
  index,
} from "drizzle-orm/pg-core";

/**
 * Fee Configuration Table
 * Stores dynamic fee rules for different transaction types
 * Example: Credit card load fee, payout fee, transfer fee
 */
export const feesConfigTable = pgTable(
  "fees_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionType: text("transaction_type").notNull(), // CREDIT_CARD_LOAD, PAYOUT, TRANSFER
    feeType: text("fee_type").notNull(), // FLAT, PERCENTAGE, TIERED
    feeValuePaise: numeric("fee_value_paise", { precision: 20, scale: 0 }), // Flat fee
    feePercentage: numeric("fee_percentage", { precision: 5, scale: 2 }), // Percentage (e.g., 2.5%)
    minFeePaise: numeric("min_fee_paise", { precision: 20, scale: 0 }).default("0"), // Minimum fee
    maxFeePaise: numeric("max_fee_paise", { precision: 20, scale: 0 }), // Maximum fee (optional)
    minTransactionPaise: numeric("min_transaction_paise", { precision: 20, scale: 0 }).default("0"),
    maxTransactionPaise: numeric("max_transaction_paise", { precision: 20, scale: 0 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index("fees_config_type_idx").on(t.transactionType),
    activeIdx: index("fees_config_active_idx").on(t.active),
  }),
);

export type FeesConfig = typeof feesConfigTable.$inferSelect;
export type InsertFeesConfig = typeof feesConfigTable.$inferInsert;
