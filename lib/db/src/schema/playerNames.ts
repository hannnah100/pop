import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const playerNamesTable = pgTable("player_names", {
  playerToken: text("player_token").primaryKey(),
  playerName: text("player_name").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PlayerName = typeof playerNamesTable.$inferSelect;
