import { Router, type IRouter } from "express";
import { db, popOrDropScoresTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import POP_OR_DROP_ITEMS_JSON from "../data/daily/pop-or-drop-items.json" with { type: "json" };

const router: IRouter = Router();

interface PopOrDropItem {
  id: string;
  name: string;
  value: number;
  unit: string;
  metricLabel: string;
  category: string;
}

const ITEMS: PopOrDropItem[] = POP_OR_DROP_ITEMS_JSON as PopOrDropItem[];

// 21 items = 20 pairs / 20 rounds
const SEQUENCE_LENGTH = 21;
const MAX_STREAK = SEQUENCE_LENGTH - 1; // 20

function lcgRng(seed: number) {
  let s = seed;
  return () => {
    s = (1664525 * s + 1013904223) & 0xffffffff;
    return (s >>> 0) / 4294967296;
  };
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function dateSeed(date: string): number {
  return parseInt(date.replace(/-/g, ""), 10);
}

function generateSequence(date: string): PopOrDropItem[] {
  const rng = lcgRng(dateSeed(date));
  const pool = [...ITEMS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, SEQUENCE_LENGTH);
}

router.get("/daily/pop-or-drop", (_req, res): void => {
  const today = todayDate();
  const items = generateSequence(today);
  res.json({ date: today, items });
});

router.get("/daily/pop-or-drop/leaderboard", async (req, res): Promise<void> => {
  const date = (req.query.date as string) || todayDate();
  const playerToken = (req.query.playerToken as string) || "";

  // Fetch top 10 via DB ordering — no artificial limit needed for top10
  const top10Rows = await db
    .select({
      playerToken: popOrDropScoresTable.playerToken,
      streak: popOrDropScoresTable.streak,
    })
    .from(popOrDropScoresTable)
    .where(eq(popOrDropScoresTable.date, date))
    .orderBy(desc(popOrDropScoresTable.streak))
    .limit(10);

  const top10 = top10Rows.map((r, i) => ({
    rank: i + 1,
    playerToken: r.playerToken,
    streak: r.streak,
  }));

  // Aggregate stats from DB (avoids loading all rows into memory)
  const agg = await db
    .select({
      totalPlayers: sql<number>`count(*)::int`,
      avgStreak: sql<number>`coalesce(round(avg(streak)), 0)::int`,
    })
    .from(popOrDropScoresTable)
    .where(eq(popOrDropScoresTable.date, date))
    .then((r) => r[0] ?? { totalPlayers: 0, avgStreak: 0 });

  // Median via percentile_cont — coalesced to 0 when no rows
  const medianRow = await db
    .select({
      medianStreak: sql<number>`coalesce(percentile_cont(0.5) within group (order by streak), 0)::int`,
    })
    .from(popOrDropScoresTable)
    .where(eq(popOrDropScoresTable.date, date))
    .then((r) => r[0]);
  const medianStreak = medianRow?.medianStreak ?? 0;

  // Player's exact rank via COUNT — works for any number of players
  let playerRank: number | null = null;
  if (playerToken) {
    const playerRow = await db
      .select({ streak: popOrDropScoresTable.streak })
      .from(popOrDropScoresTable)
      .where(
        sql`${popOrDropScoresTable.date} = ${date} AND ${popOrDropScoresTable.playerToken} = ${playerToken}`,
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (playerRow !== undefined) {
      const above = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(popOrDropScoresTable)
        .where(
          sql`${popOrDropScoresTable.date} = ${date} AND ${popOrDropScoresTable.streak} > ${playerRow.streak}`,
        )
        .then((r) => r[0]?.cnt ?? 0);
      playerRank = above + 1;
    }
  }

  res.json({
    date,
    top10,
    totalPlayers: agg.totalPlayers,
    avgStreak: agg.avgStreak,
    medianStreak,
    playerRank,
  });
});

router.post("/daily/pop-or-drop/score", async (req, res): Promise<void> => {
  const { playerToken, streak, date } = req.body as {
    playerToken?: unknown;
    streak?: unknown;
    date?: unknown;
  };

  if (
    typeof playerToken !== "string" ||
    playerToken.length < 1 ||
    playerToken.length > 64 ||
    typeof streak !== "number" ||
    !Number.isInteger(streak) ||
    streak < 0 ||
    streak > MAX_STREAK ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  // Atomic upsert: insert or update if new streak is better
  await db
    .insert(popOrDropScoresTable)
    .values({ date, playerToken, streak })
    .onConflictDoUpdate({
      target: [popOrDropScoresTable.date, popOrDropScoresTable.playerToken],
      set: {
        streak: sql`greatest(${popOrDropScoresTable.streak}, excluded.streak)`,
        createdAt: sql`${popOrDropScoresTable.createdAt}`,
      },
    });

  res.json({ ok: true });
});

export default router;
