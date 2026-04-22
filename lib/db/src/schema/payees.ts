import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const payeesTable = pgTable("payees", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  label: text("label").notNull(),
  type: text("type").notNull(), // UPI | BANK
  identifier: text("identifier").notNull(),
  ifsc: text("ifsc"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Payee = typeof payeesTable.$inferSelect;
