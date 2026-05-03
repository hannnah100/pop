import type { Server as SocketIOServer } from "socket.io";
import { ALL_CATEGORIES, BOT_ANSWER_POOL, CATEGORIES_PER_ROUND, SAFE_LETTERS, pickCategories } from "../data/scattergories/categories";
import type { ScatCategory } from "../data/scattergories/categories";

export { ScatCategory };

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
  timerHandle: NodeJS.Timeout | null;
  alertHandle: NodeJS.Timeout | null;
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

export function pickLetter(usedLetters: string[]): string {
  const available = SAFE_LETTERS.filter((l) => !usedLetters.includes(l));
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

export function scoreRound(
  categories: ScatCategory[],
  submissions: Map<string, Record<string, string>>,
  players: Array<{ id: string; name: string; isBot: boolean }>,
): CategoryResult[] {
  return categories.map((cat) => {
    const answers: PlayerAnswerResult[] = players.map((p) => {
      const raw = (submissions.get(p.id)?.[cat.id] ?? "").trim();
      const isBlank = raw.length === 0;
      return {
        playerId: p.id,
        playerName: p.name,
        answer: raw,
        isUnique: false,
        isBlank,
        pointsEarned: 0,
      };
    });

    const nonBlank = answers.filter((a) => !a.isBlank);
    nonBlank.forEach((a) => {
      const others = nonBlank.filter((b) => b.playerId !== a.playerId);
      const hasDuplicate = others.some((b) => areSameAnswer(a.answer, b.answer));
      a.isUnique = !hasDuplicate;
      a.pointsEarned = a.isUnique ? 1 : 0;
    });

    return { categoryId: cat.id, categoryName: cat.name, answers };
  });
}

export function clearScatTimer(state: ScattergoriesState) {
  if (state.timerHandle) { clearTimeout(state.timerHandle); state.timerHandle = null; }
  if (state.alertHandle) { clearTimeout(state.alertHandle); state.alertHandle = null; }
  state.timerEndAt = 0;
}

export function botPickAnswer(letter: string, _categoryId: string): string {
  if (Math.random() < 0.18) return "";
  const pool = BOT_ANSWER_POOL[letter] ?? [];
  if (pool.length === 0) return "";
  return pool[Math.floor(Math.random() * pool.length)]!;
}

interface ScatRoom {
  code: string;
  players: Array<{ id: string; name: string; isBot: boolean; isHost: boolean; score: number }>;
  isDemo: boolean;
  scattergories?: ScattergoriesState;
}

export function startScattergoriesRound(
  io: SocketIOServer,
  room: ScatRoom,
  onRoundEnd: () => void,
) {
  const sc = room.scattergories!;
  sc.phase = "round";
  sc.submissions = new Map();
  sc.submittedPlayerIds = new Set();

  const letter = pickLetter(sc.usedLetters);
  sc.currentLetter = letter;
  sc.usedLetters.push(letter);

  const categories = pickCategories(CATEGORIES_PER_ROUND, sc.usedCategoryIds);
  sc.currentCategories = categories;
  sc.usedCategoryIds.push(...categories.map((c) => c.id));

  const durationMs = TIMER_DURATIONS_MS[sc.difficulty];
  const startedAt = Date.now();
  sc.timerEndAt = startedAt + durationMs;

  io.to(room.code).emit("scattergories-round-started", {
    round: sc.currentRound,
    totalRounds: sc.roundCount,
    letter,
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    timerEndAt: sc.timerEndAt,
    difficulty: sc.difficulty,
  });

  if (room.isDemo) {
    scheduleBotScattergoriesAnswers(io, room, letter, categories, startedAt);
  }

  const alertDelay = durationMs - 10_000;
  if (alertDelay > 0) {
    sc.alertHandle = setTimeout(() => {
      const live = (io as unknown as { _rooms?: Map<string, ScatRoom> })._rooms?.get(room.code);
      if (!live?.scattergories || live.scattergories.phase !== "round") return;
      if (live.scattergories.currentLetter !== letter) return;
      io.to(room.code).emit("scattergories-10-second-alert");
    }, alertDelay);
  }

  sc.timerHandle = setTimeout(() => {
    onRoundEnd();
  }, durationMs);
}

function scheduleBotScattergoriesAnswers(
  io: SocketIOServer,
  room: ScatRoom,
  letter: string,
  categories: ScatCategory[],
  startedAt: number,
) {
  const bots = room.players.filter((p) => p.isBot && !p.isHost);
  const durationMs = TIMER_DURATIONS_MS[room.scattergories!.difficulty];

  bots.forEach((bot) => {
    const delay = Math.floor(durationMs * (0.3 + Math.random() * 0.5));
    setTimeout(() => {
      const sc = room.scattergories;
      if (!sc || sc.phase !== "round") return;
      if (sc.currentLetter !== letter) return;
      if (Date.now() - startedAt > durationMs - 2000) return;

      const answers: Record<string, string> = {};
      categories.forEach((cat) => {
        answers[cat.id] = botPickAnswer(letter, cat.id);
      });
      sc.submissions.set(bot.id, answers);
      sc.submittedPlayerIds.add(bot.id);

      const nonHostPlayers = room.players.filter((p) => !p.isHost);
      io.to(room.code).emit("scattergories-submission-progress", {
        submitted: sc.submittedPlayerIds.size,
        total: nonHostPlayers.length,
      });
    }, delay);
  });
}

export function resolveScattergoriesRound(
  io: SocketIOServer,
  room: ScatRoom,
): RoundSummary {
  const sc = room.scattergories!;
  clearScatTimer(sc);
  sc.phase = "results";

  const nonHostPlayers = room.players.filter((p) => !p.isHost);
  const results = scoreRound(sc.currentCategories, sc.submissions, nonHostPlayers);

  const roundScoreMap: Record<string, number> = {};
  results.forEach((cat) => {
    cat.answers.forEach((a) => {
      roundScoreMap[a.playerId] = (roundScoreMap[a.playerId] ?? 0) + a.pointsEarned;
    });
  });

  nonHostPlayers.forEach((p) => {
    p.score += roundScoreMap[p.id] ?? 0;
  });

  const roundScores = nonHostPlayers.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    roundScore: roundScoreMap[p.id] ?? 0,
    isBot: p.isBot,
  }));

  const summary: RoundSummary = {
    round: sc.currentRound,
    letter: sc.currentLetter,
    categories: sc.currentCategories,
    results,
    roundScores,
  };
  sc.roundHistory.push(summary);

  const leaderboard = [...nonHostPlayers]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ id: p.id, name: p.name, score: p.score, isBot: p.isBot, rank: i + 1 }));

  io.to(room.code).emit("scattergories-results", {
    round: sc.currentRound,
    totalRounds: sc.roundCount,
    letter: sc.currentLetter,
    results,
    roundScores,
    leaderboard,
    isLastRound: sc.currentRound >= sc.roundCount,
  });

  return summary;
}
