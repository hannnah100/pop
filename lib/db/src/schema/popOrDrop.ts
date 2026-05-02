import { pgTable, text, integer, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const popOrDropScoresTable = pgTable("pop_or_drop_scores", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  playerToken: text("player_token").notNull(),
  streak: integer("streak").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPopOrDropScoreSchema = createInsertSchema(popOrDropScoresTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPopOrDropScore = z.infer<typeof insertPopOrDropScoreSchema>;
export type PopOrDropScore = typeof popOrDropScoresTable.$inferSelect;
