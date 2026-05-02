import { useEffect, useRef, useState, useCallback } from "react";
import {
  useGetTodayPopOrDrop,
  useGetPopOrDropLeaderboard,
  useSubmitPopOrDropScore,
  getGetTodayPopOrDropQueryKey,
  getGetPopOrDropLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronUp,
  ChevronDown,
  Share2,
  Clock,
  Home as HomeIcon,
  Trophy,
  Flame,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import { fireConfetti, fireBigCelebration } from "@/components/fx";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticWrong, hapticVictory } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";
import { useLocation } from "wouter";

// ──────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────

interface Item {
  id: string;
  name: string;
  value: number;
  unit: string;
  metricLabel: string;
  category: string;
}

type Phase = "guessing" | "revealing-correct" | "revealing-wrong" | "gameover";

interface SavedState {
  done: boolean;
  streak: number;
  date: string;
}

// ──────────────────────────────────────────────────────
// Y2K colour palette per card (fixed, deterministic)
// ──────────────────────────────────────────────────────
const CARD_COLORS = [
  "#FF6B35", "#00E5FF", "#FF1493", "#FFD700", "#00C853",
  "#7C4DFF", "#FF6EC7", "#00BCD4", "#FF5722", "#76FF03",
  "#FF9800", "#E91E63", "#03A9F4", "#CDDC39", "#9C27B0",
  "#FF3D00", "#1DE9B6", "#FF4081", "#C6FF00", "#40C4FF",
];

function cardColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length];
}

