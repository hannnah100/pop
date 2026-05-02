import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types/game";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, CheckCircle2, Eye, Sparkles, Mic, Beer, Check, X, Trophy } from "lucide-react";
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
  gameType?: string;
  hostSettings?: { answerMethod?: HostAnswerMethod };
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

    newSocket.on("room-state", ({ players: ps, gameType: gt, hostSettings }: RoomStatePayload) => {
      setPlayers(ps.filter((p) => !p.isHost));
      if (gt) setGameType(gt);
      if (hostSettings?.answerMethod) setAnswerMethod(hostSettings.answerMethod);
    });

    newSocket.on("host-settings-changed", ({ settings }: HostSettingsChangedPayload) => {
      if (settings.answerMethod) setAnswerMethod(settings.answerMethod);
    });

    newSocket.on("host-paused-changed", ({ paused }: HostPausedChangedPayload) => {
      setHostPaused(Boolean(paused));
    });

    newSocket.on("game-started", ({ gameType: gt, questions, questionIndex }: GameStartedPayload) => {
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
      }
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
      <div className="flex flex-col min-h-[100dvh] bg-[#FFD700]">
        <header className="bg-[#FF1493] border-b-[4px] border-black px-6 py-5">
          <div className="inline-flex items-center gap-2 bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-1.5 font-display font-black text-black text-sm uppercase tracking-widest mb-3">
            <span className="text-black/60">ROOM</span>
            <span className="text-xl tracking-[0.3em]">{roomCode}</span>
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
                transition={{ type: "spring", stiffness: 280, damping: 16 }}
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
                  transition={{ type: "spring", stiffness: 280, damping: 16, delay: 0.05 }}
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
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-28 h-28 bg-[#FF1493] border-[3px] border-black shadow-[5px_5px_0_#000] flex items-center justify-center"
          >
            <Sparkles className="w-14 h-14 text-white" />
          </motion.div>
          <h1 className="font-display font-black text-black text-4xl uppercase" style={{ textShadow: "3px 3px 0 rgba(0,0,0,0.2)" }}>
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
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-24 h-24 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
          >
            <Eye className="w-12 h-12 text-black" />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-black/60">Now roasting</p>
          <h1 className="font-display font-black text-black text-4xl uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.2)" }}>
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
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-24 h-24 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] flex items-center justify-center"
          >
            <Beer className="w-12 h-12 text-black" />
          </motion.div>
          <p className="text-xs font-black uppercase tracking-widest text-black/60">Round Complete</p>
          <h1 className="font-display font-black text-black text-3xl uppercase" style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.15)" }}>{pqRoundSummary.roundName}</h1>
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
            transition={{ type: "spring", stiffness: 240, damping: 18 }}
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
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
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

  // ============ FINISHED ============
  if (gameState === "finished") {
    const myScore = players.find((p) => p.id === me?.id)?.score || 0;

    return (
      <div className="flex flex-col min-h-[100dvh] bg-[#FFD700] items-center justify-center text-center space-y-8 p-6">
        <h1 className="font-display font-black text-black text-5xl uppercase" style={{ textShadow: "4px 4px 0 rgba(0,0,0,0.2)" }}>Game Over</h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="bg-white border-[3px] border-black shadow-[6px_6px_0_#000] p-8 w-full max-w-sm"
        >
          <p className="text-lg text-muted-foreground mb-2">You scored</p>
          <div className="text-6xl font-black text-primary text-glow-primary">
            <CountUp value={myScore} duration={1.6} />
          </div>
          <p className="text-lg text-muted-foreground mt-2">points</p>
        </motion.div>
        <p className="text-xl text-muted-foreground">Look at the big screen for final standings.</p>
      </div>
    );
  }

  return null;
}
