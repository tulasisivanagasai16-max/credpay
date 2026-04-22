import { pgTable, text, timestamp, uuid, boolean, numeric, index } from "drizzle-orm/pg-core";

/**
 * Users Table
 * Core user information
 * Sensitive data (password hash, encrypted fields) should never be returned in API responses
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    phoneNumber: text("phone_number").unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"), // user, admin, support
    isEmailVerified: boolean("is_email_verified").notNull().default(false),
    isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
    dailyTransactionLimit: numeric("daily_transaction_limit", { precision: 20, scale: 0 }).default("500000"), // ₹5000 by default (in paise)
    profilePhotoUrl: text("profile_photo_url"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    lastIpAddress: text("last_ip_address"),
    isActive: boolean("is_active").notNull().default(true),
    isSuspended: boolean("is_suspended").notNull().default(false),
    suspensionReason: text("suspension_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index("users_email_idx").on(t.email),
    phoneIdx: index("users_phone_idx").on(t.phoneNumber),
    activeIdx: index("users_active_idx").on(t.isActive),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