// ──────────────────────────────────────────────────────
// Countdown to midnight helper
// ──────────────────────────────────────────────────────
function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      setSeconds(Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────────────
// Get/create a stable playerToken (anonymous UUID)
// ──────────────────────────────────────────────────────
function getPlayerToken(): string {
  let token = localStorage.getItem("ptq-player-token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("ptq-player-token", token);
  }
  return token;
}

// ──────────────────────────────────────────────────────
// Format value for display
// ──────────────────────────────────────────────────────
function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}T`;
  if (abs >= 1000) return `${sign}${abs.toLocaleString()}`;
  return `${sign}${abs.toLocaleString()}`;
}

// ──────────────────────────────────────────────────────
// ItemCard component
// ──────────────────────────────────────────────────────
interface ItemCardProps {
  item: Item;
  colorIndex: number;
  revealed: boolean;
  isRight: boolean;
  flash?: "correct" | "wrong" | null;
}

function ItemCard({ item, colorIndex, revealed, isRight, flash }: ItemCardProps) {
  const bg = cardColor(colorIndex);
  const flashBg = flash === "correct" ? "#00C853" : flash === "wrong" ? "#FF1744" : bg;
  const displayValue = `${formatValue(item.value, item.unit)}${item.unit ? " " + item.unit : ""}`;

  return (
    <motion.div
      className="flex-1 border-[3px] border-black shadow-[4px_4px_0_#000] p-4 flex flex-col items-center justify-center text-center min-h-[180px] relative overflow-hidden"
      animate={{ backgroundColor: flashBg }}
      transition={{ duration: 0.15 }}
    >
      <p className="font-sans text-xs font-bold uppercase tracking-widest text-black/60 mb-1">
        {item.metricLabel}
      </p>
      <h2 className="font-display font-black text-black text-xl md:text-2xl leading-tight mb-3 comic-headline">
        {item.name}
      </h2>
      {isRight && !revealed ? (
        <div className="flex flex-col items-center gap-1">
          <span className="font-display font-black text-4xl md:text-5xl text-black comic-headline">???</span>
          <span className="font-sans text-xs text-black/50">{item.unit || "—"}</span>
        </div>
      ) : (
        <motion.div
          initial={isRight ? { scale: 0.5, opacity: 0 } : {}}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="flex flex-col items-center"
        >
          <span className="font-display font-black text-3xl md:text-5xl text-black comic-headline">
            {displayValue}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────
export default function PopOrDrop() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playVictory } = useSfx();
  const reduced = useReducedMotion();
  const countdown = useCountdown();

  const todayDate = new Date().toISOString().split("T")[0];
  const storageKey = `ptq-pop-or-drop-${todayDate}`;

  // ── Queries ────────────────────────────────────────
  const seqQuery = useGetTodayPopOrDrop({
    query: { queryKey: getGetTodayPopOrDropQueryKey() },
  });
  const items: Item[] = seqQuery.data?.items ?? [];

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const leaderboardQuery = useGetPopOrDropLeaderboard(
    { date: todayDate },
    {
      query: {
        queryKey: getGetPopOrDropLeaderboardQueryKey({ date: todayDate }),
        enabled: leaderboardEnabled,
      },
    },
  );
  const scoresMutation = useSubmitPopOrDropScore();

  // ── Game state ─────────────────────────────────────
  const [currentIndex, setCurrentIndex] = useState(1); // right card index
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>("guessing");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [alreadyPlayed, setAlreadyPlayed] = useState<SavedState | null>(null);
  const recordedRef = useRef(false);

  // ── Restore from localStorage ───────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: SavedState = JSON.parse(saved);
        if (parsed.done) {
          setAlreadyPlayed(parsed);
          setStreak(parsed.streak);
          setPhase("gameover");
          setLeaderboardEnabled(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // ── Save to localStorage when game over ────────────
  const saveResult = useCallback((finalStreak: number) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const state: SavedState = { done: true, streak: finalStreak, date: todayDate };
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {/* ignore */}

    // Submit to leaderboard
    const playerToken = getPlayerToken();
    scoresMutation.mutate({ data: { playerToken, streak: finalStreak, date: todayDate } });
    setLeaderboardEnabled(true);

    // Update personal stats
    try {
      const raw = localStorage.getItem("ptq-stats");
      const stats = raw ? JSON.parse(raw) : {};
      stats.popOrDropTotalPlays = (stats.popOrDropTotalPlays ?? 0) + 1;
      stats.popOrDropBestStreak = Math.max(stats.popOrDropBestStreak ?? 0, finalStreak);
      stats.popOrDropStreakSum = (stats.popOrDropStreakSum ?? 0) + finalStreak;
      stats.popOrDropPerfectGames =
        (stats.popOrDropPerfectGames ?? 0) + (finalStreak >= items.length - 1 ? 1 : 0);
      localStorage.setItem("ptq-stats", JSON.stringify(stats));
    } catch {/* ignore */}

    // Update play streak
    try {
      const lastKey = "ptq-last-pop-or-drop";
      const last = localStorage.getItem(lastKey);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      const streakKey = "ptq-streak-pop-or-drop";
      const current = parseInt(localStorage.getItem(streakKey) ?? "0");
      if (last === yesterdayStr) {
        localStorage.setItem(streakKey, String(current + 1));
      } else if (last !== todayDate) {
        localStorage.setItem(streakKey, "1");
      }
      localStorage.setItem(lastKey, todayDate);
    } catch {/* ignore */}
  }, [storageKey, todayDate, scoresMutation, items.length]);

  // ── Guess handler ───────────────────────────────────
  const handleGuess = useCallback((guess: "higher" | "lower") => {
    if (phase !== "guessing" || items.length < 2) return;

    const leftItem = items[currentIndex - 1];
    const rightItem = items[currentIndex];
    const isHigher = rightItem.value > leftItem.value;
    const isCorrect = guess === "higher" ? isHigher : !isHigher;

    // Equal values: always correct (generous rule)
    const actuallyCorrect = rightItem.value === leftItem.value ? true : isCorrect;

    if (actuallyCorrect) {
      const newStreak = streak + 1;
      setFlash("correct");
      setPhase("revealing-correct");
      playCorrect();
      hapticCorrect();

      // Confetti milestones
      if (newStreak === 10 || newStreak === 25 || newStreak === 50) {
        fireBigCelebration();
      } else if (newStreak % 5 === 0) {
        fireConfetti("rainbow");
      }

      toast({
        title: `Correct! 🔥 Streak: ${newStreak}`,
        description: `${rightItem.name}: ${formatValue(rightItem.value, rightItem.unit)} ${rightItem.unit}`,
        className: "border-[3px] border-black bg-[#00C853] text-black font-bold",
      });

      setTimeout(() => {
        setFlash(null);
        const nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
          // Completed all items — perfect game!
          setStreak(newStreak);
          setPhase("gameover");
          playVictory();
          hapticVictory();
          fireBigCelebration();
          saveResult(newStreak);
        } else {
          setStreak(newStreak);
          setCurrentIndex(nextIndex);
          setPhase("guessing");
        }
      }, reduced ? 400 : 900);
    } else {
      setFlash("wrong");
      setPhase("revealing-wrong");
      playWrong();
      hapticWrong();
      setShakeKey((k) => k + 1);

      toast({
        title: "Wrong! Game over",
        description: `${rightItem.name} was actually ${formatValue(rightItem.value, rightItem.unit)} ${rightItem.unit}`,
        className: "border-[3px] border-black bg-[#FF1744] text-white font-bold",
        variant: "destructive",
      });

      setTimeout(() => {
        setFlash(null);
        setPhase("gameover");
        saveResult(streak);
      }, reduced ? 600 : 1400);
    }
  }, [phase, items, currentIndex, streak, reduced, playCorrect, playWrong, playVictory, toast, saveResult]);

  // ── Share handler ────────────────────────────────────
  const handleShare = useCallback(() => {
    const maxPossible = items.length - 1;
    const text = [
      `🎯 Pop or Drop — ${todayDate}`,
      `Streak: ${streak} / ${maxPossible}`,
      streak >= maxPossible ? "🏆 PERFECT GAME!" : streak >= 10 ? "🔥 On fire!" : "",
      "#PopOrDrop #PopTheQuestion",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard!", description: text });
    });
  }, [streak, items.length, todayDate, toast]);

  // ── Derived ─────────────────────────────────────────
  const leaderboard = leaderboardQuery.data;
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";
  const myRank = leaderboard
    ? leaderboard.top10.findIndex((e) => e.playerToken === playerToken) + 1 ||
      leaderboard.totalPlayers + 1
    : null;
  const rankPercentile =
    leaderboard && leaderboard.totalPlayers > 0
      ? Math.round((1 - (myRank! - 1) / leaderboard.totalPlayers) * 100)
      : null;

  // ── Loading ──────────────────────────────────────────
  if (seqQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-black border-t-[#FF1493] rounded-full"
        />
      </div>
    );
  }

  if (seqQuery.isError || items.length < 2) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="border-[3px] border-black bg-white p-6 shadow-[4px_4px_0_#000]">
          <p className="font-display font-black text-xl">Couldn't load today's challenge</p>
          <p className="text-sm text-black/60 mt-2">Try refreshing the page</p>
        </div>
      </div>
    );
  }

  const leftItem = items[currentIndex - 1];
  const rightItem = items[currentIndex];
  const isGameOver = phase === "gameover";
  const isRevealing = phase === "revealing-correct" || phase === "revealing-wrong";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
      {/* Header */}
      <header className="bg-[#FF1493] border-b-[4px] border-black px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <BackArrow className="text-white [&_svg]:stroke-white" />
        <div className="text-center">
          <h1 className="font-display font-black text-white text-xl uppercase tracking-tight comic-headline">
            Pop or Drop
          </h1>
          <p className="text-white/80 text-xs font-bold uppercase">Higher or Lower?</p>
        </div>
        <div className="flex items-center gap-1 bg-white border-[2px] border-black px-2 py-1 shadow-[2px_2px_0_#000]">
          <Flame className="w-4 h-4 text-[#FF1493]" />
          <span className="font-display font-black text-sm">{streak}</span>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-2 bg-black/10 border-b-[2px] border-black">
        <motion.div
          className="h-full bg-[#FF1493]"
          animate={{ width: `${((currentIndex - 1) / Math.max(items.length - 2, 1)) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 max-w-2xl mx-auto w-full">
        {/* Game area */}
        <AnimatePresence mode="wait">
          {!isGameOver ? (
            <motion.div
              key={currentIndex}
              initial={reduced ? {} : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? {} : { opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-4"
            >
              {/* Instruction */}
              <div className="bg-black text-white px-3 py-1.5 text-center border-[3px] border-black self-stretch">
                <p className="font-display font-black text-sm uppercase tracking-wide">
                  Is {rightItem.name}'s {rightItem.metricLabel} HIGHER or LOWER?
                </p>
              </div>

              {/* Two cards */}
              <motion.div
                key={`shake-${shakeKey}`}
                animate={
                  shakeKey > 0 && phase === "revealing-wrong"
                    ? { x: [0, -12, 12, -8, 8, -4, 4, 0] }
                    : {}
                }
                transition={{ duration: 0.4 }}
                className="flex gap-3"
              >
                <ItemCard
                  item={leftItem}
                  colorIndex={currentIndex - 1}
                  revealed={true}
                  isRight={false}
                  flash={null}
                />
                <ItemCard
                  item={rightItem}
                  colorIndex={currentIndex}
                  revealed={isRevealing}
                  isRight={true}
                  flash={isRevealing ? flash : null}
                />
              </motion.div>

              {/* HIGHER / LOWER buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => handleGuess("higher")}
                  disabled={isRevealing}
                  className="flex-1 h-16 font-display font-black text-lg uppercase bg-[#00C853] text-black border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all gap-2 comic-headline"
                >
                  <ChevronUp className="w-6 h-6" />
                  Higher
                </Button>
                <Button
                  onClick={() => handleGuess("lower")}
                  disabled={isRevealing}
                  className="flex-1 h-16 font-display font-black text-lg uppercase bg-[#FF3D00] text-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all gap-2 comic-headline"
                >
                  <ChevronDown className="w-6 h-6" />
                  Lower
                </Button>
              </div>

              {/* Round counter */}
              <p className="text-center text-xs font-bold text-black/40 uppercase tracking-widest">
                Round {currentIndex} of {items.length - 1}
              </p>
            </motion.div>
          ) : (
            /* ── GAME OVER panel ── */
            <motion.div
              initial={reduced ? {} : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Result banner */}
              <div
                className="border-[4px] border-black shadow-[6px_6px_0_#000] p-6 text-center relative overflow-hidden"
                style={{
                  backgroundColor:
                    streak >= items.length - 1 ? "#FFD700" : streak >= 10 ? "#00C853" : "#FF1493",
                }}
              >
                <StarDoodle className="absolute top-2 left-3 w-8 h-8 text-black/30" />
                <LightningDoodle className="absolute bottom-2 right-3 w-6 h-10 text-black/20" />

                <p className="font-display font-black text-4xl text-black comic-headline">
                  {streak >= items.length - 1
                    ? "PERFECT! 🏆"
                    : streak >= 10
                    ? "ON FIRE! 🔥"
                    : streak >= 5
                    ? "NICE STREAK! 💥"
                    : "GAME OVER 💀"}
                </p>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <Flame className="w-8 h-8 text-black" />
                  <span className="font-display font-black text-6xl text-black comic-headline">
                    {streak}
                  </span>
                  <span className="font-display text-xl text-black/70 font-bold">
                    / {items.length - 1}
                  </span>
                </div>
                <p className="text-black/70 font-bold text-sm mt-1">streak</p>

                {rankPercentile !== null && (
                  <div className="mt-3 inline-block bg-black text-white px-3 py-1 font-bold text-sm border-[2px] border-black">
                    Top {100 - rankPercentile + 1}% of players today
                  </div>
                )}
              </div>

              {/* Personal best from localStorage */}
              <PersonalBestCard streak={streak} />

              {/* Countdown */}
              <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-black" />
                  <span className="font-bold text-sm uppercase tracking-wide">Next challenge</span>
                </div>
                <span className="font-display font-black text-2xl comic-headline">{countdown}</span>
              </div>

              {/* Leaderboard */}
              {leaderboard && leaderboard.top10.length > 0 && (
                <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] overflow-hidden">
                  <div className="bg-black px-4 py-2 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#FFD700]" />
                    <span className="text-white font-display font-black text-sm uppercase">
                      Today's Leaderboard
                    </span>
                    <Badge className="ml-auto bg-[#FF1493] text-white border-[#FF1493]">
                      {leaderboard.totalPlayers} played
                    </Badge>
                  </div>
                  <div className="divide-y divide-black/10">
                    {leaderboard.top10.map((entry) => {
                      const isMe = entry.playerToken === playerToken;
                      return (
                        <div
                          key={entry.playerToken}
                          className={`flex items-center gap-3 px-4 py-2 ${isMe ? "bg-[#FFD700] border-l-4 border-[#FF1493]" : ""}`}
                        >
                          <span className="font-display font-black text-sm w-6 text-center">
                            {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                          </span>
                          <span className="flex-1 font-bold text-sm">
                            {isMe ? "You" : `Player ${entry.playerToken.slice(0, 4)}`}
                          </span>
                          <div className="flex items-center gap-1">
                            <Flame className="w-3 h-3 text-[#FF1493]" />
                            <span className="font-display font-black text-sm">{entry.streak}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {leaderboard.avgStreak > 0 && (
                    <div className="bg-black/5 px-4 py-2 flex gap-4 text-xs font-bold text-black/60">
                      <span className="flex items-center gap-1">
                        <BarChart2 className="w-3 h-3" />
                        Avg: {leaderboard.avgStreak}
                      </span>
                      <span>Median: {leaderboard.medianStreak}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleShare}
                  className="flex-1 font-display font-black uppercase bg-black text-white border-[3px] border-black shadow-[3px_3px_0_#FF1493] hover:bg-[#FF1493] transition-colors gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
                <Button
                  onClick={() => setLocation("/")}
                  variant="outline"
                  className="flex-1 font-display font-black uppercase border-[3px] border-black shadow-[3px_3px_0_#000] gap-2"
                >
                  <HomeIcon className="w-4 h-4" />
                  Home
                </Button>
              </div>

              <p className="text-center text-xs text-black/40 font-bold uppercase tracking-widest pb-4">
                Come back tomorrow for a new challenge!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// PersonalBestCard
// ──────────────────────────────────────────────────────
function PersonalBestCard({ streak }: { streak: number }) {
  const [stats, setStats] = useState<{
    popOrDropTotalPlays?: number;
    popOrDropBestStreak?: number;
    popOrDropStreakSum?: number;
  }>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ptq-stats");
      if (raw) setStats(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);

  const totalPlays = stats.popOrDropTotalPlays ?? 0;
  const best = stats.popOrDropBestStreak ?? streak;
  const avg =
    totalPlays > 0 && stats.popOrDropStreakSum
      ? (stats.popOrDropStreakSum / totalPlays).toFixed(1)
      : streak.toFixed(1);

  return (
    <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4" />
        <span className="font-display font-black text-sm uppercase">Personal Stats</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="font-display font-black text-2xl">{best}</p>
          <p className="text-xs text-black/50 font-bold uppercase">Best</p>
        </div>
        <div className="text-center">
          <p className="font-display font-black text-2xl">{avg}</p>
          <p className="text-xs text-black/50 font-bold uppercase">Avg</p>
        </div>
        <div className="text-center">
          <p className="font-display font-black text-2xl">{totalPlays}</p>
          <p className="text-xs text-black/50 font-bold uppercase">Played</p>
        </div>
      </div>
    </div>
  );
}
