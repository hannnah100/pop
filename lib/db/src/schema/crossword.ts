import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crosswordPuzzlesTable = pgTable("crossword_puzzles", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  grid: text("grid").notNull(),          // JSON: string[][]
  blackSquares: text("black_squares").notNull(), // JSON: [number, number][]
  cluesAcross: text("clues_across").notNull(),   // JSON: Record<string, string>
  cluesDown: text("clues_down").notNull(),        // JSON: Record<string, string>
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCrosswordPuzzleSchema = createInsertSchema(crosswordPuzzlesTable).omit({ createdAt: true });
export type InsertCrosswordPuzzle = z.infer<typeof insertCrosswordPuzzleSchema>;
export type CrosswordPuzzle = typeof crosswordPuzzlesTable.$inferSelect;
