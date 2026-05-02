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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  CountUp,
  ParticleRain,
  fireBigCelebration,
  fireConfetti,
  TypingText,
  RainbowText,
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

    newSocket.on("room-state", ({ players: ps, isDemo: demo, gameType: gt }: RoomStatePayload) => {
      const visible = ps.filter((p) => !p.isHost);
      setPlayers(visible);
      visible.forEach((p) => knownPlayerIds.current.add(p.id));
      if (demo) setIsDemo(true);
      if (gt) setGameType(gt);
    });

    newSocket.on("game-started", ({ gameType: gt, question, questions, players: ps, currentRound, totalRounds, isDemo: demo }: GameStartedPayload) => {
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
      }
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

    newSocket.on("game-ended", ({ players: ps }: PlayersOnlyPayload) => {
      setGameState("finished");
      if (ps) setPlayers(ps.filter((p) => !p.isHost));
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

    return null;
  };

  let content: React.ReactNode = null;
  if (gameState === "lobby") content = renderLobby();
  else if (gameState === "finished") content = renderFinished();
  else if (gameType === "pop-the-question") content = renderPtQ();
  else if (gameType === "roast-roulette") content = renderRR();

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
