import type { WofPack } from "../data/wof/types";
import { summarizeWofPack } from "../data/wof/types";

export type WofWheelSegment = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);
export const VOWEL_COST = 250;

export const WHEEL: WofWheelSegment[] = [
  300, 500, 800, 1000, 1500, 2000, 500, 1000, 300, 2500,
  "BANKRUPT", 500, 1000, "LOSE_A_TURN", 800, "FREE_PLAY",
  "BANKRUPT", 1500, "LOSE_A_TURN",
];

export type WofPhase =
  | "spinning"
  | "guessing"
  | "puzzle-over";

export interface WofState {
  pack: WofPack;
  puzzleOrder: number[];
  puzzleIndex: number;
  phase: WofPhase;
  controllerId: string | null;
  currentSpin: WofWheelSegment | null;
  revealedLetters: Set<string>;
  guessedLetters: Set<string>;
  roundEarnings: Record<string, number>;
  isFreePlay: boolean;
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

export function makeWofState(pack: WofPack): WofState {
  const puzzleOrder = shuffle(Array.from({ length: pack.puzzles.length }, (_, i) => i));
  return {
    pack,
    puzzleOrder,
    puzzleIndex: 0,
    phase: "spinning",
    controllerId: null,
    currentSpin: null,
    revealedLetters: new Set(),
    guessedLetters: new Set(),
    roundEarnings: {},
    isFreePlay: false,
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
      revealed: w.revealedLetters.has(letter),
    })),
  );
}

export function isPuzzleSolved(w: WofState): boolean {
  const puzzle = currentPuzzle(w);
  const letters = new Set(puzzle.answer.toUpperCase().replace(/\s/g, "").split(""));
  for (const letter of letters) {
    if (!w.revealedLetters.has(letter)) return false;
  }
  return true;
}

export function spinWheel(): WofWheelSegment {
  return WHEEL[Math.floor(Math.random() * WHEEL.length)]!;
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
