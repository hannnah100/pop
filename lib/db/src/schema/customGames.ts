import { pgTable, text, serial, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customJeopardyPacksTable = pgTable("custom_jeopardy_packs", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customWofPacksTable = pgTable("custom_wof_packs", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customQuizPacksTable = pgTable("custom_quiz_packs", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomJeopardyPackSchema = createInsertSchema(customJeopardyPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomJeopardyPackSchema = createSelectSchema(customJeopardyPacksTable);

export const insertCustomWofPackSchema = createInsertSchema(customWofPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomWofPackSchema = createSelectSchema(customWofPacksTable);

export const insertCustomQuizPackSchema = createInsertSchema(customQuizPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomQuizPackSchema = createSelectSchema(customQuizPacksTable);

export type CustomJeopardyPack = typeof customJeopardyPacksTable.$inferSelect;
export type CustomWofPack = typeof customWofPacksTable.$inferSelect;
export type CustomQuizPack = typeof customQuizPacksTable.$inferSelect;

export type InsertCustomJeopardyPack = z.infer<typeof insertCustomJeopardyPackSchema>;
export type InsertCustomWofPack = z.infer<typeof insertCustomWofPackSchema>;
export type InsertCustomQuizPack = z.infer<typeof insertCustomQuizPackSchema>;
