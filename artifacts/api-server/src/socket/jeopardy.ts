import type { Server as SocketIOServer } from "socket.io";
import type { JeopardyPack, JeopardyClue } from "../data/jeopardy/types";

export const JEOPARDY_VALUES = [200, 400, 600, 800, 1000] as const;

export const JEOPARDY_TIMING = {
  /** ms between revealing a clue and opening the buzzer (suspense beat). */
  buzzerArmDelayMs: 800,
  /** ms players have to buzz in once the buzzer is open. */
  buzzerWindowMs: 12_000,
  /** ms a buzzed-in player has to give an answer. */
  answerWindowMs: 12_000,
  /** ms a Daily Double player has to give an answer after revealing the clue. */
  dailyDoubleAnswerMs: 15_000,
  /** ms players have to enter their wager for a Daily Double. */
  dailyDoubleWagerMs: 20_000,
  /** ms players have to enter their final wager. */
  finalWagerMs: 30_000,
  /** ms players have to type their final answer once the clue appears. */
  finalAnswerMs: 30_000,
};

export const JEOPARDY_BOT_DELAYS = {
  buzzMinMs: 350,
  buzzMaxMs: 1500,
  ddWagerMinMs: 1500,
  ddWagerMaxMs: 4000,
  finalWagerMinMs: 2000,
  finalWagerMaxMs: 5000,
  finalAnswerMinMs: 3000,
  finalAnswerMaxMs: 8000,
};

/** Bot probability of getting a clue right when they buzz in. */
export const JEOPARDY_BOT_CORRECTNESS = 0.7;
/** Bot probability of getting Final Jeopardy right. */
export const JEOPARDY_FINAL_BOT_CORRECTNESS = 0.5;

export type JeopardyPhase =
  | "picking"
  | "clue-reveal"
  | "buzzer-open"
  | "answering"
  | "judging"
  | "dd-wager"
  | "dd-clue"
  | "dd-judging"
  | "between-clues"
  | "final-intro"
  | "final-wager"
  | "final-clue"
  | "final-reveal"
  | "ended";

export interface JeopardyActiveClue {
  cat: number;
  clue: number;
  category: string;
  value: number;
  question: string;
  answer: string;
  isDailyDouble: boolean;
}

export interface JeopardyState {
  pack: JeopardyPack;
  /** revealed[catIdx][clueIdx] === true means that square has been used. */
  revealed: boolean[][];
  /** Up to 2 (cat, clue) coordinates that are Daily Doubles. */
  dailyDoubles: Array<{ cat: number; clue: number }>;
  phase: JeopardyPhase;
  /** Whose turn it is to pick a square. Falls back to highest-scoring player when null. */
  controllerId: string | null;
  active: JeopardyActiveClue | null;
  /** Players who have buzzed in and been wrong on the active clue (locked out). */
  lockedOut: Set<string>;
  /** Whichever player is currently locked-in answering. Null when buzzer is open. */
  buzzedInId: string | null;
  /** Wall-clock timestamp the current timer ends. 0 if no timer. */
  timerEndAt: number;
  /** Active timeout handle so we can cancel/replace timers. */
  timerHandle: NodeJS.Timeout | null;
  /** Daily Double wager (locked in once submitted). */
  ddWager: number;
  /** Final-Jeopardy wagers keyed by player id. */
  finalWagers: Record<string, number>;
  /** Final-Jeopardy answers keyed by player id. */
  finalAnswers: Record<string, { raw: string; correct: boolean }>;
  /** Has the host marked Final Jeopardy as resolved? */
  finalResolved: boolean;
  endedEarly: boolean;
}

// =====================================================================
// Pack summary (player-facing — never includes answers)
// =====================================================================
export interface JeopardyPackSummaryWire {
  id: string;
  title: string;
  description: string;
  categoryCount: number;
  clueCount: number;
  finalCategory: string;
}

export function jeopardyPackSummary(pack: JeopardyPack): JeopardyPackSummaryWire {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    categoryCount: pack.categories.length,
    clueCount: pack.categories.reduce((acc, c) => acc + c.clues.length, 0),
    finalCategory: pack.final.category,
  };
}

// =====================================================================
// Construct fresh state and randomize Daily Double squares
// =====================================================================
export function makeJeopardyState(pack: JeopardyPack): JeopardyState {
  return {
    pack,
    revealed: pack.categories.map((c) => c.clues.map(() => false)),
    dailyDoubles: pickDailyDoubles(pack),
    phase: "picking",
    controllerId: null,
    active: null,
    lockedOut: new Set(),
    buzzedInId: null,
    timerEndAt: 0,
    timerHandle: null,
    ddWager: 0,
    finalWagers: {},
    finalAnswers: {},
    finalResolved: false,
    endedEarly: false,
  };
}

function pickDailyDoubles(pack: JeopardyPack): Array<{ cat: number; clue: number }> {
  // Use creator-specified Daily Double positions if present in the pack.
  const customDDs: Array<{ cat: number; clue: number }> = [];
  pack.categories.forEach((cat, ci) => {
    cat.clues.forEach((clue, qi) => {
      if (clue.isDailyDouble) customDDs.push({ cat: ci, clue: qi });
    });
  });
  if (customDDs.length > 0) return customDDs;

  // Fallback: random selection for built-in packs that don't specify positions.
  const ddCount = 2;
  const candidates: Array<{ cat: number; clue: number }> = [];
  pack.categories.forEach((cat, ci) => {
    cat.clues.forEach((clue, qi) => {
      // Avoid the cheapest row (200) — feels right and matches the show.
      if (clue.value > 200) candidates.push({ cat: ci, clue: qi });
    });
  });
  // Shuffle then take ddCount, ensuring no two share a category.
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const chosen: Array<{ cat: number; clue: number }> = [];
  for (const c of shuffled) {
    if (chosen.length >= ddCount) break;
    if (chosen.some((x) => x.cat === c.cat)) continue;
    chosen.push(c);
  }
  return chosen;
}

