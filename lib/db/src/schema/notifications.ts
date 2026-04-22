import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
  integer,
  jsonb,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Notifications Table
 * Tracks all outbound notifications (email, SMS, in-app)
 * Used for delivery confirmation, retry tracking, and notification history
 */
export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id),
    type: text("type").notNull(), // EMAIL, SMS, PUSH, IN_APP
    trigger: text("trigger").notNull(), // PAYMENT_SUCCESS, PAYOUT_INITIATED, KYC_VERIFIED, etc.
    channel: text("channel").notNull(), // sendgrid, twilio, fcm, internal
    recipient: text("recipient").notNull(), // email address, phone number, or user ID
    subject: text("subject"), // For email
    body: text("body").notNull(),
    metadata: jsonb("metadata"), // Additional context (amount, transaction ID, etc.)
    status: text("status").notNull().default("PENDING"), // PENDING, SENT, FAILED, READ
    sentAt: timestamp("sent_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }), // For in-app notifications
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    externalId: text("external_id"), // sendgrid message ID, twilio SID, etc.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
    triggerIdx: index("notifications_trigger_idx").on(t.trigger),
    statusIdx: index("notifications_status_idx").on(t.status),
    createdAtIdx: index("notifications_created_at_idx").on(t.createdAt),
  }),
);

export type Notification = typeof notificationsTable.$inferSelect;
export type InsertNotification = typeof notificationsTable.$inferInsert;
