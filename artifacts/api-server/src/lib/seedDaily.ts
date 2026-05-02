import {
  db,
  threeStrikesChallengesTable,
  crosswordPuzzlesTable,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import { logger } from "./logger";
import {
  THREE_STRIKES_SEED,
  CROSSWORD_SEED,
} from "../data/daily";

/**
 * Idempotently seed the daily-challenge tables from bundled JSON content.
 * Only inserts rows whose `id` does not already exist, so it is safe to
 * run on every server start. Lets us ship new archive content with a
 * republish — no manual SQL on production.
 */
export async function seedDailyContent(): Promise<void> {
  try {
    await Promise.all([seedThreeStrikes(), seedCrossword()]);
  } catch (err) {
    // Don't crash the server if seeding fails — just log it. The API still
    // works; the Archive page will show whatever rows are present.
    logger.error({ err }, "Failed to seed daily content");
  }
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
