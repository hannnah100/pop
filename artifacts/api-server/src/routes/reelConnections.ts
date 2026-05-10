import { Router, type IRouter } from "express";
import { db, reelConnectionsScoresTable, playerNamesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

const MAX_SCORE = 6;

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/daily/reel-connections/leaderboard", async (req, res): Promise<void> => {
  const date = (req.query.date as string) || todayDate();
  const playerToken = (req.query.playerToken as string) || "";

  const top10Rows = await db
    .select({
      playerToken: reelConnectionsScoresTable.playerToken,
      score: reelConnectionsScoresTable.score,
      playerName: playerNamesTable.playerName,
    })
    .from(reelConnectionsScoresTable)
    .leftJoin(playerNamesTable, eq(reelConnectionsScoresTable.playerToken, playerNamesTable.playerToken))
    .where(eq(reelConnectionsScoresTable.date, date))
    .orderBy(desc(reelConnectionsScoresTable.score))
    .limit(10);

  const top10 = top10Rows.map((r, i) => ({
    rank: i + 1,
    playerToken: r.playerToken,
    score: r.score,
    playerName: r.playerName ?? null,
  }));

  const agg = await db
    .select({
      totalPlayers: sql<number>`count(*)::int`,
      avgScore: sql<number>`coalesce(round(avg(score), 2), 0)::float`,
    })
    .from(reelConnectionsScoresTable)
    .where(eq(reelConnectionsScoresTable.date, date))
    .then((r) => r[0] ?? { totalPlayers: 0, avgScore: 0 });

  const medianRow = await db
    .select({
      medianScore: sql<number>`coalesce(percentile_cont(0.5) within group (order by score), 0)::float`,
    })
    .from(reelConnectionsScoresTable)
    .where(eq(reelConnectionsScoresTable.date, date))
    .then((r) => r[0]);
  const medianScore = medianRow?.medianScore ?? 0;

  let playerRank: number | null = null;
  if (playerToken) {
    const playerRow = await db
      .select({ score: reelConnectionsScoresTable.score })
      .from(reelConnectionsScoresTable)
      .where(
        sql`${reelConnectionsScoresTable.date} = ${date} AND ${reelConnectionsScoresTable.playerToken} = ${playerToken}`,
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (playerRow !== undefined) {
      const above = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(reelConnectionsScoresTable)
        .where(
          sql`${reelConnectionsScoresTable.date} = ${date} AND ${reelConnectionsScoresTable.score} > ${playerRow.score}`,
        )
        .then((r) => r[0]?.cnt ?? 0);
      playerRank = above + 1;
    }
  }

  res.json({ date, top10, totalPlayers: agg.totalPlayers, avgScore: agg.avgScore, medianScore, playerRank });
});

router.post("/daily/reel-connections/score", async (req, res): Promise<void> => {
  const { playerToken, score, date } = req.body as {
    playerToken?: unknown;
    score?: unknown;
    date?: unknown;
  };

  if (
    typeof playerToken !== "string" ||
    playerToken.length < 1 ||
    playerToken.length > 64 ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 0 ||
    score > MAX_SCORE ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  await db
    .insert(reelConnectionsScoresTable)
    .values({ date, playerToken, score })
    .onConflictDoUpdate({
      target: [reelConnectionsScoresTable.date, reelConnectionsScoresTable.playerToken],
      set: {
        score: sql`greatest(${reelConnectionsScoresTable.score}, excluded.score)`,
        createdAt: sql`${reelConnectionsScoresTable.createdAt}`,
      },
    });

  res.json({ ok: true });
});

export default router;
