import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Physical table name was renamed from "three_strikes_challenges" to
// "three_flops_challenges" in migration 0002. The rename is a single
// metadata-only ALTER TABLE — no row data is touched.
export const threeFlopsChallengesTable = pgTable("three_flops_challenges", {
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
