import { Router, type IRouter } from "express";
import { db, skinnyScoresTable, playerNamesTable } from "@workspace/db";
import { eq, asc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/skinny/leaderboard", async (req, res): Promise<void> => {
  const puzzleId = (req.query.puzzleId as string) || "";
  const playerToken = (req.query.playerToken as string) || "";

  if (!puzzleId) {
    res.status(400).json({ error: "puzzleId is required" });
    return;
  }

  const top10Rows = await db
    .select({
      playerToken: skinnyScoresTable.playerToken,
      completionTimeSecs: skinnyScoresTable.completionTimeSecs,
      playerName: playerNamesTable.playerName,
    })
    .from(skinnyScoresTable)
    .leftJoin(playerNamesTable, eq(skinnyScoresTable.playerToken, playerNamesTable.playerToken))
    .where(eq(skinnyScoresTable.puzzleId, puzzleId))
    .orderBy(asc(skinnyScoresTable.completionTimeSecs))
    .limit(10);

  const top10 = top10Rows.map((r, i) => ({
    rank: i + 1,
    playerToken: r.playerToken,
    completionTimeSecs: r.completionTimeSecs,
    playerName: r.playerName ?? null,
  }));

  const agg = await db
    .select({
      totalPlayers: sql<number>`count(*)::int`,
      avgTimeSecs: sql<number>`coalesce(round(avg(completion_time_secs)), 0)::int`,
    })
    .from(skinnyScoresTable)
    .where(eq(skinnyScoresTable.puzzleId, puzzleId))
    .then((r) => r[0] ?? { totalPlayers: 0, avgTimeSecs: 0 });

  const medianRow = await db
    .select({
      medianTimeSecs: sql<number>`coalesce(percentile_cont(0.5) within group (order by completion_time_secs), 0)::int`,
    })
    .from(skinnyScoresTable)
    .where(eq(skinnyScoresTable.puzzleId, puzzleId))
    .then((r) => r[0]);
  const medianTimeSecs = medianRow?.medianTimeSecs ?? 0;

  let playerRank: number | null = null;
  if (playerToken) {
    const playerRow = await db
      .select({ completionTimeSecs: skinnyScoresTable.completionTimeSecs })
      .from(skinnyScoresTable)
      .where(
        sql`${skinnyScoresTable.puzzleId} = ${puzzleId} AND ${skinnyScoresTable.playerToken} = ${playerToken}`,
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (playerRow !== undefined) {
      const faster = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(skinnyScoresTable)
        .where(
          sql`${skinnyScoresTable.puzzleId} = ${puzzleId} AND ${skinnyScoresTable.completionTimeSecs} < ${playerRow.completionTimeSecs}`,
        )
        .then((r) => r[0]?.cnt ?? 0);
      playerRank = faster + 1;
    }
  }

  res.json({ puzzleId, top10, totalPlayers: agg.totalPlayers, avgTimeSecs: agg.avgTimeSecs, medianTimeSecs, playerRank });
});

router.post("/skinny/score", async (req, res): Promise<void> => {
  const { playerToken, puzzleId, completionTimeSecs } = req.body as {
    playerToken?: unknown;
    puzzleId?: unknown;
    completionTimeSecs?: unknown;
  };

  if (
    typeof playerToken !== "string" ||
    playerToken.length < 1 ||
    playerToken.length > 64 ||
    typeof puzzleId !== "string" ||
    puzzleId.length < 1 ||
    puzzleId.length > 64 ||
    typeof completionTimeSecs !== "number" ||
    !Number.isInteger(completionTimeSecs) ||
    completionTimeSecs < 0 ||
    completionTimeSecs > 86400
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  await db
    .insert(skinnyScoresTable)
    .values({ puzzleId, playerToken, completionTimeSecs })
    .onConflictDoUpdate({
      target: [skinnyScoresTable.puzzleId, skinnyScoresTable.playerToken],
      set: {
        completionTimeSecs: sql`least(${skinnyScoresTable.completionTimeSecs}, excluded.completion_time_secs)`,
        completedAt: sql`${skinnyScoresTable.completedAt}`,
      },
    });

  res.json({ ok: true });
});

export default router;
