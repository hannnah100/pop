import { pgTable, text, integer, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const popOrDropScoresTable = pgTable(
  "pop_or_drop_scores",
  {
    id: serial("id").primaryKey(),
    date: text("date").notNull(),
    playerToken: text("player_token").notNull(),
    streak: integer("streak").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pod_date_token_uidx").on(t.date, t.playerToken)],
);

export type PopOrDropScore = typeof popOrDropScoresTable.$inferSelect;
