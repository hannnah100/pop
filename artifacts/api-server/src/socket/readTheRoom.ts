/**
 * Read the Room — party game where players answer juicy questions
 * anonymously, one player per round (the "Solver") tries to match answers
 * to authors, and other players can throw a single dart per game on a
 * pairing for a high-risk bonus.
 */

export const ANSWER_PHASE_MS = 60_000;
export const SOLVING_PHASE_MS = 240_000;

export const SCORE_SOLVER_CORRECT = 100;
export const SCORE_DART_HIT = 200;
export const SCORE_DART_MISS = -100;
export const SCORE_STEALTH = 50;

export const PLAYER_COLORS = [
  "#FF006E",
  "#8AFF00",
  "#00F5FF",
  "#FFD60A",
  "#FF6B00",
  "#B537F2",
  "#FF0054",
  "#0066FF",
  "#FF00FF",
  "#00FF7F",
] as const;

export const PRESET_QUESTIONS: ReadonlyArray<string> = [
  "What's your biggest ick?",
  "What's your hottest take?",
  "What's your biggest red flag?",
  "What's something you'd never admit in public?",
  "What's your most unpopular opinion?",
  "What instantly turns you off?",
  "What's your guilty pleasure?",
  "What's something people always get wrong about you?",
  "What's your most irrational fear?",
  "What would you do with $1 million?",
  "What's the pettiest reason you've ended a friendship?",
  "What's a lie you tell on first dates?",
  "What's your most controversial food opinion?",
  "What's the cringiest thing you did as a teen?",
  "What's your biggest toxic trait?",
  "What's a celebrity crush you'd never admit?",
  "What's a song you'd be embarrassed for people to find on your playlist?",
  "What's the most you've spent on something pointless?",
  "What's a compliment you fish for?",
  "What's your weirdest comfort routine?",
  "What's something you secretly judge people for?",
  "What's the worst gift you've ever received?",
  "What's an opinion you've changed completely on?",
  "What's something everyone loves but you don't get?",
  "What's a small thing that sets you off?",
];

export type ReadTheRoomPhase =
  | "lobby"
  | "picking-question"
  | "answering"
  | "solving"
  | "reveal"
  | "round-end"
  | "finished";

/** Number of question options shown to the solver each round. */
export const QUESTION_OPTIONS_COUNT = 3;

export interface RtrAnswer {
  /** Stable id for this answer (used by darts/matches). */
  id: string;
  playerId: string;
  text: string;
}

export interface RtrMatch {
  answerId: string;
  guessedPlayerId: string;
}

export interface RtrDart {
  /** Player who threw it. */
  playerId: string;
  answerId: string;
  guessedPlayerId: string;
  /** Round when thrown (each player has 1 dart per ENTIRE game). */
  round: number;
}

export interface RtrPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isBot: boolean;
  score: number;
}

export interface RtrRoundRecord {
  round: number;
  question: string;
  solverId: string;
  answers: RtrAnswer[];
  /** Solver's submitted matches: answerId -> guessedPlayerId. */
  matches: Record<string, string>;
}

export interface ReadTheRoomState {
  phase: ReadTheRoomPhase;
  currentRound: number;
  totalRounds: number;
  /** Index into players[] (non-host, non-bot if possible) of who solves this round. */
  solverIndex: number;
  /** Currently selected question for this round. */
  currentQuestion: string;
  /** Remaining preset questions available to draw from this game. */
  questionDeck: string[];
  /** The 3 options currently offered to the solver to pick from. Empty when not in picking phase. */
  questionOptions: string[];
  /** Ordered list of non-host player ids for solver rotation. */
  rotationOrder: string[];
  /** Answers indexed by player id for the CURRENT round. */
  currentAnswers: Map<string, RtrAnswer>;
  /** Has player submitted their answer this round. */
  submittedAnswerIds: Set<string>;
  /** Shuffled answer ids the solver sees (consistent across solver + spectators). */
  shuffledAnswerOrder: string[];
  /** Solver's matches for current round: answerId -> guessedPlayerId. */
  solverMatches: Record<string, string>;
  solverSubmitted: boolean;
  /** Darts used by players (one per ENTIRE game). */
  dartsByPlayer: Map<string, RtrDart>;
  /** Current reveal index (which answer in shuffled order). */
  revealIndex: number;
  /** Past round records. */
  history: RtrRoundRecord[];
  timerEndAt: number;
  timerHandle: ReturnType<typeof setTimeout> | null;
}

