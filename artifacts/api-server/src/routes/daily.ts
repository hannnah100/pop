import { Router, type IRouter } from "express";
import { db, threeFlopsChallengesTable, crosswordPuzzlesTable, popBoxGridsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import {
  GetTodayThreeFlopsResponse,
  GetTodayCrosswordResponse,
  GetDailyStatusResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

router.get("/daily/three-flops", async (req, res): Promise<void> => {
  const today = todayDate();

  let row = await db
    .select()
    .from(threeFlopsChallengesTable)
    .where(eq(threeFlopsChallengesTable.date, today))
    .limit(1)
    .then((r) => r[0]);

  // If no challenge today, fall back to the most recent one
  if (!row) {
    row = await db
      .select()
      .from(threeFlopsChallengesTable)
      .orderBy(desc(threeFlopsChallengesTable.date))
      .limit(1)
      .then((r) => r[0]);
  }

  if (!row) {
    res.status(404).json({ error: "No challenge available" });
    return;
  }

  const data = GetTodayThreeFlopsResponse.parse({
    id: row.id,
    date: row.date,
    title: row.title,
    prompt: row.prompt,
    totalCount: row.totalCount,
    answers: JSON.parse(row.answers),
  });

  res.json(data);
});

router.get("/daily/three-flops/archive", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: threeFlopsChallengesTable.id,
      date: threeFlopsChallengesTable.date,
      title: threeFlopsChallengesTable.title,
      prompt: threeFlopsChallengesTable.prompt,
      totalCount: threeFlopsChallengesTable.totalCount,
    })
    .from(threeFlopsChallengesTable)
    .orderBy(desc(threeFlopsChallengesTable.date));

  res.json(rows);
});

router.get("/daily/three-flops/:id", async (req, res): Promise<void> => {
  const row = await db
    .select()
    .from(threeFlopsChallengesTable)
    .where(eq(threeFlopsChallengesTable.id, req.params.id))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    res.status(404).json({ error: "Challenge not found" });
    return;
  }

  const data = GetTodayThreeFlopsResponse.parse({
    id: row.id,
    date: row.date,
    title: row.title,
    prompt: row.prompt,
    totalCount: row.totalCount,
    answers: JSON.parse(row.answers),
  });

  res.json(data);
});

router.get("/daily/crossword", async (req, res): Promise<void> => {
  const today = todayDate();

  let row = await db
    .select()
    .from(crosswordPuzzlesTable)
    .where(eq(crosswordPuzzlesTable.date, today))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    row = await db
      .select()
      .from(crosswordPuzzlesTable)
      .orderBy(desc(crosswordPuzzlesTable.date))
      .limit(1)
      .then((r) => r[0]);
  }

  if (!row) {
    res.status(404).json({ error: "No puzzle available" });
    return;
  }

  const data = GetTodayCrosswordResponse.parse({
    id: row.id,
    date: row.date,
    grid: JSON.parse(row.grid),
    blackSquares: JSON.parse(row.blackSquares),
    cluesAcross: JSON.parse(row.cluesAcross),
    cluesDown: JSON.parse(row.cluesDown),
  });

  res.json(data);
});

router.get("/daily/crossword/archive", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: crosswordPuzzlesTable.id,
      date: crosswordPuzzlesTable.date,
    })
    .from(crosswordPuzzlesTable)
    .orderBy(desc(crosswordPuzzlesTable.date));

  res.json(rows);
});

router.get("/daily/crossword/:id", async (req, res): Promise<void> => {
  const row = await db
    .select()
    .from(crosswordPuzzlesTable)
    .where(eq(crosswordPuzzlesTable.id, req.params.id))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    res.status(404).json({ error: "Puzzle not found" });
    return;
  }

  const data = GetTodayCrosswordResponse.parse({
    id: row.id,
    date: row.date,
    grid: JSON.parse(row.grid),
    blackSquares: JSON.parse(row.blackSquares),
    cluesAcross: JSON.parse(row.cluesAcross),
    cluesDown: JSON.parse(row.cluesDown),
  });

  res.json(data);
});

router.get("/daily/status", async (_req, res): Promise<void> => {
  const today = todayDate();

  const [tfRow, cwRow, pbRow] = await Promise.all([
    db.select({ id: threeFlopsChallengesTable.id, title: threeFlopsChallengesTable.title })
      .from(threeFlopsChallengesTable)
      .orderBy(desc(threeFlopsChallengesTable.date))
      .limit(1)
      .then((r) => r[0]),
    db.select({ id: crosswordPuzzlesTable.id, date: crosswordPuzzlesTable.date })
      .from(crosswordPuzzlesTable)
      .orderBy(desc(crosswordPuzzlesTable.date))
      .limit(1)
      .then((r) => r[0]),
    db.select({ id: popBoxGridsTable.id, date: popBoxGridsTable.date })
      .from(popBoxGridsTable)
      .orderBy(desc(popBoxGridsTable.date))
      .limit(1)
      .then((r) => r[0]),
  ]);

  const data = GetDailyStatusResponse.parse({
    date: today,
    threeFlopsAvailable: !!tfRow,
    crosswordAvailable: !!cwRow,
    popBoxAvailable: !!pbRow,
    ...(tfRow?.title ? { threeFlopsTitle: tfRow.title } : {}),
    ...(cwRow?.date ? { crosswordDate: cwRow.date } : {}),
    ...(pbRow?.date ? { popBoxDate: pbRow.date } : {}),
  });

  res.json(data);
});

export default router;
