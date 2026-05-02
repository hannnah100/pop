import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "..", "..", "artifacts", "api-server", "src", "data", "daily");

interface Category {
  id: string;
  label: string;
  group: string;
}
interface Celebrity {
  id: string;
  name: string;
  alternateNames: string[];
  categories: string[];
}
interface Grid {
  id: string;
  date: string;
  difficulty: "easy" | "medium" | "hard";
  rowCategoryIds: string[];
  columnCategoryIds: string[];
}

const categories: Category[] = JSON.parse(
  readFileSync(resolve(dataDir, "pop-box-categories.json"), "utf8"),
);
const celebrities: Celebrity[] = JSON.parse(
  readFileSync(resolve(dataDir, "pop-box-celebrities.json"), "utf8"),
);

// Index: category id -> set of celebrity ids
const byCategory = new Map<string, Set<string>>();
for (const cat of categories) byCategory.set(cat.id, new Set());
for (const celeb of celebrities) {
  for (const c of celeb.categories) {
    const set = byCategory.get(c);
    if (set) set.add(celeb.id);
  }
}

// Mulberry32 PRNG for deterministic per-date generation
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(dateStr: string): number {
  // Hash YYYY-MM-DD to a 32-bit int.
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) {
    h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function intersect(a: string, b: string): number {
  const setA = byCategory.get(a)!;
  const setB = byCategory.get(b)!;
  let n = 0;
  // Iterate the smaller set
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const id of small) if (large.has(id)) n++;
  return n;
}

const MIN_PER_CELL = 2;

interface BuildOptions {
  date: string;
  recentCategorySets: Array<Set<string>>; // last 30 days
}

function buildGrid({ date, recentCategorySets }: BuildOptions): Grid | null {
  const rng = mulberry32(dateSeed(date));
  const allCatIds = categories.map((c) => c.id);

  // Try up to 400 random combinations
  for (let attempt = 0; attempt < 400; attempt++) {
    const candidates = shuffled(allCatIds, rng);
    // Pick 6 categories from different groups when possible
    const picked: string[] = [];
    const groupsUsed = new Set<string>();
    for (const id of candidates) {
      const grp = categories.find((c) => c.id === id)!.group;
      if (groupsUsed.has(grp)) continue;
      picked.push(id);
      groupsUsed.add(grp);
      if (picked.length >= 6) break;
    }
    if (picked.length < 6) continue;

    // Avoid identical-set repeats from last 30 days
    const setKey = new Set(picked);
    const repeated = recentCategorySets.some(
      (s) => s.size === setKey.size && [...setKey].every((id) => s.has(id)),
    );
    if (repeated) continue;

    // Pick the assignment of rows/cols that maximizes the smallest intersection
    const half1 = picked.slice(0, 3);
    const half2 = picked.slice(3, 6);

    let best: { rows: string[]; cols: string[]; minCell: number; totalCells: number } | null = null;
    // Try both orientations
    const tries: Array<[string[], string[]]> = [
      [half1, half2],
      [half2, half1],
    ];
    for (const [rows, cols] of tries) {
      let minCell = Infinity;
      let totalCells = 0;
      for (const r of rows) {
        for (const c of cols) {
          const n = intersect(r, c);
          minCell = Math.min(minCell, n);
          totalCells += n;
        }
      }
      if (!best || minCell > best.minCell || (minCell === best.minCell && totalCells > best.totalCells)) {
        best = { rows, cols, minCell, totalCells };
      }
    }

    if (!best || best.minCell < MIN_PER_CELL) continue;

    const avg = best.totalCells / 9;
    const difficulty: "easy" | "medium" | "hard" = avg >= 8 ? "easy" : avg >= 5 ? "medium" : "hard";

    return {
      id: `pop-box-${date}`,
      date,
      difficulty,
      rowCategoryIds: best.rows,
      columnCategoryIds: best.cols,
    };
  }
  return null;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function build(): Grid[] {
  // Sliding window: 30 days back + 60 days forward from today (UTC).
  // Per-date generation is deterministic (mulberry32 seeded by date string),
  // so a given date always produces the same grid — the window just controls
  // which dates are emitted to JSON.
  const today = new Date().toISOString().slice(0, 10);
  const anchor = addDays(today, -30);
  const grids: Grid[] = [];
  const recentSets: Array<Set<string>> = [];

  for (let i = 0; i < 90; i++) {
    const date = addDays(anchor, i);
    const grid = buildGrid({ date, recentCategorySets: recentSets.slice(-30) });
    if (!grid) {
      console.warn(`Could not build grid for ${date}`);
      continue;
    }
    grids.push(grid);
    recentSets.push(new Set([...grid.rowCategoryIds, ...grid.columnCategoryIds]));
  }
  return grids;
}

const grids = build();

// Pretty-print summary
console.log(`Built ${grids.length} grids`);
const diffCounts = grids.reduce<Record<string, number>>((acc, g) => {
  acc[g.difficulty] = (acc[g.difficulty] ?? 0) + 1;
  return acc;
}, {});
console.log(`Difficulty distribution:`, diffCounts);

// Format as JSON-encoded strings to match seed shape used by other daily games
const seed = grids.map((g) => ({
  id: g.id,
  date: g.date,
  difficulty: g.difficulty,
  rowCategoryIds: JSON.stringify(g.rowCategoryIds),
  columnCategoryIds: JSON.stringify(g.columnCategoryIds),
}));

writeFileSync(resolve(dataDir, "pop-box.json"), JSON.stringify(seed, null, 2) + "\n");
console.log(`Wrote ${seed.length} grids to pop-box.json`);
