import type { Server as SocketIOServer } from "socket.io";
import type { QuizPack, QuizQuestion } from "../data/quiz/types";

// =====================================================================
// Per-question timer durations (ms)
// =====================================================================
export const QUIZ_TIMER_MS: Record<string, number> = {
  "multiple-choice": 30_000,
  "open-ended": 30_000,
  "true-false": 10_000,
};

// =====================================================================
// Scoring
// =====================================================================
export const QUIZ_SCORING = {
  multipleChoice: 1,
  openEnded: 1,
  trueFalse: 0.5,
  firstCorrectBonus: 0.5,
  wrongAnswerPenalty: 0,
};

// =====================================================================
// Quiz state stored on a room
// =====================================================================
export interface QuizState {
  pack: QuizPack;
  roundIndex: number;
  questionIndex: number;
  questionStartedAt: number;
  timerEndAt: number;
  timerHandle: NodeJS.Timeout | null;
  revealed: boolean;
  /**
   * Per-current-question answers keyed by player id.
   * `answer` is normalized to the player's raw input (string for MC index/open-ended, bool for true-false).
   */
  answers: Record<
    string,
    {
      raw: string;
      submittedAt: number;
      correct: boolean;
    }
  >;
  /** Tracks first correct answerer for bonus + UI. */
  firstCorrectId: string | null;
  /** Set to true when host explicitly ends the game early. */
  endedEarly: boolean;
}

export function makeQuizState(pack: QuizPack): QuizState {
  return {
    pack,
    roundIndex: 0,
    questionIndex: 0,
    questionStartedAt: 0,
    timerEndAt: 0,
    timerHandle: null,
    revealed: false,
    answers: {},
    firstCorrectId: null,
    endedEarly: false,
  };
}

// =====================================================================
// Public-safe view of a question (no answer data leaked to players)
// =====================================================================
export interface PublicQuestion {
  type: QuizQuestion["type"];
  prompt: string;
  options?: string[];
  roundName: string;
  roundIndex: number;
  questionIndex: number;
  questionsInRound: number;
  totalRounds: number;
  durationMs: number;
}

export function getCurrentQuestion(state: QuizState): QuizQuestion | undefined {
  const round = state.pack.rounds[state.roundIndex];
  return round?.questions[state.questionIndex];
}

export function getCurrentRound(state: QuizState) {
  return state.pack.rounds[state.roundIndex];
}

export function publicQuestionFromState(
  state: QuizState,
): PublicQuestion | null {
  const round = getCurrentRound(state);
  const q = getCurrentQuestion(state);
  if (!round || !q) return null;
  const base: PublicQuestion = {
    type: q.type,
    prompt: q.prompt,
    roundName: round.name,
    roundIndex: state.roundIndex,
    questionIndex: state.questionIndex,
    questionsInRound: round.questions.length,
    totalRounds: state.pack.rounds.length,
    durationMs: QUIZ_TIMER_MS[q.type] ?? 30_000,
  };
  if (q.type === "multiple-choice") {
    base.options = q.options;
  }
  return base;
}

// =====================================================================
// Fuzzy matching for open-ended answers
// =====================================================================
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9 ]+/g, " ") // strip punctuation
    .replace(/^(the|a|an) /, "") // strip leading articles
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

export function isOpenEndedCorrect(
  guess: string,
  acceptedAnswers: string[],
): boolean {
  const g = normalizeAnswer(guess);
  if (!g) return false;
  for (const accepted of acceptedAnswers) {
    const a = normalizeAnswer(accepted);
    if (!a) continue;
    if (g === a) return true;
    // Allow tiny typos: 1 char tolerance for short answers, 2 for longer
    const tol = a.length >= 8 ? 2 : a.length >= 4 ? 1 : 0;
    if (tol > 0 && levenshtein(g, a) <= tol) return true;
    // Allow "contains" for multi-word answers (e.g. accepted "James Bond" matched by "bond")
    if (a.split(" ").length > 1) {
      const tokens = a.split(" ");
      if (tokens.includes(g)) return true;
    }
  }
  return false;
}

// =====================================================================
// Score a player's submission for the CURRENT question
// =====================================================================
export interface JudgeResult {
  correct: boolean;
  pointsForCorrect: number; // base points if correct (excludes bonus)
}

export function judgeAnswer(
  q: QuizQuestion,
  raw: string,
): JudgeResult {
  if (q.type === "multiple-choice") {
    const idx = Number.parseInt(raw, 10);
    if (Number.isNaN(idx)) return { correct: false, pointsForCorrect: QUIZ_SCORING.multipleChoice };
    return {
      correct: idx === q.correctIndex,
      pointsForCorrect: QUIZ_SCORING.multipleChoice,
    };
  }
  if (q.type === "true-false") {
    const v = raw === "true" || raw === "1";
    return {
      correct: v === q.answer,
      pointsForCorrect: QUIZ_SCORING.trueFalse,
    };
  }
  // open-ended
  return {
    correct: isOpenEndedCorrect(raw, q.acceptedAnswers),
    pointsForCorrect: QUIZ_SCORING.openEnded,
  };
}

// =====================================================================
// Bot answer choice for a question
// =====================================================================
const BOT_CORRECTNESS = 0.7; // 70% correct rate

export function botAnswerFor(q: QuizQuestion): string {
  const correct = Math.random() < BOT_CORRECTNESS;
  if (q.type === "multiple-choice") {
    if (correct) return String(q.correctIndex);
    const choices = [0, 1, 2, 3].filter((i) => i !== q.correctIndex);
    return String(choices[Math.floor(Math.random() * choices.length)]);
  }
  if (q.type === "true-false") {
    return correct ? String(q.answer) : String(!q.answer);
  }
  // open-ended
  if (correct) {
    const opts = q.acceptedAnswers;
    return opts[Math.floor(Math.random() * opts.length)] ?? "";
  }
  const wrongPool = ["I don't know", "skip", "no idea", "pass", "the other one"];
  return wrongPool[Math.floor(Math.random() * wrongPool.length)]!;
}

