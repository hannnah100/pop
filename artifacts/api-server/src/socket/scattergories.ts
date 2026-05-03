import { SAFE_LETTERS, pickCategories } from "../data/scattergories/categories";
import type { ScatCategory } from "../data/scattergories/categories";

export { ScatCategory, pickCategories };
export { SAFE_LETTERS, CATEGORIES_PER_ROUND } from "../data/scattergories/categories";

export type ScattergoriesDifficulty = "easy" | "medium" | "hard";
export type ScattergoriesPhase = "lobby" | "round" | "results" | "ended";

export const TIMER_DURATIONS_MS: Record<ScattergoriesDifficulty, number> = {
  easy: 90_000,
  medium: 60_000,
  hard: 45_000,
};

export interface PlayerAnswerResult {
  playerId: string;
  playerName: string;
  answer: string;
  isUnique: boolean;
  isBlank: boolean;
  isDuplicate: boolean;
  isInvalid: boolean;
  pointsEarned: number;
}

export interface CategoryResult {
  categoryId: string;
  categoryName: string;
  answers: PlayerAnswerResult[];
}

export interface RoundSummary {
  round: number;
  letter: string;
  categories: ScatCategory[];
  results: CategoryResult[];
  roundScores: Array<{ playerId: string; playerName: string; roundScore: number; isBot: boolean }>;
}

export interface ScattergoriesState {
  phase: ScattergoriesPhase;
  roundCount: number;
  difficulty: ScattergoriesDifficulty;
  currentRound: number;
  usedLetters: string[];
  usedCategoryIds: string[];
  currentLetter: string;
  currentCategories: ScatCategory[];
  timerEndAt: number;
  timerHandle: ReturnType<typeof setTimeout> | null;
  alertHandle: ReturnType<typeof setTimeout> | null;
  submissions: Map<string, Record<string, string>>;
  submittedPlayerIds: Set<string>;
  roundHistory: RoundSummary[];
}

export function makeScattergoriesState(
  roundCount: number,
  difficulty: ScattergoriesDifficulty,
): ScattergoriesState {
  return {
    phase: "lobby",
    roundCount,
    difficulty,
    currentRound: 0,
    usedLetters: [],
    usedCategoryIds: [],
    currentLetter: "",
    currentCategories: [],
    timerEndAt: 0,
    timerHandle: null,
    alertHandle: null,
    submissions: new Map(),
    submittedPlayerIds: new Set(),
    roundHistory: [],
  };
}

export function pickScatLetter(usedLetters: string[]): string {
  const available = (SAFE_LETTERS as readonly string[]).filter((l) => !usedLetters.includes(l));
  const pool = available.length > 0 ? available : [...SAFE_LETTERS];
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = Array.from({ length: b.length + 1 }, (_, i) => i);
  const v1 = new Array<number>(b.length + 1);
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min((v1[j] ?? 0) + 1, (v0[j + 1] ?? 0) + 1, (v0[j] ?? 0) + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j] ?? 0;
  }
  return v1[b.length] ?? 0;
}

export function normalizeScatAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/^(the|a|an) /, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function areSameAnswer(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = normalizeScatAnswer(a);
  const nb = normalizeScatAnswer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const minLen = Math.min(na.length, nb.length);
  const tol = minLen >= 7 ? 2 : minLen >= 4 ? 1 : 0;
  return tol > 0 && levenshtein(na, nb) <= tol;
}

function answersWithLetter(raw: string, letter: string): boolean {
  if (!raw) return false;
  const norm = normalizeScatAnswer(raw);
  return norm.startsWith(letter.toLowerCase());
}

export function scoreScattergoriesRound(
  categories: ScatCategory[],
  submissions: Map<string, Record<string, string>>,
  players: Array<{ id: string; name: string; isBot: boolean }>,
  letter: string,
): CategoryResult[] {
  return categories.map((cat) => {
    const answers: PlayerAnswerResult[] = players.map((p) => {
      const raw = (submissions.get(p.id)?.[cat.id] ?? "").trim();
      const isBlank = raw.length === 0;
      const isInvalid = !isBlank && !answersWithLetter(raw, letter);
      return {
        playerId: p.id,
        playerName: p.name,
        answer: raw,
        isUnique: false,
        isBlank,
        isInvalid,
        isDuplicate: false,
        pointsEarned: 0,
      };
    });

    const eligible = answers.filter((a) => !a.isBlank && !a.isInvalid);
    eligible.forEach((a) => {
      const others = eligible.filter((b) => b.playerId !== a.playerId);
      const hasDuplicate = others.some((b) => areSameAnswer(a.answer, b.answer));
      a.isDuplicate = hasDuplicate;
      a.isUnique = !hasDuplicate;
      a.pointsEarned = a.isUnique ? 1 : 0;
    });

    return { categoryId: cat.id, categoryName: cat.name, answers };
  });
}

export function clearScatTimers(state: ScattergoriesState) {
  if (state.timerHandle) { clearTimeout(state.timerHandle); state.timerHandle = null; }
  if (state.alertHandle) { clearTimeout(state.alertHandle); state.alertHandle = null; }
  state.timerEndAt = 0;
}