export function makeReadTheRoomState(totalRounds: number): ReadTheRoomState {
  return {
    phase: "lobby",
    currentRound: 0,
    totalRounds,
    solverIndex: 0,
    currentQuestion: "",
    questionDeck: [],
    questionOptions: [],
    rotationOrder: [],
    currentAnswers: new Map(),
    submittedAnswerIds: new Set(),
    shuffledAnswerOrder: [],
    solverMatches: {},
    solverSubmitted: false,
    dartsByPlayer: new Map(),
    revealIndex: 0,
    history: [],
    timerEndAt: 0,
    timerHandle: null,
  };
}

export function clearRtrTimer(state: ReadTheRoomState): void {
  if (state.timerHandle) {
    clearTimeout(state.timerHandle);
    state.timerHandle = null;
  }
  state.timerEndAt = 0;
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * Score a completed round.
 * - Solver gets +100 per correct match, 0 for wrong.
 * - Each dart: +200 if hit (correct answer + correct player), -100 if miss.
 * - Stealth bonus: +50 to any author whose answer the solver guessed wrong.
 */
export function scoreReadTheRoomRound(
  answers: RtrAnswer[],
  matches: Record<string, string>,
  darts: RtrDart[],
  round: number,
): Record<string, number> {
  const delta: Record<string, number> = {};
  const add = (id: string, n: number) => {
    delta[id] = (delta[id] ?? 0) + n;
  };

  const solverId = darts.length > 0 ? null : null; // unused
  void solverId;

  for (const a of answers) {
    const guessed = matches[a.id];
    if (guessed === a.playerId) {
      // Solver correct — solver gets +100 (added by caller below); author no stealth.
    } else if (guessed) {
      // Wrong guess: stealth bonus to author.
      add(a.playerId, SCORE_STEALTH);
    }
  }

  for (const d of darts) {
    if (d.round !== round) continue;
    const target = answers.find((a) => a.id === d.answerId);
    if (!target) continue;
    if (target.playerId === d.guessedPlayerId) {
      add(d.playerId, SCORE_DART_HIT);
    } else {
      add(d.playerId, SCORE_DART_MISS);
    }
  }

  return delta;
}

/** Pick solver index for the given round (1-indexed round number). */
export function solverIdForRound(state: ReadTheRoomState, round: number): string | null {
  if (state.rotationOrder.length === 0) return null;
  const idx = (round - 1) % state.rotationOrder.length;
  return state.rotationOrder[idx] ?? null;
}

/**
 * Draw QUESTION_OPTIONS_COUNT questions from the deck for the solver to choose from.
 * Refills the deck from PRESET_QUESTIONS if it ever runs low.
 */
export function drawQuestionOptions(state: ReadTheRoomState): string[] {
  if (state.questionDeck.length < QUESTION_OPTIONS_COUNT) {
    const refill = shuffle(PRESET_QUESTIONS.filter((q) => !state.questionDeck.includes(q)));
    state.questionDeck = [...state.questionDeck, ...refill];
  }
  const options = state.questionDeck.slice(0, QUESTION_OPTIONS_COUNT);
  state.questionDeck = state.questionDeck.slice(QUESTION_OPTIONS_COUNT);
  state.questionOptions = options;
  return options;
}

/**
 * Consume the solver's chosen question — the picked one is removed,
 * the other two are shuffled back into the deck so they can resurface.
 */
export function consumeQuestionChoice(state: ReadTheRoomState, chosen: string): void {
  const returned = state.questionOptions.filter((q) => q !== chosen);
  state.questionOptions = [];
  state.questionDeck = shuffle([...state.questionDeck, ...returned]);
}
