import {
  db,
  threeFlopsChallengesTable,
  crosswordPuzzlesTable,
  popBoxGridsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "./logger";
import {
  THREE_FLOPS_SEED,
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
  "crossword-2026-05-02",
  "crossword-2026-05-03",
];

/**
 * Idempotently seed the daily-challenge tables from bundled JSON content.
 * Only inserts rows whose `id` does not already exist, so it is safe to
 * run on every server start. Lets us ship new archive content with a
 * republish — no manual SQL on production.
 */
export async function seedDailyContent(): Promise<void> {
  try {
    await Promise.all([seedThreeFlops(), seedCrossword(), seedPopBox()]);
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

/**
 * Three Flops entries whose dates were swapped after initial seeding.
 * These updates run on every startup so production DBs stay in sync.
 */
const THREE_FLOPS_DATE_FIXES: Array<{ id: string; date: string }> = [
  { id: "ryan-gosling-movies", date: "2026-05-04" },
  { id: "lady-gaga-albums",    date: "2026-09-05" },
];

/**
 * IDs whose `answers` field was corrected after initial seeding (hints trimmed
 * to year-only or blanked). Listed here so the DB row is patched on every
 * server start regardless of when it was first seeded.
 */
const THREE_FLOPS_ANSWERS_FIX_IDS = new Set([
  "ryan-gosling-movies",
  "super-bowl-champions-2000s",
  "office-main-cast",
  "summer-olympics-hosts-2000s",
  "original-avengers-2012",
  "harry-potter-books",
  "adele-albums",
  "james-bond-actors",
  "breaking-bad-characters",
  "mj-solo-albums",
  "bts-members",
  "one-direction-members",
  "grammy-song-of-year-2015-2025",
  "ariana-grande-albums",
  "oscar-best-picture-2016-2025",
  "fast-furious-main-series",
  "friends-characters-full",
  "billie-eilish-albums",
  "spider-man-film-actors",
  "simpsons-family",
  "harry-styles-albums",
  "coldplay-albums",
  "hunger-games-books",
  "star-wars-skywalker-saga",
  "afc-east-teams",
  "stranger-things-s1-cast",
  "mean-girls-characters",
  "f1-champions-2010-2024",
  "grammy-record-of-year-2019-2025",
  "the-beatles-members",
  "spice-girls-members",
  "nsync-members",
  "backstreet-boys-members",
  "destinys-child-members",
  "bruno-mars-albums",
  "katy-perry-albums",
  "the-weeknd-albums",
  "christopher-nolan-films",
  "tarantino-films",
  "oscar-best-actor-2010-2025",
  "oscar-best-director-2010-2025",
  "us-presidents-since-1990",
  "ivy-league-universities",
  "planets-solar-system",
  "fifa-world-cup-winners-1998",
  "seinfeld-characters",
  "himym-characters",
  "big-bang-theory-characters",
  "justin-timberlake-albums",
  "justin-bieber-albums",
  "dua-lipa-albums",
  "tyler-the-creator-albums",
  "kendrick-lamar-albums",
  "post-malone-albums",
  "rolling-stones-founding",
  "u2-members",
  "rhcp-classic-lineup",
  "uk-prime-ministers-2000",
  "seven-wonders-ancient",
  "new-seven-wonders",
  "g7-countries",
  "nfl-nfc-east",
  "nfl-nfc-west",
  "nfl-nfc-north",
  "nfl-nfc-south",
  "us-states-border-mexico",
  "us-states-border-canada",
  "fifth-harmony-members",
  "game-awards-goty-2015-2024",
  "oscar-best-animated-2010-2025",
  "little-mix-albums",
  "vampire-weekend-albums",
  "peaky-blinders-characters",
  "house-of-dragon-characters",
  "stark-children-got",
  "yellowstone-characters",
  "the-wire-characters",
  "frasier-characters",
  "modern-family-adults",
  "abba-members",
  "foo-fighters-lineup",
  "brics-original-members",
  "playstation-consoles",
  "nintendo-home-consoles",
  "gta-main-games",
  "radiohead-members",
  "natural-wonders-world",
  "hunger-games-films",
  "grammy-best-new-artist-2015-2025",
  "wimbledon-mens-unique-champs",
  "fifa-world-cup-hosts-2006-2026",
  "nba-champions-2000s",
  "best-actress-oscars",
  "best-picture-1990s",
]);

async function seedThreeFlops(): Promise<void> {
  // Apply any date corrections to existing rows first.
  for (const fix of THREE_FLOPS_DATE_FIXES) {
    await db
      .update(threeFlopsChallengesTable)
      .set({ date: fix.date })
      .where(eq(threeFlopsChallengesTable.id, fix.id));
  }

  // Push corrected answers to already-seeded rows so hint changes in the JSON
  // propagate to the DB without needing to delete and re-seed.
  const answerFixes = THREE_FLOPS_SEED.filter((r) =>
    THREE_FLOPS_ANSWERS_FIX_IDS.has(r.id),
  );
  for (const fix of answerFixes) {
    await db
      .update(threeFlopsChallengesTable)
      .set({ answers: fix.answers })
      .where(eq(threeFlopsChallengesTable.id, fix.id));
  }

  if (THREE_FLOPS_SEED.length === 0) return;

  const ids = THREE_FLOPS_SEED.map((r) => r.id);
  const existing = await db
    .select({ id: threeFlopsChallengesTable.id })
    .from(threeFlopsChallengesTable)
    .where(inArray(threeFlopsChallengesTable.id, ids));
  const have = new Set(existing.map((r) => r.id));

  const missing = THREE_FLOPS_SEED.filter((r) => !have.has(r.id));
  if (missing.length === 0) {
    logger.info(
      { total: THREE_FLOPS_SEED.length },
      "Three Flops archive already up to date",
    );
    return;
  }

  await db.insert(threeFlopsChallengesTable).values(missing);
  logger.info(
    { inserted: missing.length, total: THREE_FLOPS_SEED.length },
    "Seeded Three Flops archive",
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
