import { pgTable, text, integer, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const threeFlopsScoresTable = pgTable(
  "three_flops_scores",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    playerToken: text("player_token").notNull(),
    score: integer("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tf_date_token_uidx").on(t.date, t.playerToken)],
);

export type ThreeFlopsScore = typeof threeFlopsScoresTable.$inferSelect;
