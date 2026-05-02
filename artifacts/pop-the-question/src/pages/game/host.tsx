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
  gameType: string;
  quizPackId?: string | null;
  quizPackSummary?: QuizPackSummary | null;
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

    newSocket.on("room-state", ({ players: ps, isDemo: demo, gameType: gt, quizPackId }: RoomStatePayload) => {
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
      }
    });

    newSocket.on("game-started", (payload: GameStartedPayload & { pack?: QuizPackSummary }) => {
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
        setPqPack(pack ?? null);
        setPqReveal(null);
        setPqRoundSummary(null);
        setPqAnsweredCount(0);
      }
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

    newSocket.on("game-ended", (payload: PlayersOnlyPayload & { finalScores?: QuizLeaderboardRow[] }) => {
      const { players: ps, finalScores } = payload;
      setGameState("finished");
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
      if (finalScores) setPqLeaderboard(finalScores);
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

  const DemoBadge = () =>
    isDemo ? (
      <div className="flex items-center gap-2 bg-primary/20 border border-primary/40 text-primary px-4 py-2 rounded-full font-bold text-lg shadow-[0_0_18px_-4px_hsl(var(--primary))]">
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
      transition={{ type: "spring", stiffness: 360, damping: 18 }}
      className={`text-2xl font-bold px-6 py-4 rounded-xl border flex items-center gap-2 surface-elevated
        ${p.isBot
          ? "bg-primary/10 border-primary/30 text-muted-foreground"
          : "bg-background border-secondary/40 shadow-[0_0_24px_-8px_hsl(var(--secondary)/0.6)]"
        }`}
    >
      {p.isBot && <Bot className="w-5 h-5 text-primary/60" />}
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
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-bold ${
                state === "answered"
                  ? "bg-success/10 border-success/40 text-success"
                  : "bg-card/60 border-border text-foreground"
              } ${isRemote ? "text-sm" : "text-xs"}`}
            >
              {p.isBot && <Bot className="w-3.5 h-3.5 text-primary/60" />}
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
        className={`relative w-full text-left rounded-2xl border-2 p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary
          ${selected
            ? "border-secondary bg-secondary/10 shadow-[0_0_24px_-6px_hsl(var(--secondary)/0.6)]"
            : "border-border bg-card/60 hover:border-border/80 hover:bg-card/80"
          }`}
        data-testid={`pack-card-${id ?? "random"}`}
        aria-pressed={selected}
      >
        {selected && (
          <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-secondary flex items-center justify-center shadow-[0_0_12px_-2px_hsl(var(--secondary))]">
            <Check className="w-3.5 h-3.5 text-secondary-foreground font-black" />
          </span>
        )}

        <div className="flex items-start gap-2 mb-2">
          {isRandom
            ? <Shuffle className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
            : <Beer className="w-4 h-4 text-secondary mt-0.5 flex-shrink-0" />
          }
          <h3 className="font-bold text-base text-foreground leading-tight pr-6">{title}</h3>
        </div>

        <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">{description}</p>

        {!isRandom && (
          <div className="space-y-1">
            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
              <span>{roundCount} {roundCount === 1 ? "round" : "rounds"}</span>
              <span>·</span>
              <span>{questionCount} questions</span>
            </div>
            {rounds.length > 0 && (
              <div className="flex flex-col gap-0.5 mt-2">
                {rounds.map((r, i) => {
                  const meta = ROUND_TYPE_META[r.type];
                  return (
                    <div key={i} className={`flex items-center gap-1.5 text-xs ${meta?.color ?? "text-muted-foreground"}`}>
                      {meta?.icon}
                      <span className="truncate opacity-90">{r.name}</span>
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-foreground px-4">
        <div className="flex items-center gap-4 mb-6">
          <DemoBadge />
        </div>
        <p className="text-3xl font-bold text-muted-foreground uppercase tracking-[0.2em] mb-4 text-center">
          <TypingText text="Go to popthequestion.com and enter code" speedMs={28} caret={false} />
        </p>

        <motion.h1
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="text-[8rem] sm:text-[10rem] md:text-[12rem] font-black font-display tracking-[0.18em] leading-none mb-12 drop-shadow-[0_0_60px_hsl(var(--primary)/0.4)]"
        >
          <RainbowText text={roomCode} glow />
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-5xl bg-card/85 backdrop-blur rounded-3xl p-8 border-2 border-border/50 surface-elevated mb-12"
        >
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-border">
            <Users className="w-8 h-8 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary))]" />
            <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight">
              Players (<CountUp value={players.length} duration={0.4} />)
              {isDemo && <span className="ml-3 text-lg font-normal text-muted-foreground">· {players.filter(p => p.isBot).length} AI</span>}
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
                <div className="w-full flex items-center justify-center text-2xl text-muted-foreground animate-pulse">
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
              <Beer className="w-6 h-6 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary))]" />
              <h2 className="text-2xl font-bold font-display tracking-tight text-foreground">
                Choose a Pack
              </h2>
              {selectedPackId === null && (
                <span className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
                  Random is selected
                </span>
              )}
            </div>

            {availablePacks.length === 0 ? (
              <div className="text-muted-foreground animate-pulse text-lg">Loading packs…</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Random option */}
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
      </div>
    );
  };

  const renderFinished = () => {
    const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const top3 = sortedPlayers.slice(0, 3);
    const rest = sortedPlayers.slice(3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = ["h-44", "h-60", "h-32"];
    const colors = [
      "bg-gradient-to-t from-zinc-500 to-zinc-300 text-zinc-900",
      "bg-gradient-to-t from-yellow-600 to-yellow-300 text-yellow-950 shadow-[0_0_60px_-10px_hsl(48_100%_60%/0.8)]",
      "bg-gradient-to-t from-amber-700 to-amber-400 text-amber-950",
    ];
    const ranks = ["2nd", "1st", "3rd"];

    return (
      <div className="flex-1 flex flex-col text-foreground items-center justify-center relative overflow-hidden">
        {isDemo && (<div className="absolute top-6 right-6"><DemoBadge /></div>)}
        <Trophy className="w-24 h-24 text-[hsl(var(--gold))] mb-6 drop-shadow-[0_0_24px_hsl(var(--gold)/0.5)]" />
        <h1 className="text-4xl md:text-6xl font-extrabold font-display tracking-tight text-foreground text-center mb-3">
          FINAL STANDINGS
        </h1>
        <div className="heading-divider heading-divider--gold w-24 h-1 mb-12" />

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
                <div className="text-2xl md:text-3xl font-extrabold font-display tracking-tight mb-3 flex items-center gap-2">
                  {p.isBot && <Bot className="w-5 h-5 text-primary/60" />}
                  <RainbowText text={p.name} startIndex={idx} />
                </div>
                <div className="text-3xl font-black text-accent mb-2 drop-shadow-[0_0_8px_hsl(var(--accent))]">
                  <CountUp value={p.score ?? 0} duration={1.6} /> pts
                </div>
                <div className={`w-full ${heights[idx]} ${colors[idx]} rounded-t-2xl flex items-center justify-center font-black text-4xl md:text-5xl font-display border-t-4 border-white/40`}>
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
                className="flex items-center justify-between p-4 rounded-xl bg-card/80 border border-border surface-elevated"
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black text-muted-foreground w-12 text-center">#{i + 4}</span>
                  <span className="text-2xl font-bold flex items-center gap-2">
                    {p.isBot && <Bot className="w-5 h-5 text-primary/60" />}
                    {p.name}
                  </span>
                </div>
                <span className="text-2xl font-bold text-accent">
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
      <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
        <header className="flex justify-between items-center mb-8 relative z-10">
          <div className="text-2xl font-bold text-muted-foreground tracking-widest bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
            ROOM: <span className="text-foreground">{roomCode}</span>
          </div>
          {isDemo && <DemoBadge />}
          <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
            Question <span className="text-foreground"><CountUp value={questionIndex + 1} duration={0.4} /></span>
          </div>
        </header>

        {/* Remote-mode "Waiting for votes" indicator */}
        {showRemoteWaiting && (
          <div className="flex justify-center mb-4">
            <div
              className="inline-flex items-center gap-2 rounded-full bg-secondary/15 border border-secondary/40 px-4 py-2 text-base font-bold text-secondary"
              data-testid="remote-waiting-indicator"
            >
              <span className="inline-block w-2 h-2 rounded-full bg-secondary animate-pulse" />
              ⏱ Waiting for votes {votesIn}/{total}
            </div>
          </div>
        )}

        {/* Player status bar — visible during voting and results */}
        <PlayerStatusBar />

        {/* Voice-only host hint */}
        {settings.answerMethod === "voice" && !resultsRevealed && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-sm font-bold text-accent">
              <Mic className="w-4 h-4" /> Voice mode — players shout, you'll mark correct
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
              className="text-5xl md:text-[4.5rem] leading-tight font-extrabold font-display tracking-tight text-center mb-12"
            >
              {currentQuestion || "Loading question..."}
            </motion.h2>
          </AnimatePresence>

          {!resultsRevealed ? (
            <div className="flex flex-col items-center w-full">
              <div className="text-4xl font-bold mb-8">
                <span className="text-secondary text-glow-secondary"><CountUp value={votesIn} duration={0.5} /></span>
                <span className="text-muted-foreground"> / {total} Votes In</span>
              </div>
              <div className="w-full max-w-3xl bg-card rounded-full h-8 overflow-hidden border border-border mb-12 surface-elevated">
                <motion.div
                  className="bg-gradient-to-r from-secondary via-primary to-accent h-full shimmer-sweep"
                  animate={{ width: `${(votesIn / Math.max(1, total)) * 100}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <Button
                size="lg"
                onClick={handleRevealResults}
                disabled={votesIn === 0}
                className="text-3xl px-12 py-8 bg-accent hover:bg-accent/90 text-accent-foreground shadow-[0_8px_40px_-8px_hsl(var(--accent)/0.7)]"
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
              <div className="space-y-6 mb-12">
                {sortedVotes.map(([playerId, count], i) => {
                  const player = players.find((p) => p.id === playerId);
                  if (!player) return null;
                  const percentage = (count / Math.max(1, total)) * 100;
                  const isBurned = playerId === burnedPlayerId;
                  return (
                    <div key={playerId} className="relative">
                      <div className="flex justify-between text-3xl font-bold mb-2 relative z-10 px-4">
                        <span className="flex items-center gap-2">
                          {i === 0 && <Crown className="w-8 h-8 text-yellow-400 drop-shadow-[0_0_8px_hsl(48_100%_60%)]" />}
                          {player.isBot && <Bot className="w-6 h-6 text-primary/60" />}
                          <span className={isBurned ? "text-accent text-glow-accent animate-fire" : ""}>{player.name}</span>
                          {isBurned && <Flame className="w-7 h-7 text-accent drop-shadow-[0_0_8px_hsl(var(--accent))]" />}
                        </span>
                        <span><CountUp value={count} duration={1} /> {count === 1 ? "vote" : "votes"}</span>
                      </div>
                      <div className="relative h-16 bg-card rounded-2xl overflow-hidden border border-border">
                        {isBurned && (
                          <ParticleRain emoji="🔥" variant="fire" density={1} />
                        )}
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 1, delay: i * 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className={`relative h-full ${i === 0 ? "bg-gradient-to-r from-primary to-accent shimmer-sweep" : "bg-muted"}`}
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
        <div className="flex-1 flex flex-col text-foreground items-center justify-center relative">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <div className="text-2xl font-bold text-muted-foreground mb-6 uppercase tracking-widest">
            Round <span className="text-foreground"><CountUp value={rrRound} duration={0.4} /></span> of {rrTotalRounds}
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-foreground mb-3">
            WRITING ROASTS
          </h1>
          <div className="heading-divider heading-divider--orange w-20 h-1 mb-8" />

          {showRemoteWaiting && (
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/15 border border-accent/40 px-4 py-2 text-base font-bold text-accent">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              ⏱ Waiting for roasts {rrSubmitted}/{rrTotal}
            </div>
          )}

          <PlayerStatusBar />

          <div className="w-full max-w-2xl bg-card/85 backdrop-blur rounded-3xl p-8 border-2 border-border surface-elevated mb-8">
            <div className="flex justify-between text-3xl font-bold mb-6">
              <span>Submitted</span>
              <span className="text-primary text-glow-primary">
                <CountUp value={rrSubmitted} duration={0.5} />/{rrTotal}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
              <motion.div
                animate={{ width: `${(rrSubmitted / Math.max(1, rrTotal)) * 100}%` }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-gradient-to-r from-primary via-accent to-secondary shimmer-sweep"
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
                className={`px-5 py-3 rounded-full font-bold text-xl flex items-center gap-2 border surface-elevated
                  ${p.isBot ? "bg-primary/10 border-primary/30 text-muted-foreground" : "bg-card border-border"}`}
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
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <header className="flex justify-between items-center mb-6 relative z-10">
            <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
              ROOM: <span className="text-foreground">{roomCode}</span>
            </div>
            <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
              Reveal <span className="text-foreground"><CountUp value={rrRevealIndex + 1} duration={0.4} /></span> of {rrTotalReveals}
            </div>
          </header>

          {/* Remote-mode picker indicator */}
          {settings.mode === "remote" && rrCurrentRevealName && (
            <div className="flex justify-center mb-4">
              <div
                className="inline-flex items-center gap-2 rounded-full bg-secondary/15 border border-secondary/40 px-4 py-2 text-base font-bold text-secondary"
                data-testid="remote-picker-indicator"
              >
                <Eye className="w-4 h-4" />
                {isPickingBot ? "🤖" : "🎤"} {rrCurrentRevealName} is picking favorites…
              </div>
            </div>
          )}

          <main className="flex-1 flex flex-col items-center justify-center relative z-10">
            <p className="text-2xl text-muted-foreground mb-4 font-semibold uppercase tracking-widest">Roasting</p>
            <AnimatePresence mode="wait">
              <motion.h1
                key={rrCurrentRevealName}
                initial={{ opacity: 0, scale: 0.85, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="text-5xl md:text-7xl lg:text-[6rem] font-extrabold font-display tracking-tight mb-12 text-center text-foreground"
              >
                {rrCurrentRevealName}
              </motion.h1>
            </AnimatePresence>

            <div className="w-full max-w-5xl grid gap-6 mb-12">
              <AnimatePresence mode="popLayout">
                {Object.entries(rrCard).map(([color, entry], idx) => {
                  const question = rrQuestions.find((q) => q.color === color);
                  return (
                    <motion.div
                      key={`${rrCurrentRevealName}-${color}`}
                      initial={{ opacity: 0, x: 80 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -80 }}
                      transition={{
                        type: "spring",
                        stiffness: 240,
                        damping: 22,
                        delay: idx * 0.08,
                      }}
                      className="bg-card/85 backdrop-blur rounded-2xl p-6 border-2 border-border surface-elevated"
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className="w-4 self-stretch min-h-[48px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: color === "gray" ? "#6b7280" : color }}
                        />
                        <div>
                          {question && (
                            <p className="text-xl text-muted-foreground mb-2">{question.question}</p>
                          )}
                          <p className="text-3xl font-bold">{entry.answer}</p>
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
        <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
          {isDemo && <div className="absolute top-6 right-6 z-20"><DemoBadge /></div>}
          <header className="flex justify-between items-center mb-8 relative z-10">
            <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
              ROOM: <span className="text-foreground">{roomCode}</span>
            </div>
            <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
              Round <span className="text-foreground">{pqRoundSummary.roundIndex + 1}</span> / {pqRoundSummary.totalRounds}
            </div>
          </header>

          <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full relative z-10">
            <p className="text-2xl text-muted-foreground uppercase tracking-widest font-bold mb-2">Round Complete</p>
            <h1 className="text-5xl md:text-7xl font-extrabold font-display tracking-tight text-center mb-2">
              <RainbowText text={pqRoundSummary.roundName} />
            </h1>
            <div className="heading-divider heading-divider--green w-20 h-1 mb-12" />

            <div className="w-full max-w-3xl space-y-3 mb-12">
              {pqRoundSummary.leaderboard.slice(0, 8).map((row, i) => (
                <motion.div
                  key={row.id}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, type: "spring", stiffness: 200, damping: 22 }}
                  className={`flex items-center justify-between bg-card/85 backdrop-blur rounded-2xl p-5 border-2 surface-elevated ${
                    i === 0 ? "border-primary/60 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.7)]" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-xl ${
                      i === 0 ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {i + 1}
                    </div>
                    {i === 0 && <Crown className="w-7 h-7 text-yellow-400 drop-shadow-[0_0_8px_hsl(48_100%_60%)]" />}
                    {row.isBot && <Bot className="w-5 h-5 text-primary/60" />}
                    <span className="text-2xl font-bold">{row.name}</span>
                  </div>
                  <div className="text-3xl font-extrabold text-primary text-glow-primary">
                    <CountUp value={row.score} duration={1} />
                  </div>
                </motion.div>
              ))}
            </div>

            {top && (
              <p className="text-lg text-muted-foreground mt-2">
                Leading: <span className="font-bold text-foreground">{top.name}</span> with {top.score} pts
              </p>
            )}
          </main>
        </div>
      );
    }

    // ---- Loading state ----
    if (!pqQuestion) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center relative">
          {isDemo && <div className="absolute top-6 right-6"><DemoBadge /></div>}
          <Beer className="w-20 h-20 text-secondary mb-6" />
          <h1 className="text-4xl font-extrabold font-display">Loading next question…</h1>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col text-foreground relative overflow-hidden">
        {isDemo && <div className="absolute top-6 right-6 z-20"><DemoBadge /></div>}

        <header className="flex justify-between items-center mb-6 relative z-10">
          <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
            ROOM: <span className="text-foreground">{roomCode}</span>
          </div>
          <div className="text-xl font-bold uppercase tracking-widest text-secondary bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-secondary/40 surface-elevated">
            <Beer className="w-5 h-5 inline mr-2 -mt-1" />
            {pqQuestion.roundName}
          </div>
          <div className="text-2xl font-bold text-muted-foreground bg-card/80 backdrop-blur px-6 py-3 rounded-full border border-border surface-elevated">
            Q <span className="text-foreground">{pqQuestion.questionIndex + 1}</span>
            <span className="text-muted-foreground/60">/{pqQuestion.questionsInRound}</span>
            <span className="mx-3 text-muted-foreground/40">·</span>
            R <span className="text-foreground">{pqQuestion.roundIndex + 1}</span>
            <span className="text-muted-foreground/60">/{pqQuestion.totalRounds}</span>
          </div>
        </header>

        {/* Player status bar — visible during the question */}
        <PlayerStatusBar />

        <main className="flex-1 flex flex-col items-center justify-center relative z-10 max-w-6xl mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.h2
              key={`pq-${pqQuestion.roundIndex}-${pqQuestion.questionIndex}`}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              className="text-4xl md:text-6xl leading-tight font-extrabold font-display tracking-tight text-center mb-10"
            >
              {pqQuestion.prompt}
            </motion.h2>
          </AnimatePresence>

          {/* Multiple choice */}
          {pqQuestion.type === "multiple-choice" && pqQuestion.options && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl mb-10">
              {pqQuestion.options.map((opt, idx) => {
                const isCorrect = pqReveal && pqReveal.correctOptionIndex === idx;
                const isWrong = pqReveal && pqReveal.correctOptionIndex !== idx;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.06 }}
                    className={`rounded-2xl p-6 border-2 surface-elevated text-2xl font-bold flex items-center gap-4 transition-all ${
                      pqReveal
                        ? isCorrect
                          ? "bg-success/20 border-success shadow-[0_0_30px_-8px_hsl(var(--success))]"
                          : "bg-card/40 border-border opacity-50"
                        : "bg-card/85 border-border"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                      pqReveal && isCorrect ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="flex-1">{opt}</span>
                    {pqReveal && isCorrect && <Check className="w-7 h-7 text-success" />}
                    {pqReveal && isWrong && <X className="w-6 h-6 text-muted-foreground/40" />}
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
                    className={`rounded-3xl p-12 border-2 text-center text-5xl font-black surface-elevated transition-all ${
                      pqReveal
                        ? isCorrect
                          ? "bg-success/20 border-success shadow-[0_0_40px_-8px_hsl(var(--success))]"
                          : "bg-card/40 border-border opacity-40"
                        : val ? "bg-success/10 border-success/40" : "bg-destructive/10 border-destructive/40"
                    }`}
                  >
                    {label}
                    {pqReveal && isCorrect && <div className="mt-3"><Check className="w-12 h-12 text-success mx-auto" /></div>}
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
                  className="rounded-3xl p-10 bg-success/15 border-2 border-success text-center shadow-[0_0_40px_-8px_hsl(var(--success))]"
                >
                  <p className="text-lg text-muted-foreground uppercase tracking-widest font-bold mb-3">Answer</p>
                  <p className="text-5xl font-extrabold text-success">{pqReveal.correctAnswer}</p>
                  {pqReveal.acceptedAnswers && pqReveal.acceptedAnswers.length > 1 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Also accepted: {pqReveal.acceptedAnswers.filter((a) => a !== pqReveal.correctAnswer).join(", ")}
                    </p>
                  )}
                </motion.div>
              ) : (
                <div className="rounded-3xl p-10 bg-card/60 border-2 border-dashed border-border text-center">
                  <p className="text-2xl text-muted-foreground">Players are typing on their phones…</p>
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
                  <div className="text-7xl font-black">
                    <span className="text-secondary text-glow-secondary"><CountUp value={pqAnsweredCount} duration={0.4} /></span>
                    <span className="text-muted-foreground text-5xl"> / {pqTotalAnswerers}</span>
                  </div>
                  <p className="text-xl text-muted-foreground uppercase tracking-widest font-bold mt-2">Answers In</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl">
              <div className="bg-card/85 backdrop-blur rounded-2xl p-6 border-2 border-border surface-elevated">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold uppercase tracking-widest text-muted-foreground">Live Standings</h3>
                  <div className="text-sm text-muted-foreground">
                    {pqReveal.correctCount}/{pqReveal.totalAnswered} got it right
                  </div>
                </div>
                <div className="space-y-2">
                  {pqLeaderboard.slice(0, 6).map((row, i) => {
                    const ans = pqReveal.perPlayerAnswers.find((a) => a.playerId === row.id);
                    const isFirst = pqReveal.firstCorrectPlayerId === row.id;
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-background/40">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                            i === 0 ? "bg-primary/30 text-primary" : "bg-muted text-muted-foreground"
                          }`}>
                            {i + 1}
                          </div>
                          {row.isBot && <Bot className="w-4 h-4 text-primary/60 flex-shrink-0" />}
                          <span className="font-bold text-lg truncate">{row.name}</span>
                          {ans && (
                            ans.correct
                              ? <Check className="w-5 h-5 text-success flex-shrink-0" />
                              : <X className="w-5 h-5 text-destructive/70 flex-shrink-0" />
                          )}
                          {isFirst && (
                            <span className="text-xs font-bold uppercase bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full whitespace-nowrap">
                              +0.5 First
                            </span>
                          )}
                        </div>
                        <div className="text-2xl font-extrabold text-primary text-glow-primary">
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

    return null;
  };

  let content: React.ReactNode = null;
  if (gameState === "lobby") content = renderLobby();
  else if (gameState === "finished") content = renderFinished();
  else if (gameType === "pop-the-question") content = renderPtQ();
  else if (gameType === "roast-roulette") content = renderRR();
  else if (gameType === "pub-quiz") content = renderPQ();

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