export function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// =====================================================================
// Build a wire-safe reveal payload for the current question
// =====================================================================
export interface AnswerSummary {
  playerId: string;
  raw: string;
  correct: boolean;
  submittedAt: number;
  responseMs: number;
}

export interface RevealPayload {
  roundIndex: number;
  questionIndex: number;
  questionType: QuizQuestion["type"];
  correctAnswer: string; // human-readable canonical answer
  correctOptionIndex?: number;
  trueFalseAnswer?: boolean;
  acceptedAnswers?: string[];
  perPlayerAnswers: AnswerSummary[];
  firstCorrectPlayerId: string | null;
  correctCount: number;
  totalAnswered: number;
}

export function buildReveal(state: QuizState): RevealPayload {
  const q = getCurrentQuestion(state)!;
  let correctAnswer = "";
  let correctOptionIndex: number | undefined;
  let trueFalseAnswer: boolean | undefined;
  let acceptedAnswers: string[] | undefined;
  if (q.type === "multiple-choice") {
    correctOptionIndex = q.correctIndex;
    correctAnswer = q.options[q.correctIndex];
  } else if (q.type === "true-false") {
    trueFalseAnswer = q.answer;
    correctAnswer = q.answer ? "True" : "False";
  } else {
    acceptedAnswers = q.acceptedAnswers;
    correctAnswer = q.acceptedAnswers[0] ?? "";
  }

  const perPlayerAnswers: AnswerSummary[] = Object.entries(state.answers).map(
    ([playerId, a]) => ({
      playerId,
      raw: a.raw,
      correct: a.correct,
      submittedAt: a.submittedAt,
      responseMs: Math.max(0, a.submittedAt - state.questionStartedAt),
    }),
  );
  const correctCount = perPlayerAnswers.filter((p) => p.correct).length;

  return {
    roundIndex: state.roundIndex,
    questionIndex: state.questionIndex,
    questionType: q.type,
    correctAnswer,
    correctOptionIndex,
    trueFalseAnswer,
    acceptedAnswers,
    perPlayerAnswers,
    firstCorrectPlayerId: state.firstCorrectId,
    correctCount,
    totalAnswered: perPlayerAnswers.length,
  };
}

// =====================================================================
// Round / pack progress helpers
// =====================================================================
export function isLastQuestionOfRound(state: QuizState): boolean {
  const round = getCurrentRound(state);
  if (!round) return true;
  return state.questionIndex >= round.questions.length - 1;
}

export function isLastRound(state: QuizState): boolean {
  return state.roundIndex >= state.pack.rounds.length - 1;
}

export function clearTimer(state: QuizState) {
  if (state.timerHandle) {
    clearTimeout(state.timerHandle);
    state.timerHandle = null;
  }
}

export function resetForNextQuestion(state: QuizState) {
  clearTimer(state);
  state.revealed = false;
  state.answers = {};
  state.firstCorrectId = null;
  state.questionStartedAt = 0;
  state.timerEndAt = 0;
}

// =====================================================================
// Pack summaries for the host UI (id, title, etc.) — never sent answers.
// =====================================================================
export interface PackSummary {
  id: string;
  title: string;
  description: string;
  roundCount: number;
  questionCount: number;
  rounds: Array<{ name: string; type: QuizQuestion["type"]; questionCount: number }>;
}

export function packSummary(pack: QuizPack): PackSummary {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    roundCount: pack.rounds.length,
    questionCount: pack.rounds.reduce((acc, r) => acc + r.questions.length, 0),
    rounds: pack.rounds.map((r) => ({
      name: r.name,
      type: r.questions[0]?.type ?? "multiple-choice",
      questionCount: r.questions.length,
    })),
  };
}

// =====================================================================
// Schedule bots to auto-answer the current question
// =====================================================================
export function scheduleBotQuizAnswers<TPlayer extends { id: string; isBot: boolean; isHost: boolean }>(
  io: SocketIOServer,
  roomCode: string,
  state: QuizState,
  bots: TPlayer[],
  totalNonHost: number,
  onAllAnswered: () => void,
) {
  const q = getCurrentQuestion(state);
  if (!q) return;

  bots.forEach((bot) => {
    const delay = rand(1500, 5500);
    setTimeout(() => {
      // If question already moved on / revealed, drop.
      if (state.revealed) return;
      if (state.answers[bot.id]) return;
      const currentQ = getCurrentQuestion(state);
      if (!currentQ || currentQ !== q) return;

      const raw = botAnswerFor(currentQ);
      const judged = judgeAnswer(currentQ, raw);
      const submittedAt = Date.now();
      state.answers[bot.id] = {
        raw,
        submittedAt,
        correct: judged.correct,
      };
      if (judged.correct && !state.firstCorrectId) {
        state.firstCorrectId = bot.id;
      }

      const submitted = Object.keys(state.answers).length;
      io.to(roomCode).emit("quiz-answer-progress", {
        submitted,
        total: totalNonHost,
      });

      if (submitted >= totalNonHost) {
        onAllAnswered();
      }
    }, delay);
  });
}

// =====================================================================
// Compute final scores for end-of-game leaderboard
// =====================================================================
export function leaderboardSorted<TPlayer extends { id: string; name: string; score: number; isBot?: boolean; isHost?: boolean }>(
  players: TPlayer[],
): TPlayer[] {
  return [...players]
    .filter((p) => !p.isHost)
    .sort((a, b) => b.score - a.score);
}
