import { randomBytes } from "crypto";
import { Router, type IRouter } from "express";
import { db, popBoxGridsTable, popBoxAnswerCountsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  GetTodayPopBoxResponse,
  GetPopBoxAnswersResponse,
  PopBoxGuessResponse,
  PopBoxGuessBody,
} from "@workspace/api-zod";
import {
  POP_BOX_CATEGORIES,
  POP_BOX_CELEBRITIES,
  type PopBoxCelebrity,
} from "../data/daily";

const router: IRouter = Router();

const POP_BOX_SESSION_COOKIE = "ptqPopBoxSid";

// In-memory dedup set: only count the first correct guess per
// (sessionId, gridId, squareIndex, celebrityId) toward global rarity.
// Keys are bounded by daily grid lifetime; we evict entries for old
// grids on each insert to keep memory bounded.
const countedGuesses = new Set<string>();
const countedKeysByGridId = new Map<string, Set<string>>();

function recordCountedGuess(
  sessionId: string,
  gridId: string,
  squareIndex: number,
  celebrityId: string,
): boolean {
  const key = `${sessionId}|${gridId}|${squareIndex}|${celebrityId}`;
  if (countedGuesses.has(key)) return false;
  countedGuesses.add(key);
  let bucket = countedKeysByGridId.get(gridId);
  if (!bucket) {
    bucket = new Set<string>();
    countedKeysByGridId.set(gridId, bucket);
  }
  bucket.add(key);
  // Evict grids older than 7 days to keep the in-memory set bounded.
  if (countedKeysByGridId.size > 14) {
    const sorted = [...countedKeysByGridId.keys()].sort();
    for (const stale of sorted.slice(0, sorted.length - 14)) {
      const staleBucket = countedKeysByGridId.get(stale);
      if (staleBucket) {
        for (const k of staleBucket) countedGuesses.delete(k);
      }
      countedKeysByGridId.delete(stale);
    }
  }
  return true;
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[':.,\-!?&$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build lookup index once at module load.
const lookupToCelebId = new Map<string, string>();
for (const celeb of POP_BOX_CELEBRITIES) {
  const variants = [celeb.name, ...celeb.alternateNames, celeb.id.replace(/-/g, " ")];
  for (const v of variants) {
    const key = normalize(v);
    if (key) lookupToCelebId.set(key, celeb.id);
  }
}

const celebById = new Map<string, PopBoxCelebrity>(
  POP_BOX_CELEBRITIES.map((c) => [c.id, c]),
);

function celebMatchesCell(
  celebId: string,
  rowCategoryId: string,
  colCategoryId: string,
): boolean {
  const c = celebById.get(celebId);
  if (!c) return false;
  return (
    c.categories.includes(rowCategoryId) && c.categories.includes(colCategoryId)
  );
}

function buildResponseFromRow(row: typeof popBoxGridsTable.$inferSelect) {
  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];
  return GetTodayPopBoxResponse.parse({
    id: row.id,
    date: row.date,
    difficulty: row.difficulty,
    rowCategories: rowIds.map((id) => {
      const cat = POP_BOX_CATEGORIES.find((c) => c.id === id);
      return { id, label: cat?.label ?? id, group: cat?.group ?? "unknown" };
    }),
    columnCategories: colIds.map((id) => {
      const cat = POP_BOX_CATEGORIES.find((c) => c.id === id);
      return { id, label: cat?.label ?? id, group: cat?.group ?? "unknown" };
    }),
  });
}

router.get("/daily/pop-box", async (_req, res): Promise<void> => {
  const today = todayDate();

  let row = await db
    .select()
    .from(popBoxGridsTable)
    .where(eq(popBoxGridsTable.date, today))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    row = await db
      .select()
      .from(popBoxGridsTable)
      .orderBy(desc(popBoxGridsTable.date))
      .limit(1)
      .then((r) => r[0]);
  }

  if (!row) {
    res.status(404).json({ error: "No Pop Box available" });
    return;
  }

  res.json(buildResponseFromRow(row));
});

router.get("/daily/pop-box/archive", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: popBoxGridsTable.id,
      date: popBoxGridsTable.date,
      difficulty: popBoxGridsTable.difficulty,
    })
    .from(popBoxGridsTable)
    .orderBy(desc(popBoxGridsTable.date));

  res.json(rows);
});

router.get("/daily/pop-box/:id", async (req, res): Promise<void> => {
  const row = await db
    .select()
    .from(popBoxGridsTable)
    .where(eq(popBoxGridsTable.id, req.params.id))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    res.status(404).json({ error: "Pop Box not found" });
    return;
  }

  res.json(buildResponseFromRow(row));
});

