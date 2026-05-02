import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const threeStrikesChallengesTable = pgTable("three_strikes_challenges", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  totalCount: integer("total_count").notNull(),
  answers: text("answers").notNull(), // JSON: ThreeStrikesAnswer[]
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertThreeStrikesChallengeSchema = createInsertSchema(threeStrikesChallengesTable).omit({ createdAt: true });
export type InsertThreeStrikesChallenge = z.infer<typeof insertThreeStrikesChallengeSchema>;
export type ThreeStrikesChallenge = typeof threeStrikesChallengesTable.$inferSelect;
