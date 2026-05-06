import { pgTable, text, integer, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const skinnyScoresTable = pgTable(
  "skinny_scores",
  {
    id: serial("id").primaryKey(),
    puzzleId: text("puzzle_id").notNull(),
    playerToken: text("player_token").notNull(),
    completionTimeSecs: integer("completion_time_secs").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("skinny_puzzle_token_uidx").on(t.puzzleId, t.playerToken)],
);

export type SkinnyScore = typeof skinnyScoresTable.$inferSelect;
