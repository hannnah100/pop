import { randomBytes } from "crypto";
import { Router, type IRouter } from "express";
import { db, popBoxGridsTable, popBoxAnswerCountsTable, popBoxScoresTable, playerNamesTable } from "@workspace/db";
import { eq, desc, asc, and, like, sql } from "drizzle-orm";
import {
  GetTodayPopBoxResponse,
  GetPopBoxAnswersResponse,
  PopBoxGuessResponse,
  PopBoxGuessBody,
} from "@workspace/api-zod";
import {
  POP_BOX_CATEGORIES,
  POP_BOX_CELEBRITIES,
  ARTIST_SONGS,
  ACTOR_FILMOGRAPHY,
  STAR_CROSSED_GRIDS,
  entryCanonical,
  entryVariants,
  type PopBoxCelebrity,
  type SongEntry,
  type TitleEntry,
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

// ---------------------------------------------------------------------------
// Alphabet-mode helpers
// ---------------------------------------------------------------------------

type GridMode = "celebrity-categories" | "artist-alphabet" | "actor-alphabet" | "star-crossed" | "ball-knowers";

function getGridMode(id: string): GridMode {
  if (id.startsWith("artist-alpha-")) return "artist-alphabet";
  if (id.startsWith("actor-alpha-")) return "actor-alphabet";
  if (id.startsWith("star-crossed-")) return "star-crossed";
  if (id.startsWith("ball-knowers-")) return "ball-knowers";
  return "celebrity-categories";
}

/**
 * Modes that flow through the celebrity-categories validation path: same
 * category-lookup logic, same per-celeb tag matching. Ball-knowers reuses this
 * because its row/col IDs are real category IDs and athletes are tagged with
 * achievement categories like `nba-champion`, `super-bowl-mvp`, `ballon-dor`.
 */
function isCategoryGridMode(mode: GridMode): boolean {
  return mode === "celebrity-categories" || mode === "ball-knowers";
}

/**
 * Weekly mode rotation. Every day of the week is locked to one Pop Box mode;
 * today's grid is selected from that mode's pool.
 *
 *   Sun → Ball Knowers     Wed → Celebrity Categories    Sat → Celebrity Categories
 *   Mon → Actor Alphabet   Thu → Star-Crossed
 *   Tue → Artist Alphabet  Fri → Artist Alphabet
 *
 * Date is the local YYYY-MM-DD; we read day-of-week in UTC to keep the rotation
 * stable regardless of server timezone.
 */
function modeForDate(dateStr: string): GridMode {
  const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
  switch (dow) {
    case 0: return "ball-knowers";
    case 1: return "actor-alphabet";
    case 2: return "artist-alphabet";
    case 3: return "celebrity-categories";
    case 4: return "star-crossed";
    case 5: return "artist-alphabet";
    case 6: return "celebrity-categories";
    default: return "celebrity-categories";
  }
}

function modeIdPrefix(mode: GridMode): string {
  switch (mode) {
    case "actor-alphabet": return "actor-alpha-";
    case "artist-alphabet": return "artist-alpha-";
    case "ball-knowers": return "ball-knowers-";
    case "star-crossed": return "star-crossed-";
    default: return "pop-box-"; // celebrity-categories
  }
}

/** Days since Unix epoch — used as a stable rotation index. */
function epochDays(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T00:00:00Z").getTime() / 86_400_000);
}

// Artist lookup: artistId → songs[]
const artistSongsMap = new Map(ARTIST_SONGS.map((a) => [a.id, a]));
// Actor lookup: actorId → titles[]
const actorFilmographyMap = new Map(ACTOR_FILMOGRAPHY.map((a) => [a.id, a]));
// Star-Crossed: gridId → grid (with rowActors/colActors/cells)
const starCrossedMap = new Map(STAR_CROSSED_GRIDS.map((g) => [g.id, g]));
// Star-Crossed: actorId → name (across all grids)
const starCrossedActorMap = new Map<string, string>();
for (const g of STAR_CROSSED_GRIDS) {
  for (const a of [...g.rowActors, ...g.colActors]) {
    starCrossedActorMap.set(a.id, a.name);
  }
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[':.,\-!?&$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFirstLetter(title: string): string | null {
  let n = normalizeTitle(title);
  if (n.startsWith("the ")) n = n.slice(4);
  if (n.startsWith("a ")) n = n.slice(2);
  const m = n.match(/[a-z]/);
  return m ? m[0] : null;
}

function letterGroupMatches(group: string, title: string): boolean {
  const letters = group.toLowerCase().split("-");
  const fl = titleFirstLetter(title);
  return fl != null && letters.includes(fl);
}

/**
 * Find a canonical song/title match for a guess. Returns the canonical (display)
 * name or null. Each entry may carry alternate names (regional/UK-vs-US/featured-artist
 * variants) — any variant matches but the canonical is always returned.
 */
function findAlphabetAnswer(
  items: Array<SongEntry | TitleEntry>,
  guess: string,
): string | null {
  const gNorm = normalizeTitle(guess);
  if (!gNorm) return null;
  // Pass 1: exact match against any variant.
  for (const item of items) {
    for (const v of entryVariants(item)) {
      if (normalizeTitle(v) === gNorm) return entryCanonical(item);
    }
  }
  // Pass 2: substring match (≥4 chars) against any variant, both directions.
  if (gNorm.length >= 4) {
    for (const item of items) {
      for (const v of entryVariants(item)) {
        const vNorm = normalizeTitle(v);
        if (vNorm && (vNorm.includes(gNorm) || gNorm.includes(vNorm))) {
          return entryCanonical(item);
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Celebrity-mode helpers (existing)
// ---------------------------------------------------------------------------

// Build lookup index once at module load.
// Two-pass build: alternates first, then canonical names, so a canonical name
// always beats an alternate name collision (e.g. "Cher" → cher, not cher-lloyd).
const lookupToCelebId = new Map<string, string>();
for (const celeb of POP_BOX_CELEBRITIES) {
  const variants = [...celeb.alternateNames, celeb.id.replace(/-/g, " ")];
  for (const v of variants) {
    const key = normalize(v);
    if (key) lookupToCelebId.set(key, celeb.id);
  }
}
for (const celeb of POP_BOX_CELEBRITIES) {
  const key = normalize(celeb.name);
  if (key) lookupToCelebId.set(key, celeb.id);
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
  const mode = getGridMode(row.id);
  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];

  if (mode === "artist-alphabet") {
    return GetTodayPopBoxResponse.parse({
      id: row.id,
      date: row.date,
      difficulty: row.difficulty,
      mode,
      rowCategories: rowIds.map((group) => ({
        id: group,
        label: group.replace(/-/g, " · "),
        group: "letter-group",
      })),
      columnCategories: colIds.map((id) => {
        const artist = artistSongsMap.get(id);
        return { id, label: artist?.name ?? id, group: "artist" };
      }),
    });
  }

  if (mode === "actor-alphabet") {
    return GetTodayPopBoxResponse.parse({
      id: row.id,
      date: row.date,
      difficulty: row.difficulty,
      mode,
      rowCategories: rowIds.map((group) => ({
        id: group,
        label: group.replace(/-/g, " · "),
        group: "letter-group",
      })),
      columnCategories: colIds.map((id) => {
        const actor = actorFilmographyMap.get(id);
        return { id, label: actor?.name ?? id, group: "actor" };
      }),
    });
  }

  if (mode === "star-crossed") {
    return GetTodayPopBoxResponse.parse({
      id: row.id,
      date: row.date,
      difficulty: row.difficulty,
      mode,
      rowCategories: rowIds.map((id) => ({
        id,
        label: starCrossedActorMap.get(id) ?? id,
        group: "actor",
      })),
      columnCategories: colIds.map((id) => ({
        id,
        label: starCrossedActorMap.get(id) ?? id,
        group: "actor",
      })),
    });
  }

  // celebrity-categories + ball-knowers — both look up labels from POP_BOX_CATEGORIES
  return GetTodayPopBoxResponse.parse({
    id: row.id,
    date: row.date,
    difficulty: row.difficulty,
    mode,
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
  const expectedMode = modeForDate(today);
  const prefix = modeIdPrefix(expectedMode);

  // 1) If a grid is explicitly scheduled for today AND it matches today's mode,
  //    honor that exact pick. (Lets us pin specific grids to specific dates if
  //    the mode lines up.)
  let row = await db
    .select()
    .from(popBoxGridsTable)
    .where(
      and(
        eq(popBoxGridsTable.date, today),
        like(popBoxGridsTable.id, `${prefix}%`),
      ),
    )
    .orderBy(asc(popBoxGridsTable.id))
    .limit(1)
    .then((r) => r[0]);

  // 2) Otherwise rotate through this mode's pool. Same calendar date always
  //    returns the same grid, and consecutive same-mode days walk forward
  //    through the pool, so players don't see the same one back-to-back.
  if (!row) {
    const pool = await db
      .select()
      .from(popBoxGridsTable)
      .where(like(popBoxGridsTable.id, `${prefix}%`))
      .orderBy(asc(popBoxGridsTable.id));
    if (pool.length > 0) {
      row = pool[epochDays(today) % pool.length];
    }
  }

  // 3) Last-resort fallback if a mode pool is somehow empty.
  if (!row) {
    row = await db
      .select()
      .from(popBoxGridsTable)
      .orderBy(desc(popBoxGridsTable.date), asc(popBoxGridsTable.id))
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

  res.json(rows.map((r) => ({ ...r, mode: getGridMode(r.id) })));
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

  const mode = getGridMode(row.id);
  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];

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

      let validEntries: Array<{ id: string; name: string }>;
      if (mode === "artist-alphabet") {
        const artist = artistSongsMap.get(colCat);
        validEntries = (artist?.songs ?? [])
          .map((s) => entryCanonical(s))
          .filter((s) => letterGroupMatches(rowCat, s))
          .map((s) => ({ id: normalizeTitle(s).replace(/\s/g, "-"), name: s }));
      } else if (mode === "actor-alphabet") {
        const actor = actorFilmographyMap.get(colCat);
        validEntries = (actor?.titles ?? [])
          .map((t) => entryCanonical(t))
          .filter((t) => letterGroupMatches(rowCat, t))
          .map((t) => ({ id: normalizeTitle(t).replace(/\s/g, "-"), name: t }));
      } else if (mode === "star-crossed") {
        const grid = starCrossedMap.get(row.id);
        const cellTitles = grid?.cells?.[r]?.[c] ?? [];
        validEntries = cellTitles
          .map((t) => entryCanonical(t))
          .filter((t): t is string => !!t)
          .map((t) => ({ id: normalizeTitle(t).replace(/\s/g, "-"), name: t }));
      } else {
        validEntries = POP_BOX_CELEBRITIES.filter((celeb) =>
          celebMatchesCell(celeb.id, rowCat, colCat),
        ).map((c) => ({ id: c.id, name: c.name }));
      }

      const totalCellGuesses = validEntries.reduce(
        (sum, e) => sum + (countMap.get(`${idx}:${e.id}`) ?? 0),
        0,
      );
      cells.push({
        squareIndex: idx,
        rowCategoryId: rowCat,
        columnCategoryId: colCat,
        validCelebrities: validEntries
          .map((e) => {
            const guesses = countMap.get(`${idx}:${e.id}`) ?? 0;
            const rarityPercent =
              totalCellGuesses <= 0
                ? 50
                : ((totalCellGuesses - guesses) / totalCellGuesses) * 100;
            return {
              id: e.id,
              name: e.name,
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

  const mode = getGridMode(row.id);
  const rowIds = JSON.parse(row.rowCategoryIds) as string[];
  const colIds = JSON.parse(row.columnCategoryIds) as string[];
  const r = Math.floor(squareIndex / 3);
  const c = squareIndex % 3;
  const rowCat = rowIds[r];
  const colCat = colIds[c];

  // ---- Star-Crossed mode validation ----
  if (mode === "star-crossed") {
    const grid = starCrossedMap.get(row.id);
    const cellTitles = grid?.cells?.[r]?.[c] ?? [];
    const matched = findAlphabetAnswer(cellTitles, guess);
    if (!matched) {
      // The guess isn't in this cell's intersection. To distinguish "wrong cell"
      // (a real co-star title for a different cell) from "unknown", scan every
      // cell of this grid; if found elsewhere, return wrong_cell.
      let wrongCellMatch: string | null = null;
      if (grid) {
        for (let rr = 0; rr < 3 && !wrongCellMatch; rr++) {
          for (let cc = 0; cc < 3 && !wrongCellMatch; cc++) {
            if (rr === r && cc === c) continue;
            wrongCellMatch = findAlphabetAnswer(grid.cells[rr]?.[cc] ?? [], guess);
          }
        }
      }
      res.json(
        PopBoxGuessResponse.parse({
          correct: false,
          reason: wrongCellMatch ? "wrong_cell" : "unknown_celebrity",
          celebrityId: null,
          celebrityName: wrongCellMatch,
          rarityPercent: null,
        }),
      );
      return;
    }

    const answerId = normalizeTitle(matched).replace(/\s/g, "-");
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
    const isTodayGrid = row.date === todayDate();
    const shouldCount = isTodayGrid && recordCountedGuess(sessionId, row.id, squareIndex, answerId);
    if (shouldCount) {
      try {
        await db
          .insert(popBoxAnswerCountsTable)
          .values({ gridId: row.id, squareIndex, celebrityId: answerId, count: 1 })
          .onConflictDoUpdate({
            target: [popBoxAnswerCountsTable.gridId, popBoxAnswerCountsTable.squareIndex, popBoxAnswerCountsTable.celebrityId],
            set: { count: sql`${popBoxAnswerCountsTable.count} + 1`, updatedAt: new Date() },
          });
      } catch (err) {
        req.log.warn({ err }, "Failed to increment pop box answer count");
      }
    }
    const cellCounts = await db.select().from(popBoxAnswerCountsTable).where(
      and(eq(popBoxAnswerCountsTable.gridId, row.id), eq(popBoxAnswerCountsTable.squareIndex, squareIndex)),
    );
    const total = cellCounts.reduce((s, c) => s + c.count, 0);
    const myCount = cellCounts.find((c) => c.celebrityId === answerId)?.count ?? 1;
    const rarityPercent = total <= 1 ? 50 : ((total - myCount) / total) * 100;

    res.json(
      PopBoxGuessResponse.parse({
        correct: true,
        reason: null,
        celebrityId: answerId,
        celebrityName: matched,
        rarityPercent: Math.round(rarityPercent * 10) / 10,
      }),
    );
    return;
  }

  // ---- Alphabet mode validation ----
  if (mode === "artist-alphabet" || mode === "actor-alphabet") {
    const items =
      mode === "artist-alphabet"
        ? (artistSongsMap.get(colCat)?.songs ?? [])
        : (actorFilmographyMap.get(colCat)?.titles ?? []);

    const matched = findAlphabetAnswer(items, guess);
    if (!matched) {
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
    if (!letterGroupMatches(rowCat, matched)) {
      res.json(
        PopBoxGuessResponse.parse({
          correct: false,
          reason: "wrong_cell",
          celebrityId: null,
          celebrityName: matched,
          rarityPercent: null,
        }),
      );
      return;
    }

    const answerId = normalizeTitle(matched).replace(/\s/g, "-");
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
    const isTodayGrid = row.date === todayDate();
    const shouldCount = isTodayGrid && recordCountedGuess(sessionId, row.id, squareIndex, answerId);
    if (shouldCount) {
      try {
        await db
          .insert(popBoxAnswerCountsTable)
          .values({ gridId: row.id, squareIndex, celebrityId: answerId, count: 1 })
          .onConflictDoUpdate({
            target: [popBoxAnswerCountsTable.gridId, popBoxAnswerCountsTable.squareIndex, popBoxAnswerCountsTable.celebrityId],
            set: { count: sql`${popBoxAnswerCountsTable.count} + 1`, updatedAt: new Date() },
          });
      } catch (err) {
        req.log.warn({ err }, "Failed to increment pop box answer count");
      }
    }
    const cellCounts = await db.select().from(popBoxAnswerCountsTable).where(
      and(eq(popBoxAnswerCountsTable.gridId, row.id), eq(popBoxAnswerCountsTable.squareIndex, squareIndex)),
    );
    const total = cellCounts.reduce((s, c) => s + c.count, 0);
    const myCount = cellCounts.find((c) => c.celebrityId === answerId)?.count ?? 1;
    const rarityPercent = total <= 1 ? 50 : ((total - myCount) / total) * 100;

    res.json(
      PopBoxGuessResponse.parse({
        correct: true,
        reason: null,
        celebrityId: answerId,
        celebrityName: matched,
        rarityPercent: Math.round(rarityPercent * 10) / 10,
      }),
    );
    return;
  }

  // ---- Celebrity-categories mode (original logic) ----
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
  // Rarity = % of correct submissions on this square that picked
  // SOMEONE DIFFERENT. Higher % = rarer pick = better.
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
  // If this is the only submission so far, rarity isn't meaningful yet —
  // call it 50 (neutral) to avoid awarding/penalizing the first player.
  const rarityPercent =
    total <= 1 ? 50 : ((total - myCount) / total) * 100;

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

router.get("/daily/pop-box/leaderboard", async (req, res): Promise<void> => {
  const date = (req.query.date as string) || todayDate();
  const playerToken = (req.query.playerToken as string) || "";

  const top10Rows = await db
    .select({
      playerToken: popBoxScoresTable.playerToken,
      score: popBoxScoresTable.score,
      playerName: playerNamesTable.playerName,
    })
    .from(popBoxScoresTable)
    .leftJoin(playerNamesTable, eq(popBoxScoresTable.playerToken, playerNamesTable.playerToken))
    .where(eq(popBoxScoresTable.date, date))
    .orderBy(desc(popBoxScoresTable.score))
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
      avgScore: sql<number>`coalesce(round(avg(score)), 0)::int`,
    })
    .from(popBoxScoresTable)
    .where(eq(popBoxScoresTable.date, date))
    .then((r) => r[0] ?? { totalPlayers: 0, avgScore: 0 });

  const medianRow = await db
    .select({
      medianScore: sql<number>`coalesce(percentile_cont(0.5) within group (order by score), 0)::int`,
    })
    .from(popBoxScoresTable)
    .where(eq(popBoxScoresTable.date, date))
    .then((r) => r[0]);
  const medianScore = medianRow?.medianScore ?? 0;

  let playerRank: number | null = null;
  if (playerToken) {
    const playerRow = await db
      .select({ score: popBoxScoresTable.score })
      .from(popBoxScoresTable)
      .where(
        sql`${popBoxScoresTable.date} = ${date} AND ${popBoxScoresTable.playerToken} = ${playerToken}`,
      )
      .limit(1)
      .then((rows) => rows[0]);

    if (playerRow !== undefined) {
      const above = await db
        .select({ cnt: sql<number>`count(*)::int` })
        .from(popBoxScoresTable)
        .where(
          sql`${popBoxScoresTable.date} = ${date} AND ${popBoxScoresTable.score} > ${playerRow.score}`,
        )
        .then((r) => r[0]?.cnt ?? 0);
      playerRank = above + 1;
    }
  }

  res.json({ date, top10, totalPlayers: agg.totalPlayers, avgScore: agg.avgScore, medianScore, playerRank });
});

router.post("/daily/pop-box/score", async (req, res): Promise<void> => {
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
    score > 9 ||
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  await db
    .insert(popBoxScoresTable)
    .values({ date, playerToken, score })
    .onConflictDoUpdate({
      target: [popBoxScoresTable.date, popBoxScoresTable.playerToken],
      set: {
        score: sql`greatest(${popBoxScoresTable.score}, excluded.score)`,
        createdAt: sql`${popBoxScoresTable.createdAt}`,
      },
    });

  res.json({ ok: true });
});

export default router;
