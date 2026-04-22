import {
  pgTable,
  text,
  uuid,
  timestamp,
  jsonb,
  integer,
  index,
} from "drizzle-orm/pg-core";

/**
 * Webhook Events Table
 * Stores inbound webhook events from payment gateways (Razorpay, Cashfree)
 * Used for traceability, reconciliation, and replay capability
 */
export const webhookEventsTable = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(), // razorpay, cashfree, stripe
    eventType: text("event_type").notNull(), // payment.success, transfer.success, etc.
    externalId: text("external_id").notNull().unique(), // Gateway's event ID (prevent duplicates)
    payload: jsonb("payload").notNull(), // Complete webhook payload
    signature: text("signature"), // Webhook signature (for verification)
    status: text("status").notNull().default("RECEIVED"), // RECEIVED, PROCESSED, FAILED
    processedAt: timestamp("processed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    retryCount: integer("retry_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index("webhook_events_provider_idx").on(t.provider),
    eventTypeIdx: index("webhook_events_event_type_idx").on(t.eventType),
    statusIdx: index("webhook_events_status_idx").on(t.status),
    externalIdIdx: index("webhook_events_external_id_idx").on(t.externalId),
  }),
);

export type WebhookEvent = typeof webhookEventsTable.$inferSelect;
export type InsertWebhookEvent = typeof webhookEventsTable.$inferInsert;
