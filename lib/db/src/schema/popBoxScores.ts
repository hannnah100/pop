import { pgTable, text, integer, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const popBoxScoresTable = pgTable(
  "pop_box_scores",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    playerToken: text("player_token").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pb_date_token_uidx").on(t.date, t.playerToken)],
);

export type PopBoxScore = typeof popBoxScoresTable.$inferSelect;
