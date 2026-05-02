import {
  db,
  threeStrikesChallengesTable,
  crosswordPuzzlesTable,
  popBoxGridsTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";
import {
  THREE_STRIKES_SEED,
  CROSSWORD_SEED,
  POP_BOX_SEED,
} from "../data/daily";

/**
 * IDs of crossword puzzles that were shipped with bad data and must be removed
 * from the database on every server start. Add an id here whenever a puzzle
 * needs to be retracted from production.
 */
const STALE_CROSSWORD_IDS = [
  "crossword-2025-04-30",
  "crossword-2025-05-01",
  "crossword-2025-05-02",
];

/**
 * Idempotently seed the daily-challenge tables from bundled JSON content.
 * Only inserts rows whose `id` does not already exist, so it is safe to
 * run on every server start. Lets us ship new archive content with a
 * republish — no manual SQL on production.
 */
export async function seedDailyContent(): Promise<void> {
  try {
    await Promise.all([seedThreeStrikes(), seedCrossword(), seedPopBox()]);
  } catch (err) {
    // Don't crash the server if seeding fails — just log it. The API still
    // works; the Archive page will show whatever rows are present.
    logger.error({ err }, "Failed to seed daily content");
  }
}

async function seedPopBox(): Promise<void> {
  if (POP_BOX_SEED.length === 0) return;

  const ids = POP_BOX_SEED.map((r) => r.id);
  const existing = await db
    .select({ id: popBoxGridsTable.id })
    .from(popBoxGridsTable)
    .where(inArray(popBoxGridsTable.id, ids));
  const have = new Set(existing.map((r) => r.id));

  const missing = POP_BOX_SEED.filter((r) => !have.has(r.id));
  if (missing.length === 0) {
    logger.info(
      { total: POP_BOX_SEED.length },
      "Pop Box archive already up to date",
    );
    return;
  }

  await db.insert(popBoxGridsTable).values(missing);
  logger.info(
    { inserted: missing.length, total: POP_BOX_SEED.length },
    "Seeded Pop Box archive",
  );
}

async function seedThreeStrikes(): Promise<void> {
  if (THREE_STRIKES_SEED.length === 0) return;

  const ids = THREE_STRIKES_SEED.map((r) => r.id);
  const existing = await db
    .select({ id: threeStrikesChallengesTable.id })
    .from(threeStrikesChallengesTable)
    .where(inArray(threeStrikesChallengesTable.id, ids));
  const have = new Set(existing.map((r) => r.id));

  const missing = THREE_STRIKES_SEED.filter((r) => !have.has(r.id));
  if (missing.length === 0) {
    logger.info(
      { total: THREE_STRIKES_SEED.length },
      "Three Strikes archive already up to date",
    );
    return;
  }

  await db.insert(threeStrikesChallengesTable).values(missing);
  logger.info(
    { inserted: missing.length, total: THREE_STRIKES_SEED.length },
    "Seeded Three Strikes archive",
  );
}

async function seedCrossword(): Promise<void> {
  // Purge any stale/broken puzzles that were previously shipped.
  if (STALE_CROSSWORD_IDS.length > 0) {
    const deleted = await db
      .delete(crosswordPuzzlesTable)
      .where(inArray(crosswordPuzzlesTable.id, STALE_CROSSWORD_IDS));
    if (deleted.rowCount && deleted.rowCount > 0) {
      logger.info(
        { count: deleted.rowCount, ids: STALE_CROSSWORD_IDS },
        "Purged stale crossword puzzles",
      );
    }
  }

  if (CROSSWORD_SEED.length === 0) return;

  const ids = CROSSWORD_SEED.map((r) => r.id);
  const existing = await db
    .select({ id: crosswordPuzzlesTable.id })
    .from(crosswordPuzzlesTable)
    .where(inArray(crosswordPuzzlesTable.id, ids));
  const have = new Set(existing.map((r) => r.id));

  const missing = CROSSWORD_SEED.filter((r) => !have.has(r.id));
  if (missing.length === 0) {
    logger.info(
      { total: CROSSWORD_SEED.length },
      "Crossword archive already up to date",
    );
    return;
  }

  await db.insert(crosswordPuzzlesTable).values(missing);
  logger.info(
    { inserted: missing.length, total: CROSSWORD_SEED.length },
    "Seeded Crossword archive",
  );
}
