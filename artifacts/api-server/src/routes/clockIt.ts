import { Router, type IRouter } from "express";
// NOTE: filename preserved as guess-the-year.json — the JSON content is
// generic year-puzzle data and renaming the file would just churn git history
// for no functional gain.
import CLOCK_IT_JSON from "../data/daily/guess-the-year.json" with { type: "json" };

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

/**
 * Map a calendar date to a puzzle by counting days since a fixed epoch and
 * cycling through the puzzle list. This guarantees exactly one new puzzle per
 * calendar day with no consecutive repeats — the previous LCG approach was
 * broken because consecutive date integers (20260501, 20260502, …) shifted
 * the LCG output by only ~1.6M out of a 4.3B range, landing in the same
 * puzzle bin for ~25 consecutive days.
 */
function selectPuzzle(date: string): ClockItPuzzle {
  const [y, m, d] = date.split("-").map(Number);
  const dayIndex = Math.floor(
    (Date.UTC(y, m - 1, d) - Date.UTC(2024, 0, 1)) / 86_400_000,
  );
  const index = ((dayIndex % PUZZLES.length) + PUZZLES.length) % PUZZLES.length;
  return PUZZLES[index];
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

export default router;
