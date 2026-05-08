import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // Firebase UID
  username: text("username").notNull().unique(),
  email: text("email"),
  authProvider: text("auth_provider").notNull(), // 'google' | 'apple' | 'email'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
