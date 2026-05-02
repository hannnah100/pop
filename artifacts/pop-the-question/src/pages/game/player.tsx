import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { io, Socket } from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import type { Player } from "@/types/game";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send, CheckCircle2, Eye, Sparkles } from "lucide-react";
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

  const finishedRef = useRef(false);

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

    newSocket.on("room-state", ({ players: ps, gameType: gt }: RoomStatePayload) => {
      setPlayers(ps.filter((p) => !p.isHost));
      if (gt) setGameType(gt);
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
      }
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

    newSocket.on("game-ended", ({ players: ps }: GameEndedPayload) => {
      setGameState("finished");
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
    });

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, playerNameParam]);

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
    playTap();
    hapticTap();
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

  // ============ LOBBY ============
  if (gameState === "lobby") {
    return (
      <div className="flex flex-col min-h-[100dvh] p-6">
        <header className="mb-8">
          <div className="inline-block px-4 py-1 rounded-full bg-card border border-secondary/30 text-sm font-bold tracking-widest text-secondary mb-4 surface-elevated">
            ROOM {roomCode}
          </div>
          <h1 className="text-4xl font-extrabold font-display tracking-tight text-foreground">You're in!</h1>
          <div className="heading-divider heading-divider--green w-12 h-1 mt-2" />
          <p className="text-lg text-muted-foreground mt-3">Look at the big screen.</p>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6 text-center">
          <div className="relative">
            <Loader2 className="w-16 h-16 text-primary animate-spin drop-shadow-[0_0_18px_hsl(var(--primary))]" />
          </div>
          <h2 className="text-2xl font-bold">Waiting for host to start...</h2>
        </div>
      </div>
    );
  }

  // ============ PLAYING — Pop the Question ============
  if (gameState === "playing" && (gameType === "pop-the-question" || gameType === "")) {
    const q = currentQuestion as { prompt?: string } | null;
    return (
      <div className="flex flex-col min-h-[100dvh] p-4 sm:p-6">
        <header className="mb-6 sticky top-0 bg-background/85 backdrop-blur-md z-10 py-4 border-b border-border/50">
          <AnimatePresence mode="wait">
            <motion.h2
              key={q?.prompt ?? "loading"}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-bold font-display leading-tight"
            >
              {q?.prompt || "Loading..."}
            </motion.h2>
          </AnimatePresence>
        </header>

        <main className="flex-1 flex flex-col">
          {!votedFor && !resultsRevealed ? (
            <motion.div
              className="space-y-4 pb-8"
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
                    className="p-6 cursor-pointer transition-all bg-card hover:bg-card/80 border-2 border-border hover:border-primary hover:shadow-[0_0_28px_-6px_hsl(var(--primary)/0.7)] min-h-12"
                    data-testid={`btn-vote-${p.id}`}
                  >
                    <span className="text-2xl font-bold relative z-[1]">{p.name}</span>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : !resultsRevealed ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 16 }}
                className="w-24 h-24 bg-success/20 rounded-full flex items-center justify-center shadow-[0_0_36px_-4px_hsl(var(--success))]"
              >
                <span className="text-4xl">👍</span>
              </motion.div>
              <h2 className="text-3xl font-bold font-display">Vote received!</h2>
              <p className="text-xl text-muted-foreground">Look at the big screen to see what everyone else thought.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
              <h2 className="text-3xl font-bold text-primary text-glow-primary font-display">Results are up!</h2>
              <p className="text-xl text-muted-foreground">Look at the big screen.</p>
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
        <div className="flex flex-col min-h-[100dvh] p-4 sm:p-6">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Round <span className="text-foreground"><CountUp value={rrRound} duration={0.3} /></span> of {rrTotalRounds}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground mt-1 leading-tight">
                Roast{" "}
                {rrTargetName ? (
                  <span className="text-accent">{rrTargetName}</span>
                ) : (
                  <span className="text-muted-foreground">…</span>
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

          <main className="flex-1 flex flex-col">
            {!currentRoastQ ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
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
                  className="w-24 h-24 rounded-full flex items-center justify-center bg-rainbow-warm shadow-[0_0_40px_-4px_hsl(var(--primary)/0.7)]"
                >
                  <CheckCircle2 className="w-12 h-12 text-white drop-shadow" />
                </motion.div>
                <h2 className="text-3xl font-bold font-display">Roast sent!</h2>
                <p className="text-lg text-muted-foreground max-w-sm">
                  Waiting for the others to finish writing…
                </p>
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
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
                  className="p-5 mb-4 border-2"
                  style={{
                    borderColor: `${colorHex(currentRoastQ.color)}aa`,
                    boxShadow: `0 0 32px -8px ${colorHex(currentRoastQ.color)}aa`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 self-stretch rounded-full flex-shrink-0"
                      style={{ background: colorHex(currentRoastQ.color) }}
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                        About {rrTargetName || "your target"}
                      </p>
                      <p className="text-lg sm:text-xl font-bold font-display leading-snug">
                        {currentRoastQ.question}
                      </p>
                    </div>
                  </div>
                </Card>

                <Input
                  value={rrCurrentAnswer}
                  onChange={(e) => setRrCurrentAnswer(e.target.value)}
                  placeholder="Type your roast…"
                  maxLength={140}
                  className="text-base py-6 min-h-12 bg-card border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-primary/30 focus-visible:shadow-[0_0_24px_-4px_hsl(var(--primary))] transition-shadow"
                  autoFocus
                  data-testid="input-roast-answer"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitRoast();
                    }
                  }}
                />
                <div className="text-right text-xs text-muted-foreground mt-1 mb-4 font-mono">
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
              </motion.div>
            )}
          </main>
        </div>
      );
    }

    // --- WRITING COMPLETE (intermission) ---
    if (rrPhase === "writing-complete") {
      return (
        <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-6">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-28 h-28 rounded-full flex items-center justify-center bg-rainbow-warm shadow-[0_0_50px_-4px_hsl(var(--primary)/0.7)]"
          >
            <Sparkles className="w-14 h-14 text-white drop-shadow" />
          </motion.div>
          <h1 className="text-4xl font-extrabold font-display tracking-tight text-foreground">
            All roasts in
          </h1>
          <div className="heading-divider heading-divider--pink w-16 h-1 mx-auto" />
          <p className="text-lg text-muted-foreground max-w-sm">
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
          <div className="flex flex-col min-h-[100dvh] p-4 sm:p-6">
            <header className="mb-5 text-center">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your card!</p>
              <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight text-foreground mt-1 leading-tight">
                Guess who roasted you
              </h1>
              <div className="heading-divider heading-divider--orange w-16 h-1 mx-auto mt-2" />
            </header>

            <main className="flex-1 flex flex-col gap-3 pb-8">
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
                        className="p-4 border-2"
                        style={{
                          borderColor: picked ? "hsl(var(--success) / 0.5)" : `${colorHex(color)}aa`,
                          boxShadow: picked ? "none" : `0 0 24px -10px ${colorHex(color)}cc`,
                          opacity: picked ? 0.6 : 1,
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-3 self-stretch rounded-full flex-shrink-0"
                            style={{ background: colorHex(color) }}
                          />
                          <div className="flex-1 min-w-0">
                            {q?.question && (
                              <p className="text-xs text-muted-foreground mb-1 leading-snug">{q.question}</p>
                            )}
                            <p className="text-base sm:text-lg font-bold leading-snug break-words">
                              "{entry.answer}"
                            </p>

                            {!picked && !isPicking && (
                              <Button
                                size="sm"
                                variant="outline"
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
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                  Who wrote it?
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {players
                                    .filter((p) => p.id !== me?.id)
                                    .map((p) => (
                                      <Button
                                        key={p.id}
                                        variant="outline"
                                        size="sm"
                                        className="min-h-12 justify-start font-bold"
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
                                  className="text-muted-foreground"
                                  onClick={() => setRrPickFor(null)}
                                >
                                  Cancel
                                </Button>
                              </motion.div>
                            )}

                            {picked && (
                              <div className="mt-2 flex items-center gap-2 text-success text-sm font-bold">
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
                  <p className="text-lg font-bold text-muted-foreground">
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
        <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-6">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            className="w-24 h-24 rounded-full flex items-center justify-center bg-card/85 border-2 border-primary/40 backdrop-blur shadow-[0_0_40px_-6px_hsl(var(--primary)/0.6)]"
          >
            <Eye className="w-12 h-12 text-primary" />
          </motion.div>
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Now roasting</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold font-display tracking-tight text-foreground leading-tight">
            {rrCurrentRevealName || "…"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-sm">
            Watch the big screen — they're guessing who wrote each roast.
          </p>
        </div>
      );
    }
  }

  // ============ FINISHED ============
  if (gameState === "finished") {
    const myScore = players.find((p) => p.id === me?.id)?.score || 0;

    return (
      <div className="flex flex-col min-h-[100dvh] p-6 items-center justify-center text-center space-y-8">
        <h1 className="text-5xl font-extrabold font-display tracking-tight text-foreground">Game Over</h1>
        <div className="heading-divider heading-divider--magenta w-16 h-1" />
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className="bg-card/85 backdrop-blur p-8 rounded-3xl border-2 border-primary/30 w-full max-w-sm surface-elevated shadow-[0_0_60px_-20px_hsl(var(--primary)/0.7)]"
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
