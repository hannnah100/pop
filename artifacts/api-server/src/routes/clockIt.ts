import { Router, type IRouter } from "express";
// NOTE: filename preserved as guess-the-year.json — the JSON content is
// generic year-puzzle data and renaming the file would just churn git history
// for no functional gain.
import CLOCK_IT_JSON from "../data/daily/guess-the-year.json" with { type: "json" };
import { db, clockItScoresTable, playerNamesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

interface ClockItPuzzle {
  id: string;
  year: number;
  hints: [string, string, string];
}

const PUZZLES: ClockItPuzzle[] = CLOCK_IT_JSON as ClockItPuzzle[];

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

// Group puzzles by year once at module load so selectPuzzle is O(1).
const PUZZLES_BY_YEAR = new Map<number, ClockItPuzzle[]>();
for (const p of PUZZLES) {
  if (!PUZZLES_BY_YEAR.has(p.year)) PUZZLES_BY_YEAR.set(p.year, []);
  PUZZLES_BY_YEAR.get(p.year)!.push(p);
}
const PUZZLE_YEARS = [...PUZZLES_BY_YEAR.keys()].sort((a, b) => a - b);

/**
 * Two-level selection: cycle through years first, then rotate through each
 * year's hint sets on successive cycles.
 *
 * - Guarantees a different year every day for PUZZLE_YEARS.length days (37).
 * - After one full year-rotation, picks the next hint set for each year,
 *   so the same year+hint combo doesn't repeat for 37 × numSets days (≥111).
 * - Fully deterministic: same date always returns the same puzzle.
 */
function selectPuzzle(date: string): ClockItPuzzle {
  const [y, m, d] = date.split("-").map(Number);
  const dayIndex = Math.floor(
    (Date.UTC(y, m - 1, d) - Date.UTC(2024, 0, 1)) / 86_400_000,
  );

  const yearIdx = ((dayIndex % PUZZLE_YEARS.length) + PUZZLE_YEARS.length) % PUZZLE_YEARS.length;
  const year = PUZZLE_YEARS[yearIdx];
  const sets = PUZZLES_BY_YEAR.get(year)!;
  const cycle = Math.floor(Math.abs(dayIndex) / PUZZLE_YEARS.length);
  return sets[cycle % sets.length];
}

router.get("/daily/clock-it", (_req, res): void => {
  const today = todayDate();
  const puzzle = selectPuzzle(today);
  res.json({
    id: today,
    date: today,
    year: puzzle.year,
    hints: puzzle.hints,
  });
});

router.post("/daily/clock-it/check", (req, res): void => {
  const { id, guess, giveUp } = req.body as {
    id?: unknown;
    guess?: unknown;
    giveUp?: unknown;
  };

  if (typeof id !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const puzzle = selectPuzzle(id);

  if (giveUp === true) {
    res.json({ correct: false, year: puzzle.year });
    return;
  }

  if (typeof guess !== "number" || !Number.isInteger(guess)) {
    res.status(400).json({ error: "Invalid guess" });
    return;
  }

  const correct = guess === puzzle.year;
  res.json({
    correct,
    year: correct ? puzzle.year : undefined,
  });
});

router.get("/daily/clock-it/leaderboard", async (req, res): Promise<void> => {
  const date = (req.query.date as string) || todayDate();
  const playerToken = (req.query.playerToken as string) || "";

  const top10Rows = await db
    .select({
      playerToken: clockItScoresTable.playerToken,
      score: clockItScoresTable.score,
      hintsUsed: clockItScoresTable.hintsUsed,
      playerName: playerNamesTable.playerName,
    })
    .from(clockItScoresTable)
    .leftJoin(playerNamesTable, eq(clockItScoresTable.playerToken, playerNamesTable.playerToken))
    .where(eq(clockItScoresTable.date, date))
    .orderBy(desc(clockItScoresTable.score), clockItScoresTable.hintsUsed)
    .limit(10);

  const top10 = top10Rows.map((r, i) => ({
    rank: i + 1,
    playerToken: r.playerToken,
    score: r.score,
    hintsUsed: r.hintsUsed,
    playerName: r.playerName ?? null,
  }));

  const agg = await db
    .select({
      totalPlayers: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(round(avg(score)), 0)::int`,
    })
    .from(clockItScoresTable)
    .where(eq(clockItScoresTable.date, date))
    .then((r) => r[0] ?? { totalPlayers: 0, avgScore: 0 });

  let playerRank: number | null = null;
  if (playerToken) {
    const playerRow = await db
      .select({ score: clockItScoresTable.score, hintsUsed: clockItScoresTable.hintsUsed })
      .from(clockItScoresTable)
      .where(sql`${clockItScoresTable.date} = ${date} AND ${clockItScoresTable.playerToken} = ${playerToken}`)
      .limit(1)
      .then((rows) => rows[0]);

    if (playerRow !== undefined) {
      const above = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(clockItScoresTable)
        .where(
          sql`${clockItScoresTable.date} = ${date} AND (${clockItScoresTable.score} > ${playerRow.score} OR (${clockItScoresTable.score} = ${playerRow.score} AND ${clockItScoresTable.hintsUsed} < ${playerRow.hintsUsed}))`,
        )
        .then((r) => r[0]?.cnt ?? 0);
      playerRank = above + 1;
    }
  }

  res.json({
    date,
    top10,
    totalPlayers: agg.totalPlayers,
    avgScore: agg.avgScore,
    playerRank,
  });
});

router.post("/daily/clock-it/score", async (req, res): Promise<void> => {
  const { playerToken, score, hintsUsed, date } = req.body as {
    playerToken?: unknown;
    score?: unknown;
    hintsUsed?: unknown;
    date?: unknown;
  };

  if (
    typeof playerToken !== "string" ||
    playerToken.length < 1 ||
    playerToken.length > 64 ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > 3 ||
    typeof hintsUsed !== "number" ||
    !Number.isInteger(hintsUsed) ||
    hintsUsed < 1 ||
    hintsUsed > 3 ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  await db
    .insert(clockItScoresTable)
    .values({ date, playerToken, score, hintsUsed })
    .onConflictDoUpdate({
      target: [clockItScoresTable.date, clockItScoresTable.playerToken],
      set: {
        score: sql`greatest(${clockItScoresTable.score}, excluded.score)`,
        hintsUsed: sql`least(${clockItScoresTable.hintsUsed}, excluded.hints_used)`,
        createdAt: sql`${clockItScoresTable.createdAt}`,
      },
    });

  res.json({ ok: true });
});

export default router;
