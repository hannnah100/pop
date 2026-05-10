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

export const customPollPacksTable = pgTable("custom_poll_packs", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customScattergoriesPacksTable = pgTable("custom_scattergories_packs", {
  id: serial("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  title: text("title").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customRoastPacksTable = pgTable("custom_roast_packs", {
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

export const insertCustomPollPackSchema = createInsertSchema(customPollPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomPollPackSchema = createSelectSchema(customPollPacksTable);

export const insertCustomScattergoriesPackSchema = createInsertSchema(customScattergoriesPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomScattergoriesPackSchema = createSelectSchema(customScattergoriesPacksTable);

export const insertCustomRoastPackSchema = createInsertSchema(customRoastPacksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const selectCustomRoastPackSchema = createSelectSchema(customRoastPacksTable);

export type CustomJeopardyPack = typeof customJeopardyPacksTable.$inferSelect;
export type CustomWofPack = typeof customWofPacksTable.$inferSelect;
export type CustomQuizPack = typeof customQuizPacksTable.$inferSelect;
export type CustomPollPack = typeof customPollPacksTable.$inferSelect;
export type CustomScattergoriesPack = typeof customScattergoriesPacksTable.$inferSelect;
export type CustomRoastPack = typeof customRoastPacksTable.$inferSelect;

export type InsertCustomJeopardyPack = z.infer<typeof insertCustomJeopardyPackSchema>;
export type InsertCustomWofPack = z.infer<typeof insertCustomWofPackSchema>;
export type InsertCustomQuizPack = z.infer<typeof insertCustomQuizPackSchema>;
export type InsertCustomPollPack = z.infer<typeof insertCustomPollPackSchema>;
export type InsertCustomScattergoriesPack = z.infer<typeof insertCustomScattergoriesPackSchema>;
export type InsertCustomRoastPack = z.infer<typeof insertCustomRoastPackSchema>;