export function isDailyDouble(state: JeopardyState, cat: number, clue: number): boolean {
  return state.dailyDoubles.some((dd) => dd.cat === cat && dd.clue === clue);
}

// =====================================================================
// Public-safe board view (for both host and players)
// =====================================================================
export interface BoardWire {
  categories: Array<{ name: string; clues: Array<{ value: number; revealed: boolean }> }>;
}

export function publicBoard(state: JeopardyState): BoardWire {
  return {
    categories: state.pack.categories.map((c, ci) => ({
      name: c.name,
      clues: c.clues.map((q, qi) => ({
        value: q.value,
        revealed: state.revealed[ci]![qi]!,
      })),
    })),
  };
}

export function isBoardCleared(state: JeopardyState): boolean {
  return state.revealed.every((row) => row.every((r) => r));
}

export function getClue(state: JeopardyState, cat: number, clue: number): JeopardyClue | undefined {
  return state.pack.categories[cat]?.clues[clue];
}

// =====================================================================
// Scoring helpers
// =====================================================================
export function maxDailyDoubleWager(playerScore: number, value: number): number {
  // Show convention: max( current score, max value on the board ) = 1000 here.
  return Math.max(playerScore, value, 1000);
}

export function maxFinalWager(playerScore: number): number {
  return Math.max(playerScore, 0);
}

export function clampWager(raw: number, max: number): number {
  if (!Number.isFinite(raw)) return 0;
  const r = Math.max(0, Math.floor(raw));
  return Math.min(r, max);
}

// =====================================================================
// Fuzzy answer judging (for typed-answer mode and bot judging)
// =====================================================================
export function normalizeJeopardyAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    // Strip Jeopardy-style "what is / who are" question prefixes.
    .replace(/^\s*(what(?:'s| is| are)?|who(?:'s| is| are)?|where(?:'s| is| are)?)\s+/i, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

export function isJeopardyAnswerCorrect(
  guess: string,
  canonical: string,
  accepted?: string[],
): boolean {
  const g = normalizeJeopardyAnswer(guess);
  if (!g) return false;
  const candidates = [canonical, ...(accepted ?? [])];
  for (const a of candidates) {
    const n = normalizeJeopardyAnswer(a);
    if (!n) continue;
    if (g === n) return true;
    const tol = n.length >= 8 ? 2 : n.length >= 4 ? 1 : 0;
    if (tol > 0 && levenshtein(g, n) <= tol) return true;
    // multi-word: allow significant token match
    if (n.split(" ").length > 1) {
      if (n.split(" ").includes(g)) return true;
    }
  }
  return false;
}

// =====================================================================
// Timer helpers
// =====================================================================
export function clearJeopardyTimer(state: JeopardyState) {
  if (state.timerHandle) {
    clearTimeout(state.timerHandle);
    state.timerHandle = null;
  }
  state.timerEndAt = 0;
}

export function setJeopardyTimer(
  state: JeopardyState,
  durationMs: number,
  cb: () => void,
) {
  clearJeopardyTimer(state);
  state.timerEndAt = Date.now() + durationMs;
  state.timerHandle = setTimeout(cb, durationMs);
}

export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =====================================================================
// Bot decision helpers
// =====================================================================
export function botDailyDoubleWager(playerScore: number, value: number): number {
  // Modest aggression: half of allowed max, with a floor of `value`.
  const max = maxDailyDoubleWager(playerScore, value);
  const bid = Math.round(max * (0.4 + Math.random() * 0.4));
  return Math.max(value, Math.min(max, bid));
}

export function botFinalWager(playerScore: number, leaderScore: number): number {
  const max = maxFinalWager(playerScore);
  if (max === 0) return 0;
  // If trailing, bet big; if leading, bet conservatively.
  const isLeading = playerScore >= leaderScore;
  const ratio = isLeading ? 0.3 + Math.random() * 0.3 : 0.6 + Math.random() * 0.4;
  return Math.max(0, Math.min(max, Math.round(max * ratio)));
}

export function botShouldBuzz(): boolean {
  // Bots always *try* to buzz — the racing delay is what spaces them apart.
  return true;
}

export function botGuessesCorrect(): boolean {
  return Math.random() < JEOPARDY_BOT_CORRECTNESS;
}

export function botFinalGuessesCorrect(): boolean {
  return Math.random() < JEOPARDY_FINAL_BOT_CORRECTNESS;
}

// =====================================================================
// Round summary leaderboard (sorted desc, host filtered out)
// =====================================================================
export function jeopardyLeaderboard<TPlayer extends { id: string; name: string; score: number; isHost?: boolean; isBot?: boolean }>(
  players: TPlayer[],
): TPlayer[] {
  return [...players]
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);
}

// =====================================================================
// Wire-safe active clue (with optional answer reveal flag)
// =====================================================================
export interface ActiveClueWire {
  cat: number;
  clue: number;
  category: string;
  value: number;
  question: string;
  isDailyDouble: boolean;
}

export function activeClueWire(active: JeopardyActiveClue): ActiveClueWire {
  return {
    cat: active.cat,
    clue: active.clue,
    category: active.category,
    value: active.value,
    question: active.question,
    isDailyDouble: active.isDailyDouble,
  };
}
