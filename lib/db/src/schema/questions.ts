import { pgTable, text, integer, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const popQuestionPromptsTable = pgTable("pop_question_prompts", {
  id: serial("id").primaryKey(),
  prompt: text("prompt").notNull(),
  category: text("category"),
  isActive: boolean("is_active").default(true),
});

export const roastQuestionsTable = pgTable("roast_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  color: text("color"),
  category: text("category"),
  isActive: boolean("is_active").default(true),
});

export const insertPopQuestionPromptSchema = createInsertSchema(popQuestionPromptsTable).omit({ id: true });
export const insertRoastQuestionSchema = createInsertSchema(roastQuestionsTable).omit({ id: true });

export type InsertPopQuestionPrompt = z.infer<typeof insertPopQuestionPromptSchema>;
export type InsertRoastQuestion = z.infer<typeof insertRoastQuestionSchema>;
export type PopQuestionPrompt = typeof popQuestionPromptsTable.$inferSelect;
export type RoastQuestion = typeof roastQuestionsTable.$inferSelect;
