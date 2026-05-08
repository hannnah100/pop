import { pgTable, text, integer, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const clockItScoresTable = pgTable(
  "clock_it_scores",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    playerToken: text("player_token").notNull(),
    score: integer("score").notNull(),
    hintsUsed: integer("hints_used").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ci_date_token_uidx").on(t.date, t.playerToken)],
);

export type ClockItScore = typeof clockItScoresTable.$inferSelect;
