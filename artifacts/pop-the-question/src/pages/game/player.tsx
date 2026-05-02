import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types/game";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Send, CheckCircle2, Eye, Sparkles, Mic, Beer, Check, X, Trophy, Grid3x3, Star, Zap, Award } from "lucide-react";
import type { HostAnswerMethod } from "@/lib/hostSettings";
import { useToast } from "@/hooks/use-toast";
import {
  CountUp,
  fireBigCelebration,
  fireConfetti,
  TimerRing,
} from "@/components/fx";
import { useSfx } from "@/lib/sfx";
import {
  hapticTap,
  hapticVictory,
  hapticCorrect,
  hapticWrong,
} from "@/lib/haptics";

interface RoastQuestion {
  color: string;
  question: string;
}

interface RoastEntry {
  answer: string;
  author: string;
  answerId: string;
}

interface PlayerJoinedPayload {
  player: Player;
  players: Player[];
}

interface RoomStatePayload {
  players: Player[];
  status?: string;
  gameType?: string;
  hostSettings?: { answerMethod?: HostAnswerMethod };
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

interface HostSettingsChangedPayload {
  settings: { answerMethod?: HostAnswerMethod };
}

interface HostPausedChangedPayload {
  paused: boolean;
}

interface GameStartedPayload {
  gameType: string;
  question?: string;
  questions?: unknown[];
  questionIndex?: number;
}

interface QuestionUpdatePayload {
  question: unknown;
}

interface GameEndedPayload {
  players: Player[];
}

interface AssignCardPayload {
  targetPlayerId: string;
  targetPlayerName: string;
  round: number;
}

interface RoundCompletePayload {
  nextRound: number;
  totalRounds: number;
}

interface StartRevealsPayload {
  revealOrder: string[];
  currentRevealId: string;
  currentRevealName: string;
  card: Record<string, RoastEntry>;
  questions: RoastQuestion[];
}

interface FavoritePickedPayload {
  color: string;
  pickedByName: string;
  actualAuthorName: string;
  guessedPlayerId: string;
  actualAuthorId: string;
  correct: boolean;
  players: Player[];
}

// ---- Pub Quiz types ----
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

type RrPhase = "writing" | "writing-complete" | "revealing";

// ---- Wheel of Fortune types ----
interface WofBoardCell { letter: string; revealed: boolean }
type WofBoardWord = WofBoardCell[];
interface WofScoreRow { id: string; name: string; score: number; roundEarnings: number; isBot: boolean }
type WofWheelValue = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

// ---- Jeopardy types ----
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

const colorHex = (color: string): string => {
  switch (color) {
    case "yellow": return "#FFD700";
    case "red":    return "#FF1493";
    case "green":  return "#00F5A0";
    case "purple": return "#FF006E";
    case "orange": return "#FF6B35";
    case "blue":   return "#7DD3FC";
    case "gray":   return "#9CA3AF";
    default:       return color;
  }
};

export default function GamePlayer() {
  const [, params] = useRoute("/game/:roomCode/player");
  const roomCode = params?.roomCode || "";
  const { toast } = useToast();
  const { playTap, playVictory, playCorrect, playWrong, playWhoosh } = useSfx();

  const urlParams = new URLSearchParams(window.location.search);
  const playerNameParam = urlParams.get("name") || "";

  const [, setLocation] = useLocation();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<"lobby" | "playing" | "finished">("lobby");
  const [gameType, setGameType] = useState<string>("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [me, setMe] = useState<Player | null>(null);

  // Pop the Question state
  const [currentQuestion, setCurrentQuestion] = useState<unknown>(null);
  const [votedFor, setVotedFor] = useState<string | null>(null);
  const [resultsRevealed, setResultsRevealed] = useState(false);

  // Roast Roulette state
  const [rrPhase, setRrPhase] = useState<RrPhase>("writing");
  const [rrTargetId, setRrTargetId] = useState("");
  const [rrTargetName, setRrTargetName] = useState("");
  const [rrRound, setRrRound] = useState(1);
  const [rrTotalRounds, setRrTotalRounds] = useState(1);
  const [rrQuestions, setRrQuestions] = useState<RoastQuestion[]>([]);
  const [rrCurrentAnswer, setRrCurrentAnswer] = useState("");
  const [rrSubmittedColors, setRrSubmittedColors] = useState<Set<string>>(new Set());

  // Reveal phase
  const [rrCurrentRevealId, setRrCurrentRevealId] = useState("");
  const [rrCurrentRevealName, setRrCurrentRevealName] = useState("");
  const [rrCard, setRrCard] = useState<Record<string, RoastEntry>>({});
  const [rrPickedColors, setRrPickedColors] = useState<Set<string>>(new Set());
  const [rrPickFor, setRrPickFor] = useState<{ color: string; entry: RoastEntry } | null>(null);
  const rrPickForRef = useRef<{ color: string } | null>(null);

  // Pub Quiz state
  const [pqQuestion, setPqQuestion] = useState<QuizPublicQuestion | null>(null);
  const [pqTimerEndAt, setPqTimerEndAt] = useState(0);
  const [pqMyAnswer, setPqMyAnswer] = useState<string>("");
  const [pqOpenAnswerInput, setPqOpenAnswerInput] = useState<string>("");
  const [pqAnswered, setPqAnswered] = useState(false);
  const [pqMyResult, setPqMyResult] = useState<{ correct: boolean; bonus: boolean } | null>(null);
  const [pqReveal, setPqReveal] = useState<QuizRevealPayload | null>(null);
  const [pqRoundSummary, setPqRoundSummary] = useState<{ roundName: string; isLastRound: boolean } | null>(null);
  const [pqNow, setPqNow] = useState(Date.now());

  // Jeopardy state
  const [jBoard, setJBoard] = useState<JBoardWire | null>(null);
  const [jPhase, setJPhase] = useState<JPhase>("picking");
  const [jControllerId, setJControllerId] = useState<string | null>(null);
  const [jActive, setJActive] = useState<JActiveClueWire | null>(null);
  const [jBuzzedInId, setJBuzzedInId] = useState<string | null>(null);
  const [jBuzzedInName, setJBuzzedInName] = useState<string>("");
  const [jScores, setJScores] = useState<JScoreRow[]>([]);
  const [jClueRevealedAnswer, setJClueRevealedAnswer] = useState<string | null>(null);
  const [jDailyDouble, setJDailyDouble] = useState<JDailyDoublePayload | null>(null);
  const [jDdWagerInput, setJDdWagerInput] = useState<string>("");
  const [jDdSubmitted, setJDdSubmitted] = useState(false);
  const [jFinalCategory, setJFinalCategory] = useState<string>("");
  const [jFinalQuestion, setJFinalQuestion] = useState<string>("");
  const [jFinalEligibleIds, setJFinalEligibleIds] = useState<string[]>([]);
  const [jFinalWagerInput, setJFinalWagerInput] = useState<string>("");
  const [jFinalAnswerInput, setJFinalAnswerInput] = useState<string>("");
  const [jFinalWagerSubmitted, setJFinalWagerSubmitted] = useState(false);
  const [jFinalAnswerSubmitted, setJFinalAnswerSubmitted] = useState(false);
  const [jFinalReveal, setJFinalReveal] = useState<{ correctAnswer: string; perPlayer: Array<{ id: string; name: string; wager: number; answer: string; correct: boolean }> } | null>(null);
  const [jLastResolved, setJLastResolved] = useState<{ playerId: string | null; correct: boolean; delta: number } | null>(null);
  const [jBuzzerArmed, setJBuzzerArmed] = useState(false);
  const [jMyBuzzLockedOut, setJMyBuzzLockedOut] = useState(false);
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
  const [wofIsFreePlay, setWofIsFreePlay] = useState(false);
  const [wofSolveSubmitted, setWofSolveSubmitted] = useState(false);
  const [wofSpeakNow, setWofSpeakNow] = useState(false);
  const [wofSolvePending, setWofSolvePending] = useState(false);
  const [wofPuzzleIndex, setWofPuzzleIndex] = useState(0);
  const [wofTotalPuzzles, setWofTotalPuzzles] = useState(0);
  const [wofLastLetter, setWofLastLetter] = useState<{ letter: string; count: number; correct: boolean } | null>(null);
  const [wofSolveResult, setWofSolveResult] = useState<{ correct: boolean; answer: string | null; solverName: string } | null>(null);
  const [wofPuzzleOver, setWofPuzzleOver] = useState<{ answer: string; isLastPuzzle: boolean } | null>(null);
  const [wofGuessInput, setWofGuessInput] = useState("");
  const [wofSolveInput, setWofSolveInput] = useState("");
  const [wofVowelMode, setWofVowelMode] = useState(false);

  const finishedRef = useRef(false);

  // Task #5: host-driven settings + state
  const [answerMethod, setAnswerMethod] = useState<HostAnswerMethod>("both");
  const [hostPaused, setHostPaused] = useState(false);
  const [selfMuted, setSelfMuted] = useState(false);
  const typingTimerRef = useRef<number | null>(null);
  const lastTypingEmitRef = useRef<boolean>(false);

  useEffect(() => {
    rrPickForRef.current = rrPickFor ? { color: rrPickFor.color } : null;
  }, [rrPickFor]);

  useEffect(() => {
    if (!roomCode || !playerNameParam) return;

    const newSocket = io({ path: "/socket.io" });
    setSocket(newSocket);

    newSocket.emit("join-room", { roomCode, playerName: playerNameParam, isHost: false });

    newSocket.on("player-joined", ({ player, players: ps }: PlayerJoinedPayload) => {
      setPlayers(ps.filter((p) => !p.isHost));
      if (player.name === playerNameParam) setMe(player);
    });

    newSocket.on("room-state", (data: RoomStatePayload) => {
      const { players: ps, gameType: gt, hostSettings } = data;
      setPlayers(ps.filter((p) => !p.isHost));
      if (gt) setGameType(gt);
      if (hostSettings?.answerMethod) setAnswerMethod(hostSettings.answerMethod);
      // Rehydrate WoF mid-game state on reconnect
      if (gt === "wheel-of-fortune" && data.status === "playing" && data.wofBoard) {
        setGameState("playing");
        setWofBoard(data.wofBoard);
        setWofCategory(data.wofCategory ?? "");
        setWofHint(data.wofHint ?? null);
        setWofControllerId(data.wofControllerId ?? null);
        setWofRevealedLetters(data.wofRevealedLetters ?? []);
        setWofGuessedLetters(data.wofGuessedLetters ?? []);
        setWofPhase(data.wofPhase ?? "spinning");
        setWofSolvePending(!!data.wofPendingSolve);
        setWofPuzzleIndex(data.wofPuzzleIndex ?? 0);
        setWofTotalPuzzles(data.wofTotalPuzzles ?? 0);
        if (data.wofScores) setWofScores(data.wofScores);
        setWofLastSpin(null);
        setWofLastLetter(null);
        setWofSolveResult(null);
        setWofPuzzleOver(null);
      }
    });

    newSocket.on("host-settings-changed", ({ settings }: HostSettingsChangedPayload) => {
      if (settings.answerMethod) setAnswerMethod(settings.answerMethod);
    });

    newSocket.on("host-paused-changed", ({ paused }: HostPausedChangedPayload) => {
      setHostPaused(Boolean(paused));
    });

    newSocket.on("game-started", (payload: GameStartedPayload & {
      board?: JBoardWire;
      controllerId?: string | null;
      scores?: JScoreRow[];
    }) => {
      const { gameType: gt, questions, questionIndex } = payload;
      setGameState("playing");
      setGameType(gt);
      playWhoosh();

      if (gt === "pop-the-question") {
        if (questions && typeof questionIndex === "number" && questions[questionIndex]) {
          setCurrentQuestion(questions[questionIndex]);
        }
      } else if (gt === "roast-roulette") {
        if (questions) setRrQuestions(questions as RoastQuestion[]);
        setRrPhase("writing");
        setRrCurrentAnswer("");
        setRrSubmittedColors(new Set());
        setRrPickedColors(new Set());
        setRrCurrentRevealId("");
      } else if (gt === "pub-quiz") {
        setPqQuestion(null);
        setPqReveal(null);
        setPqRoundSummary(null);
        setPqAnswered(false);
        setPqMyResult(null);
        setPqMyAnswer("");
        setPqOpenAnswerInput("");
      } else if (gt === "jeopardy") {
        setJBoard(payload.board ?? null);
        setJControllerId(payload.controllerId ?? null);
        setJScores(payload.scores ?? []);
        setJPhase("picking");
        setJActive(null);
        setJBuzzedInId(null);
        setJBuzzedInName("");
        setJClueRevealedAnswer(null);
        setJDailyDouble(null);
        setJDdWagerInput("");
        setJDdSubmitted(false);
        setJFinalCategory("");
        setJFinalQuestion("");
        setJFinalEligibleIds([]);
        setJFinalWagerInput("");
        setJFinalAnswerInput("");
        setJFinalWagerSubmitted(false);
        setJFinalAnswerSubmitted(false);
        setJFinalReveal(null);
        setJLastResolved(null);
        setJBuzzerArmed(false);
        setJMyBuzzLockedOut(false);
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
        setWofGuessInput("");
        setWofSolveInput("");
        setWofVowelMode(false);
      }
    });

    // ============ Wheel of Fortune socket handlers ============
    newSocket.on("wof-spun", (payload: {
      value: WofWheelValue;
      type: string;
      controllerId: string | null;
      isFreePlay?: boolean;
      scores: WofScoreRow[];
    }) => {
      setWofLastSpin(payload.value);
      setWofSpinType(payload.type);
      setWofControllerId(payload.controllerId);
      setWofScores(payload.scores);
      setWofLastLetter(null);
      setWofSolveResult(null);
      setWofGuessInput("");
      setWofVowelMode(false);
      setWofIsFreePlay(payload.isFreePlay ?? false);
      setWofSolveSubmitted(false);
      if (payload.type === "bankrupt" || payload.type === "lose-a-turn") {
        setWofPhase("spinning");
        hapticWrong();
      } else {
        setWofPhase("guessing");
        hapticTap();
      }
    });

    newSocket.on("wof-solve-submitted", () => {
      setWofSolvePending(true);
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
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofGuessedLetters(payload.guessedLetters);
      setWofControllerId(payload.controllerId);
      setWofScores(payload.scores);
      setWofLastLetter({ letter: payload.letter, count: payload.count, correct: payload.correct });
      setWofGuessInput("");
      setWofPhase("spinning");
      if (payload.correct && payload.count > 0) hapticCorrect();
      else hapticWrong();
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
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofGuessedLetters(payload.guessedLetters);
      setWofControllerId(payload.controllerId);
      setWofScores(payload.scores);
      setWofLastLetter({ letter: payload.letter, count: payload.count, correct: payload.found });
      setWofGuessInput("");
      setWofVowelMode(false);
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
      setWofBoard(payload.board);
      setWofRevealedLetters(payload.revealedLetters);
      setWofScores(payload.scores);
      setWofSolveResult({ correct: payload.correct, answer: payload.answer, solverName: payload.solverName });
      setWofSolveInput("");
      setWofSolveSubmitted(false);
      setWofSpeakNow(false);
      setWofSolvePending(false);
      if (payload.correct) hapticVictory();
      else hapticWrong();
    });

    newSocket.on("wof-puzzle-over", (payload: {
      answer: string;
      category: string;
      board: WofBoardWord[];
      scores: WofScoreRow[];
      isLastPuzzle: boolean;
    }) => {
      setWofBoard(payload.board);
      setWofScores(payload.scores);
      setWofPhase("puzzle-over");
      setWofPuzzleOver({ answer: payload.answer, isLastPuzzle: payload.isLastPuzzle });
      hapticVictory();
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
      setWofGuessInput("");
      setWofSolveInput("");
      setWofVowelMode(false);
      setWofIsFreePlay(false);
      setWofSolveSubmitted(false);
      setWofSpeakNow(false);
      setWofSolvePending(false);
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
        setJDdWagerInput("");
        setJDdSubmitted(false);
        setJBuzzerArmed(false);
        setJMyBuzzLockedOut(false);
        setJLastResolved(null);
        setJTimerEndAt(0);
      }
    });

    newSocket.on("jeopardy-clue-revealed", (payload: {
      active: JActiveClueWire;
    }) => {
      setJActive(payload.active);
      setJPhase("clue-reveal");
      setJBuzzedInId(null);
      setJBuzzedInName("");
      setJClueRevealedAnswer(null);
      setJBuzzerArmed(false);
      setJMyBuzzLockedOut(false);
      setJLastResolved(null);
      setJTimerEndAt(0);
      playWhoosh();
    });

    newSocket.on("jeopardy-buzzer-open", (payload: { timerEndAt: number }) => {
      setJPhase("buzzer-open");
      setJBuzzedInId(null);
      setJBuzzedInName("");
      setJBuzzerArmed(true);
      setJMyBuzzLockedOut(false);
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
      setJBuzzerArmed(false);
      setJTimerEndAt(payload.timerEndAt);
      // If someone else buzzed before me, lock me out for this clue
      if (me?.id && payload.playerId !== me.id) {
        setJMyBuzzLockedOut(true);
      }
    });

    newSocket.on("jeopardy-answer-resolved", (payload: {
      playerId: string | null;
      playerName: string;
      correct: boolean;
      delta: number;
      scores: JScoreRow[];
    }) => {
      setJScores(payload.scores);
      setJLastResolved({
        playerId: payload.playerId,
        correct: payload.correct,
        delta: payload.delta,
      });
      if (payload.playerId === me?.id) {
        if (payload.correct) {
          playCorrect();
          hapticCorrect();
        } else {
          playWrong();
          hapticWrong();
        }
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
      setJBuzzerArmed(false);
      setJTimerEndAt(0);
    });

    newSocket.on("jeopardy-daily-double", (payload: JDailyDoublePayload & { timerEndAt: number }) => {
      setJDailyDouble(payload);
      setJPhase("dd-wager");
      setJDdWagerInput("");
      setJDdSubmitted(false);
      setJControllerId(payload.controllerId);
      setJTimerEndAt(payload.timerEndAt);
      playWhoosh();
    });

    newSocket.on("jeopardy-dd-clue", (payload: {
      active: JActiveClueWire;
      wager: number;
      controllerId: string;
      timerEndAt: number;
    }) => {
      setJActive(payload.active);
      setJControllerId(payload.controllerId);
      setJPhase("dd-clue");
      setJTimerEndAt(payload.timerEndAt);
    });

    newSocket.on("jeopardy-final-intro", (payload: { category: string; scores: JScoreRow[] }) => {
      setJFinalCategory(payload.category);
      setJScores(payload.scores);
      setJPhase("final-intro");
      setJActive(null);
      setJFinalWagerInput("");
      setJFinalAnswerInput("");
      setJFinalWagerSubmitted(false);
      setJFinalAnswerSubmitted(false);
      setJFinalReveal(null);
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
      setJFinalWagerSubmitted(false);
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
      setJFinalAnswerSubmitted(false);
      playWhoosh();
    });

    newSocket.on("jeopardy-final-reveal", (payload: {
      correctAnswer: string;
      perPlayer: Array<{ id: string; name: string; wager: number; answer: string; correct: boolean }>;
    }) => {
      setJFinalReveal(payload);
      setJPhase("final-reveal");
      setJTimerEndAt(0);
      const mine = payload.perPlayer.find((p) => p.id === me?.id);
      if (mine) {
        if (mine.correct) { playCorrect(); hapticCorrect(); }
        else { playWrong(); hapticWrong(); }
      }
    });

    newSocket.on("jeopardy-final-scored", (payload: { scores: JScoreRow[] }) => {
      setJScores(payload.scores);
    });

    // ============ Pub Quiz handlers ============
    newSocket.on("quiz-question", ({ question, timerEndAt }: { question: QuizPublicQuestion; timerEndAt: number }) => {
      setPqQuestion(question);
      setPqTimerEndAt(timerEndAt);
      setPqReveal(null);
      setPqRoundSummary(null);
      setPqAnswered(false);
      setPqMyResult(null);
      setPqMyAnswer("");
      setPqOpenAnswerInput("");
      playWhoosh();
      window.scrollTo(0, 0);
    });

    newSocket.on("quiz-answer-accepted", ({ correct, firstCorrect }: { correct: boolean; firstCorrect: boolean }) => {
      setPqAnswered(true);
      setPqMyResult({ correct, bonus: firstCorrect });
      if (correct) {
        playCorrect();
        hapticCorrect();
        if (firstCorrect) fireConfetti("gold", { particleCount: 60, spread: 80, origin: { y: 0.6 } });
      } else {
        playWrong();
        hapticWrong();
      }
    });

    newSocket.on("quiz-reveal", (payload: { reveal: QuizRevealPayload }) => {
      setPqReveal(payload.reveal);
    });

    newSocket.on("quiz-round-summary", (payload: { roundName: string; isLastRound: boolean }) => {
      setPqRoundSummary({ roundName: payload.roundName, isLastRound: payload.isLastRound });
    });

    newSocket.on("quiz-question-skipped", () => {
      setPqAnswered(true);
      setPqMyResult(null);
    });

    // Pop the Question handlers
    newSocket.on("question-update", ({ question }: QuestionUpdatePayload) => {
      setCurrentQuestion(question);
      setVotedFor(null);
      setResultsRevealed(false);
      window.scrollTo(0, 0);
    });

    newSocket.on("results-revealed", () => setResultsRevealed(true));

    // Roast Roulette handlers
    newSocket.on("assign-card", ({ targetPlayerId, targetPlayerName, round }: AssignCardPayload) => {
      setRrTargetId(targetPlayerId);
      setRrTargetName(targetPlayerName);
      setRrRound(round);
      setRrPhase("writing");
      setRrCurrentAnswer("");
      setRrSubmittedColors(new Set());
      window.scrollTo(0, 0);
    });

    newSocket.on("round-complete", ({ nextRound, totalRounds }: RoundCompletePayload) => {
      setRrRound(nextRound);
      setRrTotalRounds(totalRounds);
    });

    newSocket.on("writing-complete", () => {
      setRrPhase("writing-complete");
      playWhoosh();
    });

    newSocket.on("start-reveals", ({ currentRevealId, currentRevealName, card, questions: qs }: StartRevealsPayload) => {
      setRrPhase("revealing");
      setRrCurrentRevealId(currentRevealId);
      setRrCurrentRevealName(currentRevealName);
      setRrCard(card ?? {});
      if (qs) setRrQuestions(qs);
      setRrPickedColors(new Set());
      setRrPickFor(null);
      window.scrollTo(0, 0);
    });

    newSocket.on("favorite-picked", ({ color, correct, pickedByName, actualAuthorName, players: ps }: FavoritePickedPayload) => {
      setRrPickedColors((prev) => {
        const next = new Set(prev);
        next.add(color);
        return next;
      });
      if (ps) setPlayers(ps.filter((p) => !p.isHost));

      if (rrPickForRef.current?.color === color) {
        if (correct) {
          playCorrect();
          hapticCorrect();
          fireConfetti("gold", { particleCount: 80, spread: 90, origin: { y: 0.6 } });
        } else {
          playWrong();
          hapticWrong();
        }
        toast({
          title: correct ? "Correct!" : "Wrong author",
          description: correct
            ? `${actualAuthorName} wrote that — nice read!`
            : `${actualAuthorName} actually wrote it. ${pickedByName} guessed wrong.`,
          variant: correct ? "default" : "destructive",
        });
        setRrPickFor(null);
      }
    });

    newSocket.on("game-ended", (payload: GameEndedPayload & { finalScores?: Array<{ id: string; name: string; score: number; isBot: boolean }> }) => {
      const { players: ps, finalScores } = payload;
      setGameState("finished");
      if (ps) {
        setPlayers(ps.filter((p) => !p.isHost));
      }
      if (finalScores) {
        // Map scores back onto players so the finished view shows correct totals.
        setPlayers((prev) => {
          const lookup = new Map(finalScores.map((r) => [r.id, r.score]));
          return prev.map((p) => ({ ...p, score: lookup.get(p.id) ?? p.score ?? 0 }));
        });
      }
    });

    return () => {
      newSocket.disconnect();
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, playerNameParam]);

  // Emit player-typing (debounced) when the roast input changes; clear
  // typing flag 1.2s after the last keystroke or immediately on submit.
  const emitTyping = (isTyping: boolean) => {
    if (lastTypingEmitRef.current === isTyping) return;
    lastTypingEmitRef.current = isTyping;
    socket?.emit("player-typing", { roomCode, isTyping });
  };

  const handleAnswerInput = (value: string) => {
    setRrCurrentAnswer(value);
    if (value.length > 0) {
      emitTyping(true);
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = window.setTimeout(() => {
        emitTyping(false);
        typingTimerRef.current = null;
      }, 1200);
    } else {
      emitTyping(false);
      if (typingTimerRef.current !== null) {
        window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    }
  };

  const toggleSelfMute = () => {
    const next = !selfMuted;
    setSelfMuted(next);
    socket?.emit("player-muted", { roomCode, muted: next });
  };

  // Toggle a body data attribute when host pauses — drives the global
  // paused overlay defined in index.css (works across every render branch).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (hostPaused) {
      document.body.dataset.gamePaused = "true";
    } else {
      delete document.body.dataset.gamePaused;
    }
    return () => {
      delete document.body.dataset.gamePaused;
    };
  }, [hostPaused]);

  useEffect(() => {
    if (gameState === "finished" && !finishedRef.current) {
      finishedRef.current = true;
      playVictory();
      hapticVictory();
      setTimeout(() => fireBigCelebration(), 350);
    }
  }, [gameState, playVictory]);

  const handleVote = (playerId: string) => {
    if (votedFor || resultsRevealed) return;
    if (hostPaused) {
      toast({ title: "Game paused", description: "Wait for the host to resume.", variant: "destructive" });
      return;
    }
    setVotedFor(playerId);
    playTap();
    hapticTap();
    socket?.emit("submit-vote", { roomCode, votedForId: playerId });
  };

  const currentRoastQ = rrQuestions[rrRound - 1];
  const submittedThisRound = currentRoastQ
    ? rrSubmittedColors.has(currentRoastQ.color)
    : false;

  const handleSubmitRoast = () => {
    const answer = rrCurrentAnswer.trim();
    if (!answer) {
      toast({ title: "Type something first", description: "Roasts can't be blank.", variant: "destructive" });
      return;
    }
    if (!rrTargetId || !currentRoastQ || submittedThisRound) return;
    if (hostPaused) {
      toast({ title: "Game paused", description: "Wait for the host to resume.", variant: "destructive" });
      return;
    }
    playTap();
    hapticTap();
    // Clear typing flag on submit so host doesn't see a stale "typing…" badge.
    if (typingTimerRef.current !== null) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    emitTyping(false);
    socket?.emit("submit-roast", {
      roomCode,
      targetPlayerId: rrTargetId,
      color: currentRoastQ.color,
      answer,
    });
    setRrSubmittedColors((prev) => {
      const next = new Set(prev);
      next.add(currentRoastQ.color);
      return next;
    });
    setRrCurrentAnswer("");
    fireConfetti("rainbow", { particleCount: 30, spread: 60, origin: { y: 0.7 } });
  };

  const handlePickAuthor = (guessedPlayerId: string) => {
    if (!rrPickFor || !socket) return;
    socket.emit("pick-favorite", {
      roomCode,
      color: rrPickFor.color,
      answerId: rrPickFor.entry.answerId,
      guessedPlayerId,
    });
    playTap();
    hapticTap();
  };

  const isMyCard = useMemo(
    () => Boolean(me?.id && rrCurrentRevealId && me.id === rrCurrentRevealId),
    [me?.id, rrCurrentRevealId],
  );

  // Pub Quiz: timer tick
  useEffect(() => {
    if (gameType !== "pub-quiz" || !pqQuestion || pqReveal || pqRoundSummary || pqAnswered) return;
    const id = setInterval(() => setPqNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameType, pqQuestion, pqReveal, pqRoundSummary, pqAnswered]);

  // Pub Quiz: submit helpers
  const submitQuizAnswer = (answer: string) => {
    if (!socket || !pqQuestion || pqAnswered) return;
    setPqMyAnswer(answer);
    setPqAnswered(true);
    playTap();
    hapticTap();
    socket.emit("quiz-submit-answer", { roomCode, answer });
  };

  const handlePqPickOption = (idx: number) => {
    if (pqAnswered) return;
    submitQuizAnswer(String(idx));
  };

  const handlePqPickTrueFalse = (val: boolean) => {
    if (pqAnswered) return;
    submitQuizAnswer(val ? "true" : "false");
  };

  // ============ Jeopardy handlers ============
  const handleJBuzz = () => {
    if (!socket || jPhase !== "buzzer-open" || jMyBuzzLockedOut) return;
    if (hostPaused) return;
    playTap();
    hapticTap();
    socket.emit("jeopardy-buzz-in", { roomCode });
  };

  const handleJPickSquare = (cat: number, clue: number) => {
    if (!socket || jPhase !== "picking") return;
    if (me?.id !== jControllerId) return;
    if (hostPaused) return;
    playTap();
    hapticTap();
    socket.emit("jeopardy-pick-square", { roomCode, cat, clue });
  };

  const handleJSubmitDdWager = () => {
    if (!socket || !jDailyDouble || jDdSubmitted) return;
    const wager = parseInt(jDdWagerInput, 10);
    if (Number.isNaN(wager) || wager < 5 || wager > jDailyDouble.maxWager) {
      toast({
        title: "Invalid wager",
        description: `Must be between $5 and $${jDailyDouble.maxWager}.`,
        variant: "destructive",
      });
      return;
    }
    setJDdSubmitted(true);
    playTap();
    hapticTap();
    socket.emit("jeopardy-submit-dd-wager", { roomCode, wager });
  };

  const handleJSubmitFinalWager = () => {
    if (!socket || jFinalWagerSubmitted) return;
    const myScore = jScores.find((s) => s.id === me?.id)?.score ?? 0;
    const max = Math.max(0, myScore);
    const wager = parseInt(jFinalWagerInput, 10);
    if (Number.isNaN(wager) || wager < 0 || wager > max) {
      toast({
        title: "Invalid wager",
        description: `Must be between $0 and $${max}.`,
        variant: "destructive",
      });
      return;
    }
    setJFinalWagerSubmitted(true);
    playTap();
    hapticTap();
    socket.emit("jeopardy-submit-final-wager", { roomCode, wager });
  };

  const handleJSubmitFinalAnswer = () => {
    if (!socket || jFinalAnswerSubmitted) return;
    const answer = jFinalAnswerInput.trim();
    if (!answer) {
      toast({ title: "Type your answer first", variant: "destructive" });
      return;
    }
    setJFinalAnswerSubmitted(true);
    playTap();
    hapticTap();
    socket.emit("jeopardy-submit-final-answer", { roomCode, answer });
  };

  // Jeopardy: timer tick whenever a timer is active
  useEffect(() => {
    if (gameType !== "jeopardy" || jTimerEndAt === 0) return;
    const id = setInterval(() => setJNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [gameType, jTimerEndAt]);

  const handlePqSubmitOpen = () => {
    const ans = pqOpenAnswerInput.trim();
    if (!ans) {
      toast({ title: "Type your answer first", variant: "destructive" });
      return;
    }
    submitQuizAnswer(ans);
  };

  // ============ LOBBY ============
  if (gameState === "lobby") {
    return (
      <>
        <div className="flex flex-col min-h-[100dvh] bg-[#FFD700]">
          <header className="bg-[#FF1493] border-b-[4px] border-black px-6 py-5">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="inline-flex items-center gap-2 bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-1.5 font-display font-black text-black text-sm uppercase tracking-widest">
                <span className="text-black/60">ROOM</span>
                <span className="text-xl tracking-[0.3em]">{roomCode}</span>
              </div>
              <button
                onClick={() => setConfirmLeave(true)}
                data-testid="btn-leave-game"
                className="inline-flex items-center gap-1.5 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] px-3 py-1.5 font-display font-black text-black text-xs uppercase tracking-wide hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-[box-shadow,transform] duration-75"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 flex-shrink-0" aria-hidden>
                  <path d="M19 12H5M5 12L11 6M5 12L11 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                LEAVE
              </button>
            </div>
            <h1 className="font-display font-black text-white text-4xl uppercase" style={{ textShadow: "3px 3px 0 #000" }}>You're in!</h1>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center px-6">
            <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] w-24 h-24 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-black animate-spin" />
            </div>
            <h2 className="font-display font-black text-black text-2xl uppercase">Waiting for host…</h2>
            <p className="text-black/70 font-bold font-sans">Look at the big screen.</p>
          </div>
        </div>

        <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="font-display font-black uppercase text-xl">← Leave Game?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll be taken back to the home screen. You can rejoin using the same room code if the game hasn't started.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-leave-cancel">Stay</AlertDialogCancel>
              <AlertDialogAction
                className="bg-black text-[#FFD700] border-[3px] border-black hover:bg-black/80 font-display font-black uppercase"
                onClick={() => { setConfirmLeave(false); setLocation("/"); }}
                data-testid="btn-leave-confirm"
              >
                ← LEAVE
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  // ============ PLAYING — Pop the Question ============
  if (gameState === "playing" && (gameType === "pop-the-question" || gameType === "")) {
    const q = currentQuestion as { prompt?: string } | null;
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <header className="sticky top-0 z-10 bg-[#FF1493] border-b-[4px] border-black px-4 py-4">
          <AnimatePresence mode="wait">
            <motion.h2
              key={q?.prompt ?? "loading"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="font-display font-black text-white text-xl uppercase leading-tight"
              style={{ textShadow: "2px 2px 0 #000" }}
            >
              {q?.prompt || "Loading…"}
            </motion.h2>
          </AnimatePresence>
        </header>

        <main className="flex-1 flex flex-col p-4 bg-[#FFF8E7]">
          {!votedFor && !resultsRevealed ? (
            <motion.div
              className="space-y-3 pb-8"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {players.filter((p) => p.id !== me?.id).map((p) => (
                <motion.div
                  key={p.id}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  whileTap={{ scale: 0.96 }}
                >
                  <Card
                    onClick={() => handleVote(p.id)}
                    className="p-6 cursor-pointer bg-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#FFD700] min-h-16 active:shadow-[2px_2px_0_#000] active:translate-y-[2px]"
                    data-testid={`btn-vote-${p.id}`}
                  >
                    <span className="font-display font-black text-black text-2xl uppercase">{p.name}</span>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : !resultsRevealed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 p-4">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 28 }}
                className="w-24 h-24 bg-[#00C853] border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
              >
                <span className="text-4xl">👍</span>
              </motion.div>
              <h2 className="font-display font-black text-black text-3xl uppercase">Vote received!</h2>
              <p className="text-black/60 font-sans">Look at the big screen to see what everyone else thought.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 p-4">
              <div className="bg-[#FF1493] border-[3px] border-black shadow-[4px_4px_0_#000] p-6">
                <h2 className="font-display font-black text-white text-3xl uppercase" style={{ textShadow: "2px 2px 0 #000" }}>Results are up!</h2>
              </div>
              <p className="text-black/60 font-sans">Look at the big screen.</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============ PLAYING — Roast Roulette ============
  if (gameState === "playing" && gameType === "roast-roulette") {
    // --- WRITING PHASE ---
    if (rrPhase === "writing") {
      const roundsRemaining = Math.max(1, rrTotalRounds - rrRound + 1);
      return (
        <div className="flex flex-col min-h-[100dvh]">
          <header className="bg-[#FF6B35] border-b-[4px] border-black px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-black/60">
                Round <span className="text-black"><CountUp value={rrRound} duration={0.3} /></span> of {rrTotalRounds}
              </p>
              <h1 className="font-display font-black text-white text-2xl uppercase leading-tight" style={{ textShadow: "2px 2px 0 #000" }}>
                Roast{" "}
                {rrTargetName ? (
                  <span className="text-[#FFD700]">{rrTargetName}</span>
                ) : (
                  <span className="text-white/60">…</span>
                )}
              </h1>
            </div>
            <TimerRing
              value={roundsRemaining}
              total={Math.max(1, rrTotalRounds)}
              size={64}
              thickness={6}
              label={`${rrRound}/${rrTotalRounds}`}
              showLabel
            />
          </header>

          <main className="flex-1 flex flex-col p-4 bg-[#FFF8E7]">
            {!currentRoastQ ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-black animate-spin" />
              </div>
            ) : submittedThisRound ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 20 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-6"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 28, delay: 0.05 }}
                  className="w-24 h-24 bg-[#00C853] border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
                >
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </motion.div>
                <h2 className="font-display font-black text-black text-3xl uppercase">Roast sent!</h2>
                <p className="text-black/60 max-w-sm font-sans">
                  Waiting for the others to finish writing…
                </p>
                <Loader2 className="w-6 h-6 text-black/40 animate-spin" />
              </motion.div>
            ) : (
              <motion.div
                key={`writing-${rrRound}-${currentRoastQ.color}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 flex flex-col"
              >
                <Card
                  className="p-5 mb-4 border-[3px] border-black shadow-[4px_4px_0_#000]"
                  style={{ backgroundColor: `${colorHex(currentRoastQ.color)}22` }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 self-stretch flex-shrink-0 border border-black"
                      style={{ background: colorHex(currentRoastQ.color) }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest text-black/50 mb-1">
                        About {rrTargetName || "your target"}
                      </p>
                      <p className="font-display font-black text-black text-lg uppercase leading-snug">
                        {currentRoastQ.question}
                      </p>
                    </div>
                  </div>
                </Card>

                {answerMethod === "voice" ? (
                  <div
                    className="border-[3px] border-black shadow-[4px_4px_0_#000] bg-[#FF6B35] p-6 text-center mb-4"
                    data-testid="voice-mode-prompt"
                  >
                    <Mic className="w-12 h-12 text-white mx-auto mb-3" />
                    <p className="font-display font-black text-white text-lg uppercase mb-1">Shout your roast!</p>
                    <p className="text-white/80 text-sm mb-4 font-sans">
                      Say it out loud, then tap below so the round can advance.
                    </p>
                    <Button
                      size="lg"
                      onClick={() => {
                        if (submittedThisRound || !rrTargetId || !currentRoastQ) return;
                        if (hostPaused) {
                          toast({ title: "Game paused", description: "Wait for the host to resume.", variant: "destructive" });
                          return;
                        }
                        playTap();
                        hapticTap();
                        socket?.emit("submit-roast", {
                          roomCode,
                          targetPlayerId: rrTargetId,
                          color: currentRoastQ.color,
                          answer: "(spoken aloud)",
                        });
                        setRrSubmittedColors((prev) => {
                          const next = new Set(prev);
                          next.add(currentRoastQ.color);
                          return next;
                        });
                        fireConfetti("rainbow", { particleCount: 30, spread: 60, origin: { y: 0.7 } });
                      }}
                      disabled={submittedThisRound}
                      className="w-full"
                      data-testid="btn-mark-spoken"
                    >
                      <Mic className="w-5 h-5 mr-2" /> I said it — next!
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      value={rrCurrentAnswer}
                      onChange={(e) => handleAnswerInput(e.target.value)}
                      onBlur={() => emitTyping(false)}
                      placeholder={
                        answerMethod === "text"
                          ? "Type your roast (text-only mode)…"
                          : "Type your roast…"
                      }
                      maxLength={140}
                      className="text-base py-6 min-h-12"
                      autoFocus
                      data-testid="input-roast-answer"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitRoast();
                        }
                      }}
                    />
                    <div className="text-right text-xs text-black/40 mt-1 mb-4 font-mono">
                      {rrCurrentAnswer.length}/140
                    </div>

                    <Button
                      size="lg"
                      onClick={handleSubmitRoast}
                      disabled={!rrCurrentAnswer.trim()}
                      className="w-full"
                      data-testid="btn-submit-roast"
                    >
                      <Send className="w-5 h-5 mr-2" /> Send Roast
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </main>
        </div>
      );
    }

    // --- WRITING COMPLETE (intermission) ---
    if (rrPhase === "writing-complete") {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-[#FFD700] items-center justify-center text-center space-y-6 p-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            className="w-28 h-28 bg-[#FF1493] border-[3px] border-black shadow-[5px_5px_0_#000] flex items-center justify-center"
          >
            <Sparkles className="w-14 h-14 text-white" />
          </motion.div>
          <h1 className="font-display font-black text-4xl uppercase comic-headline">
            All roasts in
          </h1>
          <p className="text-black/70 max-w-sm font-sans">
            Time for reveals. Look at the big screen.
          </p>
        </div>
      );
    }

    // --- REVEALING ---
    if (rrPhase === "revealing") {
      // The card owner picks the author for each color
      if (isMyCard) {
        const allPicked = rrPickedColors.size >= Object.keys(rrCard).length && Object.keys(rrCard).length > 0;
        return (
          <div className="flex flex-col min-h-[100dvh]">
            <header className="bg-[#FF6B35] border-b-[4px] border-black px-4 py-5 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-black/60">Your card!</p>
              <h1 className="font-display font-black text-white text-2xl uppercase" style={{ textShadow: "2px 2px 0 #000" }}>
                Guess who roasted you
              </h1>
            </header>

            <main className="flex-1 flex flex-col gap-3 p-4 pb-8 bg-[#FFF8E7]">
              <AnimatePresence mode="popLayout">
                {Object.entries(rrCard).map(([color, entry], idx) => {
                  const q = rrQuestions.find((x) => x.color === color);
                  const picked = rrPickedColors.has(color);
                  const isPicking = rrPickFor?.color === color;

                  return (
                    <motion.div
                      key={color}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.35 }}
                    >
                      <Card
                        className="p-4 border-[3px] border-black shadow-[4px_4px_0_#000]"
                        style={{
                          backgroundColor: picked ? "#e8f5e9" : `${colorHex(color)}18`,
                          opacity: picked ? 0.7 : 1,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-3 self-stretch flex-shrink-0 border border-black"
                            style={{ background: colorHex(color) }}
                          />
                          <div className="flex-1 min-w-0">
                            {q?.question && (
                              <p className="text-xs text-black/50 mb-1 leading-snug font-sans">{q.question}</p>
                            )}
                            <p className="font-display font-black text-black text-base uppercase leading-snug break-words">
                              "{entry.answer}"
                            </p>

                            {!picked && !isPicking && (
                              <Button
                                size="sm"
                                className="mt-3 min-h-10"
                                onClick={() => setRrPickFor({ color, entry })}
                                data-testid={`btn-pick-${color}`}
                              >
                                Pick the author
                              </Button>
                            )}

                            {!picked && isPicking && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                className="mt-3 space-y-2"
                              >
                                <p className="text-xs font-black uppercase tracking-widest text-black/50">
                                  Who wrote it?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {players
                                    .filter((p) => p.id !== me?.id)
                                    .map((p) => (
                                      <Button
                                        key={p.id}
                                        size="sm"
                                        className="min-h-12 justify-start font-display font-black uppercase"
                                        onClick={() => handlePickAuthor(p.id)}
                                        data-testid={`btn-author-${p.id}`}
                                      >
                                        {p.name}
                                      </Button>
                                    ))}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-black/50"
                                  onClick={() => setRrPickFor(null)}
                                >
                                  Cancel
                                </Button>
                              </motion.div>
                            )}

                            {picked && (
                              <div className="mt-2 flex items-center gap-2 text-[#00C853] text-sm font-black uppercase">
                                <CheckCircle2 className="w-4 h-4" /> Revealed
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {allPicked && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center mt-4"
                >
                  <p className="font-display font-black text-black uppercase">
                    All authors guessed! Look at the big screen.
                  </p>
                </motion.div>
              )}
            </main>
          </div>
        );
      }

      // Spectator (someone else's card is being revealed)
      return (
        <div className="flex flex-col min-h-[100dvh] bg-[#00E5FF] items-center justify-center text-center space-y-6 p-6">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            className="w-24 h-24 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
          >
            <Eye className="w-12 h-12 text-black" />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-black/60">Now roasting</p>
          <h1 className="font-display font-black text-4xl uppercase comic-headline">
            {rrCurrentRevealName || "…"}
          </h1>
          <p className="text-black/60 max-w-sm font-sans">
            Watch the big screen — they're guessing who wrote each roast.
          </p>
        </div>
      );
    }
  }

  // ============ PLAYING — Pub Quiz ============
  if (gameState === "playing" && gameType === "pub-quiz") {
    // Round summary intermission
    if (pqRoundSummary) {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-[#00C853] items-center justify-center text-center space-y-6 p-6">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            className="w-24 h-24 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
          >
            <Beer className="w-12 h-12 text-black" />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-black/60">Round Complete</p>
          <h1 className="font-display font-black text-3xl uppercase comic-headline">{pqRoundSummary.roundName}</h1>
          <p className="text-black/70 max-w-sm font-sans">
            {pqRoundSummary.isLastRound
              ? "Final standings on the big screen!"
              : "Look at the big screen for round standings."}
          </p>
        </div>
      );
    }

    // Loading
    if (!pqQuestion) {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-[#FFF8E7] items-center justify-center p-6 space-y-4">
          <Loader2 className="w-12 h-12 text-black animate-spin" />
          <p className="text-black/60 font-sans">Loading next question…</p>
        </div>
      );
    }

    const remainingMs = Math.max(0, pqTimerEndAt - pqNow);
    const totalMs = pqQuestion.durationMs;
    const secsLeft = Math.ceil(remainingMs / 1000);

    // Reveal: show my result
    if (pqReveal) {
      const myAnswer = pqReveal.perPlayerAnswers.find((a) => a.playerId === me?.id);
      const wasCorrect = myAnswer?.correct ?? false;
      const wasFirst = pqReveal.firstCorrectPlayerId === me?.id;

      return (
        <div className={`flex flex-col min-h-[100dvh] items-center justify-center text-center space-y-6 p-6 ${wasCorrect ? "bg-[#00C853]" : "bg-[#FF1493]"}`}>
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 26 }}
            className="w-28 h-28 bg-white border-[3px] border-black shadow-[5px_5px_0_#000] flex items-center justify-center"
          >
            {wasCorrect
              ? <Check className="w-14 h-14 text-[#00C853]" />
              : <X className="w-14 h-14 text-[#FF1493]" />}
          </motion.div>
          <h1 className="font-display font-black text-white text-4xl uppercase" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.3)" }}>
            {wasCorrect ? "Correct!" : myAnswer ? "Not quite" : "No answer"}
          </h1>
          {wasFirst && (
            <div className="bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-2 font-display font-black text-black uppercase text-sm tracking-widest">
              + 0.5 first-correct bonus
            </div>
          )}
          <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 w-full max-w-sm">
            <p className="text-xs font-black uppercase tracking-widest text-black/50 mb-1">Correct answer</p>
            <p className="font-display font-black text-black text-2xl uppercase">{pqReveal.correctAnswer}</p>
            {myAnswer && !wasCorrect && (
              <>
                <p className="text-xs font-black uppercase tracking-widest text-black/50 mt-3 mb-1">Your answer</p>
                <p className="text-black/60 font-sans">{myAnswer.raw}</p>
              </>
            )}
          </div>
          <p className="text-white/70 text-sm font-sans">Look at the big screen for standings.</p>
        </div>
      );
    }

    // Answered, waiting for reveal
    if (pqAnswered) {
      const showResult = pqMyResult !== null;
      const bgColor = showResult ? (pqMyResult.correct ? "#00C853" : "#FF1493") : "#FF6B35";
      return (
        <div className="flex flex-col min-h-[100dvh] items-center justify-center text-center space-y-6 p-6" style={{ backgroundColor: bgColor }}>
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="w-24 h-24 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
          >
            {showResult ? (
              pqMyResult.correct
                ? <Check className="w-12 h-12 text-[#00C853]" />
                : <X className="w-12 h-12 text-[#FF1493]" />
            ) : (
              <CheckCircle2 className="w-12 h-12 text-[#FF6B35]" />
            )}
          </motion.div>
          <h2 className="font-display font-black text-white text-3xl uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.3)" }}>
            {showResult
              ? pqMyResult.correct
                ? pqMyResult.bonus
                  ? "First correct!"
                  : "Locked in!"
                : "Locked in"
              : "Answer sent!"}
          </h2>
          {pqMyResult?.bonus && (
            <div className="bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-2 font-display font-black text-black uppercase text-sm tracking-widest">
              + 0.5 bonus
            </div>
          )}
          <p className="text-white/70 max-w-sm font-sans">
            Waiting for everyone else… the answer reveals on the big screen.
          </p>
          <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
        </div>
      );
    }

    // Active question — answer UI
    return (
      <div className="flex flex-col min-h-[100dvh]">
        <header className="bg-[#00E5FF] border-b-[4px] border-black px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-black/60">
              <Beer className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              {pqQuestion.roundName}
            </p>
            <p className="text-xs text-black/50 mt-0.5 font-sans">
              Q {pqQuestion.questionIndex + 1} of {pqQuestion.questionsInRound}
              <span className="mx-1.5">·</span>
              R {pqQuestion.roundIndex + 1}/{pqQuestion.totalRounds}
            </p>
          </div>
          <TimerRing
            value={remainingMs / 1000}
            total={totalMs / 1000}
            size={60}
            thickness={6}
            label={`${secsLeft}s`}
          />
        </header>

        <main className="flex-1 flex flex-col p-4 bg-[#FFF8E7]">
          <Card className="p-5 mb-5 border-[3px] border-black shadow-[4px_4px_0_#000]">
            <h2 className="font-display font-black text-black text-xl uppercase leading-snug">
              {pqQuestion.prompt}
            </h2>
          </Card>

          {/* Multiple choice */}
          {pqQuestion.type === "multiple-choice" && pqQuestion.options && (
            <motion.div
              className="space-y-3 pb-6"
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
            >
              {pqQuestion.options.map((opt, idx) => (
                <motion.div
                  key={idx}
                  variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    className="w-full min-h-16 text-left py-4 px-4 justify-start whitespace-normal h-auto"
                    onClick={() => handlePqPickOption(idx)}
                    data-testid={`btn-pq-option-${idx}`}
                  >
                    <div className="w-8 h-8 bg-white border-[2px] border-black text-black flex items-center justify-center font-black mr-3 flex-shrink-0 text-sm">
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="flex-1 font-display font-black uppercase text-sm">{opt}</span>
                  </Button>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* True / False */}
          {pqQuestion.type === "true-false" && (
            <div className="grid grid-cols-2 gap-4 pb-6">
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  className="w-full min-h-32 font-display font-black text-3xl uppercase bg-[#00C853] text-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#00C853]/90"
                  onClick={() => handlePqPickTrueFalse(true)}
                  data-testid="btn-pq-true"
                >
                  TRUE
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.96 }}>
                <Button
                  className="w-full min-h-32 font-display font-black text-3xl uppercase bg-[#FF1493] text-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:bg-[#FF1493]/90"
                  onClick={() => handlePqPickTrueFalse(false)}
                  data-testid="btn-pq-false"
                >
                  FALSE
                </Button>
              </motion.div>
            </div>
          )}

          {/* Open-ended */}
          {pqQuestion.type === "open-ended" && (
            <div className="space-y-3 pb-6">
              <Input
                value={pqOpenAnswerInput}
                onChange={(e) => setPqOpenAnswerInput(e.target.value)}
                placeholder="Type your answer…"
                maxLength={120}
                className="text-lg py-6 min-h-12"
                autoFocus
                data-testid="input-pq-open"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePqSubmitOpen();
                  }
                }}
              />
              <p className="text-xs text-black/50 text-center font-sans">
                Spelling counts loosely — typos and minor variations are accepted.
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={handlePqSubmitOpen}
                disabled={!pqOpenAnswerInput.trim()}
                data-testid="btn-pq-submit-open"
              >
                <Send className="w-5 h-5 mr-2" /> Submit
              </Button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ============ PLAYING — Jeopardy ============
  if (gameState === "playing" && gameType === "jeopardy") {
    const myScore = jScores.find((s) => s.id === me?.id)?.score ?? 0;
    const isController = me?.id != null && me.id === jControllerId;
    const isBuzzedIn = jBuzzedInId != null && jBuzzedInId === me?.id;
    const remainingMs = Math.max(0, jTimerEndAt - jNow);
    const secsLeft = Math.ceil(remainingMs / 1000);

    const ScoreBadge = () => (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-sm border-2 ${
        myScore < 0
          ? "bg-destructive/15 border-destructive/50 text-destructive"
          : "bg-yellow-400/15 border-yellow-400/50 text-yellow-300"
      }`}>
        <span className="text-xs uppercase opacity-70">You</span>
        {myScore < 0 ? "-" : ""}${Math.abs(myScore)}
      </div>
    );

    // ---- Final reveal (read-only screen) ----
    if (jFinalReveal) {
      const mine = jFinalReveal.perPlayer.find((p) => p.id === me?.id);
      return (
        <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
          <Award className="w-16 h-16 text-yellow-400" />
          <h1 className="text-3xl font-extrabold font-display">Final Jeopardy</h1>
          <p className="text-sm uppercase font-bold tracking-widest text-muted-foreground">Correct Answer</p>
          <p className="text-3xl font-black text-yellow-300">{jFinalReveal.correctAnswer}</p>
          {mine && (
            <div className={`p-5 rounded-2xl border-2 w-full max-w-sm surface-elevated ${
              mine.correct ? "bg-success/10 border-success/50" : "bg-destructive/10 border-destructive/50"
            }`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {mine.correct
                  ? <Check className="w-6 h-6 text-success" />
                  : <X className="w-6 h-6 text-destructive" />}
                <p className={`text-xl font-extrabold ${mine.correct ? "text-success" : "text-destructive"}`}>
                  {mine.correct ? "Correct!" : "Wrong"}
                </p>
              </div>
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Your Answer</p>
              <p className="text-lg font-bold text-foreground italic">"{mine.answer}"</p>
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground mt-3">Wager</p>
              <p className="text-2xl font-black text-foreground">${mine.wager}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Look at the big screen for standings.</p>
        </div>
      );
    }

    // ---- Final clue: answer input ----
    if (jPhase === "final-clue") {
      const eligible = jFinalEligibleIds.includes(me?.id ?? "");
      if (!eligible) {
        return (
          <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
            <Award className="w-12 h-12 text-yellow-400" />
            <h1 className="text-2xl font-extrabold font-display">Final Jeopardy</h1>
            <p className="text-muted-foreground max-w-sm">You're not eligible for Final (score must be positive). Watch on the big screen.</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col min-h-[100dvh] p-5 sm:p-6">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-yellow-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />Final Jeopardy
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">{jFinalCategory}</p>
            </div>
            <TimerRing value={remainingMs / 1000} total={30} size={56} thickness={6} label={`${secsLeft}s`} />
          </header>
          <main className="flex-1 flex flex-col">
            <Card className="p-5 mb-4 border-2 border-yellow-400/40 bg-card/85">
              <h2 className="text-xl sm:text-2xl font-extrabold font-display leading-snug">{jFinalQuestion}</h2>
            </Card>
            {jFinalAnswerSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
                <CheckCircle2 className="w-16 h-16 text-success" />
                <h2 className="text-2xl font-extrabold">Answer locked in</h2>
                <p className="text-muted-foreground">"{jFinalAnswerInput.trim()}"</p>
                <p className="text-sm text-muted-foreground">Waiting for everyone else…</p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                <Input
                  value={jFinalAnswerInput}
                  onChange={(e) => setJFinalAnswerInput(e.target.value)}
                  placeholder="Your answer…"
                  maxLength={120}
                  className="text-lg py-6 min-h-12 bg-card border-2 border-yellow-400/40 focus-visible:border-yellow-400 focus-visible:ring-yellow-400/30"
                  autoFocus
                  data-testid="input-j-final-answer"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleJSubmitFinalAnswer();
                    }
                  }}
                />
                <Button
                  size="lg"
                  className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950 font-bold"
                  onClick={handleJSubmitFinalAnswer}
                  disabled={!jFinalAnswerInput.trim()}
                  data-testid="btn-j-final-answer-submit"
                >
                  <Send className="w-5 h-5 mr-2" /> Submit Answer
                </Button>
              </div>
            )}
          </main>
        </div>
      );
    }

    // ---- Final wager ----
    if (jPhase === "final-wager") {
      const eligible = jFinalEligibleIds.includes(me?.id ?? "");
      const max = Math.max(0, myScore);
      if (!eligible) {
        return (
          <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
            <Award className="w-12 h-12 text-yellow-400" />
            <h1 className="text-2xl font-extrabold font-display">Final Jeopardy</h1>
            <p className="text-muted-foreground max-w-sm">You're not eligible for Final (score must be positive). Watch on the big screen.</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col min-h-[100dvh] p-5 sm:p-6">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-yellow-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />Final Jeopardy
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">Wager phase</p>
            </div>
            <TimerRing value={remainingMs / 1000} total={30} size={56} thickness={6} label={`${secsLeft}s`} />
          </header>
          <main className="flex-1 flex flex-col">
            <Card className="p-5 mb-4 border-2 border-yellow-400/40 bg-card/85 text-center">
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Category</p>
              <h2 className="text-3xl font-extrabold font-display text-yellow-300 mt-1">{jFinalCategory}</h2>
            </Card>
            {jFinalWagerSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
                <CheckCircle2 className="w-16 h-16 text-success" />
                <h2 className="text-2xl font-extrabold">Wager locked in</h2>
                <p className="text-3xl font-black text-yellow-300">${parseInt(jFinalWagerInput, 10) || 0}</p>
                <p className="text-sm text-muted-foreground">Waiting for the clue…</p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                <div className="text-center mb-2">
                  <p className="text-sm text-muted-foreground">Your score</p>
                  <p className="text-3xl font-black text-foreground">${myScore}</p>
                  <p className="text-xs text-muted-foreground mt-1">Wager $0 – ${max}</p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={jFinalWagerInput}
                  onChange={(e) => setJFinalWagerInput(e.target.value)}
                  placeholder="0"
                  min={0}
                  max={max}
                  className="text-2xl py-6 text-center font-black bg-card border-2 border-yellow-400/40 focus-visible:border-yellow-400 focus-visible:ring-yellow-400/30"
                  autoFocus
                  data-testid="input-j-final-wager"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleJSubmitFinalWager();
                    }
                  }}
                />
                <Button
                  size="lg"
                  className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950 font-bold"
                  onClick={handleJSubmitFinalWager}
                  data-testid="btn-j-final-wager-submit"
                >
                  <Send className="w-5 h-5 mr-2" /> Lock in wager
                </Button>
              </div>
            )}
          </main>
        </div>
      );
    }

    // ---- Final intro: just waiting ----
    if (jPhase === "final-intro") {
      return (
        <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
          <Award className="w-16 h-16 text-yellow-400 drop-shadow-[0_0_24px_hsl(48_100%_60%)]" />
          <h1 className="text-3xl font-extrabold font-display">Final Jeopardy</h1>
          <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Category</p>
          <p className="text-2xl font-extrabold text-yellow-300">{jFinalCategory}</p>
          <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Waiting for the host to start wagering…</p>
        </div>
      );
    }

    // ---- Daily Double: controller wagers ----
    if (jPhase === "dd-wager" && jDailyDouble) {
      if (jDailyDouble.controllerId !== me?.id) {
        return (
          <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
            <Star className="w-16 h-16 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_18px_hsl(48_100%_60%)]" />
            <h1 className="text-3xl font-extrabold font-display text-yellow-300">DAILY DOUBLE</h1>
            <p className="text-muted-foreground">
              <span className="font-bold text-foreground">{jDailyDouble.controllerName}</span> is wagering…
            </p>
            <ScoreBadge />
          </div>
        );
      }
      return (
        <div className="flex flex-col min-h-[100dvh] p-5 sm:p-6">
          <header className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <p className="text-sm uppercase font-bold tracking-widest text-yellow-400">Daily Double</p>
            </div>
            <TimerRing value={remainingMs / 1000} total={20} size={56} thickness={6} label={`${secsLeft}s`} />
          </header>
          <main className="flex-1 flex flex-col">
            <Card className="p-5 mb-4 border-2 border-yellow-400/40 bg-card/85 text-center">
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Category</p>
              <h2 className="text-2xl font-extrabold font-display text-yellow-300 mt-1">{jDailyDouble.category}</h2>
            </Card>
            {jDdSubmitted ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-8">
                <CheckCircle2 className="w-16 h-16 text-success" />
                <h2 className="text-2xl font-extrabold">Wager locked in</h2>
                <p className="text-3xl font-black text-yellow-300">${parseInt(jDdWagerInput, 10) || 0}</p>
                <p className="text-sm text-muted-foreground">Get ready for the clue…</p>
              </div>
            ) : (
              <div className="space-y-3 pb-6">
                <div className="text-center mb-2">
                  <p className="text-sm text-muted-foreground">Your score: <span className="font-bold text-foreground">${myScore}</span></p>
                  <p className="text-xs text-muted-foreground mt-1">Wager $5 – ${jDailyDouble.maxWager}</p>
                </div>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={jDdWagerInput}
                  onChange={(e) => setJDdWagerInput(e.target.value)}
                  placeholder="0"
                  min={5}
                  max={jDailyDouble.maxWager}
                  className="text-2xl py-6 text-center font-black bg-card border-2 border-yellow-400/40 focus-visible:border-yellow-400 focus-visible:ring-yellow-400/30"
                  autoFocus
                  data-testid="input-j-dd-wager"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleJSubmitDdWager();
                    }
                  }}
                />
                <Button
                  size="lg"
                  className="w-full bg-yellow-500 hover:bg-yellow-500/90 text-yellow-950 font-bold"
                  onClick={handleJSubmitDdWager}
                  data-testid="btn-j-dd-wager-submit"
                >
                  <Send className="w-5 h-5 mr-2" /> Lock in wager
                </Button>
              </div>
            )}
          </main>
        </div>
      );
    }

    // ---- Daily Double clue: only controller answers (verbally to host) ----
    if (jPhase === "dd-clue" && jActive) {
      const isCtrl = me?.id === jControllerId;
      return (
        <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
          <Star className="w-12 h-12 text-yellow-400 fill-yellow-400" />
          <h1 className="text-2xl font-extrabold font-display text-yellow-300">Daily Double</h1>
          {isCtrl ? (
            <>
              <p className="text-lg font-bold text-foreground">Your turn — answer out loud!</p>
              <p className="text-muted-foreground text-sm">The host is judging.</p>
              <TimerRing value={remainingMs / 1000} total={15} size={80} thickness={8} label={`${secsLeft}s`} />
            </>
          ) : (
            <>
              <p className="text-muted-foreground">
                <span className="font-bold text-foreground">{jScores.find((s) => s.id === jControllerId)?.name ?? "Player"}</span> is answering on stage.
              </p>
              <ScoreBadge />
            </>
          )}
        </div>
      );
    }

    // ---- Active clue: buzzer / answering / between-clues ----
    if (jActive && (jPhase === "clue-reveal" || jPhase === "buzzer-open" || jPhase === "answering" || jPhase === "between-clues")) {
      // Speaking-to-host moment when player is answering
      if (jPhase === "answering" && isBuzzedIn) {
        return (
          <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-4">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
              className="w-32 h-32 rounded-full flex items-center justify-center bg-yellow-400/20 border-4 border-yellow-400 shadow-[0_0_60px_-4px_hsl(48_100%_60%/0.7)]"
            >
              <Mic className="w-16 h-16 text-yellow-400" />
            </motion.div>
            <h1 className="text-3xl font-extrabold font-display text-yellow-300">You're up!</h1>
            <p className="text-lg text-foreground">Answer out loud — host is judging.</p>
            <TimerRing value={remainingMs / 1000} total={12} size={80} thickness={8} label={`${secsLeft}s`} />
            <ScoreBadge />
          </div>
        );
      }

      return (
        <div className="flex flex-col min-h-[100dvh] p-5 sm:p-6 items-center">
          <header className="w-full mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase font-bold tracking-widest text-muted-foreground">{jActive.category}</p>
              <p className="text-2xl font-black text-yellow-300">${jActive.value}</p>
            </div>
            {jPhase === "buzzer-open" && (
              <TimerRing value={remainingMs / 1000} total={12} size={56} thickness={6} label={`${secsLeft}s`} />
            )}
          </header>

          <Card className="p-4 mb-6 border-2 border-yellow-400/40 bg-card/85 text-center w-full">
            <h2 className="text-xl font-extrabold font-display leading-snug">{jActive.question}</h2>
          </Card>

          {/* The big BUZZ button */}
          {(jPhase === "clue-reveal" || jPhase === "buzzer-open") && (
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleJBuzz}
                disabled={jPhase !== "buzzer-open" || jMyBuzzLockedOut}
                className={`w-56 h-56 rounded-full font-black text-4xl font-display border-4 transition-all ${
                  jPhase === "buzzer-open" && !jMyBuzzLockedOut
                    ? "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-200 text-yellow-950 shadow-[0_0_60px_-4px_hsl(48_100%_60%/0.9)] animate-pulse"
                    : jMyBuzzLockedOut
                    ? "bg-muted/40 border-muted text-muted-foreground cursor-not-allowed"
                    : "bg-card/40 border-border text-muted-foreground cursor-not-allowed"
                }`}
                data-testid="btn-j-buzz"
              >
                <Zap className="w-16 h-16 mx-auto mb-1" />
                {jPhase === "buzzer-open" ? (jMyBuzzLockedOut ? "LOCKED" : "BUZZ!") : "WAIT…"}
              </motion.button>
              <p className="text-sm text-muted-foreground mt-6 text-center max-w-xs">
                {jPhase === "clue-reveal"
                  ? "Read the clue. Buzzer is arming…"
                  : jMyBuzzLockedOut
                  ? "Someone else buzzed first. Sit tight!"
                  : "Buzzer open — tap as fast as you can!"}
              </p>
            </div>
          )}

          {jPhase === "answering" && jBuzzedInName && !isBuzzedIn && (
            <div className="flex-1 flex flex-col items-center justify-center w-full space-y-3">
              <Zap className="w-12 h-12 text-yellow-400" />
              <p className="text-2xl font-extrabold">
                <span className="text-yellow-300">{jBuzzedInName}</span> buzzed in
              </p>
              <p className="text-muted-foreground">Host is judging…</p>
            </div>
          )}

          {jPhase === "between-clues" && jClueRevealedAnswer && (
            <div className="flex-1 flex flex-col items-center justify-center w-full space-y-2">
              <p className="text-xs uppercase font-bold tracking-widest text-yellow-400">Correct Answer</p>
              <p className="text-2xl font-extrabold text-yellow-300 text-center">{jClueRevealedAnswer}</p>
              {jLastResolved && (
                <p className={`text-sm font-bold ${jLastResolved.correct ? "text-success" : "text-destructive"}`}>
                  {jLastResolved.correct ? "+" : "−"}${Math.abs(jLastResolved.delta)}
                </p>
              )}
            </div>
          )}

          <div className="mt-6"><ScoreBadge /></div>
        </div>
      );
    }

    // ---- Picking phase: controller sees pickable board, others wait ----
    if (jBoard) {
      const ctrl = jScores.find((s) => s.id === jControllerId);
      return (
        <div className="flex flex-col min-h-[100dvh] p-4">
          <header className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3x3 className="w-5 h-5 text-yellow-400" />
              <p className="text-sm font-bold uppercase tracking-widest text-yellow-400">Jeopardy</p>
            </div>
            <ScoreBadge />
          </header>
          {isController ? (
            <p className="text-center text-sm text-foreground mb-3">
              <span className="font-extrabold text-yellow-300">Your pick!</span> Tap any open square.
            </p>
          ) : (
            <p className="text-center text-sm text-muted-foreground mb-3">
              <span className="font-bold text-foreground">{ctrl?.name ?? "Player"}</span> is picking the next clue.
            </p>
          )}

          <div className="grid grid-cols-6 gap-1 w-full mb-3">
            {jBoard.categories.map((cat, ci) => (
              <div
                key={ci}
                className="bg-gradient-to-b from-blue-700 to-blue-900 rounded px-1 py-1.5 text-center border border-blue-400/40"
              >
                <p className="text-[8px] sm:text-[10px] font-extrabold uppercase tracking-tight text-yellow-200 leading-tight line-clamp-2">
                  {cat.name}
                </p>
              </div>
            ))}
            {[0, 1, 2, 3, 4].map((row) =>
              jBoard.categories.map((cat, ci) => {
                const clue = cat.clues[row];
                if (!clue) return null;
                const disabled = clue.revealed || !isController;
                return (
                  <button
                    key={`${ci}-${row}`}
                    onClick={() => handleJPickSquare(ci, row)}
                    disabled={disabled}
                    className={`aspect-[3/2] rounded font-black border transition-all ${
                      clue.revealed
                        ? "bg-blue-950/40 border-blue-900/40 text-transparent"
                        : isController
                        ? "bg-gradient-to-b from-blue-700 to-blue-900 border-blue-400/40 text-yellow-300 active:scale-95 hover:border-yellow-300"
                        : "bg-gradient-to-b from-blue-800 to-blue-950 border-blue-600/30 text-yellow-300/60 cursor-not-allowed"
                    }`}
                    data-testid={`btn-j-square-${ci}-${row}`}
                  >
                    {!clue.revealed && (
                      <span className="text-xs sm:text-sm">${clue.value}</span>
                    )}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      );
    }

    // Fallback
    return (
      <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-3">
        <Loader2 className="w-12 h-12 text-yellow-400 animate-spin" />
        <p className="text-lg text-muted-foreground">Loading Jeopardy…</p>
      </div>
    );
  }

  // ============ WHEEL OF FORTUNE ============
  if (gameType === "wheel-of-fortune" && gameState === "playing") {
    const isMyTurn = me?.id === wofControllerId;
    const VOWELS_SET = new Set(["A", "E", "I", "O", "U"]);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const myScore = wofScores.find(s => s.id === me?.id);

    const canSpin = isMyTurn && wofPhase === "spinning" && !wofSolvePending;
    const canGuessConsonant = isMyTurn && wofPhase === "guessing" && !wofSolvePending;
    const canBuyVowel = isMyTurn && wofPhase === "spinning" && !wofSolvePending && (myScore?.roundEarnings ?? 0) >= 250;
    const canSolve = isMyTurn && (wofPhase === "spinning" || wofPhase === "guessing");

    const spinValueLabel = (v: WofWheelValue | null): string => {
      if (v === null) return "";
      if (v === "BANKRUPT") return "BANKRUPT!";
      if (v === "LOSE_A_TURN") return "LOSE A TURN";
      if (v === "FREE_PLAY") return "FREE PLAY";
      return `$${(v as number).toLocaleString()}`;
    };

    const handleSpin = () => {
      socket?.emit("wof-spin", { roomCode });
      hapticTap();
    };

    const handleGuessLetter = (letter: string) => {
      if (wofGuessedLetters.includes(letter)) return;
      socket?.emit("wof-guess-letter", { roomCode, letter });
      hapticTap();
    };

    const handleSolve = () => {
      if (!wofSolveInput.trim()) return;
      socket?.emit("wof-solve-attempt", { roomCode, answer: wofSolveInput.trim() });
      setWofSolveSubmitted(true);
      hapticTap();
    };

    if (wofPuzzleOver) {
      return (
        <div className="flex flex-col min-h-[100dvh] bg-[#7C3AED] items-center justify-center text-center p-6 space-y-5">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }} className="space-y-3">
            <p className="font-display font-black text-white/70 uppercase tracking-widest text-lg">Puzzle Solved!</p>
            <h1 className="font-display font-black text-white text-4xl uppercase">{wofPuzzleOver.answer}</h1>
            {myScore && (
              <p className="font-display font-black text-[#FFD700] text-2xl">${myScore.score.toLocaleString()} total</p>
            )}
          </motion.div>
          <p className="text-white/60 font-sans text-sm">
            {wofPuzzleOver.isLastPuzzle ? "Wait for final standings…" : "Host will advance to next puzzle…"}
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#FFF8E7]">
        {/* Header */}
        <div className="bg-[#7C3AED] border-b-[4px] border-black px-4 py-3 flex justify-between items-center">
          <div className="font-display font-black text-white uppercase tracking-wide text-sm">
            Puzzle {wofPuzzleIndex + 1}/{wofTotalPuzzles}
          </div>
          <div className="font-display font-black text-[#FFD700] text-lg">
            ${myScore?.score.toLocaleString() ?? "0"}
          </div>
        </div>

        {/* Board (compact) */}
        <div className="px-3 py-4 bg-black/5 border-b-[3px] border-black">
          <p className="font-display font-black text-black/50 uppercase text-xs tracking-widest text-center mb-3">{wofCategory}
            {wofHint && <span className="ml-2 text-black/30 font-normal normal-case tracking-normal">({wofHint})</span>}
          </p>
          <div className="flex flex-col items-center gap-1.5">
            {wofBoard.map((word, wi) => (
              <div key={wi} className="flex flex-wrap justify-center gap-1">
                {word.map((cell, ci) => (
                  <motion.div key={`${wi}-${ci}`}
                    animate={{ backgroundColor: cell.revealed ? "#FFD700" : "#fff" }}
                    transition={{ duration: 0.3 }}
                    className="w-8 h-9 flex items-center justify-center border-[2px] border-black shadow-[1px_1px_0_#000] font-display font-black text-sm">
                    {cell.revealed ? cell.letter : ""}
                  </motion.div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Game area */}
        <div className="flex-1 flex flex-col px-4 py-4 gap-4 overflow-auto">
          {/* Turn indicator */}
          <AnimatePresence mode="wait">
            {isMyTurn ? (
              <motion.div key="myturn" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-[#7C3AED] border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-3 text-center">
                <p className="font-display font-black text-white uppercase text-lg tracking-wide">Your Turn!</p>
              </motion.div>
            ) : (
              <motion.div key="notmyturn" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white border-[3px] border-black px-4 py-3 text-center">
                <p className="font-display font-black text-black/60 uppercase text-sm tracking-wide">
                  {wofScores.find(s => s.id === wofControllerId)?.name ?? "Player"}'s turn
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Last spin display */}
          <AnimatePresence mode="wait">
            {wofLastSpin !== null && !wofPuzzleOver && (
              <motion.div key={String(wofLastSpin)} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`border-[3px] border-black px-4 py-3 text-center ${wofSpinType === "bankrupt" ? "bg-black text-white" : wofSpinType === "free-play" ? "bg-[#00C853] text-white" : "bg-[#FFD700] text-black"}`}>
                <p className="font-display font-black text-2xl uppercase">{spinValueLabel(wofLastSpin)}</p>
                {wofLastLetter && (
                  <p className="font-display font-black text-sm uppercase mt-1">
                    "{wofLastLetter.letter}" — {wofLastLetter.count > 0 ? `${wofLastLetter.count} found!` : "Not in puzzle"}
                  </p>
                )}
              </motion.div>
            )}
            {wofSolveResult && (
              <motion.div key="solve" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className={`border-[3px] border-black px-4 py-3 text-center ${wofSolveResult.correct ? "bg-[#00C853] text-white" : "bg-black text-white"}`}>
                <p className="font-display font-black text-xl uppercase">
                  {wofSolveResult.correct ? `✓ ${wofSolveResult.solverName} solved it!` : `✗ Wrong — turn passes`}
                </p>
                {wofSolveResult.answer && <p className="text-sm font-sans mt-1 opacity-80">{wofSolveResult.answer}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          {isMyTurn && wofPhase !== "puzzle-over" && (
            <div className="flex flex-col gap-3">
              {/* Spin button */}
              {canSpin && (
                <Button onClick={handleSpin} className="w-full py-6 text-xl font-display font-black uppercase bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white border-[3px] border-black shadow-[4px_4px_0_#000]">
                  🎡 Spin the Wheel!
                </Button>
              )}

              {/* Guess consonant keyboard (or all letters on FREE PLAY) */}
              {canGuessConsonant && (
                <div>
                  <p className="font-display font-black text-black/60 uppercase text-xs tracking-widest mb-2">
                    {wofIsFreePlay ? "FREE PLAY — Pick Any Letter!" : "Pick a Consonant"}
                  </p>
                  {wofIsFreePlay && (
                    <p className="text-xs text-[#00C853] font-display font-black uppercase tracking-widest mb-2">Vowels included — no charge!</p>
                  )}
                  <div className="grid grid-cols-7 gap-1">
                    {(wofIsFreePlay ? alphabet : alphabet.filter(l => !VOWELS_SET.has(l))).map(l => {
                      const used = wofGuessedLetters.includes(l);
                      const isVowel = VOWELS_SET.has(l);
                      return (
                        <button key={l} onClick={() => !used && handleGuessLetter(l)} disabled={used}
                          className={`h-10 flex items-center justify-center border-[2px] border-black font-display font-black text-base
                            ${used ? "bg-black text-white/30 cursor-not-allowed"
                              : isVowel && wofIsFreePlay ? "bg-[#00C853] hover:bg-[#00C853]/80 active:scale-95 shadow-[2px_2px_0_#000] text-white"
                              : "bg-white hover:bg-[#FFD700] active:scale-95 shadow-[2px_2px_0_#000]"}`}
                          data-testid={`btn-wof-letter-${l}`}>
                          {l}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Solve attempt (typed + verbal) */}
              {canSolve && !wofSolveSubmitted && !wofSpeakNow && (
                <div className="flex flex-col gap-2">
                  <p className="font-display font-black text-black/60 uppercase text-xs tracking-widest">Try to Solve</p>
                  <div className="flex gap-2">
                    <Input value={wofSolveInput} onChange={e => setWofSolveInput(e.target.value.toUpperCase())}
                      placeholder="TYPE THE ANSWER…"
                      className="flex-1 border-[2px] border-black font-display font-black uppercase text-base"
                      onKeyDown={e => e.key === "Enter" && handleSolve()}
                    />
                    <Button onClick={handleSolve} disabled={!wofSolveInput.trim()}
                      className="bg-[#FF1493] text-white border-[2px] border-black font-display font-black uppercase hover:bg-[#FF1493]/90">
                      Solve!
                    </Button>
                  </div>
                  <Button
                    onClick={() => {
                      socket?.emit("wof-solve-verbal", { roomCode });
                      setWofSpeakNow(true);
                      hapticTap();
                    }}
                    className="w-full bg-[#7C3AED] hover:bg-[#7C3AED]/90 text-white border-[2px] border-black font-display font-black uppercase"
                    data-testid="btn-wof-say-it"
                  >
                    🎤 Say It Out Loud
                  </Button>
                </div>
              )}

              {/* Verbal solve — speak now screen */}
              {canSolve && wofSpeakNow && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#7C3AED] border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-5 text-center flex flex-col gap-3"
                >
                  <p className="font-display font-black text-white text-4xl">🎤</p>
                  <p className="font-display font-black text-white uppercase text-xl tracking-widest">Speak Now!</p>
                  <p className="text-white/70 font-sans text-sm">Host is listening — say your answer out loud</p>
                  <div className="flex justify-center">
                    <div className="w-5 h-5 border-4 border-white border-t-transparent animate-spin rounded-full" />
                  </div>
                </motion.div>
              )}

              {/* Waiting for host to judge typed solve */}
              {canSolve && wofSolveSubmitted && !wofSpeakNow && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-[#FF1493] border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-4 text-center"
                >
                  <p className="font-display font-black text-white uppercase text-lg tracking-widest">Answer Submitted!</p>
                  <p className="text-white/80 font-sans text-sm mt-1">Waiting for host to judge…</p>
                  <div className="flex justify-center mt-2">
                    <div className="w-5 h-5 border-4 border-white border-t-transparent animate-spin rounded-full" />
                  </div>
                </motion.div>
              )}

              {/* Buy vowel — explicit action button leading into vowel picker */}
              {isMyTurn && wofPhase === "spinning" && !wofSolvePending && (
                <div>
                  {!wofVowelMode ? (
                    <Button
                      onClick={() => canBuyVowel && setWofVowelMode(true)}
                      disabled={!canBuyVowel}
                      className={`w-full py-5 text-base font-display font-black uppercase border-[3px] border-black
                        ${canBuyVowel
                          ? "bg-[#00E5FF] hover:bg-[#00E5FF]/80 text-black shadow-[4px_4px_0_#000]"
                          : "bg-gray-200 text-black/30 cursor-not-allowed border-black/30"}`}
                    >
                      🔤 Buy a Vowel — $250{!canBuyVowel && " (need more funds)"}
                    </Button>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-display font-black text-black/60 uppercase text-xs tracking-widest">Pick a Vowel ($250)</p>
                        <button onClick={() => setWofVowelMode(false)} className="text-black/40 text-xs font-display font-black uppercase hover:text-black">✕ Cancel</button>
                      </div>
                      <div className="flex gap-1">
                        {["A","E","I","O","U"].map(l => {
                          const used = wofGuessedLetters.includes(l);
                          return (
                            <button key={l} onClick={() => { if (!used) { setWofVowelMode(false); socket?.emit("wof-buy-vowel", { roomCode, letter: l }); } }} disabled={used}
                              className={`flex-1 h-12 flex items-center justify-center border-[2px] border-black font-display font-black text-lg
                                ${used ? "bg-black text-white/30 cursor-not-allowed" : "bg-[#00E5FF] hover:bg-[#00E5FF]/80 active:scale-95 shadow-[2px_2px_0_#000] text-black"}`}>
                              {l}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Used letters — always visible */}
          <div>
            <p className="font-display font-black text-black/40 uppercase text-xs tracking-widest mb-2">Used Letters</p>
            <div className="flex flex-wrap gap-1">
              {alphabet.map(l => {
                const used = wofGuessedLetters.includes(l);
                const revealed = wofRevealedLetters.includes(l);
                const isVowel = VOWELS_SET.has(l);
                return (
                  <div key={l} className={`w-8 h-8 flex items-center justify-center border-[2px] border-black font-display font-black text-xs
                    ${used ? (revealed ? "bg-[#FFD700] text-black" : "bg-black text-white/50") : isVowel ? "bg-[#00E5FF]/20 text-black/60" : "bg-white text-black/60"}`}>
                    {l}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scoreboard */}
          <div className="mt-auto">
            <p className="font-display font-black text-black/40 uppercase text-xs tracking-widest mb-2">Scores</p>
            <div className="space-y-1">
              {[...wofScores].sort((a, b) => b.score - a.score).map((s) => (
                <div key={s.id} className={`flex justify-between items-center px-3 py-2 border-[2px] border-black ${s.id === me?.id ? "bg-[#7C3AED] text-white" : s.id === wofControllerId ? "bg-[#FFD700] text-black" : "bg-white text-black"}`}>
                  <span className="font-display font-black text-sm uppercase truncate max-w-[120px]">{s.name}</span>
                  <div className="flex flex-col items-end">
                    <span className="font-display font-black text-sm">${s.score.toLocaleString()}</span>
                    {s.roundEarnings > 0 && (
                      <span className={`font-display font-black text-xs ${s.id === me?.id ? "text-white/70" : "text-black/50"}`}>+${s.roundEarnings.toLocaleString()} this round</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ FINISHED ============
  if (gameState === "finished") {
    const myScore = players.find((p) => p.id === me?.id)?.score || 0;

    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#FFD700] items-center justify-center text-center space-y-8 p-6">
        <h1 className="font-display font-black text-5xl uppercase comic-headline">Game Over</h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="bg-white border-[3px] border-black shadow-[6px_6px_0_#000] p-8 w-full max-w-sm"
        >
          <p className="text-black/60 font-sans mb-2">You scored</p>
          <div className="font-display font-black text-black text-6xl uppercase">
            <CountUp value={myScore} duration={1.6} />
          </div>
          <p className="text-black/60 font-sans mt-2">points</p>
        </motion.div>
        <p className="text-black/60 font-sans">Look at the big screen for final standings.</p>
      </div>
    );
  }

  return null;
}
