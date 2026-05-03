import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// NOTE: The physical table name is preserved as "three_strikes_challenges"
// from before the game was renamed to "Three Flops". Renaming the table in
// production would require a migration with downtime risk, and there is no
// behavioural reason to rename it — Drizzle binds via the symbol, not the
// physical name. All TS identifiers use the new "threeFlops" naming.
export const threeFlopsChallengesTable = pgTable("three_strikes_challenges", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  totalCount: integer("total_count").notNull(),
  answers: text("answers").notNull(), // JSON: ThreeFlopsAnswer[]
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertThreeFlopsChallengeSchema = createInsertSchema(threeFlopsChallengesTable).omit({ createdAt: true });
export type InsertThreeFlopsChallenge = z.infer<typeof insertThreeFlopsChallengeSchema>;
export type ThreeFlopsChallenge = typeof threeFlopsChallengesTable.$inferSelect;
