import type { WofPack } from "../data/wof/types";
import { summarizeWofPack } from "../data/wof/types";

export type WofWheelSegment = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);
export const VOWEL_COST = 250;

export const WHEEL: WofWheelSegment[] = [
  300, "BANKRUPT", 600, "LOSE_A_TURN", 500, 300, 900,
  "FREE_PLAY", 700, 500, 1000, "BANKRUPT", 600, 800,
  "LOSE_A_TURN", 500, 1500, 300, 2000, "FREE_PLAY",
  800, 500, 2500, "BANKRUPT", 700, 1000, "LOSE_A_TURN",
  300, 1500, 500,
]; // 30 segments

export type WofPhase =
  | "spinning"
  | "guessing"
  | "puzzle-over";

export interface WofState {
  pack: WofPack;
  puzzleOrder: number[];
  puzzleIndex: number;
  roundCount: number;
  phase: WofPhase;
  controllerId: string | null;
  currentSpin: WofWheelSegment | null;
  currentSpinIndex: number | null;
  revealedLetters: Set<string>;
  guessedLetters: Set<string>;
  roundEarnings: Record<string, number>;
  isFreePlay: boolean;
  pendingSolve: { solverId: string; solverName: string; answer: string; isVerbal?: boolean } | null;
}

export interface WofBoardCell {
  letter: string;
  revealed: boolean;
}

export type WofBoardWire = WofBoardCell[][];

export interface WofPackSummaryWire {
  id: string;
  title: string;
  description: string;
  puzzleCount: number;
}

export interface WofScoreRow {
  id: string;
  name: string;
  score: number;
  roundEarnings: number;
  isBot: boolean;
}

export function wofPackSummaryWire(pack: WofPack): WofPackSummaryWire {
  const s = summarizeWofPack(pack);
  return { id: s.id, title: s.title, description: s.description, puzzleCount: s.puzzleCount };
}

export function makeWofState(pack: WofPack, roundCount = 5): WofState {
  const puzzleOrder = shuffle(Array.from({ length: pack.puzzles.length }, (_, i) => i));
  const clamped = Math.min(Math.max(roundCount, 1), pack.puzzles.length);
  return {
    pack,
    puzzleOrder,
    puzzleIndex: 0,
    roundCount: clamped,
    phase: "spinning",
    controllerId: null,
    currentSpin: null,
    currentSpinIndex: null,
    revealedLetters: new Set(),
    guessedLetters: new Set(),
    roundEarnings: {},
    isFreePlay: false,
    pendingSolve: null,
  };
}

export function currentPuzzle(w: WofState) {
  return w.pack.puzzles[w.puzzleOrder[w.puzzleIndex] ?? 0]!;
}

export function publicBoard(w: WofState): WofBoardWire {
  const puzzle = currentPuzzle(w);
  const answer = puzzle.answer.toUpperCase();
  return answer.split(" ").map((word) =>
    word.split("").map((letter) => ({
      letter,
      // Non-alpha chars (hyphens, apostrophes, etc.) are always revealed
      revealed: /[^A-Z]/.test(letter) || w.revealedLetters.has(letter),
    })),
  );
}

export function isPuzzleSolved(w: WofState): boolean {
  const puzzle = currentPuzzle(w);
  // Only A-Z letters need to be revealed; non-alpha separators are auto-revealed
  const letters = new Set(
    puzzle.answer.toUpperCase().replace(/[^A-Z]/g, "").split("").filter(Boolean)
  );
  for (const letter of letters) {
    if (!w.revealedLetters.has(letter)) return false;
  }
  return true;
}

export interface SpinResult {
  value: WofWheelSegment;
  spinIndex: number;
}

// Weight map: special segments appear less often, high-dollar segments slightly more
const SEGMENT_WEIGHTS: number[] = WHEEL.map((seg) => {
  if (seg === "BANKRUPT") return 0.4;
  if (seg === "LOSE_A_TURN") return 0.4;
  if (seg === "FREE_PLAY") return 1.4;
  if (typeof seg === "number" && seg >= 2000) return 1.3;
  if (typeof seg === "number" && seg >= 1000) return 1.1;
  return 1.0;
});
const TOTAL_WEIGHT = SEGMENT_WEIGHTS.reduce((a, b) => a + b, 0);

export function spinWheel(): SpinResult {
  const rand = Math.random() * TOTAL_WEIGHT;
  let acc = 0;
  for (let i = 0; i < WHEEL.length; i++) {
    acc += SEGMENT_WEIGHTS[i]!;
    if (rand < acc) return { value: WHEEL[i]!, spinIndex: i };
  }
  const spinIndex = WHEEL.length - 1;
  return { value: WHEEL[spinIndex]!, spinIndex };
}

export function getLetterPositions(answer: string, letter: string): number[] {
  const positions: number[] = [];
  const upper = answer.toUpperCase();
  const l = letter.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    if (upper[i] === l) positions.push(i);
  }
  return positions;
}

export function advanceController(
  controllerId: string | null,
  playerIds: string[],
): string | null {
  if (playerIds.length === 0) return null;
  if (!controllerId) return playerIds[0] ?? null;
  const idx = playerIds.indexOf(controllerId);
  return playerIds[(idx + 1) % playerIds.length] ?? null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function botGuessesCorrect(): boolean {
  return Math.random() < 0.65;
}

export function botSolvesCorrect(): boolean {
  return Math.random() < 0.55;
}

export function botPickConsonant(guessedLetters: Set<string>): string | null {
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ".split("").filter((c) => !guessedLetters.has(c));
  if (consonants.length === 0) return null;
  return consonants[Math.floor(Math.random() * consonants.length)]!;
}
