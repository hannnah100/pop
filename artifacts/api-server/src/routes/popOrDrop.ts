import { Router, type IRouter } from "express";
import { db, popOrDropScoresTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
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

  const rows = await db
    .select({
      playerToken: popOrDropScoresTable.playerToken,
      streak: popOrDropScoresTable.streak,
    })
    .from(popOrDropScoresTable)
    .where(eq(popOrDropScoresTable.date, date))
    .orderBy(desc(popOrDropScoresTable.streak))
    .limit(500);

  // De-duplicate by playerToken, keep highest streak per token
  const best = new Map<string, { playerToken: string; streak: number }>();
  for (const row of rows) {
    const existing = best.get(row.playerToken);
    if (!existing || row.streak > existing.streak) {
      best.set(row.playerToken, { playerToken: row.playerToken, streak: row.streak });
    }
  }

  const sorted = [...best.values()].sort((a, b) => b.streak - a.streak);
  const top10 = sorted.slice(0, 10).map((r, i) => ({
    rank: i + 1,
    playerToken: r.playerToken,
    streak: r.streak,
  }));

  const allStreaks = sorted.map((r) => r.streak);
  const totalPlayers = allStreaks.length;
  const avgStreak =
    totalPlayers > 0
      ? Math.round(allStreaks.reduce((a, b) => a + b, 0) / totalPlayers)
      : 0;
  const medianStreak =
    totalPlayers > 0
      ? allStreaks[Math.floor(totalPlayers / 2)]
      : 0;

  // Find caller's rank (may be outside top 10)
  let playerRank: number | null = null;
  if (playerToken) {
    const idx = sorted.findIndex((r) => r.playerToken === playerToken);
    if (idx !== -1) {
      playerRank = idx + 1;
    }
  }

  res.json({ date, top10, totalPlayers, avgStreak, medianStreak, playerRank });
});

router.post("/daily/pop-or-drop/score", async (req, res): Promise<void> => {
  const { playerToken, streak, date } = req.body as {
    playerToken?: unknown;
    streak?: unknown;
    date?: unknown;
  };

  if (
    typeof playerToken !== "string" || playerToken.length < 1 || playerToken.length > 64 ||
    typeof streak !== "number" || !Number.isInteger(streak) || streak < 0 ||
    typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const existing = await db
    .select({ streak: popOrDropScoresTable.streak })
    .from(popOrDropScoresTable)
    .where(
      and(
        eq(popOrDropScoresTable.date, date),
        eq(popOrDropScoresTable.playerToken, playerToken),
      ),
    )
    .limit(1)
    .then((r) => r[0]);

  if (!existing) {
    await db.insert(popOrDropScoresTable).values({ date, playerToken, streak });
  } else if (streak > existing.streak) {
    await db
      .delete(popOrDropScoresTable)
      .where(
        and(
          eq(popOrDropScoresTable.date, date),
          eq(popOrDropScoresTable.playerToken, playerToken),
        ),
      );
    await db.insert(popOrDropScoresTable).values({ date, playerToken, streak });
  }

  res.json({ ok: true });
});

export default router;
