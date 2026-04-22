import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const riskFlagsTable = pgTable("risk_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  kind: text("kind").notNull(), // VELOCITY | INSTANT_WITHDRAWAL | THRESHOLD | MANUAL
  severity: text("severity").notNull().default("LOW"), // LOW | MEDIUM | HIGH
  message: text("message").notNull(),
  resolved: text("resolved").notNull().default("OPEN"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type RiskFlag = typeof riskFlagsTable.$inferSelect;
