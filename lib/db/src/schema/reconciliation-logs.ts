import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Reconciliation Logs Table
 * Tracks daily reconciliation jobs between platform and external gateways
 * Used for verification of payment status, payout status, and identifying discrepancies
 */
export const reconciliationLogsTable = pgTable(
  "reconciliation_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reconciliationType: text("reconciliation_type").notNull(), // PAYOUT, PAYMENT, LEDGER
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: text("status").notNull(), // RUNNING, COMPLETED, FAILED
    recordsProcessed: text("records_processed"),
    recordsMatched: text("records_matched"),
    discrepanciesFound: text("discrepancies_found"),
    discrepancyDetails: jsonb("discrepancy_details"), // Array of mismatches
    failureReason: text("failure_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    typeIdx: index("recon_logs_type_idx").on(t.reconciliationType),
    statusIdx: index("recon_logs_status_idx").on(t.status),
    dateIdx: index("recon_logs_date_idx").on(t.startDate),
  }),
);

export type ReconciliationLog = typeof reconciliationLogsTable.$inferSelect;
export type InsertReconciliationLog = typeof reconciliationLogsTable.$inferInsert;
