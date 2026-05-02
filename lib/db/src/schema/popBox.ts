import { pgTable, text, integer, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const popBoxGridsTable = pgTable("pop_box_grids", {
  id: text("id").primaryKey(),
  date: text("date").notNull(),
  difficulty: text("difficulty").notNull(),
  rowCategoryIds: text("row_category_ids").notNull(),
  columnCategoryIds: text("column_category_ids").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const popBoxAnswerCountsTable = pgTable(
  "pop_box_answer_counts",
  {
    gridId: text("grid_id").notNull(),
    squareIndex: integer("square_index").notNull(),
    celebrityId: text("celebrity_id").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.gridId, t.squareIndex, t.celebrityId] }),
  ],
);

export const insertPopBoxGridSchema = createInsertSchema(popBoxGridsTable).omit({ createdAt: true });
export type InsertPopBoxGrid = z.infer<typeof insertPopBoxGridSchema>;
export type PopBoxGrid = typeof popBoxGridsTable.$inferSelect;
export type PopBoxAnswerCount = typeof popBoxAnswerCountsTable.$inferSelect;