router.get("/daily/pop-box/:id/answers", async (req, res): Promise<void> => {
  const row = await db
    .select()
    .from(popBoxGridsTable)
    .where(eq(popBoxGridsTable.id, req.params.id))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    res.status(404).json({ error: "Pop Box not found" });
    return;
  }

  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];

  // For each cell, list valid celebrity ids + their global tally for the cell.
  const counts = await db
    .select()
    .from(popBoxAnswerCountsTable)
    .where(eq(popBoxAnswerCountsTable.gridId, row.id));
  const countMap = new Map<string, number>();
  let totalAcrossGrid = 0;
  for (const c of counts) {
    countMap.set(`${c.squareIndex}:${c.celebrityId}`, c.count);
    totalAcrossGrid += c.count;
  }

  const cells = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const rowCat = rowIds[r];
      const colCat = colIds[c];
      const valid = POP_BOX_CELEBRITIES.filter((celeb) =>
        celebMatchesCell(celeb.id, rowCat, colCat),
      );
      const totalCellGuesses = valid.reduce(
        (sum, celeb) => sum + (countMap.get(`${idx}:${celeb.id}`) ?? 0),
        0,
      );
      cells.push({
        squareIndex: idx,
        rowCategoryId: rowCat,
        columnCategoryId: colCat,
        validCelebrities: valid
          .map((celeb) => {
            const guesses = countMap.get(`${idx}:${celeb.id}`) ?? 0;
            const rarityPercent =
              totalCellGuesses > 0 ? (guesses / totalCellGuesses) * 100 : 0;
            return {
              id: celeb.id,
              name: celeb.name,
              guessCount: guesses,
              rarityPercent: Math.round(rarityPercent * 10) / 10,
            };
          })
          .sort((a, b) => b.guessCount - a.guessCount),
      });
    }
  }

  res.json(
    GetPopBoxAnswersResponse.parse({
      id: row.id,
      date: row.date,
      totalGuesses: totalAcrossGrid,
      cells,
    }),
  );
});

router.post("/daily/pop-box/:id/guess", async (req, res): Promise<void> => {
  const parsed = PopBoxGuessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }
  const { squareIndex, guess } = parsed.data;

  const row = await db
    .select()
    .from(popBoxGridsTable)
    .where(eq(popBoxGridsTable.id, req.params.id))
    .limit(1)
    .then((r) => r[0]);

  if (!row) {
    res.status(404).json({ error: "Pop Box not found" });
    return;
  }
  if (squareIndex < 0 || squareIndex > 8) {
    res.status(400).json({ error: "squareIndex out of range" });
    return;
  }

  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];
  const r = Math.floor(squareIndex / 3);
  const c = squareIndex % 3;
  const rowCat = rowIds[r];
  const colCat = colIds[c];

  const key = normalize(guess);
  const celebId = key ? lookupToCelebId.get(key) : undefined;

  if (!celebId) {
    res.json(
      PopBoxGuessResponse.parse({
        correct: false,
        reason: "unknown_celebrity",
        celebrityId: null,
        celebrityName: null,
        rarityPercent: null,
      }),
    );
    return;
  }

  const matches = celebMatchesCell(celebId, rowCat, colCat);
  if (!matches) {
    const celeb = celebById.get(celebId);
    res.json(
      PopBoxGuessResponse.parse({
        correct: false,
        reason: "wrong_cell",
        celebrityId: celebId,
        celebrityName: celeb?.name ?? null,
        rarityPercent: null,
      }),
    );
    return;
  }

  // Establish a lightweight session cookie for per-player dedup.
  let sessionId = req.cookies?.[POP_BOX_SESSION_COOKIE] as string | undefined;
  if (!sessionId || typeof sessionId !== "string" || sessionId.length < 16) {
    sessionId = randomBytes(16).toString("hex");
    res.cookie(POP_BOX_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.secure,
      maxAge: 1000 * 60 * 60 * 24 * 90,
      path: "/",
    });
  }

  // Only count guesses for today's grid toward global rarity. Archive
  // replays must not mutate stats. Per-session dedup prevents a single
  // user from spamming the same correct answer to skew rarity.
  const isTodayGrid = row.date === todayDate();
  const shouldCount =
    isTodayGrid && recordCountedGuess(sessionId, row.id, squareIndex, celebId);

  if (shouldCount) {
    try {
      await db
        .insert(popBoxAnswerCountsTable)
        .values({
          gridId: row.id,
          squareIndex,
          celebrityId: celebId,
          count: 1,
        })
        .onConflictDoUpdate({
          target: [
            popBoxAnswerCountsTable.gridId,
            popBoxAnswerCountsTable.squareIndex,
            popBoxAnswerCountsTable.celebrityId,
          ],
          set: {
            count: sql`${popBoxAnswerCountsTable.count} + 1`,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      req.log.warn({ err }, "Failed to increment pop box answer count");
    }
  }

  // Compute rarity for this cell after the increment.
  const cellCounts = await db
    .select()
    .from(popBoxAnswerCountsTable)
    .where(
      and(
        eq(popBoxAnswerCountsTable.gridId, row.id),
        eq(popBoxAnswerCountsTable.squareIndex, squareIndex),
      ),
    );
  const total = cellCounts.reduce((sum, c) => sum + c.count, 0);
  const myCount =
    cellCounts.find((c) => c.celebrityId === celebId)?.count ?? 1;
  const rarityPercent = total > 0 ? (myCount / total) * 100 : 100;

  const celeb = celebById.get(celebId);
  res.json(
    PopBoxGuessResponse.parse({
      correct: true,
      reason: null,
      celebrityId: celebId,
      celebrityName: celeb?.name ?? null,
      rarityPercent: Math.round(rarityPercent * 10) / 10,
    }),
  );
});

export default router;
