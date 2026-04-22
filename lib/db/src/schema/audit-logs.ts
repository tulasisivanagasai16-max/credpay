import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

/**
 * Audit Logs Table
 * Immutable log of all financial operations and user actions
 * Used for compliance, debugging, and forensics
 */
export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    action: text("action").notNull(), // CREATE_PAYMENT, PROCESS_PAYOUT, VERIFY_KYC, etc.
    entityType: text("entity_type").notNull(), // TRANSACTION, PAYMENT, PAYOUT, USER, WALLET
    entityId: uuid("entity_id"),
    targetUserId: uuid("target_user_id"), // For admin actions on other users
    oldValue: jsonb("old_value"), // Before state (for updates)
    newValue: jsonb("new_value"), // After state (for updates)
    changeDescription: text("change_description"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    status: text("status").notNull(), // SUCCESS, FAILED
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("audit_logs_user_idx").on(t.userId),
    actionIdx: index("audit_logs_action_idx").on(t.action),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdAtIdx: index("audit_logs_created_at_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
