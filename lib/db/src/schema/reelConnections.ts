import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reelConnectionsChallengesTable = pgTable("reel_connections_challenges", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  actors: text("actors").notNull(), // JSON: string[] (length 6)
  validAnswers: text("valid_answers").notNull(), // JSON: string[][] (length 5)
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReelConnectionsChallengeSchema = createInsertSchema(reelConnectionsChallengesTable).omit({ createdAt: true });
export type InsertReelConnectionsChallenge = z.infer<typeof insertReelConnectionsChallengeSchema>;
export type ReelConnectionsChallenge = typeof reelConnectionsChallengesTable.$inferSelect;
