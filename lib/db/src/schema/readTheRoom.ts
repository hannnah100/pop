import { pgTable, text, integer, boolean, timestamp, serial, primaryKey } from "drizzle-orm/pg-core";

export const readTheRoomRoomsTable = pgTable("read_the_room_rooms", {
  roomCode: text("room_code").primaryKey(),
  hostId: text("host_id").notNull(),
  currentRound: integer("current_round").notNull().default(0),
  gameState: text("game_state").notNull().default("lobby"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const readTheRoomAnswersTable = pgTable(
  "read_the_room_answers",
  {
    id: serial("id").primaryKey(),
    roomCode: text("room_code").notNull(),
    round: integer("round").notNull(),
    playerId: text("player_id").notNull(),
    answer: text("answer").notNull(),
    revealed: boolean("revealed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const readTheRoomDartsTable = pgTable(
  "read_the_room_darts",
  {
    roomCode: text("room_code").notNull(),
    playerId: text("player_id").notNull(),
    round: integer("round").notNull(),
    targetAnswer: text("target_answer").notNull(),
    targetPlayer: text("target_player").notNull(),
    used: boolean("used").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomCode, t.playerId] })],
);

export const readTheRoomScoresTable = pgTable(
  "read_the_room_scores",
  {
    roomCode: text("room_code").notNull(),
    playerId: text("player_id").notNull(),
    totalScore: integer("total_score").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.roomCode, t.playerId] })],
);

export type ReadTheRoomRoom = typeof readTheRoomRoomsTable.$inferSelect;
export type ReadTheRoomAnswer = typeof readTheRoomAnswersTable.$inferSelect;
export type ReadTheRoomDart = typeof readTheRoomDartsTable.$inferSelect;
export type ReadTheRoomScore = typeof readTheRoomScoresTable.$inferSelect;
