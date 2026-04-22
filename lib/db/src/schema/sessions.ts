import {
  pgTable,
  text,
  uuid,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Sessions Table
 * Manages user sessions and refresh tokens
 * Used for authentication, device tracking, and session invalidation
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id),
    refreshToken: text("refresh_token").notNull().unique(), // Hashed refresh token
    deviceId: text("device_id"), // For multi-device session tracking
    deviceName: text("device_name"), // Mobile, Web, etc.
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").notNull().default(true),
    lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("sessions_user_idx").on(t.userId),
    tokenIdx: index("sessions_token_idx").on(t.refreshToken),
    activeIdx: index("sessions_active_idx").on(t.isActive),
  }),
);

export type Session = typeof sessionsTable.$inferSelect;
export type InsertSession = typeof sessionsTable.$inferInsert;
