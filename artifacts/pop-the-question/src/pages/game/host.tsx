import { useEffect, useRef, useState, useCallback } from "react";
import { useRoute } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types/game";
import { Button } from "@/components/ui/button";
import {
  Users,
  Play,
  Crown,
  Trophy,
  Bot,
  Flame,
  Mic,
  ChevronRight,
  Eye,
  Beer,
  Check,
  X,
  SkipForward,
  ArrowRight,
  Shuffle,
  BookOpen,
  CheckSquare,
  AlignLeft,
  Grid3x3,
  Star,
  Zap,
  Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CountUp,
  ParticleRain,
  fireBigCelebration,
  fireConfetti,
  TypingText,
  RainbowText,
  TimerRing,
} from "@/components/fx";
import { WofWheel } from "@/components/WofWheel";
import { WofBoard } from "@/components/WofBoard";
import { useSfx } from "@/lib/sfx";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { HostShell } from "@/components/host/HostShell";
import {
  PlayerStatusBadge,
  type PlayerStatusState,
} from "@/components/host/PlayerStatusBadge";
import type { HostNotificationsHandle } from "@/components/host/HostNotifications";
import { useHostSettings, type HostAnswerMethod } from "@/lib/hostSettings";

// ============ Pub Quiz types ============
interface QuizPackSummary {
  id: string;
  title: string;
  description: string;
  roundCount: number;
  questionCount: number;
  rounds: Array<{ name: string; type: string; questionCount: number }>;
}

interface QuizPublicQuestion {
  type: "multiple-choice" | "open-ended" | "true-false";
  prompt: string;
  options?: string[];
  roundName: string;
  roundIndex: number;
  questionIndex: number;
  questionsInRound: number;
  totalRounds: number;
  durationMs: number;
}

interface QuizAnswerSummary {
  playerId: string;
  raw: string;
  correct: boolean;
  submittedAt: number;
  responseMs: number;
}

interface QuizRevealPayload {
  roundIndex: number;
  questionIndex: number;
  questionType: "multiple-choice" | "open-ended" | "true-false";
  correctAnswer: string;
  correctOptionIndex?: number;
  trueFalseAnswer?: boolean;
  acceptedAnswers?: string[];
  perPlayerAnswers: QuizAnswerSummary[];
  firstCorrectPlayerId: string | null;
  correctCount: number;
  totalAnswered: number;
}

interface QuizLeaderboardRow { id: string; name: string; score: number; isBot: boolean }

// ============ Jeopardy types ============
interface JPackSummary {
  id: string;
  title: string;
  description: string;
  categoryCount: number;
  clueCount: number;
  finalCategory: string;
}

interface JBoardWire {
  categories: Array<{ name: string; clues: Array<{ value: number; revealed: boolean }> }>;
}

interface JActiveClueWire {
  cat: number;
  clue: number;
  category: string;
  value: number;
  question: string;
  isDailyDouble: boolean;
}

interface JScoreRow { id: string; name: string; score: number; isBot: boolean }

type JPhase =
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

interface JDailyDoublePayload {
  cat: number;
  clue: number;
  category: string;
  value: number;
  controllerId: string;
  controllerName: string;
  maxWager: number;
}

interface JFinalPerPlayer {
  id: string;
  name: string;
  wager: number;
  answer: string;
  correct: boolean;
  score?: number;
}

// ============ Wheel of Fortune types ============
interface WofBoardCell { letter: string; revealed: boolean }
type WofBoardWord = WofBoardCell[];

interface WofPackSummaryWire {
  id: string;
  title: string;
  description: string;
  puzzleCount: number;
}

type WofWheelValue = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

interface WofScoreRow { id: string; name: string; score: number; roundEarnings: number; isBot: boolean }

// ============ Scattergories types ============
interface ScatCategory { id: string; name: string }
interface ScatAnswerResult {
  playerId: string;
  playerName: string;
  answer: string;
  pointsEarned: number;
  isDuplicate: boolean;
  isInvalid?: boolean;
}
interface ScatCategoryResult {
  categoryId: string;
  categoryName: string;
  answers: ScatAnswerResult[];
}
interface ScatRoundScore {
  playerId: string;
  playerName: string;
  roundScore: number;
  isBot: boolean;
}
interface ScatLeaderboardRow { id: string; name: string; score: number; isBot: boolean; rank: number }
type ScatDifficulty = "easy" | "medium" | "hard";

interface PlayerWithBot extends Player {
  isBot?: boolean;
  lastActivity?: number;
  muted?: boolean;
}

interface RoastQuestion {
  color?: string;
  question?: string;
}

interface RoastCard {
  [questionId: string]: { answer: string; author: string; answerId: string };
}

interface PlayerJoinedPayload {
  player?: PlayerWithBot;
  players: PlayerWithBot[];
  isDemo: boolean;
}

interface RoomStatePayload {
  players: PlayerWithBot[];
  isDemo: boolean;
  status?: string;
  gameType: string;
  quizPackId?: string | null;
  quizPackSummary?: QuizPackSummary | null;
  wofPackId?: string | null;
  wofRoundCount?: number;
  wofBoard?: WofBoardWord[] | null;
  wofPhase?: "spinning" | "guessing" | "puzzle-over" | "ended" | null;
  wofControllerId?: string | null;
  wofRevealedLetters?: string[];
  wofGuessedLetters?: string[];
  wofCategory?: string | null;
  wofHint?: string | null;
  wofPendingSolve?: { solverId: string | null; solverName: string; answer: string; isVerbal?: boolean } | null;
  wofPuzzleIndex?: number;
  wofTotalPuzzles?: number;
  wofScores?: WofScoreRow[];
}

interface GameStartedPayload {
  gameType: string;
  question?: string;
  questions?: RoastQuestion[];
  players?: PlayerWithBot[];
  currentRound?: number;
  totalRounds?: number;
  isDemo?: boolean;
}

interface QuestionUpdatePayload {
  question: string;
  questionIndex: number;
}

interface VoteProgressPayload {
  voted: number;
  total: number;
}

interface ResultsRevealedPayload {
  voteCounts: Record<string, number>;
  players?: PlayerWithBot[];
}

interface SubmissionProgressPayload {
  submitted: number;
  total: number;
  round: number;
}

interface RoundCompletePayload {
  nextRound: number;
  totalRounds: number;
}

interface StartRevealsPayload {
  currentRevealName: string;
  card?: RoastCard;
  questions?: RoastQuestion[];
  revealOrder?: string[];
  currentRevealId?: string;
}

interface PlayersOnlyPayload {
  players: PlayerWithBot[];
}

interface PlayerLeftPayload {
  playerId: string;
  players: PlayerWithBot[];
}

interface PlayerTypingChangedPayload {
  playerId: string;
  isTyping: boolean;
}

interface PlayerMutedChangedPayload {
  playerId: string;
  muted: boolean;
}

interface ErrorPayload {
  message: string;
}

const AWAY_THRESHOLD_MS = 30_000;

