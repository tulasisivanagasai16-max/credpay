import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const kycRecordsTable = pgTable("kyc_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  // PENDING | VERIFIED | REJECTED
  status: text("status").notNull().default("PENDING"),
  fullName: text("full_name"),
  panMasked: text("pan_masked"),
  addressLine: text("address_line"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

export type KycRecord = typeof kycRecordsTable.$inferSelect;
