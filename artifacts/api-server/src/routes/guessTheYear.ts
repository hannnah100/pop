import { Router, type IRouter } from "express";
import GUESS_THE_YEAR_JSON from "../data/daily/guess-the-year.json" with { type: "json" };

const router: IRouter = Router();

interface GuessTheYearPuzzle {
  id: string;
  year: number;
  hints: [string, string, string];
}

const PUZZLES: GuessTheYearPuzzle[] = GUESS_THE_YEAR_JSON as GuessTheYearPuzzle[];

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

function selectPuzzle(date: string): GuessTheYearPuzzle {
  const rng = lcgRng(dateSeed(date));
  const index = Math.floor(rng() * PUZZLES.length);
  return PUZZLES[index];
}

router.get("/daily/guess-the-year", (_req, res): void => {
  const today = todayDate();
  const puzzle = selectPuzzle(today);
  res.json({
    id: today,
    date: today,
    hints: puzzle.hints,
  });
});

router.post("/daily/guess-the-year/check", (req, res): void => {
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