export default function GameHost() {
  const [, params] = useRoute("/game/:roomCode/host");
  const roomCode = params?.roomCode || "";
  const { toast } = useToast();
  const { playWhoosh, playVictory, playCorrect } = useSfx();
  const settings = useHostSettings();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finished">("lobby");
  const [gameType, setGameType] = useState<string>("");
  const [players, setPlayers] = useState<PlayerWithBot[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [voteCounts, setVoteCounts] = useState<Record<string, number>>({});
  const [votesIn, setVotesIn] = useState(0);
  const [totalVoters, setTotalVoters] = useState(0);
  const [resultsRevealed, setResultsRevealed] = useState(false);
  const [burnedPlayerId, setBurnedPlayerId] = useState<string | null>(null);

  const [rrPhase, setRrPhase] = useState<"writing" | "revealing" | "done">("writing");
  const [rrSubmitted, setRrSubmitted] = useState(0);
  const [rrTotal, setRrTotal] = useState(0);
  const [rrRound, setRrRound] = useState(1);
  const [rrTotalRounds, setRrTotalRounds] = useState(1);
  const [rrCurrentRevealId, setRrCurrentRevealId] = useState<string | null>(null);
  const [rrCurrentRevealName, setRrCurrentRevealName] = useState("");
  const [rrCard, setRrCard] = useState<Record<string, { answer: string; author: string; answerId: string }>>({});
  const [rrQuestions, setRrQuestions] = useState<Array<{ color?: string; question?: string }>>([]);
  const [rrRevealIndex, setRrRevealIndex] = useState(0);
  const [rrTotalReveals, setRrTotalReveals] = useState(0);

  // Per-player transient state (Task #5)
  const [typingPlayers, setTypingPlayers] = useState<Set<string>>(new Set());
  const [submittedPlayers, setSubmittedPlayers] = useState<Set<string>>(new Set());
  const [, setAwayTick] = useState(0);

  // Pub Quiz lobby — pack selection (Task #12)
  const [availablePacks, setAvailablePacks] = useState<QuizPackSummary[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  // Pub Quiz state
  const [pqPack, setPqPack] = useState<QuizPackSummary | null>(null);
  const [pqQuestion, setPqQuestion] = useState<QuizPublicQuestion | null>(null);
  const [pqQuestionStartedAt, setPqQuestionStartedAt] = useState(0);
  const [pqTimerEndAt, setPqTimerEndAt] = useState(0);
  const [pqAnsweredCount, setPqAnsweredCount] = useState(0);
  const [pqTotalAnswerers, setPqTotalAnswerers] = useState(0);
  const [pqReveal, setPqReveal] = useState<QuizRevealPayload | null>(null);
  const [pqLeaderboard, setPqLeaderboard] = useState<QuizLeaderboardRow[]>([]);
  const [pqRoundSummary, setPqRoundSummary] = useState<{
    roundIndex: number;
    roundName: string;
    totalRounds: number;
    isLastRound: boolean;
    leaderboard: QuizLeaderboardRow[];
  } | null>(null);
  const [pqNow, setPqNow] = useState(Date.now());

  // Jeopardy state
  const [jPack, setJPack] = useState<JPackSummary | null>(null);
  const [jBoard, setJBoard] = useState<JBoardWire | null>(null);
  const [jPhase, setJPhase] = useState<JPhase>("picking");
  const [jControllerId, setJControllerId] = useState<string | null>(null);
  const [jActive, setJActive] = useState<JActiveClueWire | null>(null);
  const [jBuzzedInId, setJBuzzedInId] = useState<string | null>(null);
  const [jBuzzedInName, setJBuzzedInName] = useState<string>("");
  const [jScores, setJScores] = useState<JScoreRow[]>([]);
  const [jLastResolved, setJLastResolved] = useState<{
    playerId: string | null;
    playerName: string;
    correct: boolean;
    delta: number;
    isDailyDouble?: boolean;
  } | null>(null);
  const [jClueRevealedAnswer, setJClueRevealedAnswer] = useState<string | null>(null);
  const [jDailyDouble, setJDailyDouble] = useState<JDailyDoublePayload | null>(null);
  const [jDdWager, setJDdWager] = useState<number>(0);
  const [jFinalCategory, setJFinalCategory] = useState<string>("");
  const [jFinalQuestion, setJFinalQuestion] = useState<string>("");
  const [jFinalEligibleIds, setJFinalEligibleIds] = useState<string[]>([]);
  const [jFinalProgress, setJFinalProgress] = useState<{ stage: "wager" | "answer"; submitted: number; total: number } | null>(null);
  const [jFinalReveal, setJFinalReveal] = useState<{ correctAnswer: string; perPlayer: JFinalPerPlayer[] } | null>(null);
  const [jFinalScored, setJFinalScored] = useState<JFinalPerPlayer[] | null>(null);
  const [jTimerEndAt, setJTimerEndAt] = useState<number>(0);
  const [jNow, setJNow] = useState(Date.now());

  // Wheel of Fortune state
  const [wofBoard, setWofBoard] = useState<WofBoardWord[]>([]);
  const [wofCategory, setWofCategory] = useState("");
  const [wofHint, setWofHint] = useState<string | null>(null);
  const [wofControllerId, setWofControllerId] = useState<string | null>(null);
  const [wofRevealedLetters, setWofRevealedLetters] = useState<string[]>([]);
  const [wofGuessedLetters, setWofGuessedLetters] = useState<string[]>([]);
  const [wofScores, setWofScores] = useState<WofScoreRow[]>([]);
  const [wofPhase, setWofPhase] = useState<"spinning" | "guessing" | "puzzle-over" | "ended">("spinning");
  const [wofLastSpin, setWofLastSpin] = useState<WofWheelValue | null>(null);
  const [wofSpinType, setWofSpinType] = useState<string | null>(null);
  const [wofSpinning, setWofSpinning] = useState(false);
  const [wofPuzzleIndex, setWofPuzzleIndex] = useState(0);
  const [wofTotalPuzzles, setWofTotalPuzzles] = useState(0);
  const [wofPuzzleOver, setWofPuzzleOver] = useState<{ answer: string; category: string; isLastPuzzle: boolean } | null>(null);
  const [wofLastLetter, setWofLastLetter] = useState<{ letter: string; count: number; correct: boolean; scoreEarned: number } | null>(null);
  const [wofSolveResult, setWofSolveResult] = useState<{ correct: boolean; answer: string | null; solverName: string } | null>(null);
  // Pack selection
  const [wofAvailablePacks, setWofAvailablePacks] = useState<WofPackSummaryWire[]>([]);
  const [wofSelectedPackId, setWofSelectedPackId] = useState<string | null>(null);
  const [wofRoundCount, setWofRoundCount] = useState<number>(5);
  const [wofSpinIndex, setWofSpinIndex] = useState<number | null>(null);
  const [wofIsFreePlay, setWofIsFreePlay] = useState(false);
  const [wofPendingSolve, setWofPendingSolve] = useState<{ solverId: string | null; solverName: string; answer: string; isVerbal?: boolean } | null>(null);
  const wofSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scattergories state
  const [scatPhase, setScatPhase] = useState<"round" | "results" | "ended" | null>(null);
  const [scatRound, setScatRound] = useState(0);
  const [scatTotalRounds, setScatTotalRounds] = useState(3);
  const [scatLetter, setScatLetter] = useState("");
  const [scatCategories, setScatCategories] = useState<ScatCategory[]>([]);
  const [scatTimerEndAt, setScatTimerEndAt] = useState(0);
  const [scatNow, setScatNow] = useState(Date.now());
  const [scatSubmitted, setScatSubmitted] = useState(0);
  const [scatTotal, setScatTotal] = useState(0);
  const [scatResults, setScatResults] = useState<ScatCategoryResult[]>([]);
  const [scatRoundScores, setScatRoundScores] = useState<ScatRoundScore[]>([]);
  const [scatLeaderboard, setScatLeaderboard] = useState<ScatLeaderboardRow[]>([]);
  const [scatIsLastRound, setScatIsLastRound] = useState(false);
  const [scatDifficulty, setScatDifficulty] = useState<ScatDifficulty>("medium");
  const [scatRoundCount, setScatRoundCount] = useState(3);
  const [scatAlertActive, setScatAlertActive] = useState(false);

  const finishedRef = useRef(false);
  const notificationsRef = useRef<HostNotificationsHandle | null>(null);
  const knownPlayerIds = useRef<Set<string>>(new Set());

  // Force-recompute Away status on a 5s tick (status derived from lastActivity).
  useEffect(() => {
    const id = window.setInterval(() => setAwayTick((t) => t + 1), 5000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!roomCode) return;

    const newSocket = io({ path: "/socket.io" });
    setSocket(newSocket);

    newSocket.emit("join-room", { roomCode, playerName: "HOST", isHost: true });

    newSocket.on("player-joined", ({ player, players: ps, isDemo: demo }: PlayerJoinedPayload) => {
      const visible = ps.filter((p) => !p.isHost);
      setPlayers(visible);
      if (demo) setIsDemo(true);

      // Notify on real (non-bot, non-host) joins after the initial population.
      if (player && !player.isHost && !player.isBot) {
        if (knownPlayerIds.current.has(player.id)) return;
        knownPlayerIds.current.add(player.id);
        notificationsRef.current?.push({
          message: `🎉 ${player.name} joined the room`,
          variant: "success",
          duration: 3500,
        });
      }
    });

    newSocket.on("player-left", ({ playerId, players: ps }: PlayerLeftPayload) => {
      const left = players.find((p) => p.id === playerId);
      knownPlayerIds.current.delete(playerId);
      setPlayers(ps.filter((p) => !p.isHost));
      setTypingPlayers((prev) => {
        const next = new Set(prev);
        next.delete(playerId);
        return next;
      });
      if (left && !left.isBot) {
        notificationsRef.current?.push({
          message: `👋 ${left.name} left`,
          variant: "warn",
          duration: 3000,
        });
      }
    });

    newSocket.on("room-state", (data: RoomStatePayload & { wofRoundCount?: number }) => {
      const { players: ps, isDemo: demo, gameType: gt, quizPackId, wofPackId } = data;
      const visible = ps.filter((p) => !p.isHost);
      setPlayers(visible);
      visible.forEach((p) => knownPlayerIds.current.add(p.id));
      if (demo) setIsDemo(true);
      if (gt) {
        setGameType(gt);
        if (gt === "pub-quiz") {
          // Restore host-selected pack from server state and fetch the pack list.
          setSelectedPackId(quizPackId ?? null);
          newSocket.emit("quiz-list-packs");
        }
        if (gt === "wheel-of-fortune") {
          setWofSelectedPackId(wofPackId ?? null);
          if (data.wofRoundCount) setWofRoundCount(data.wofRoundCount);
          newSocket.emit("wof-list-packs");
          // Rehydrate mid-game state on reconnect
          if (data.status === "playing" && data.wofBoard) {
            setGameState("playing");
            setWofBoard(data.wofBoard);
            setWofCategory(data.wofCategory ?? "");
            setWofHint(data.wofHint ?? null);
            setWofControllerId(data.wofControllerId ?? null);
            setWofRevealedLetters(data.wofRevealedLetters ?? []);
            setWofGuessedLetters(data.wofGuessedLetters ?? []);
            setWofPhase(data.wofPhase ?? "spinning");
            setWofPendingSolve(data.wofPendingSolve ?? null);
            setWofPuzzleIndex(data.wofPuzzleIndex ?? 0);
            setWofTotalPuzzles(data.wofTotalPuzzles ?? 0);
            if (data.wofScores) setWofScores(data.wofScores);
            setWofSpinning(false);
            setWofSpinIndex(null);
            setWofLastSpin(null);
            setWofLastLetter(null);
            setWofSolveResult(null);
            setWofPuzzleOver(null);
          }
        }
      }
    });

    newSocket.on("game-started", (payload: GameStartedPayload & {
      pack?: QuizPackSummary | JPackSummary;
      board?: JBoardWire;
      controllerId?: string | null;
      scores?: JScoreRow[];
    }) => {
      const { gameType: gt, question, questions, players: ps, currentRound, totalRounds, isDemo: demo, pack } = payload;
      setGameState("playing");
      setGameType(gt);
      if (demo) setIsDemo(true);
      playWhoosh();
      setSubmittedPlayers(new Set());
      setTypingPlayers(new Set());

      if (gt === "pop-the-question") {
        setCurrentQuestion(question ?? "");
        setQuestionIndex(0);
        setVotesIn(0);
        setResultsRevealed(false);
        if (ps) setTotalVoters(ps.filter((p) => !p.isHost).length);
      } else if (gt === "roast-roulette") {
        setRrPhase("writing");
        setRrRound(currentRound ?? 1);
        setRrTotalRounds(totalRounds ?? 1);
        setRrSubmitted(0);
        if (ps) {
          const nonHost = ps.filter((p) => !p.isHost);
          setRrTotal(nonHost.length);
          setRrTotalReveals(nonHost.length);
          setPlayers(nonHost);
        }
        if (questions) setRrQuestions(questions);
      } else if (gt === "pub-quiz") {
        setPqPack((pack as QuizPackSummary) ?? null);
        setPqReveal(null);
        setPqRoundSummary(null);
        setPqAnsweredCount(0);
      } else if (gt === "jeopardy") {
        setJPack((pack as JPackSummary) ?? null);
        setJBoard(payload.board ?? null);
        setJControllerId(payload.controllerId ?? null);
        setJScores(payload.scores ?? []);
        setJPhase("picking");
        setJActive(null);
        setJBuzzedInId(null);
        setJBuzzedInName("");
        setJLastResolved(null);
        setJClueRevealedAnswer(null);
        setJDailyDouble(null);
        setJDdWager(0);
        setJFinalCategory("");
        setJFinalQuestion("");
        setJFinalEligibleIds([]);
        setJFinalProgress(null);
        setJFinalReveal(null);
        setJFinalScored(null);
        setJTimerEndAt(0);
      } else if (gt === "wheel-of-fortune") {
        const w = payload as unknown as {
          board: WofBoardWord[];
          category: string;
          hint?: string | null;
          controllerId: string | null;
          revealedLetters: string[];
          guessedLetters: string[];
          puzzleIndex: number;
          totalPuzzles: number;
          scores: WofScoreRow[];
        };
        setWofBoard(w.board ?? []);
        setWofCategory(w.category ?? "");
        setWofHint(w.hint ?? null);
        setWofControllerId(w.controllerId ?? null);
        setWofRevealedLetters(w.revealedLetters ?? []);
        setWofGuessedLetters(w.guessedLetters ?? []);
        setWofPuzzleIndex(w.puzzleIndex ?? 0);
        setWofTotalPuzzles(w.totalPuzzles ?? 0);
        setWofScores(w.scores ?? []);
        setWofPhase("spinning");
        setWofLastSpin(null);
        setWofSpinType(null);
        setWofLastLetter(null);
        setWofSolveResult(null);
        setWofPuzzleOver(null);
      } else if (gt === "scattergories") {
        const s = payload as unknown as { roundCount?: number; difficulty?: ScatDifficulty };
        setScatPhase(null);
        setScatRound(0);
        setScatTotalRounds(s.roundCount ?? 3);
        setScatDifficulty(s.difficulty ?? "medium");
        setScatLetter("");
        setScatCategories([]);
        setScatResults([]);
        setScatLeaderboard([]);
        setScatAlertActive(false);
        setScatSubmitted(0);
        setScatTotal(players.length);
      }
    });

    // ============ Jeopardy socket handlers ============
    newSocket.on("jeopardy-board-update", (payload: {
      board: JBoardWire;
      phase: JPhase;
      controllerId: string | null;
      scores: JScoreRow[];
    }) => {
      setJBoard(payload.board);
      setJPhase(payload.phase);
      setJControllerId(payload.controllerId);
      setJScores(payload.scores);
      if (payload.phase === "picking") {
        setJActive(null);
        setJBuzzedInId(null);
        setJBuzzedInName("");
        setJClueRevealedAnswer(null);
        setJDailyDouble(null);
        setJLastResolved(null);
        setJTimerEndAt(0);
      }
    });

    newSocket.on("jeopardy-clue-revealed", (payload: {
      active: JActiveClueWire;
      buzzerArmDelayMs: number;
    }) => {
      setJActive(payload.active);
      setJPhase("clue-reveal");
      setJBuzzedInId(null);
      setJBuzzedInName("");
      setJClueRevealedAnswer(null);
      setJLastResolved(null);
      setJTimerEndAt(0);
      playWhoosh();
    });

    newSocket.on("jeopardy-buzzer-open", (payload: { timerEndAt: number }) => {
      setJPhase("buzzer-open");
      setJBuzzedInId(null);
      setJBuzzedInName("");
      setJTimerEndAt(payload.timerEndAt);
    });

    newSocket.on("jeopardy-buzzed", (payload: {
      playerId: string;
      playerName: string;
      timerEndAt: number;
    }) => {
      setJPhase("answering");
      setJBuzzedInId(payload.playerId);
      setJBuzzedInName(payload.playerName);
      setJTimerEndAt(payload.timerEndAt);
      playWhoosh();
    });

    newSocket.on("jeopardy-answer-resolved", (payload: {
      playerId: string | null;
      playerName: string;
      correct: boolean;
      delta: number;
      correctAnswer?: string;
      scores: JScoreRow[];
      isDailyDouble?: boolean;
    }) => {
      setJScores(payload.scores);
      setJLastResolved({
        playerId: payload.playerId,
        playerName: payload.playerName,
        correct: payload.correct,
        delta: payload.delta,
        isDailyDouble: payload.isDailyDouble,
      });
      if (payload.correct) {
        playCorrect();
        fireConfetti("gold", { particleCount: 60, spread: 80, origin: { y: 0.6 } });
      }
    });

    newSocket.on("jeopardy-clue-ended", (payload: {
      correctAnswer: string | null;
      scores: JScoreRow[];
    }) => {
      setJScores(payload.scores);
      setJClueRevealedAnswer(payload.correctAnswer);
      setJBuzzedInId(null);
      setJBuzzedInName("");
      setJTimerEndAt(0);
    });

    newSocket.on("jeopardy-daily-double", (payload: JDailyDoublePayload & { timerEndAt: number }) => {
      setJDailyDouble(payload);
      setJPhase("dd-wager");
      setJDdWager(0);
      setJTimerEndAt(payload.timerEndAt);
      playWhoosh();
      fireConfetti("rainbow", { particleCount: 80, spread: 90, origin: { y: 0.5 } });
    });

    newSocket.on("jeopardy-dd-clue", (payload: {
      active: JActiveClueWire;
      wager: number;
      controllerId: string;
      timerEndAt: number;
    }) => {
      setJActive(payload.active);
      setJDdWager(payload.wager);
      setJControllerId(payload.controllerId);
      setJPhase("dd-clue");
      setJTimerEndAt(payload.timerEndAt);
    });

    newSocket.on("jeopardy-final-intro", (payload: { category: string; scores: JScoreRow[] }) => {
      setJFinalCategory(payload.category);
      setJScores(payload.scores);
      setJPhase("final-intro");
      setJActive(null);
      setJTimerEndAt(0);
      playWhoosh();
    });

    newSocket.on("jeopardy-final-wager-open", (payload: {
      category: string;
      timerEndAt: number;
      eligiblePlayerIds: string[];
    }) => {
      setJFinalCategory(payload.category);
      setJFinalEligibleIds(payload.eligiblePlayerIds);
      setJPhase("final-wager");
      setJTimerEndAt(payload.timerEndAt);
      setJFinalProgress({ stage: "wager", submitted: 0, total: payload.eligiblePlayerIds.length });
    });

    newSocket.on("jeopardy-final-progress", (payload: {
      stage: "wager" | "answer";
      submitted: number;
      total: number;
    }) => {
      setJFinalProgress(payload);
    });

    newSocket.on("jeopardy-final-clue", (payload: {
      category: string;
      question: string;
      timerEndAt: number;
    }) => {
      setJFinalCategory(payload.category);
      setJFinalQuestion(payload.question);
      setJPhase("final-clue");
      setJTimerEndAt(payload.timerEndAt);
      playWhoosh();
    });

    newSocket.on("jeopardy-final-reveal", (payload: {
      correctAnswer: string;
      perPlayer: JFinalPerPlayer[];
    }) => {
      setJFinalReveal(payload);
      setJPhase("final-reveal");
      setJTimerEndAt(0);
    });

    newSocket.on("jeopardy-final-scored", (payload: {
      scores: JScoreRow[];
      perPlayer: JFinalPerPlayer[];
    }) => {
      setJScores(payload.scores);
      setJFinalScored(payload.perPlayer);
      playCorrect();
      setTimeout(() => fireBigCelebration(), 300);
    });

    // ============ Pub Quiz socket handlers ============
    newSocket.on("quiz-question", ({ question, startedAt, timerEndAt }: { question: QuizPublicQuestion; startedAt: number; timerEndAt: number }) => {
      setPqQuestion(question);
      setPqQuestionStartedAt(startedAt);
      setPqTimerEndAt(timerEndAt);
      setPqReveal(null);
      setPqRoundSummary(null);
      setPqAnsweredCount(0);
      setPqTotalAnswerers(players.filter((p) => !p.isHost).length || 0);
      playWhoosh();
    });

    newSocket.on("quiz-answer-progress", ({ submitted, total }: { submitted: number; total: number }) => {
      setPqAnsweredCount(submitted);
      setPqTotalAnswerers(total);
    });

    newSocket.on("quiz-reveal", (payload: {
      reveal: QuizRevealPayload;
      leaderboard: QuizLeaderboardRow[];
      isLastQuestionOfRound: boolean;
      isLastRound: boolean;
    }) => {
      setPqReveal(payload.reveal);
      setPqLeaderboard(payload.leaderboard);
      playCorrect();
      if (payload.reveal.correctCount > 0) {
        setTimeout(() => fireConfetti("rainbow", { particleCount: 60, spread: 80, origin: { y: 0.55 } }), 200);
      }
    });

    // ====== Pub Quiz: pack list + host selection (Task #12) ======
    newSocket.on("quiz-packs", ({ packs }: { packs: QuizPackSummary[] }) => {
      setAvailablePacks(packs);
    });

    newSocket.on("quiz-pack-changed", ({ packId }: { packId: string | null }) => {
      setSelectedPackId(packId);
    });

    newSocket.on("quiz-round-summary", (payload: {
      roundIndex: number;
      roundName: string;
      totalRounds: number;
      isLastRound: boolean;
      leaderboard: QuizLeaderboardRow[];
    }) => {
      setPqRoundSummary(payload);
      setPqLeaderboard(payload.leaderboard);
      playWhoosh();
      setTimeout(() => fireConfetti("gold", { particleCount: 50, spread: 70, origin: { y: 0.5 } }), 200);
    });

    newSocket.on("quiz-question-skipped", () => {
      // Treat skip as a "fake reveal" so host can advance — but render handled by reveal=null + leaderboard view.
      setPqReveal({
        roundIndex: pqQuestion?.roundIndex ?? 0,
        questionIndex: pqQuestion?.questionIndex ?? 0,
        questionType: pqQuestion?.type ?? "multiple-choice",
        correctAnswer: "(skipped)",
        perPlayerAnswers: [],
        firstCorrectPlayerId: null,
        correctCount: 0,
        totalAnswered: 0,
      });
    });

    newSocket.on("question-update", ({ question, questionIndex: qi }: QuestionUpdatePayload) => {
      setCurrentQuestion(question ?? "");
      setQuestionIndex(qi);
      setVotesIn(0);
      setVoteCounts({});
      setResultsRevealed(false);
      setBurnedPlayerId(null);
      setSubmittedPlayers(new Set());
      setTypingPlayers(new Set());
      playWhoosh();
    });

    newSocket.on("vote-progress", ({ voted, total }: VoteProgressPayload) => {
      setVotesIn(voted);
      setTotalVoters(total);
    });

    newSocket.on("results-revealed", ({ voteCounts: vc, players: ps }: ResultsRevealedPayload) => {
      setVoteCounts(vc ?? {});
      setResultsRevealed(true);
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
      playCorrect();

      const sorted = Object.entries(vc ?? {}).sort(([, a], [, b]) => b - a);
      if (sorted.length > 0 && sorted[0][1] > 0) {
        setBurnedPlayerId(sorted[0][0]);
        setTimeout(() => fireConfetti("fire", { particleCount: 90, spread: 90, origin: { y: 0.55 } }), 300);
      }
    });

    newSocket.on("submission-progress", ({ submitted, total, round }: SubmissionProgressPayload) => {
      setRrSubmitted(submitted);
      setRrTotal(total);
      setRrRound(round);
    });

    newSocket.on("round-complete", ({ nextRound, totalRounds }: RoundCompletePayload) => {
      setRrRound(nextRound);
      setRrTotalRounds(totalRounds);
      setRrSubmitted(0);
      setSubmittedPlayers(new Set());
      setTypingPlayers(new Set());
      notificationsRef.current?.push({
        message: `Round ${nextRound} of ${totalRounds}`,
        variant: "info",
        duration: 2500,
      });
    });

    newSocket.on("writing-complete", () => {
      setRrPhase("revealing");
      playWhoosh();
      notificationsRef.current?.push({
        message: "📝 All roasts written — time for reveals!",
        variant: "success",
        duration: 3500,
      });
    });

    newSocket.on("start-reveals", ({ currentRevealName, card, questions: qs, revealOrder, currentRevealId }: StartRevealsPayload) => {
      setRrPhase("revealing");
      setRrCurrentRevealName(currentRevealName ?? "");
      setRrCard(card ?? {});
      if (qs) setRrQuestions(qs);
      if (revealOrder && currentRevealId) {
        setRrCurrentRevealId(currentRevealId);
        setRrRevealIndex((prev) => {
          const idx = revealOrder.indexOf(currentRevealId);
          return idx >= 0 ? idx : prev;
        });
        setRrTotalReveals(revealOrder.length);
      }
      playWhoosh();
    });

    newSocket.on("favorite-picked", ({ players: ps }: PlayersOnlyPayload) => {
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
    });

    newSocket.on("game-ended", (payload: PlayersOnlyPayload & { finalScores?: QuizLeaderboardRow[]; gameType?: string }) => {
      const { players: ps, finalScores, gameType: gt } = payload;
      setGameState("finished");
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
      if (finalScores) setPqLeaderboard(finalScores);
      if (gt === "wheel-of-fortune" && finalScores) setWofScores(finalScores.map(s => ({ ...s, roundEarnings: 0 })));
      if (gt === "scattergories" && finalScores) {
        const sorted = [...finalScores].sort((a, b) => b.score - a.score);
        setScatLeaderboard(sorted.map((r, i) => ({ ...r, rank: i + 1 })));
      }
    });

    // ============ Scattergories socket handlers ============
    newSocket.on("scattergories-config-changed", ({ roundCount, difficulty }: { roundCount: number; difficulty: ScatDifficulty }) => {
      setScatRoundCount(roundCount);
      setScatDifficulty(difficulty);
    });

    newSocket.on("scattergories-round-started", (payload: {
      round: number;
      totalRounds: number;
      letter: string;
      categories: ScatCategory[];
      timerEndAt: number;
      difficulty: ScatDifficulty;
    }) => {
      setScatPhase("round");
      setScatRound(payload.round);
      setScatTotalRounds(payload.totalRounds);
      setScatLetter(payload.letter);
      setScatCategories(payload.categories);
      setScatTimerEndAt(payload.timerEndAt);
      setScatNow(Date.now());
      setScatDifficulty(payload.difficulty);
      setScatAlertActive(false);
      setScatSubmitted(0);
      setScatTotal(players.filter(p => !p.isHost).length);
      setScatResults([]);
      setScatRoundScores([]);
      playWhoosh();
    });

    newSocket.on("scattergories-submission-progress", ({ submitted, total }: { submitted: number; total: number }) => {
      setScatSubmitted(submitted);
      setScatTotal(total);
    });

    newSocket.on("scattergories-10-second-alert", () => {
      setScatAlertActive(true);
    });

    newSocket.on("scattergories-results", (payload: {
      round: number;
      totalRounds: number;
      letter: string;
      results: ScatCategoryResult[];
      roundScores: ScatRoundScore[];
      leaderboard: ScatLeaderboardRow[];
      isLastRound: boolean;
    }) => {
      setScatPhase("results");
      setScatRound(payload.round);
      setScatTotalRounds(payload.totalRounds);
      setScatLetter(payload.letter);
      setScatResults(payload.results);
      setScatRoundScores(payload.roundScores);
      setScatLeaderboard(payload.leaderboard);
      setScatIsLastRound(payload.isLastRound);
      setScatAlertActive(false);
      // Update player scores from leaderboard
      setPlayers(prev => prev.map(p => {
        const row = payload.leaderboard.find(r => r.id === p.id);
        return row ? { ...p, score: row.score } : p;
      }));
      playCorrect();
    });

    // ============ Wheel of Fortune socket handlers ============
    newSocket.on("wof-packs", ({ packs }: { packs: WofPackSummaryWire[] }) => {
      setWofAvailablePacks(packs);
    });

    newSocket.on("wof-pack-changed", ({ packId }: { packId: string | null }) => {
      setWofSelectedPackId(packId);
    });

    newSocket.on("wof-round-count-changed", ({ roundCount }: { roundCount: number }) => {
      setWofRoundCount(roundCount);
    });

    newSocket.on("wof-spun", (payload: {
      value: WofWheelValue;
      spinIndex: number;
      type: string;
      controllerId: string | null;
      controllerName: string;
      isFreePlay?: boolean;
      scores: WofScoreRow[];
    }) => {
      // Start the wheel animation immediately (works for both host-spin and player/bot spins)
      setWofSpinning(true);
      // Set spin index so WofWheel knows the target segment to snap to after animation
      setWofSpinIndex(payload.spinIndex ?? null);
      // Clear any previous pending spin timeout
      if (wofSpinTimeoutRef.current) clearTimeout(wofSpinTimeoutRef.current);
      // Delay applying game state until the 3.5s spin animation completes
      wofSpinTimeoutRef.current = setTimeout(() => {
        setWofLastSpin(payload.value);
        setWofSpinType(payload.type);
        setWofSpinning(false);
        setWofControllerId(payload.controllerId);
        setWofScores(payload.scores);
        setWofPendingSolve(null);
        setWofIsFreePlay(payload.isFreePlay ?? false);
        if (payload.type === "bankrupt" || payload.type === "lose-a-turn") {
          setWofPhase("spinning");
        } else {
          setWofPhase("guessing");
        }
        setWofLastLetter(null);
        setWofSolveResult(null);
      }, 2600);
    });

    newSocket.on("wof-solve-pending", (payload: { solverId: string | null; solverName: string; answer: string }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofPendingSolve(payload);
    });

    newSocket.on("wof-solve-submitted", (payload: { solverName: string }) => {
      notificationsRef.current?.push({
        message: `📝 ${payload.solverName} is attempting to solve!`,
        variant: "info",
        duration: 3000,
      });
    });

    newSocket.on("wof-letter-result", (payload: {
      letter: string;
      count: number;
      correct: boolean;
      scoreEarned: number;
      board: WofBoardWord[];
      revealedLetters: string[];
      guessedLetters: string[];
      controllerId: string | null;
      scores: WofScoreRow[];
    }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofGuessedLetters(payload.guessedLetters);
      setWofControllerId(payload.controllerId);
      setWofScores(payload.scores);
      setWofLastLetter({ letter: payload.letter, count: payload.count, correct: payload.correct, scoreEarned: payload.scoreEarned });
      setWofSolveResult(null);
      if (payload.count > 0) {
        if (payload.correct) fireConfetti("gold", { particleCount: 40, spread: 60, origin: { y: 0.5 } });
        setWofPhase("spinning");
      } else {
        setWofPhase("spinning");
      }
    });

    newSocket.on("wof-vowel-result", (payload: {
      letter: string;
      count: number;
      found: boolean;
      board: WofBoardWord[];
      revealedLetters: string[];
      guessedLetters: string[];
      controllerId: string | null;
      scores: WofScoreRow[];
    }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofGuessedLetters(payload.guessedLetters);
      setWofControllerId(payload.controllerId);
      setWofScores(payload.scores);
      setWofLastLetter({ letter: payload.letter, count: payload.count, correct: payload.found, scoreEarned: 0 });
      setWofPhase("spinning");
    });

    newSocket.on("wof-solve-result", (payload: {
      correct: boolean;
      answer: string | null;
      solverId: string | null;
      solverName: string;
      board: WofBoardWord[];
      revealedLetters: string[];
      scores: WofScoreRow[];
    }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofScores(payload.scores);
      setWofSolveResult({ correct: payload.correct, answer: payload.answer, solverName: payload.solverName });
      setWofPendingSolve(null);
      if (payload.correct) {
        playCorrect();
        setTimeout(() => fireBigCelebration(), 300);
      }
    });

    newSocket.on("wof-puzzle-over", (payload: {
      answer: string;
      category: string;
      board: WofBoardWord[];
      scores: WofScoreRow[];
      puzzleIndex: number;
      totalPuzzles: number;
      isLastPuzzle: boolean;
    }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.board.flatMap(w => w.map(c => c.letter)));
      setWofScores(payload.scores);
      setWofPhase("puzzle-over");
      setWofPuzzleOver({ answer: payload.answer, category: payload.category, isLastPuzzle: payload.isLastPuzzle });
      setWofPuzzleIndex(payload.puzzleIndex);
      setWofTotalPuzzles(payload.totalPuzzles);
      playCorrect();
      setTimeout(() => fireConfetti("rainbow", { particleCount: 80, spread: 90, origin: { y: 0.5 } }), 200);
    });

    newSocket.on("wof-next-puzzle", (payload: {
      board: WofBoardWord[];
      category: string;
      hint: string | null;
      controllerId: string | null;
      puzzleIndex: number;
      totalPuzzles: number;
      revealedLetters: string[];
      guessedLetters: string[];
      scores: WofScoreRow[];
    }) => {
      if (wofSpinTimeoutRef.current) { clearTimeout(wofSpinTimeoutRef.current); wofSpinTimeoutRef.current = null; }
      setWofSpinning(false);
      setWofBoard(payload.board);
      setWofCategory(payload.category);
      setWofHint(payload.hint);
      setWofControllerId(payload.controllerId);
      setWofPuzzleIndex(payload.puzzleIndex);
      setWofTotalPuzzles(payload.totalPuzzles);
      setWofRevealedLetters(payload.revealedLetters);
      setWofGuessedLetters(payload.guessedLetters);
      setWofScores(payload.scores);
      setWofPhase("spinning");
      setWofLastSpin(null);
      setWofSpinType(null);
      setWofLastLetter(null);
      setWofSolveResult(null);
      setWofPuzzleOver(null);
      playWhoosh();
    });

    // ====== Task #5: per-player status events ======
    newSocket.on("player-typing-changed", ({ playerId, isTyping }: PlayerTypingChangedPayload) => {
      setTypingPlayers((prev) => {
        const next = new Set(prev);
        if (isTyping) next.add(playerId);
        else next.delete(playerId);
        return next;
      });
    });

    newSocket.on("player-muted-changed", ({ playerId, muted }: PlayerMutedChangedPayload) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, muted } : p)),
      );
    });

    newSocket.on("error", ({ message }: ErrorPayload) => {
      toast({ title: "Game Error", description: message, variant: "destructive" });
    });

    return () => { newSocket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode]);

  useEffect(() => {
    if (gameState === "finished" && !finishedRef.current) {
      finishedRef.current = true;
      playVictory();
      setTimeout(() => fireBigCelebration(), 350);
    }
  }, [gameState, playVictory]);

  // Track who has submitted this round so we can render Answered badges.
  useEffect(() => {
    // PtQ: each player in voteCounts has answered; before reveal we don't have
    // per-player vote info, so we rely on votesIn (count) only.
    if (gameType === "pop-the-question" && resultsRevealed) {
      setSubmittedPlayers(new Set(Object.keys(voteCounts)));
    }
  }, [voteCounts, resultsRevealed, gameType]);

  const handleStartGame = () => socket?.emit("start-game", { roomCode });
  const handleRevealResults = () => socket?.emit("reveal-results", { roomCode });
  const handleNextQuestion = () => socket?.emit("next-question", { roomCode });
  const handleEndGame = () => socket?.emit("end-game", { roomCode });
  const handleNextReveal = () => socket?.emit("next-reveal", { roomCode });

  const handlePauseChange = useCallback(
    (paused: boolean) => {
      socket?.emit("host-pause", { roomCode, paused });
      notificationsRef.current?.push({
        message: paused ? "⏸ Game paused" : "▶ Game resumed",
        variant: paused ? "warn" : "success",
        duration: 2500,
      });
    },
    [socket, roomCode],
  );

  const handleAnswerMethodChange = useCallback(
    (method: HostAnswerMethod) => {
      socket?.emit("host-settings-update", {
        roomCode,
        settings: { answerMethod: method },
      });
    },
    [socket, roomCode],
  );

  // Publish the host's locally-persisted settings to the room on connect
  // so players read the host's actual preferences, not server defaults.
  // Re-publishes if the host changes mode/answerMethod locally between games.
  const lastPublishedRef = useRef<string>("");
  useEffect(() => {
    if (!socket) return;
    const payload = {
      mode: settings.mode,
      answerMethod: settings.answerMethod,
    };
    const key = JSON.stringify(payload);
    if (key === lastPublishedRef.current) return;
    lastPublishedRef.current = key;
    socket.emit("host-settings-update", { roomCode, settings: payload });
  }, [socket, roomCode, settings.mode, settings.answerMethod]);

  // Derive per-player status for Task #5 status badges.
  const getPlayerStatus = useCallback(
    (p: PlayerWithBot): PlayerStatusState => {
      if (p.muted) return "muted";
      if (submittedPlayers.has(p.id)) return "answered";
      if (typingPlayers.has(p.id)) return "typing";
      // Bots are never "away"; humans go away after AWAY_THRESHOLD_MS.
      if (!p.isBot && p.lastActivity && Date.now() - p.lastActivity > AWAY_THRESHOLD_MS) {
        return "away";
      }
      return "thinking";
    },
    [submittedPlayers, typingPlayers],
  );

  // Pub Quiz: pack picker (Task #12)
  const handleSetPack = (packId: string | null) => {
    setSelectedPackId(packId);
    socket?.emit("set-pack", { roomCode, packId });
  };

  // Wheel of Fortune: pack picker
  const handleWofSetPack = (packId: string | null) => {
    setWofSelectedPackId(packId);
    socket?.emit("wof-set-pack", { roomCode, packId });
  };

  // Wheel of Fortune: handlers
  const handleWofSpin = () => {
    setWofSpinning(true);
    setWofSpinIndex(null);
    socket?.emit("wof-spin", { roomCode });
  };
  const handleWofNextPuzzle = () => {
    setWofPendingSolve(null);
    socket?.emit("wof-next-puzzle", { roomCode });
  };
  const handleWofEndGame = () => socket?.emit("wof-end-game", { roomCode });
  const handleWofSetRoundCount = (count: number) => {
    setWofRoundCount(count);
    socket?.emit("wof-set-round-count", { roomCode, roundCount: count });
  };
  const handleWofJudge = (correct: boolean) => {
    setWofPendingSolve(null);
    socket?.emit("wof-judge", { roomCode, correct });
  };

  // Scattergories handlers
  const handleScatSetConfig = (roundCount: number, difficulty: ScatDifficulty) => {
    setScatRoundCount(roundCount);
    setScatDifficulty(difficulty);
    socket?.emit("scattergories-set-config", { roomCode, roundCount, difficulty });
  };
  const handleScatSkipToResults = () => socket?.emit("scattergories-skip-to-results", { roomCode });
  const handleScatNextRound = () => socket?.emit("scattergories-next-round", { roomCode });
  const handleScatEndGame = () => socket?.emit("scattergories-end-game", { roomCode });

  // Pub Quiz handlers
  const handlePqReveal = () => socket?.emit("quiz-reveal-answer", { roomCode });
  const handlePqSkip = () => socket?.emit("quiz-skip-question", { roomCode });
  const handlePqNext = () => socket?.emit("quiz-next-question", { roomCode });
  const handlePqNextRound = () => socket?.emit("quiz-next-round", { roomCode });
  const handlePqEndGame = () => socket?.emit("quiz-end-game", { roomCode });

  // Pub Quiz: timer tick (every 250ms while a question is live without reveal)
  useEffect(() => {
    if (gameType !== "pub-quiz" || !pqQuestion || pqReveal || pqRoundSummary) return;
    const id = setInterval(() => setPqNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameType, pqQuestion, pqReveal, pqRoundSummary]);

  // Jeopardy handlers
  const handleJMarkCorrect = () => socket?.emit("jeopardy-mark-correct", { roomCode });
  const handleJMarkIncorrect = () => socket?.emit("jeopardy-mark-incorrect", { roomCode });
  const handleJSkipClue = () => socket?.emit("jeopardy-skip-clue", { roomCode });
  const handleJStartFinal = () => socket?.emit("jeopardy-start-final", { roomCode });
  const handleJRevealFinal = () => socket?.emit("jeopardy-reveal-final", { roomCode });
  const handleJEndGame = () => socket?.emit("jeopardy-end-game", { roomCode });
  const handleJOverrideFinal = (playerId: string, correct: boolean) =>
    socket?.emit("jeopardy-override-final", { roomCode, playerId, correct });

  // Jeopardy: timer tick whenever a timer is active
  useEffect(() => {
    if (gameType !== "jeopardy" || jTimerEndAt === 0) return;
    const id = setInterval(() => setJNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameType, jTimerEndAt]);

  // Scattergories: timer tick during active round
  useEffect(() => {
    if (gameType !== "scattergories" || scatPhase !== "round" || scatTimerEndAt === 0) return;
    const id = setInterval(() => setScatNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameType, scatPhase, scatTimerEndAt]);

  const DemoBadge = () =>
    isDemo ? (
      <div className="flex items-center gap-2 bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] text-black px-4 py-2 font-display font-black text-lg uppercase">
        <Bot className="w-5 h-5" />
        DEMO MODE
      </div>
    ) : null;

  const PlayerChip = ({ p }: { p: PlayerWithBot }) => (
    <motion.div
      key={p.id}
      layout
      initial={{ opacity: 0, scale: 0.7, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className={`font-display font-black text-2xl uppercase px-6 py-4 border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center gap-2
        ${p.isBot
          ? "bg-[#FFF8E7] text-black/50"
          : "bg-white text-black"
        }`}
    >
      {p.isBot && <Bot className="w-5 h-5 text-black/40" />}
      {p.name}
    </motion.div>
  );

  /**
   * Status bar shown during gameplay in Remote mode (Task #5).
   * Compact in In-Person mode to avoid TV chrome clutter.
   */
  const PlayerStatusBar = () => {
    if (players.length === 0) return null;
    const isRemote = settings.mode === "remote";
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={
          isRemote
            ? "flex flex-wrap gap-2 justify-center max-w-5xl mx-auto mb-6"
            : "flex flex-wrap gap-1.5 justify-center max-w-4xl mx-auto mb-3 opacity-80"
        }
        data-testid="player-status-bar"
      >
        {players.map((p) => {
          const state = getPlayerStatus(p);
          return (
            <div
              key={p.id}
              className={`inline-flex items-center gap-2 border-[2px] border-black px-3 py-1.5 font-display font-black uppercase shadow-[2px_2px_0_#000] ${
                state === "answered"
                  ? "bg-[#00C853] text-white"
                  : "bg-white text-black"
              } ${isRemote ? "text-sm" : "text-xs"}`}
            >
              {p.isBot && <Bot className="w-3.5 h-3.5 text-black/40" />}
              <span className="truncate max-w-[140px]">{p.name}</span>
              <PlayerStatusBadge state={state} compact={!isRemote} />
            </div>
          );
        })}
      </motion.div>
    );
  };

  // ============================================================
  //   Pack card — reusable within the lobby pack picker (Task #12)
  // ============================================================

  const ROUND_TYPE_META: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    "multiple-choice": {
      icon: <BookOpen className="w-3 h-3" />,
      label: "Multiple Choice",
      color: "text-primary",
    },
    "open-ended": {
      icon: <AlignLeft className="w-3 h-3" />,
      label: "Open-Ended",
      color: "text-accent",
    },
    "true-false": {
      icon: <CheckSquare className="w-3 h-3" />,
      label: "True/False",
      color: "text-secondary",
    },
  };

  const PackCard = ({
    id,
    title,
    description,
    roundCount,
    questionCount,
    rounds,
    selected,
    onSelect,
  }: {
    id: string | null;
    title: string;
    description: string;
    roundCount: number;
    questionCount: number;
    rounds: Array<{ name: string; type: string; questionCount: number }>;
    selected: boolean;
    onSelect: () => void;
  }) => {
    const isRandom = id === null;
    return (
      <motion.button
        layout
        onClick={onSelect}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`relative w-full text-left border-[3px] border-black p-4 focus-visible:outline-none
          ${selected
            ? "bg-[#FFD700] shadow-[5px_5px_0_#000]"
            : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"
          }`}
        data-testid={`pack-card-${id ?? "random"}`}
        aria-pressed={selected}
      >
        {selected && (
          <span className="absolute top-3 right-3 w-6 h-6 bg-black flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-[#FFD700]" />
          </span>
        )}

        <div className="flex items-start gap-2 mb-2">
          {isRandom
            ? <Shuffle className="w-4 h-4 text-black mt-0.5 flex-shrink-0" />
            : <Beer className="w-4 h-4 text-black mt-0.5 flex-shrink-0" />
          }
          <h3 className="font-display font-black text-black uppercase text-sm leading-tight pr-6">{title}</h3>
        </div>

        <p className="text-xs text-black/60 mb-3 leading-relaxed line-clamp-2 font-sans">{description}</p>

        {!isRandom && (
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-xs text-black/50 font-sans">
              <span>{roundCount} {roundCount === 1 ? "round" : "rounds"}</span>
              <span>·</span>
              <span>{questionCount} questions</span>
            </div>
            {rounds.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-2">
                {rounds.map((r, i) => {
                  const meta = ROUND_TYPE_META[r.type];
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-xs text-black/60 font-sans">
                      {meta?.icon}
                      <span className="truncate">{r.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </motion.button>
    );
  };

  // ============================================================
  //   CONTENT RENDERERS — each returns the phase-specific JSX
  //   without an outer min-h container. HostShell wraps them.
  // ============================================================

  const renderLobby = () => {
    const joinUrl = typeof window !== "undefined"
      ? `${window.location.hostname}/join`
      : "popthequestion.replit.app/join";

    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 bg-[#FFF8E7]">
        <div className="flex items-center gap-4 mb-6">
          <DemoBadge />
        </div>

        {/* Join URL — the big instruction players see on the TV */}
        <div className="mb-2 text-center">
          <p className="font-display font-black text-black/40 text-xl uppercase tracking-[0.15em] mb-1">
            Players: open your phone and go to
          </p>
          <div className="inline-flex items-center gap-3 bg-black px-6 py-3 border-[3px] border-black shadow-[4px_4px_0_#FF1493] mb-2">
            <span className="font-display font-black text-[#FFD700] text-2xl md:text-3xl tracking-wide">
              {joinUrl}
            </span>
          </div>
          <p className="font-display font-black text-black/40 text-xl uppercase tracking-[0.15em]">
            then enter code
          </p>
        </div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
          className="font-display font-black text-[8rem] sm:text-[10rem] md:text-[12rem] tracking-[0.18em] leading-none mb-4 comic-headline"
        >
          {roomCode}
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-5xl bg-white border-[4px] border-black shadow-[8px_8px_0_#000] p-8 mb-12"
        >
          <div className="flex items-center gap-4 mb-6 pb-4 border-b-[3px] border-black">
            <Users className="w-8 h-8 text-black" />
            <h2 className="font-display font-black text-black text-2xl md:text-3xl uppercase">
              Players (<CountUp value={players.length} duration={0.4} />)
              {isDemo && <span className="ml-3 text-lg font-sans font-normal text-black/50">· {players.filter(p => p.isBot).length} AI</span>}
            </h2>
          </div>

          <motion.div
            className="flex flex-wrap gap-4 min-h-[120px]"
            variants={staggerContainer(0.06)}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence>
              {players.length === 0 ? (
                <div className="w-full flex items-center justify-center text-2xl text-black/40 font-display font-black uppercase animate-pulse">
                  Waiting for players to join...
                </div>
              ) : (
                players.map((p) => <PlayerChip key={p.id} p={p} />)
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>

        {/* ===== Pub Quiz pack picker (Task #12) ===== */}
        {gameType === "pub-quiz" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-5xl mb-8"
          >
            <div className="flex items-center gap-3 mb-4">
              <Beer className="w-6 h-6 text-black" />
              <h2 className="font-display font-black text-black text-2xl uppercase">
                Choose a Pack
              </h2>
              {selectedPackId === null && (
                <span className="text-sm text-black/50 border-[2px] border-black px-3 py-1 font-sans">
                  Random is selected
                </span>
              )}
            </div>

            {availablePacks.length === 0 ? (
              <div className="text-black/50 animate-pulse text-lg font-display font-black uppercase">Loading packs…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <PackCard
                  id={null}
                  title="🎲 Random"
                  description="Let fate decide — a pack will be chosen at random when the game starts."
                  roundCount={0}
                  questionCount={0}
                  rounds={[]}
                  selected={selectedPackId === null}
                  onSelect={() => handleSetPack(null)}
                />
                {availablePacks.map((pack) => (
                  <PackCard
                    key={pack.id}
                    id={pack.id}
                    title={pack.title}
                    description={pack.description}
                    roundCount={pack.roundCount}
                    questionCount={pack.questionCount}
                    rounds={pack.rounds}
                    selected={selectedPackId === pack.id}
                    onSelect={() => handleSetPack(pack.id)}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ===== Wheel of Fortune lobby settings ===== */}
        {gameType === "wheel-of-fortune" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-5xl mb-8 space-y-8"
          >
            {/* Pack picker */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Grid3x3 className="w-6 h-6 text-black" />
                <h2 className="font-display font-black text-black text-2xl uppercase">
                  Choose a Puzzle Pack
                </h2>
                {wofSelectedPackId === null && (
                  <span className="text-sm text-black/50 border-[2px] border-black px-3 py-1 font-sans">
                    Random is selected
                  </span>
                )}
              </div>
              {wofAvailablePacks.length === 0 ? (
                <div className="text-black/50 animate-pulse text-lg font-display font-black uppercase">Loading packs…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <motion.button
                    layout
                    onClick={() => handleWofSetPack(null)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full text-left border-[3px] border-black p-4 focus-visible:outline-none ${wofSelectedPackId === null ? "bg-[#FFD700] shadow-[5px_5px_0_#000]" : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"}`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <Shuffle className="w-4 h-4 text-black mt-0.5 flex-shrink-0" />
                      <h3 className="font-display font-black text-black uppercase text-sm leading-tight">🎲 Random</h3>
                    </div>
                    <p className="text-xs text-black/60 leading-relaxed font-sans">Let fate decide — a puzzle pack will be chosen at random.</p>
                  </motion.button>
                  {wofAvailablePacks.map((pack) => (
                    <motion.button
                      key={pack.id}
                      layout
                      onClick={() => handleWofSetPack(pack.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className={`relative w-full text-left border-[3px] border-black p-4 focus-visible:outline-none ${wofSelectedPackId === pack.id ? "bg-[#7C3AED] shadow-[5px_5px_0_#000]" : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"}`}
                    >
                      {wofSelectedPackId === pack.id && (
                        <span className="absolute top-3 right-3 w-6 h-6 bg-black flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-[#FFD700]" />
                        </span>
                      )}
                      <h3 className={`font-display font-black uppercase text-sm leading-tight mb-1 ${wofSelectedPackId === pack.id ? "text-white" : "text-black"}`}>
                        {pack.title}
                      </h3>
                      <p className={`text-xs mb-2 leading-relaxed line-clamp-2 font-sans ${wofSelectedPackId === pack.id ? "text-white/80" : "text-black/60"}`}>
                        {pack.description}
                      </p>
                      <span className={`text-xs font-sans ${wofSelectedPackId === pack.id ? "text-white/70" : "text-black/40"}`}>
                        {pack.puzzleCount} puzzles
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Round count picker */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-6 h-6 text-black" />
                <h2 className="font-display font-black text-black text-2xl uppercase">
                  Number of Rounds
                </h2>
                <span className="text-sm text-black/50 border-[2px] border-black px-3 py-1 font-sans">
                  {wofRoundCount} puzzle{wofRoundCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex gap-3">
                {[3, 4, 5].map((n) => (
                  <motion.button
                    key={n}
                    onClick={() => handleWofSetRoundCount(n)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    className={`w-16 h-16 font-display font-black text-2xl border-[3px] border-black focus-visible:outline-none
                      ${wofRoundCount === n ? "bg-[#FFD700] shadow-[5px_5px_0_#000]" : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"}`}
                    data-testid={`btn-wof-rounds-${n}`}
                  >
                    {n}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ===== Scattergories lobby settings ===== */}
        {gameType === "scattergories" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-5xl mb-8 space-y-8"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Star className="w-6 h-6 text-black" />
                <h2 className="font-display font-black text-black text-2xl uppercase">Number of Rounds</h2>
                <span className="text-sm text-black/50 border-[2px] border-black px-3 py-1 font-sans">{scatRoundCount} round{scatRoundCount !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex gap-3">
                {[3, 4, 5].map((n) => (
                  <motion.button
                    key={n}
                    onClick={() => handleScatSetConfig(n, scatDifficulty)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.96 }}
                    className={`w-16 h-16 font-display font-black text-2xl border-[3px] border-black focus-visible:outline-none ${scatRoundCount === n ? "bg-[#FF6B35] text-white shadow-[5px_5px_0_#000]" : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"}`}
                    data-testid={`btn-scat-rounds-${n}`}
                  >
                    {n}
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-6 h-6 text-black" />
                <h2 className="font-display font-black text-black text-2xl uppercase">Difficulty</h2>
                <span className="text-sm text-black/50 border-[2px] border-black px-3 py-1 font-sans">
                  {scatDifficulty === "easy" ? "90s" : scatDifficulty === "medium" ? "60s" : "45s"} per round
                </span>
              </div>
              <div className="flex gap-3">
                {(["easy", "medium", "hard"] as ScatDifficulty[]).map((d) => (
                  <motion.button
                    key={d}
                    onClick={() => handleScatSetConfig(scatRoundCount, d)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`px-8 py-4 font-display font-black text-xl uppercase border-[3px] border-black focus-visible:outline-none ${scatDifficulty === d ? "bg-[#FF6B35] text-white shadow-[5px_5px_0_#000]" : "bg-white shadow-[4px_4px_0_#000] hover:bg-[#FFF8E7]"}`}
                    data-testid={`btn-scat-diff-${d}`}
                  >
                    {d}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const renderScattergories = () => {
    const secondsLeft = scatTimerEndAt > 0 ? Math.max(0, Math.ceil((scatTimerEndAt - scatNow) / 1000)) : 0;
    const totalSecs = scatDifficulty === "easy" ? 90 : scatDifficulty === "medium" ? 60 : 45;

    if (scatPhase === "round") {
      return (
        <div className="flex-1 flex flex-col bg-[#FFF8E7] p-6 gap-6">
          <header className="flex justify-between items-center flex-wrap gap-3">
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase tracking-widest">
              ROOM: <span style={{ color: "#FF6B35" }}>{roomCode}</span>
            </div>
            {isDemo && <DemoBadge />}
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
              Round <span style={{ color: "#FF6B35" }}>{scatRound}</span> / {scatTotalRounds}
            </div>
          </header>

          <div className="flex flex-col lg:flex-row gap-6 flex-1">
            {/* Main panel */}
            <div className="flex-1 flex flex-col gap-6">
              {/* Letter + timer */}
              <div className={`flex items-center justify-between p-6 border-[4px] border-black shadow-[6px_6px_0_#000] ${scatAlertActive ? "bg-[#FF1493]" : "bg-[#FF6B35]"}`}>
                <div>
                  <p className="font-display font-black text-white/70 text-sm uppercase tracking-widest mb-1">This round&apos;s letter</p>
                  <div className="font-display font-black text-white text-[8rem] leading-none" style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.3)" }}>
                    {scatLetter}
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <TimerRing value={secondsLeft} total={totalSecs} size={120} thickness={10} label={`${secondsLeft}s`} />
                  {scatAlertActive && (
                    <span className="font-display font-black text-white uppercase text-sm animate-pulse">⚡ 10 seconds!</span>
                  )}
                </div>
              </div>

              {/* Submission progress */}
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display font-black text-black uppercase text-sm">Answers submitted</span>
                  <span className="font-display font-black" style={{ color: "#FF6B35" }}>{scatSubmitted} / {scatTotal}</span>
                </div>
                <div className="w-full bg-black/10 border-[2px] border-black h-4">
                  <motion.div
                    className="h-full"
                    style={{ backgroundColor: "#FF6B35" }}
                    animate={{ width: `${(scatSubmitted / Math.max(1, scatTotal)) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Categories list */}
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
                <h3 className="font-display font-black text-black uppercase text-lg mb-4 border-b-[3px] border-black pb-2">Categories — must start with <span style={{ color: "#FF6B35" }}>{scatLetter}</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {scatCategories.map((cat) => (
                    <div key={cat.id} className="flex items-center gap-3 p-3 border-[2px] border-black bg-[#FFF8E7]">
                      <div className="w-8 h-8 flex items-center justify-center font-display font-black text-white text-sm flex-shrink-0" style={{ backgroundColor: "#FF6B35" }}>
                        {scatLetter}
                      </div>
                      <span className="font-display font-black text-black text-sm uppercase">{cat.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="w-full lg:w-64 flex flex-col gap-4">
              <Button
                variant="outline"
                onClick={handleScatSkipToResults}
                className="w-full border-[3px] border-black font-display font-black text-base uppercase shadow-[4px_4px_0_#000]"
                data-testid="btn-scat-skip"
              >
                <SkipForward className="w-5 h-5 mr-2" /> Skip to Results
              </Button>
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
                <h3 className="font-display font-black text-black uppercase text-sm mb-3">Scoreboard</h3>
                <div className="space-y-2">
                  {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8).map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-black/40 text-sm w-5">#{i+1}</span>
                        {p.isBot && <Bot className="w-3 h-3 text-black/40" />}
                        <span className="font-display font-black text-black text-sm uppercase truncate max-w-[100px]">{p.name}</span>
                      </div>
                      <span className="font-display font-black text-sm" style={{ color: "#FF6B35" }}>{p.score ?? 0}pt</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (scatPhase === "results") {
      return (
        <div className="flex-1 flex flex-col bg-[#FFF8E7] p-6 gap-6">
          <header className="flex justify-between items-center flex-wrap gap-3">
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase tracking-widest">
              Round {scatRound} Results — <span style={{ color: "#FF6B35" }}>Letter {scatLetter}</span>
            </div>
            {isDemo && <DemoBadge />}
            <div className="flex gap-3">
              {!scatIsLastRound && (
                <Button onClick={handleScatNextRound} className="font-display font-black uppercase text-lg px-8 py-4" data-testid="btn-scat-next-round">
                  Next Round <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              )}
              <Button variant="outline" onClick={handleScatEndGame} className="border-[3px] border-black font-display font-black uppercase" data-testid="btn-scat-end-game">
                End Game
              </Button>
            </div>
          </header>

          <div className="flex flex-col lg:flex-row gap-6 flex-1 overflow-auto">
            {/* Results table */}
            <div className="flex-1 space-y-4 overflow-auto">
              {scatResults.map((cat) => (
                <div key={cat.categoryId} className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000]">
                  <div className="p-3 border-b-[3px] border-black flex items-center gap-3" style={{ backgroundColor: "#FF6B35" }}>
                    <span className="w-8 h-8 flex items-center justify-center font-display font-black text-white text-sm bg-black/20">{scatLetter}</span>
                    <span className="font-display font-black text-white uppercase text-sm">{cat.categoryName}</span>
                  </div>
                  <div className="divide-y-[2px] divide-black">
                    {cat.answers.filter(a => a.answer).map((a) => (
                      <div key={a.playerId} className={`flex items-center justify-between px-4 py-2 ${a.isDuplicate ? "bg-black/5 opacity-60" : ""}`}>
                        <div className="flex items-center gap-3">
                          {a.pointsEarned > 0 ? <Check className="w-4 h-4 text-[#00C853]" /> : <X className="w-4 h-4 text-[#FF1493]" />}
                          <span className="font-display font-black text-black uppercase text-sm">{a.playerName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-sans text-sm text-black/70 italic">{a.answer}</span>
                          {a.isDuplicate && <span className="text-xs font-sans text-black/50 border border-black/30 px-1">dup</span>}
                          <span className="font-display font-black text-sm" style={{ color: a.pointsEarned > 0 ? "#00C853" : "#FF1493" }}>
                            {a.pointsEarned > 0 ? "+1" : "0"}
                          </span>
                        </div>
                      </div>
                    ))}
                    {cat.answers.filter(a => !a.answer).map((a) => (
                      <div key={a.playerId} className="flex items-center justify-between px-4 py-2 opacity-40">
                        <div className="flex items-center gap-3">
                          <X className="w-4 h-4 text-black/50" />
                          <span className="font-display font-black text-black uppercase text-sm">{a.playerName}</span>
                        </div>
                        <span className="font-sans text-sm text-black/40 italic">—</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Round leaderboard */}
            <div className="w-full lg:w-72 flex flex-col gap-4">
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
                <h3 className="font-display font-black text-xl uppercase mb-4 border-b-[3px] border-black pb-2">Leaderboard</h3>
                <div className="space-y-3">
                  {scatLeaderboard.map((row) => (
                    <div key={row.id} className={`flex items-center justify-between p-3 border-[2px] border-black ${row.rank === 1 ? "bg-[#FFD700]" : "bg-[#FFF8E7]"}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-black text-black/50 w-6">#{row.rank}</span>
                        {row.isBot && <Bot className="w-4 h-4 text-black/40" />}
                        <span className="font-display font-black text-black uppercase truncate max-w-[100px]">{row.name}</span>
                      </div>
                      <span className="font-display font-black text-black text-lg">{row.score}pt</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderFinished = () => {
    const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top3 = sortedPlayers.slice(0, 3);
    const rest = sortedPlayers.slice(3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = ["h-44", "h-60", "h-32"];
    const podiumColors = [
      "bg-[#C0C0C0] border-[3px] border-black text-black",
      "bg-[#FFD700] border-[3px] border-black text-black shadow-[6px_6px_0_#000]",
      "bg-[#CD7F32] border-[3px] border-black text-black",
    ];
    const ranks = ["2nd", "1st", "3rd"];

    return (
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-[#FFF8E7]">
        {isDemo && (<div className="absolute top-6 right-6"><DemoBadge /></div>)}
        <Trophy className="w-24 h-24 text-[#FFD700] mb-4" style={{ filter: "drop-shadow(4px 4px 0 #000)" }} />
        <h1 className="font-display font-black text-4xl md:text-6xl uppercase text-center mb-2 comic-headline">
          FINAL STANDINGS
        </h1>
        <div className="h-1 w-24 bg-[#FFD700] border-y border-black mb-12" />

        <div className="w-full max-w-4xl mb-12 flex items-end justify-center gap-4 md:gap-8">
          {podiumOrder.map((p, idx) => {
            if (!p) return null;
            return (
              <motion.div
                key={p.id}
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 18, delay: idx * 0.18 }}
                className="flex flex-col items-center flex-1 max-w-[200px]"
              >
                <div className="font-display font-black text-black text-2xl md:text-3xl uppercase mb-3 flex items-center gap-2 text-center">
                  {p.isBot && <Bot className="w-5 h-5 text-black/40" />}
                  {p.name}
                </div>
                <div className="font-display font-black text-[#FF1493] text-3xl mb-2" style={{ textShadow: "2px 2px 0 #000" }}>
                  <CountUp value={p.score ?? 0} duration={1.6} /> pts
                </div>
                <div className={`w-full ${heights[idx]} ${podiumColors[idx]} flex items-center justify-center font-display font-black text-4xl md:text-5xl uppercase`}>
                  {ranks[idx]}
                </div>
              </motion.div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <motion.div
            className="w-full max-w-3xl space-y-3"
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="show"
          >
            {rest.map((p, i) => (
              <motion.div
                key={p.id}
                variants={staggerItem}
                className="flex items-center justify-between p-4 bg-white border-[3px] border-black shadow-[4px_4px_0_#000]"
              >
                <div className="flex items-center gap-4">
                  <span className="font-display font-black text-black/40 text-3xl w-12 text-center">#{i + 4}</span>
                  <span className="font-display font-black text-black text-2xl uppercase flex items-center gap-2">
                    {p.isBot && <Bot className="w-5 h-5 text-black/40" />}
                    {p.name}
                  </span>
                </div>
                <span className="font-display font-black text-[#FF1493] text-2xl">
                  <CountUp value={p.score ?? 0} /> pts
                </span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    );
  };

  const renderPtQ = () => {
    const sortedVotes = Object.entries(voteCounts).sort(([, a], [, b]) => b - a);
    const total = totalVoters || players.length;
    const showRemoteWaiting =
      settings.mode === "remote" && !resultsRevealed && total > 0;

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FFF8E7]">
        <header className="flex justify-between items-center mb-8 relative z-10">
          <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase tracking-widest">
            ROOM: <span className="text-[#FF1493]">{roomCode}</span>
          </div>
          {isDemo && <DemoBadge />}
          <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
            Q <span className="text-[#FF1493]"><CountUp value={questionIndex + 1} duration={0.4} /></span>
          </div>
        </header>

        {/* Remote-mode "Waiting for votes" indicator */}
        {showRemoteWaiting && (
          <div className="flex justify-center mb-4">
            <div
              className="inline-flex items-center gap-2 bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-2 font-display font-black text-black uppercase text-sm"
              data-testid="remote-waiting-indicator"
            >
              <span className="inline-block w-2 h-2 bg-black animate-pulse" />
              Waiting for votes {votesIn}/{total}
            </div>
          </div>
        )}

        <PlayerStatusBar />

        {settings.answerMethod === "voice" && !resultsRevealed && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-2 bg-[#00E5FF] border-[2px] border-black shadow-[2px_2px_0_#000] px-4 py-2 font-display font-black text-black uppercase text-sm">
              <Mic className="w-4 h-4" /> Voice mode — players shout
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`q-${questionIndex}`}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              className="font-display font-black text-5xl md:text-[4.5rem] leading-tight uppercase text-center mb-12 comic-headline"
            >
              {currentQuestion || "Loading question..."}
            </motion.h2>
          </AnimatePresence>

          {!resultsRevealed ? (
            <div className="flex flex-col items-center w-full">
              <div className="font-display font-black text-black text-4xl mb-8 uppercase">
                <span className="text-[#FF1493]"><CountUp value={votesIn} duration={0.5} /></span>
                <span className="text-black/40"> / {total} Votes In</span>
              </div>
              <div className="w-full max-w-3xl bg-white border-[3px] border-black h-10 overflow-hidden mb-12">
                <motion.div
                  className="bg-[#FF1493] h-full"
                  animate={{ width: `${(votesIn / Math.max(1, total)) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <Button
                size="lg"
                onClick={handleRevealResults}
                disabled={votesIn === 0}
                className="text-3xl px-12 py-8"
                data-testid="btn-reveal"
              >
                Reveal Results
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="w-full max-w-4xl"
            >
              <div className="space-y-4 mb-12">
                {sortedVotes.map(([playerId, count], i) => {
                  const player = players.find((p) => p.id === playerId);
                  if (!player) return null;
                  const percentage = (count / Math.max(1, total)) * 100;
                  const isBurned = playerId === burnedPlayerId;
                  return (
                    <div key={playerId} className="relative">
                      <div className="flex justify-between font-display font-black text-black text-3xl uppercase mb-2 relative z-10">
                        <span className="flex items-center gap-2">
                          {i === 0 && <Crown className="w-8 h-8 text-[#FFD700]" style={{ filter: "drop-shadow(2px 2px 0 #000)" }} />}
                          {player.isBot && <Bot className="w-6 h-6 text-black/40" />}
                          <span className={isBurned ? "text-[#FF6B35]" : ""}>{player.name}</span>
                          {isBurned && <Flame className="w-7 h-7 text-[#FF6B35]" />}
                        </span>
                        <span><CountUp value={count} duration={1} /> {count === 1 ? "vote" : "votes"}</span>
                      </div>
                      <div className="relative h-16 bg-white border-[3px] border-black overflow-hidden">
                        {isBurned && (
                          <ParticleRain emoji="🔥" variant="fire" density={1} />
                        )}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className={`relative h-full ${i === 0 ? "bg-[#FF1493]" : "bg-[#FFD700]"}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </main>
      </div>
    );
  };

  const renderRR = () => {
    if (rrPhase === "writing") {
      const showRemoteWaiting = settings.mode === "remote" && rrTotal > 0;
      return (
        <div className="flex-1 flex flex-col items-center justify-center relative bg-[#FF6B35]">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <div className="font-display font-black text-white text-2xl uppercase tracking-widest mb-6" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>
            Round <CountUp value={rrRound} duration={0.4} /> of {rrTotalRounds}
          </div>
          <h1 className="font-display font-black text-white text-4xl md:text-5xl uppercase mb-4" style={{ textShadow: "4px 4px 0 #000" }}>
            WRITING ROASTS
          </h1>
          <div className="h-1 w-20 bg-white border border-black mb-8" />

          {showRemoteWaiting && (
            <div className="mb-6 bg-white border-[3px] border-black shadow-[3px_3px_0_#000] inline-flex items-center gap-2 px-4 py-2 font-display font-black text-black uppercase text-sm">
              <span className="inline-block w-2 h-2 bg-black animate-pulse" />
              Waiting for roasts {rrSubmitted}/{rrTotal}
            </div>
          )}

          <PlayerStatusBar />

          <div className="w-full max-w-2xl bg-white border-[4px] border-black shadow-[6px_6px_0_#000] p-8 mb-8">
            <div className="flex justify-between font-display font-black text-black text-3xl uppercase mb-6">
              <span>Submitted</span>
              <span className="text-[#FF6B35]">
                <CountUp value={rrSubmitted} duration={0.5} />/{rrTotal}
              </span>
            </div>
            <div className="w-full bg-black/10 border-[2px] border-black h-6 overflow-hidden">
              <motion.div
                animate={{ width: `${(rrSubmitted / Math.max(1, rrTotal)) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-[#FF6B35]"
              />
            </div>
          </div>
          <motion.div
            className="flex flex-wrap gap-3 justify-center max-w-3xl"
            variants={staggerContainer(0.05)}
            initial="hidden"
            animate="show"
          >
            {players.map((p) => (
              <motion.div
                key={p.id}
                variants={staggerItem}
                className={`px-5 py-3 border-[2px] border-black shadow-[2px_2px_0_#000] font-display font-black uppercase text-xl flex items-center gap-2
                  ${p.isBot ? "bg-white/50 text-black/50" : "bg-white text-black"}`}
              >
                {p.isBot && <Bot className="w-4 h-4" />}
                {p.name}
              </motion.div>
            ))}
          </motion.div>
        </div>
      );
    }

    if (rrPhase === "revealing") {
      const isPickingBot = (() => {
        if (!rrCurrentRevealId) return null;
        const reveal = players.find((p) => p.id === rrCurrentRevealId);
        return reveal?.isBot ? reveal : null;
      })();

      return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FFF8E7]">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <header className="flex justify-between items-center mb-6 relative z-10">
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
              ROOM: <span className="text-[#FF1493]">{roomCode}</span>
            </div>
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
              Reveal <span className="text-[#FF1493]"><CountUp value={rrRevealIndex + 1} duration={0.4} /></span> of {rrTotalReveals}
            </div>
          </header>

          {settings.mode === "remote" && rrCurrentRevealName && (
            <div className="flex justify-center mb-4">
              <div
                className="inline-flex items-center gap-2 bg-[#00E5FF] border-[2px] border-black shadow-[2px_2px_0_#000] px-4 py-2 font-display font-black text-black uppercase text-sm"
                data-testid="remote-picker-indicator"
              >
                <Eye className="w-4 h-4" />
                {isPickingBot ? "🤖" : "🎤"} {rrCurrentRevealName} is picking favorites…
              </div>
            </div>
          )}

          <main className="flex-1 flex flex-col items-center justify-center relative z-10">
            <p className="font-display font-black text-black/50 text-2xl uppercase tracking-widest mb-4">Roasting</p>
            <AnimatePresence mode="wait">
              <motion.h1
                key={rrCurrentRevealName}
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="font-display font-black text-5xl md:text-7xl lg:text-[6rem] uppercase mb-12 text-center comic-headline"
              >
                {rrCurrentRevealName}
              </motion.h1>
            </AnimatePresence>

            <div className="w-full max-w-5xl grid gap-4 mb-12">
              <AnimatePresence mode="popLayout">
                {Object.entries(rrCard).map(([color, entry], idx) => {
                  const question = rrQuestions.find((q) => q.color === color);
                  return (
                    <motion.div
                      key={`${rrCurrentRevealName}-${color}`}
                      initial={{ opacity: 0, x: 80 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -80 }}
                      transition={{ type: "spring", stiffness: 240, damping: 22, delay: idx * 0.08 }}
                      className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="w-4 self-stretch min-h-[48px] flex-shrink-0 border border-black/20"
                          style={{ backgroundColor: color === "gray" ? "#6b7280" : color }}
                        />
                        <div>
                          {question && (
                            <p className="text-black/50 mb-2 font-sans">{question.question}</p>
                          )}
                          <p className="font-display font-black text-black text-3xl uppercase">{entry.answer}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </main>
        </div>
      );
    }

    return null;
  };

  // ============================================================
  //   PUB QUIZ — renders question, reveal panel, round summary
  // ============================================================
  const renderPQ = () => {
    const remainingMs = Math.max(0, pqTimerEndAt - pqNow);
    const totalMs = pqQuestion ? pqQuestion.durationMs : 30000;
    const secsLeft = Math.ceil(remainingMs / 1000);

    // ---- Round summary screen (between rounds) ----
    if (pqRoundSummary) {
      const top = pqRoundSummary.leaderboard[0];
      return (
        <div className="flex-1 flex flex-col relative overflow-hidden bg-[#00C853]">
          {isDemo && <div className="absolute top-6 right-6 z-20"><DemoBadge /></div>}
          <header className="flex justify-between items-center mb-8 relative z-10">
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
              ROOM: <span className="text-[#FF1493]">{roomCode}</span>
            </div>
            <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
              Round <span className="text-[#FF1493]">{pqRoundSummary.roundIndex + 1}</span> / {pqRoundSummary.totalRounds}
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full relative z-10">
            <p className="font-display font-black text-white text-2xl uppercase tracking-widest mb-2" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>Round Complete</p>
            <h1 className="font-display font-black text-white text-5xl md:text-7xl uppercase text-center mb-2" style={{ textShadow: "5px 5px 0 #000" }}>
              {pqRoundSummary.roundName}
            </h1>
            <div className="h-1 w-20 bg-white border border-black mb-12" />

            <div className="w-full max-w-3xl space-y-3 mb-12">
              {pqRoundSummary.leaderboard.slice(0, 8).map((row, i) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, type: "spring", stiffness: 200, damping: 22 }}
                  className={`flex items-center justify-between p-5 border-[3px] border-black ${
                    i === 0 ? "bg-[#FFD700] shadow-[5px_5px_0_#000]" : "bg-white shadow-[3px_3px_0_#000]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black flex items-center justify-center font-display font-black text-white text-xl">
                      {i + 1}
                    </div>
                    {i === 0 && <Crown className="w-7 h-7 text-black" />}
                    {row.isBot && <Bot className="w-5 h-5 text-black/40" />}
                    <span className="font-display font-black text-black text-2xl uppercase">{row.name}</span>
                  </div>
                  <div className="font-display font-black text-[#FF1493] text-3xl" style={{ textShadow: "1px 1px 0 #000" }}>
                    <CountUp value={row.score} duration={1} />
                  </div>
                </motion.div>
              ))}
            </div>

            {top && (
              <p className="text-white/80 font-sans mt-2">
                Leading: <span className="font-black">{top.name}</span> with {top.score} pts
              </p>
            )}
          </main>
        </div>
      );
    }

    // ---- Loading state ----
    if (!pqQuestion) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center relative bg-[#FFF8E7]">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <Beer className="w-20 h-20 text-black mb-6" />
          <h1 className="font-display font-black text-black text-4xl uppercase">Loading next question…</h1>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#FFF8E7]">
        {isDemo && <div className="absolute top-6 right-6 z-20"><DemoBadge /></div>}

        <header className="flex justify-between items-center mb-6 relative z-10">
          <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
            ROOM: <span className="text-[#FF1493]">{roomCode}</span>
          </div>
          <div className="font-display font-black text-black text-xl bg-[#00E5FF] border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
            <Beer className="w-5 h-5 inline mr-2 -mt-1" />
            {pqQuestion.roundName}
          </div>
          <div className="font-display font-black text-black text-xl bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-6 py-3 uppercase">
            Q <span className="text-[#FF1493]">{pqQuestion.questionIndex + 1}</span>
            <span className="text-black/40">/{pqQuestion.questionsInRound}</span>
            <span className="mx-3 text-black/30">·</span>
            R <span className="text-[#FF1493]">{pqQuestion.roundIndex + 1}</span>
            <span className="text-black/40">/{pqQuestion.totalRounds}</span>
          </div>
        </header>

        <PlayerStatusBar />

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`pq-${pqQuestion.roundIndex}-${pqQuestion.questionIndex}`}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              className="font-display font-black text-4xl md:text-6xl leading-tight uppercase text-center mb-10 comic-headline"
            >
              {pqQuestion.prompt}
            </motion.h2>
          </AnimatePresence>

          {/* Multiple choice */}
          {pqQuestion.type === "multiple-choice" && pqQuestion.options && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-10">
              {pqQuestion.options.map((opt, idx) => {
                const isCorrect = pqReveal && pqReveal.correctOptionIndex === idx;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.06 }}
                    className={`border-[3px] border-black p-6 font-display font-black text-2xl uppercase flex items-center gap-4 ${
                      pqReveal
                        ? isCorrect
                          ? "bg-[#00C853] text-white shadow-[4px_4px_0_#000]"
                          : "bg-white opacity-40"
                        : "bg-white shadow-[4px_4px_0_#000]"
                    }`}
                  >
                    <div className={`w-10 h-10 border-[2px] border-black flex items-center justify-center font-black text-sm flex-shrink-0 ${
                      pqReveal && isCorrect ? "bg-white text-[#00C853]" : "bg-black text-white"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="flex-1">{opt}</span>
                    {pqReveal && isCorrect && <Check className="w-7 h-7 flex-shrink-0" />}
                    {pqReveal && !isCorrect && <X className="w-6 h-6 flex-shrink-0 opacity-40" />}
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* True / False */}
          {pqQuestion.type === "true-false" && (
            <div className="grid grid-cols-2 gap-6 w-full max-w-3xl mb-10">
              {[true, false].map((val) => {
                const label = val ? "TRUE" : "FALSE";
                const isCorrect = pqReveal && pqReveal.trueFalseAnswer === val;
                return (
                  <div
                    key={label}
                    className={`border-[3px] border-black p-12 text-center font-display font-black text-5xl uppercase ${
                      pqReveal
                        ? isCorrect
                          ? "bg-[#00C853] text-white shadow-[6px_6px_0_#000]"
                          : "bg-white opacity-40"
                        : val
                          ? "bg-[#00C853] text-white shadow-[4px_4px_0_#000]"
                          : "bg-[#FF1493] text-white shadow-[4px_4px_0_#000]"
                    }`}
                  >
                    {label}
                    {pqReveal && isCorrect && <div className="mt-3"><Check className="w-12 h-12 mx-auto" /></div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Open-ended */}
          {pqQuestion.type === "open-ended" && (
            <div className="w-full max-w-3xl mb-10">
              {pqReveal ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-[#00C853] border-[4px] border-black shadow-[6px_6px_0_#000] p-10 text-center"
                >
                  <p className="font-display font-black text-white text-lg uppercase tracking-widest mb-3" style={{ textShadow: "1px 1px 0 rgba(0,0,0,0.3)" }}>Answer</p>
                  <p className="font-display font-black text-white text-5xl uppercase" style={{ textShadow: "3px 3px 0 #000" }}>{pqReveal.correctAnswer}</p>
                  {pqReveal.acceptedAnswers && pqReveal.acceptedAnswers.length > 1 && (
                    <p className="text-white/70 font-sans text-sm mt-4">
                      Also accepted: {pqReveal.acceptedAnswers.filter((a) => a !== pqReveal.correctAnswer).join(", ")}
                    </p>
                  )}
                </motion.div>
              ) : (
                <div className="bg-white border-[3px] border-black border-dashed p-10 text-center">
                  <p className="font-display font-black text-black/40 text-2xl uppercase">Players are typing on their phones…</p>
                </div>
              )}
            </div>
          )}

          {/* Bottom: timer + progress (pre-reveal) or live standings (post-reveal) */}
          {!pqReveal ? (
            <div className="w-full max-w-4xl flex flex-col items-center gap-6">
              <div className="flex items-center justify-center gap-12">
                <TimerRing
                  value={remainingMs / 1000}
                  total={totalMs / 1000}
                  size={160}
                  thickness={12}
                  label={`${secsLeft}s`}
                />
                <div className="text-center">
                  <div className="font-display font-black text-7xl text-black">
                    <span className="text-[#FF1493]"><CountUp value={pqAnsweredCount} duration={0.4} /></span>
                    <span className="text-black/40 text-5xl"> / {pqTotalAnswerers}</span>
                  </div>
                  <p className="font-display font-black text-black/50 text-xl uppercase tracking-widest mt-2">Answers In</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl">
              <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-black text-black text-xl uppercase tracking-widest">Live Standings</h3>
                  <div className="text-sm text-black/50 font-sans">
                    {pqReveal.correctCount}/{pqReveal.totalAnswered} got it right
                  </div>
                </div>
                <div className="space-y-2">
                  {pqLeaderboard.slice(0, 6).map((row, i) => {
                    const ans = pqReveal.perPlayerAnswers.find((a) => a.playerId === row.id);
                    const isFirst = pqReveal.firstCorrectPlayerId === row.id;
                    return (
                      <div key={row.id} className={`flex items-center justify-between gap-4 px-4 py-3 border-[2px] border-black ${i === 0 ? "bg-[#FFD700]" : "bg-[#FFF8E7]"}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 bg-black flex items-center justify-center font-display font-black text-white text-sm">
                            {i + 1}
                          </div>
                          {row.isBot && <Bot className="w-4 h-4 text-black/40 flex-shrink-0" />}
                          <span className="font-display font-black text-black text-lg uppercase truncate">{row.name}</span>
                          {ans && (
                            ans.correct
                              ? <Check className="w-5 h-5 text-[#00C853] flex-shrink-0" />
                              : <X className="w-5 h-5 text-black/30 flex-shrink-0" />
                          )}
                          {isFirst && (
                            <span className="font-display font-black text-xs uppercase bg-[#FFD700] border border-black px-2 py-0.5 whitespace-nowrap">
                              +0.5 First
                            </span>
                          )}
                        </div>
                        <div className="font-display font-black text-[#FF1493] text-2xl">
                          {row.score}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  };

  // ============================================================
  //   JEOPARDY — renders board, clue, daily double, final
  // ============================================================
  const renderJeopardy = () => {
    const valueColor = (v: number) => {
      if (v <= 200) return "text-yellow-300";
      if (v <= 400) return "text-amber-300";
      if (v <= 600) return "text-orange-300";
      if (v <= 800) return "text-rose-300";
      return "text-fuchsia-300";
    };

    const Scoreboard = () => (
      <div className="w-full max-w-6xl mx-auto grid grid-flow-col auto-cols-fr gap-2 mt-6 px-4">
        {jScores.map((s) => {
          const isCtrl = s.id === jControllerId;
          const isBuzz = s.id === jBuzzedInId;
          return (
            <div
              key={s.id}
              className={`rounded-xl border-2 px-3 py-2 surface-elevated text-center ${
                isBuzz
                  ? "border-yellow-400 bg-yellow-400/15 shadow-[0_0_24px_-4px_hsl(48_100%_60%/0.7)]"
                  : isCtrl
                  ? "border-primary/60 bg-primary/10"
                  : "border-border bg-card/70"
              }`}
              data-testid={`j-score-${s.id}`}
            >
              <div className="flex items-center justify-center gap-1.5 text-sm font-bold truncate">
                {s.isBot && <Bot className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />}
                {isCtrl && <Crown className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                <span className="truncate">{s.name}</span>
              </div>
              <div className={`text-2xl md:text-3xl font-black font-display ${
                s.score < 0 ? "text-destructive" : "text-foreground"
              }`}>
                {s.score < 0 ? "-" : ""}${Math.abs(s.score)}
              </div>
            </div>
          );
        })}
      </div>
    );

    const Header = ({ subtitle }: { subtitle?: string }) => (
      <header className="flex justify-between items-center mb-6 relative z-10">
        <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
          ROOM: <span className="text-foreground">{roomCode}</span>
        </div>
        {isDemo && <DemoBadge />}
        <div className="text-xl font-bold uppercase tracking-widest text-yellow-400 bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-yellow-400/40 surface-elevated">
          <Grid3x3 className="w-5 h-5 inline mr-2 -mt-1" />
          {subtitle ?? jPack?.title ?? "JEOPARDY"}
        </div>
      </header>
    );

    const remainingMs = Math.max(0, jTimerEndAt - jNow);
    const secsLeft = Math.ceil(remainingMs / 1000);

    // ---- FINAL: scored (last screen before End Game) ----
    if (jFinalScored) {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header subtitle="FINAL JEOPARDY" />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <Award className="w-16 h-16 text-yellow-400 mb-4 drop-shadow-[0_0_18px_hsl(48_100%_60%)]" />
            <h2 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-center mb-3">
              Final Scored!
            </h2>
            <div className="heading-divider heading-divider--gold w-20 h-1 mb-8" />
            <div className="w-full max-w-3xl space-y-2">
              {[...jFinalScored].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl p-4 border-2 surface-elevated ${
                    i === 0 ? "border-primary/60 bg-primary/10" : "border-border bg-card/70"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold ${
                      i === 0 ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
                    }`}>{i + 1}</div>
                    {i === 0 && <Crown className="w-6 h-6 text-yellow-400" />}
                    <div>
                      <div className="text-xl font-bold">{p.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Wager ${p.wager} · {p.correct ? <span className="text-success font-bold">Correct</span> : <span className="text-destructive font-bold">Wrong</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`text-3xl font-black ${(p.score ?? 0) < 0 ? "text-destructive" : "text-foreground"}`}>
                    {(p.score ?? 0) < 0 ? "-" : ""}${Math.abs(p.score ?? 0)}
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      );
    }

    // ---- FINAL REVEAL ----
    if (jFinalReveal) {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header subtitle="FINAL JEOPARDY" />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <p className="text-xl text-muted-foreground uppercase tracking-widest font-bold mb-2">Correct Answer</p>
            <h2 className="text-5xl md:text-6xl font-extrabold font-display tracking-tight text-yellow-300 text-center mb-2 drop-shadow-[0_0_18px_hsl(48_100%_60%/0.5)]">
              {jFinalReveal.correctAnswer}
            </h2>
            <div className="heading-divider heading-divider--gold w-20 h-1 mb-8" />

            <div className="w-full max-w-3xl space-y-2">
              {jFinalReveal.perPlayer.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-2xl p-4 border-2 surface-elevated ${
                    p.correct ? "border-success/60 bg-success/10" : "border-destructive/40 bg-destructive/5"
                  }`}
                  data-testid={`j-final-row-${p.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {p.correct
                      ? <Check className="w-6 h-6 text-success flex-shrink-0" />
                      : <X className="w-6 h-6 text-destructive flex-shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-lg font-bold truncate">{p.name}</div>
                      <div className="text-sm text-muted-foreground truncate italic">"{p.answer}"</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xl font-black text-foreground">${p.wager}</div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant={p.correct ? "default" : "outline"}
                        className={`px-2 ${p.correct ? "bg-success hover:bg-success/90" : ""}`}
                        onClick={() => handleJOverrideFinal(p.id, true)}
                        data-testid={`btn-j-final-correct-${p.id}`}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={!p.correct ? "default" : "outline"}
                        className={`px-2 ${!p.correct ? "bg-destructive hover:bg-destructive/90" : ""}`}
                        onClick={() => handleJOverrideFinal(p.id, false)}
                        data-testid={`btn-j-final-wrong-${p.id}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </div>
      );
    }

    // ---- FINAL CLUE ----
    if (jPhase === "final-clue") {
      const total = jFinalProgress?.total ?? 0;
      const submitted = jFinalProgress?.submitted ?? 0;
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header subtitle="FINAL JEOPARDY" />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <p className="text-xl uppercase tracking-widest font-bold text-yellow-400 mb-2">{jFinalCategory}</p>
            <h2 className="text-4xl md:text-6xl font-extrabold font-display tracking-tight text-center mb-10 leading-tight">
              {jFinalQuestion}
            </h2>
            <div className="flex items-center gap-12">
              <TimerRing
                value={remainingMs / 1000}
                total={30}
                size={140}
                thickness={10}
                label={`${secsLeft}s`}
              />
              <div className="text-center">
                <div className="text-6xl font-black">
                  <span className="text-yellow-400"><CountUp value={submitted} duration={0.4} /></span>
                  <span className="text-muted-foreground text-4xl"> / {total}</span>
                </div>
                <p className="text-lg text-muted-foreground uppercase tracking-widest font-bold mt-2">Answers In</p>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // ---- FINAL WAGER ----
    if (jPhase === "final-wager") {
      const total = jFinalProgress?.total ?? jFinalEligibleIds.length;
      const submitted = jFinalProgress?.submitted ?? 0;
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header subtitle="FINAL JEOPARDY" />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <p className="text-2xl uppercase tracking-widest font-bold text-muted-foreground mb-2">Category</p>
            <h2 className="text-5xl md:text-7xl font-extrabold font-display tracking-tight text-yellow-300 text-center mb-8 drop-shadow-[0_0_24px_hsl(48_100%_60%/0.6)]">
              {jFinalCategory}
            </h2>
            <p className="text-2xl text-muted-foreground mb-8">Players are entering their wagers…</p>
            <div className="flex items-center gap-12">
              <TimerRing
                value={remainingMs / 1000}
                total={30}
                size={140}
                thickness={10}
                label={`${secsLeft}s`}
              />
              <div className="text-center">
                <div className="text-6xl font-black">
                  <span className="text-yellow-400"><CountUp value={submitted} duration={0.4} /></span>
                  <span className="text-muted-foreground text-4xl"> / {total}</span>
                </div>
                <p className="text-lg text-muted-foreground uppercase tracking-widest font-bold mt-2">Wagers In</p>
              </div>
            </div>
            <Scoreboard />
          </main>
        </div>
      );
    }

    // ---- FINAL INTRO ----
    if (jPhase === "final-intro") {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header subtitle="FINAL JEOPARDY" />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 18 }}
            >
              <Award className="w-24 h-24 text-yellow-400 mb-6 drop-shadow-[0_0_24px_hsl(48_100%_60%)]" />
            </motion.div>
            <h2 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-muted-foreground uppercase mb-2">
              Final Jeopardy
            </h2>
            <p className="text-xl text-muted-foreground mb-2">Category</p>
            <h1 className="text-6xl md:text-8xl font-extrabold font-display tracking-tight text-center mb-4">
              <RainbowText text={jFinalCategory} glow />
            </h1>
            <p className="text-lg text-muted-foreground mt-6">Hit "Start Final" to begin wagering.</p>
            <Scoreboard />
          </main>
        </div>
      );
    }

    // ---- DAILY DOUBLE WAGER (controller is choosing wager) ----
    if (jPhase === "dd-wager" && jDailyDouble) {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 26 }}
              className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-3xl p-12 mb-6 shadow-[0_0_80px_-10px_hsl(48_100%_60%/0.7)] border-4 border-yellow-300"
            >
              <Star className="w-20 h-20 mx-auto text-yellow-100 fill-yellow-100 mb-3" />
              <h1 className="text-6xl font-black font-display tracking-tight text-yellow-50 text-center">
                DAILY DOUBLE!
              </h1>
            </motion.div>
            <p className="text-2xl text-muted-foreground mb-2">Category</p>
            <h3 className="text-4xl font-extrabold mb-6 text-foreground uppercase tracking-wider">
              {jDailyDouble.category}
            </h3>
            <p className="text-2xl text-muted-foreground">
              <span className="text-foreground font-bold">{jDailyDouble.controllerName}</span> is wagering up to <span className="text-yellow-300 font-bold">${jDailyDouble.maxWager}</span>…
            </p>
            <div className="mt-6">
              <TimerRing value={remainingMs / 1000} total={20} size={120} thickness={10} label={`${secsLeft}s`} />
            </div>
            <Scoreboard />
          </main>
        </div>
      );
    }

    // ---- DD CLUE: clue is shown to the controller ----
    if (jPhase === "dd-clue" && jActive) {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-7 h-7 text-yellow-400 fill-yellow-400" />
              <p className="text-xl uppercase tracking-widest font-bold text-yellow-400">Daily Double · Wager ${jDdWager}</p>
            </div>
            <p className="text-lg uppercase font-bold text-muted-foreground tracking-widest mb-2">{jActive.category}</p>
            <h2 className="text-3xl md:text-5xl font-extrabold font-display tracking-tight text-center mb-10 leading-tight max-w-4xl">
              {jActive.question}
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              {jScores.find((s) => s.id === jControllerId)?.name ?? "Player"} is answering…
            </p>
            <TimerRing value={remainingMs / 1000} total={15} size={120} thickness={10} label={`${secsLeft}s`} />
            <Scoreboard />
          </main>
        </div>
      );
    }

    // ---- ACTIVE CLUE: clue-reveal / buzzer-open / answering / between-clues ----
    if (jActive && (jPhase === "clue-reveal" || jPhase === "buzzer-open" || jPhase === "answering" || jPhase === "between-clues")) {
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full">
            <p className="text-lg md:text-xl uppercase font-bold text-muted-foreground tracking-widest mb-1">{jActive.category}</p>
            <p className={`text-4xl font-black font-display mb-6 ${valueColor(jActive.value)} drop-shadow-[0_0_12px_currentColor]`}>${jActive.value}</p>
            <h2 className="text-3xl md:text-5xl font-extrabold font-display tracking-tight text-center mb-8 leading-tight max-w-4xl">
              {jActive.question}
            </h2>

            {jPhase === "clue-reveal" && (
              <p className="text-xl text-muted-foreground italic">Buzzer arming…</p>
            )}

            {jPhase === "buzzer-open" && (
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="flex items-center gap-3 px-8 py-4 rounded-full bg-success/20 border-2 border-success shadow-[0_0_30px_-6px_hsl(var(--success))]"
                >
                  <Zap className="w-8 h-8 text-success" />
                  <span className="text-3xl font-black uppercase tracking-widest text-success">Buzzers Open</span>
                </motion.div>
                <TimerRing value={remainingMs / 1000} total={12} size={100} thickness={8} label={`${secsLeft}s`} />
              </div>
            )}

            {jPhase === "answering" && jBuzzedInName && (
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 210, damping: 28 }}
                className="flex flex-col items-center gap-3"
              >
                <div className="flex items-center gap-3 px-10 py-5 rounded-2xl bg-yellow-400/20 border-2 border-yellow-400 shadow-[0_0_40px_-6px_hsl(48_100%_60%/0.7)]">
                  <Zap className="w-10 h-10 text-yellow-400 fill-yellow-400" />
                  <span className="text-4xl font-black font-display text-yellow-300">
                    {jBuzzedInName}
                  </span>
                  <span className="text-2xl font-bold text-yellow-200/80 ml-2">buzzed in!</span>
                </div>
                <TimerRing value={remainingMs / 1000} total={12} size={100} thickness={8} label={`${secsLeft}s`} />
              </motion.div>
            )}

            {jPhase === "between-clues" && jClueRevealedAnswer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-yellow-400/15 border-2 border-yellow-400/50 rounded-2xl px-8 py-5 text-center"
              >
                <p className="text-sm uppercase font-bold tracking-widest text-yellow-400 mb-2">Correct Answer</p>
                <p className="text-3xl md:text-4xl font-extrabold text-yellow-300">{jClueRevealedAnswer}</p>
              </motion.div>
            )}

            {jLastResolved && jPhase !== "between-clues" && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className={`mt-4 px-5 py-2 rounded-full font-bold text-lg border ${
                  jLastResolved.correct
                    ? "bg-success/15 border-success/50 text-success"
                    : "bg-destructive/15 border-destructive/50 text-destructive"
                }`}
              >
                {jLastResolved.playerName} {jLastResolved.correct ? "+" : "−"}${Math.abs(jLastResolved.delta)}
              </motion.div>
            )}

            <Scoreboard />
          </main>
        </div>
      );
    }

    // ---- BOARD VIEW (picking phase, default) ----
    if (jBoard) {
      const ctrl = jScores.find((s) => s.id === jControllerId);
      return (
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          <Header />
          <main className="flex-1 flex flex-col items-center max-w-7xl mx-auto w-full">
            {ctrl && (
              <p className="text-xl text-muted-foreground mb-3">
                <Crown className="inline w-5 h-5 text-primary mr-1 -mt-1" />
                <span className="font-bold text-foreground">{ctrl.name}</span> picks the next clue
              </p>
            )}

            <div className="grid grid-cols-6 gap-1.5 md:gap-2 w-full mb-4">
              {jBoard.categories.map((cat, ci) => (
                <div
                  key={ci}
                  className="bg-gradient-to-b from-blue-700 to-blue-900 rounded-md px-2 py-3 md:py-4 text-center border-2 border-blue-400/40 shadow-[0_4px_18px_-2px_rgba(0,0,0,0.5)]"
                >
                  <p className="text-xs md:text-sm font-extrabold font-display uppercase tracking-tight text-yellow-200 leading-tight">
                    {cat.name}
                  </p>
                </div>
              ))}
              {[0, 1, 2, 3, 4].map((row) =>
                jBoard.categories.map((cat, ci) => {
                  const clue = cat.clues[row];
                  if (!clue) return null;
                  return (
                    <div
                      key={`${ci}-${row}`}
                      className={`aspect-[3/2] rounded-md flex items-center justify-center font-black font-display border-2 transition-all ${
                        clue.revealed
                          ? "bg-blue-950/40 border-blue-900/40 text-transparent"
                          : "bg-gradient-to-b from-blue-700 to-blue-900 border-blue-400/40 shadow-[0_4px_18px_-2px_rgba(0,0,0,0.5)]"
                      }`}
                      data-testid={`j-square-${ci}-${row}`}
                    >
                      {!clue.revealed && (
                        <span className={`text-3xl md:text-5xl ${valueColor(clue.value)} drop-shadow-[0_0_12px_currentColor]`}>
                          ${clue.value}
                        </span>
                      )}
                    </div>
                  );
                }),
              )}
            </div>
            <Scoreboard />
          </main>
        </div>
      );
    }

    // Fallback
    return (
      <div className="flex-1 flex flex-col items-center justify-center">
        <Grid3x3 className="w-16 h-16 text-yellow-400 animate-pulse mb-4" />
        <p className="text-2xl font-bold">Loading Jeopardy…</p>
      </div>
    );
  };

  // ============================================================
  //   CONTROLS — game-contextual buttons rendered in the bar
  // ============================================================
  const renderControls = () => {
    if (gameState === "lobby") {
      const canStart = isDemo
        ? players.length >= 1
        : players.filter((p) => !p.isBot).length >= 3;
      return (
        <Button
          size="lg"
          onClick={handleStartGame}
          disabled={!canStart}
          className="text-xl px-8 py-6 font-bold gap-2"
          data-testid="btn-start-game"
        >
          <Play className="w-5 h-5 fill-current" />
          {canStart
            ? "Start Game"
            : `Need ${3 - players.filter((p) => !p.isBot).length} more`}
        </Button>
      );
    }
    if (gameState === "finished") return null;

    if (gameType === "pop-the-question") {
      if (!resultsRevealed) {
        return (
          <Button
            size="lg"
            onClick={handleRevealResults}
            disabled={votesIn === 0}
            className="text-lg px-6 py-5 font-bold gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            data-testid="btn-reveal-bar"
          >
            Reveal Results
            <ChevronRight className="w-5 h-5" />
          </Button>
        );
      }
      return (
        <Button
          size="lg"
          onClick={handleNextQuestion}
          className="text-lg px-6 py-5 font-bold gap-2"
          data-testid="btn-next-bar"
        >
          Next Question
          <ChevronRight className="w-5 h-5" />
        </Button>
      );
    }

    if (gameType === "roast-roulette" && rrPhase === "revealing") {
      const isLast = rrRevealIndex + 1 >= rrTotalReveals;
      return (
        <Button
          size="lg"
          onClick={handleNextReveal}
          className="text-lg px-6 py-5 font-bold gap-2 bg-primary hover:bg-primary/90"
          data-testid="btn-next-reveal-bar"
        >
          {isLast ? "Finish Game" : "Next Player"}
          <ChevronRight className="w-5 h-5" />
        </Button>
      );
    }

    if (gameType === "jeopardy") {
      // After Final scored — show End Game (also available throughout via HostShell)
      if (jFinalScored) {
        return (
          <Button
            size="lg"
            onClick={handleJEndGame}
            className="text-lg px-6 py-5 font-bold gap-2 bg-primary hover:bg-primary/90"
            data-testid="btn-j-end-bar"
          >
            <Trophy className="w-5 h-5" />
            Show Final Standings
          </Button>
        );
      }
      // Final reveal — host clicks Apply Scores (no-op if already applied) or End Game
      if (jFinalReveal) {
        return (
          <Button
            size="lg"
            onClick={handleJEndGame}
            className="text-lg px-6 py-5 font-bold gap-2 bg-primary hover:bg-primary/90"
            data-testid="btn-j-end-bar"
          >
            <Trophy className="w-5 h-5" />
            Show Final Standings
          </Button>
        );
      }
      // Final clue — host can manually reveal
      if (jPhase === "final-clue") {
        return (
          <Button
            size="lg"
            onClick={handleJRevealFinal}
            className="text-lg px-6 py-5 font-bold gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
            data-testid="btn-j-reveal-final-bar"
          >
            <Eye className="w-5 h-5" />
            Reveal Final
          </Button>
        );
      }
      // Final intro — host clicks Start Final
      if (jPhase === "final-intro") {
        return (
          <Button
            size="lg"
            onClick={handleJStartFinal}
            className="text-lg px-6 py-5 font-bold gap-2 bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950"
            data-testid="btn-j-start-final-bar"
          >
            <Award className="w-5 h-5" />
            Start Final Jeopardy
          </Button>
        );
      }
      // Answering / dd-clue — host judges Correct / Wrong
      if (jPhase === "answering" || jPhase === "dd-clue") {
        return (
          <div className="flex gap-3">
            <Button
              size="lg"
              onClick={handleJMarkIncorrect}
              variant="outline"
              className="text-lg px-5 py-5 font-bold gap-2 border-destructive/60 text-destructive hover:bg-destructive/10"
              data-testid="btn-j-wrong-bar"
            >
              <X className="w-5 h-5" />
              Wrong
            </Button>
            <Button
              size="lg"
              onClick={handleJMarkCorrect}
              className="text-lg px-6 py-5 font-bold gap-2 bg-success hover:bg-success/90 text-success-foreground"
              data-testid="btn-j-correct-bar"
            >
              <Check className="w-5 h-5" />
              Correct
            </Button>
          </div>
        );
      }
      // Clue revealed / buzzer open — host can skip
      if (jPhase === "clue-reveal" || jPhase === "buzzer-open" || jPhase === "between-clues") {
        return (
          <Button
            size="lg"
            onClick={handleJSkipClue}
            variant="outline"
            className="text-lg px-5 py-5 font-bold gap-2"
            data-testid="btn-j-skip-bar"
          >
            <SkipForward className="w-5 h-5" />
            Skip Clue
          </Button>
        );
      }
      return null;
    }

    if (gameType === "pub-quiz") {
      // Round summary phase
      if (pqRoundSummary) {
        if (pqRoundSummary.isLastRound) {
          return (
            <Button
              size="lg"
              onClick={handlePqEndGame}
              className="text-lg px-6 py-5 font-bold gap-2 bg-primary hover:bg-primary/90"
              data-testid="btn-pq-end-bar"
            >
              <Trophy className="w-5 h-5" />
              Show Final Standings
            </Button>
          );
        }
        return (
          <Button
            size="lg"
            onClick={handlePqNextRound}
            className="text-lg px-6 py-5 font-bold gap-2"
            data-testid="btn-pq-next-round-bar"
          >
            Next Round
            <ChevronRight className="w-5 h-5" />
          </Button>
        );
      }
      // Reveal phase: advance to next question
      if (pqReveal) {
        return (
          <Button
            size="lg"
            onClick={handlePqNext}
            className="text-lg px-6 py-5 font-bold gap-2 bg-primary hover:bg-primary/90"
            data-testid="btn-pq-next-bar"
          >
            Next Question
            <ArrowRight className="w-5 h-5" />
          </Button>
        );
      }
      // Question is live: reveal + skip
      if (pqQuestion) {
        const remainingMs = Math.max(0, pqTimerEndAt - pqNow);
        const allAnswered = pqTotalAnswerers > 0 && pqAnsweredCount >= pqTotalAnswerers;
        return (
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              onClick={handlePqSkip}
              className="text-lg px-5 py-5 font-bold gap-2"
              data-testid="btn-pq-skip-bar"
            >
              <SkipForward className="w-5 h-5" />
              Skip
            </Button>
            <Button
              size="lg"
              onClick={handlePqReveal}
              disabled={pqAnsweredCount === 0 && !allAnswered && remainingMs > 1000}
              className="text-lg px-6 py-5 font-bold gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid="btn-pq-reveal-bar"
            >
              <Eye className="w-5 h-5" />
              {allAnswered || remainingMs <= 0 ? "Reveal Answer" : "Reveal Now"}
            </Button>
          </div>
        );
      }
      return null;
    }

    if (gameType === "wheel-of-fortune") {
      if (wofPuzzleOver) {
        return (
          <div className="flex gap-3">
            {wofPuzzleOver.isLastPuzzle ? (
              <Button size="lg" onClick={handleWofEndGame}
                className="text-lg px-6 py-5 font-bold gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white"
                data-testid="btn-wof-final-standings">
                <Trophy className="w-5 h-5" /> Final Standings
              </Button>
            ) : (
              <Button size="lg" onClick={handleWofNextPuzzle}
                className="text-lg px-6 py-5 font-bold gap-2 bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white"
                data-testid="btn-wof-next-puzzle">
                Next Puzzle <ChevronRight className="w-5 h-5" />
              </Button>
            )}
          </div>
        );
      }
      return (
        <Button size="lg" variant="outline" onClick={handleWofEndGame}
          className="text-lg px-5 py-5 font-bold gap-2" data-testid="btn-wof-end">
          <Trophy className="w-5 h-5" /> End Game
        </Button>
      );
    }

    return null;
  };

  const renderWof = () => {
    const controllerPlayer = players.find(p => p.id === wofControllerId);
    const controllerName = controllerPlayer?.name ?? "???";
    const isMyTurn = false; // host always spectates — players act

    const VOWELS_SET = new Set(["A", "E", "I", "O", "U"]);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

    function spinValueLabel(v: WofWheelValue | null): string {
      if (v === null) return "";
      if (v === "BANKRUPT") return "BANKRUPT!";
      if (v === "LOSE_A_TURN") return "LOSE A TURN";
      if (v === "FREE_PLAY") return "FREE PLAY";
      return `$${(v as number).toLocaleString()}`;
    }

    return (
      <div className="flex-1 flex flex-col bg-[#FFF8E7] min-h-0">
        {/* Header */}
        <header className="flex justify-between items-center px-6 py-3 bg-[#7C3AED] border-b-[4px] border-black">
          <div className="font-display font-black text-white text-xl uppercase tracking-widest">
            ROOM: <span className="text-[#FFD700]">{roomCode}</span>
          </div>
          {isDemo && <DemoBadge />}
          <div className="font-display font-black text-white text-xl uppercase tracking-widest">
            Puzzle <span className="text-[#FFD700]">{wofPuzzleIndex + 1}</span>
            <span className="text-white/60"> / {wofTotalPuzzles}</span>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-auto">
          {/* Main area — board + wheel result */}
          <div className="flex-1 flex flex-col items-center gap-4">
            {/* Board */}
            <div className="w-full max-w-3xl bg-black/5 border-[3px] border-black p-4 shadow-[4px_4px_0_#000]">
              <WofBoard board={wofBoard} category={wofCategory} hint={wofHint ?? undefined} />
            </div>

            {/* Animated WofWheel */}
            <WofWheel
              spinning={wofSpinning}
              spinIndex={wofSpinIndex}
              value={wofSpinning ? null : wofLastSpin}
              spinnerName={controllerName}
              size={460}
            />

            {/* Host SPIN button — active when controller needs to spin */}
            {wofPhase === "spinning" && !wofSpinning && !wofPendingSolve && !wofPuzzleOver && (
              <Button
                onClick={handleWofSpin}
                className="w-full max-w-xs py-6 text-2xl font-display font-black uppercase bg-[#FFD700] hover:bg-[#FFD700]/90 text-black border-[4px] border-black shadow-[6px_6px_0_#000]"
                data-testid="btn-wof-spin"
              >
                🎡 SPIN
              </Button>
            )}

            {/* Pending solve — host judge controls */}
            <AnimatePresence>
              {wofPendingSolve && (
                <motion.div
                  key="pending-solve"
                  initial={{ scale: 0.8, opacity: 0, y: -10 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  className={`w-full max-w-md border-[4px] border-black shadow-[6px_6px_0_#000] p-5 flex flex-col gap-3 ${wofPendingSolve.isVerbal ? "bg-[#7C3AED]" : "bg-[#FF1493]"}`}
                >
                  <p className="font-display font-black text-white uppercase text-xl tracking-widest text-center">
                    {wofPendingSolve.isVerbal ? "🎤 Verbal Solve!" : "Solve Attempt!"}
                  </p>
                  <p className="text-white/80 font-sans text-sm text-center">
                    <span className="font-black text-white">{wofPendingSolve.solverName}</span>
                    {wofPendingSolve.isVerbal ? " is saying it out loud — listen carefully!" : " typed:"}
                  </p>
                  {!wofPendingSolve.isVerbal && (
                    <div className="bg-white border-[3px] border-black px-4 py-3 text-center">
                      <p className="font-display font-black text-2xl uppercase text-black tracking-wider">
                        {wofPendingSolve.answer}
                      </p>
                    </div>
                  )}
                  {wofPendingSolve.isVerbal && (
                    <div className="bg-white/20 border-[2px] border-white/50 px-4 py-3 text-center rounded">
                      <p className="font-display font-black text-white text-lg">🎧 Listen to their answer…</p>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleWofJudge(true)}
                      className="flex-1 bg-[#00C853] hover:bg-[#00C853]/90 text-white border-[3px] border-black font-display font-black text-xl uppercase shadow-[4px_4px_0_#000]"
                      data-testid="btn-wof-judge-correct"
                    >
                      <Check className="w-5 h-5 mr-2" /> CORRECT
                    </Button>
                    <Button
                      onClick={() => handleWofJudge(false)}
                      className="flex-1 bg-black hover:bg-black/80 text-white border-[3px] border-white/30 font-display font-black text-xl uppercase shadow-[4px_4px_0_#000]"
                      data-testid="btn-wof-judge-wrong"
                    >
                      <X className="w-5 h-5 mr-2" /> WRONG
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Solve / letter result feedback */}
            <AnimatePresence mode="wait">
              {!wofSpinning && !wofPendingSolve && wofPuzzleOver ? (
                <motion.div key="puzzleover" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 bg-[#7C3AED] border-[3px] border-black shadow-[6px_6px_0_#000] px-8 py-5 text-white text-center">
                  <p className="font-display font-black text-2xl uppercase tracking-wide">Puzzle Solved!</p>
                  <p className="font-display text-4xl font-black text-[#FFD700]">{wofPuzzleOver.answer}</p>
                  {!wofPuzzleOver.isLastPuzzle && (
                    <Button onClick={handleWofNextPuzzle} className="mt-2 bg-[#FFD700] text-black border-[2px] border-black font-display font-black uppercase hover:bg-[#FFD700]/90">
                      Next Puzzle →
                    </Button>
                  )}
                  {wofPuzzleOver.isLastPuzzle && (
                    <Button onClick={handleWofEndGame} className="mt-2 bg-black text-[#FFD700] border-[2px] border-black font-display font-black uppercase hover:bg-black/80">
                      <Trophy className="w-4 h-4 mr-2" /> Final Standings
                    </Button>
                  )}
                </motion.div>
              ) : !wofSpinning && !wofPendingSolve && wofLastLetter ? (
                <motion.div key={`letter-${wofLastLetter.letter}`} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`px-6 py-3 border-[3px] border-black text-center ${wofLastLetter.correct ? "bg-[#FFD700] text-black" : "bg-black text-white"}`}>
                  <p className="font-display font-black text-2xl uppercase">
                    "{wofLastLetter.letter}" — {wofLastLetter.count > 0 ? `${wofLastLetter.count} found! +$${wofLastLetter.scoreEarned}` : "Not in puzzle"}
                  </p>
                </motion.div>
              ) : !wofSpinning && !wofPendingSolve && wofSolveResult ? (
                <motion.div key="solve" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className={`px-6 py-3 border-[3px] border-black text-center ${wofSolveResult.correct ? "bg-[#00C853] text-white" : "bg-black text-white"}`}>
                  <p className="font-display font-black text-xl uppercase">
                    {wofSolveResult.correct ? `✓ ${wofSolveResult.solverName} solved it!` : `✗ ${wofSolveResult.solverName} — wrong answer`}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Host A-Z keyboard — active when in guessing phase and no pending solve */}
            {wofPhase === "guessing" && !wofPendingSolve && !wofPuzzleOver && (
              <div className="w-full max-w-2xl">
                <p className="font-display font-black text-xs uppercase tracking-widest text-black/40 mb-2">
                  {wofIsFreePlay ? "🎉 FREE PLAY — Click Any Letter" : "Click Letter When Called"}
                </p>
                <div className="grid grid-cols-9 gap-1">
                  {alphabet.map(l => {
                    const used = wofGuessedLetters.includes(l);
                    const isVowel = VOWELS_SET.has(l);
                    const isDisabled = used || (!wofIsFreePlay && isVowel);
                    return (
                      <button
                        key={l}
                        onClick={() => !isDisabled && socket?.emit("wof-guess-letter", { roomCode, letter: l })}
                        disabled={isDisabled}
                        data-testid={`btn-host-wof-letter-${l}`}
                        className={`h-10 flex items-center justify-center border-[2px] border-black font-display font-black text-sm
                          ${used ? "bg-black text-white/30 cursor-not-allowed"
                            : isDisabled ? "bg-black/10 text-black/30 cursor-not-allowed"
                            : isVowel && wofIsFreePlay ? "bg-[#00C853] hover:bg-[#00C853]/80 text-white shadow-[2px_2px_0_#000] cursor-pointer"
                            : "bg-white hover:bg-[#FFD700] text-black shadow-[2px_2px_0_#000] cursor-pointer"}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Used letters tracker */}
            <div className="w-full max-w-2xl">
              <p className="font-display font-black text-xs uppercase tracking-widest text-black/40 mb-2">Used Letters</p>
              <div className="flex flex-wrap gap-1.5">
                {alphabet.map(l => {
                  const used = wofGuessedLetters.includes(l);
                  const revealed = wofRevealedLetters.includes(l);
                  const isVowel = VOWELS_SET.has(l);
                  return (
                    <div key={l} className={`w-8 h-8 flex items-center justify-center font-display font-black text-sm border-[2px] border-black
                      ${used ? (revealed ? "bg-[#FFD700] text-black" : "bg-black text-white/50") : isVowel ? "bg-[#00E5FF]/30 text-black/70" : "bg-white text-black"}`}>
                      {l}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scoreboard sidebar */}
          <div className="w-full lg:w-72 flex flex-col gap-4">
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
              <h3 className="font-display font-black text-xl uppercase mb-4 border-b-[3px] border-black pb-2">Scores</h3>
              <div className="space-y-3">
                {[...wofScores].sort((a, b) => b.score - a.score).map((s, idx) => (
                  <div key={s.id} className={`flex items-center justify-between p-3 border-[2px] border-black ${s.id === wofControllerId ? "bg-[#7C3AED] text-white" : "bg-[#FFF8E7] text-black"}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-lg w-6">#{idx + 1}</span>
                      {s.isBot && <Bot className="w-4 h-4 opacity-60" />}
                      <span className="font-display font-black uppercase truncate max-w-[100px]">{s.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-black text-lg">${s.score.toLocaleString()}</div>
                      {s.roundEarnings > 0 && <div className="text-xs font-sans opacity-70">+${s.roundEarnings} this round</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  let content: React.ReactNode = null;
  if (gameState === "lobby") content = renderLobby();
  else if (gameState === "finished") content = renderFinished();
  else if (gameType === "pop-the-question") content = renderPtQ();
  else if (gameType === "roast-roulette") content = renderRR();
  else if (gameType === "pub-quiz") content = renderPQ();
  else if (gameType === "jeopardy") content = renderJeopardy();
  else if (gameType === "wheel-of-fortune") content = renderWof();
  else if (gameType === "scattergories") content = renderScattergories();

  return (
    <HostShell
      playerCount={players.length}
      controls={renderControls()}
      onEndGame={handleEndGame}
      onPauseChange={handlePauseChange}
      onAnswerMethodChange={handleAnswerMethodChange}
      notificationsRef={notificationsRef}
      hideEndGame={gameState === "lobby" || gameState === "finished"}
    >
      {content}
    </HostShell>
  );
}
