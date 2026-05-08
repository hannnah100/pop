import { useEffect, useRef, useState, useCallback } from "react";
import {
  useGetTodayPopOrDrop,
  useGetPopOrDropLeaderboard,
  useSubmitPopOrDropScore,
  useUpdatePlayerName,
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
  Pencil,
  Check,
  X,
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

const CARD_COLORS = [
  "#FF6B35", "#00E5FF", "#FF1493", "#FFD700", "#00C853",
  "#7C4DFF", "#FF6EC7", "#00BCD4", "#FF5722", "#76FF03",
  "#FF9800", "#E91E63", "#03A9F4", "#CDDC39", "#9C27B0",
  "#FF3D00", "#1DE9B6", "#FF4081", "#C6FF00", "#40C4FF",
  "#FF6B35",
];

function cardColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length];
}

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

function getPlayerToken(): string {
  let token = localStorage.getItem("ptq-player-token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("ptq-player-token", token);
  }
  return token;
}

function getStoredPlayerName(): string {
  return localStorage.getItem("ptq-player-name") ?? "";
}

function savePlayerName(name: string): void {
  localStorage.setItem("ptq-player-name", name.trim());
}

function formatValue(value: number): string {
  return value.toLocaleString();
}

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
  const displayValue = formatValue(item.value);

  return (
    <motion.div
      className="flex-1 border-[3px] border-black shadow-[4px_4px_0_#000] p-4 flex flex-col items-center justify-center text-center min-h-[180px] relative overflow-hidden"
      animate={{ backgroundColor: flashBg }}
      transition={{ duration: 0.15 }}
    >
      <p className="font-sans text-xs font-bold uppercase tracking-widest text-black/60 mb-1">
        {item.metricLabel}
      </p>
      <h2 className="font-display font-black text-black text-xl md:text-2xl leading-tight mb-3">
        {item.name}
      </h2>
      {isRight && !revealed ? (
        <div className="flex flex-col items-center gap-1">
          <span className="font-display font-black text-4xl md:text-5xl text-black">???</span>
        </div>
      ) : (
        <motion.div
          initial={isRight ? { scale: 0.5, opacity: 0 } : {}}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="flex flex-col items-center"
        >
          <span className="font-display font-black text-2xl md:text-4xl text-black break-all">
            {displayValue}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function PopOrDrop() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playVictory } = useSfx();
  const reduced = useReducedMotion();
  const countdown = useCountdown();

  const todayDate = new Date().toISOString().split("T")[0];
  const storageKey = `ptq-pop-or-drop-${todayDate}`;
  const startedKey = `ptq-pod-started-${todayDate}`;

  const seqQuery = useGetTodayPopOrDrop({
    query: { queryKey: getGetTodayPopOrDropQueryKey() },
  });
  const items: Item[] = seqQuery.data?.items ?? [];

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";

  const leaderboardQuery = useGetPopOrDropLeaderboard(
    { date: todayDate, playerToken },
    {
      query: {
        queryKey: getGetPopOrDropLeaderboardQueryKey({ date: todayDate, playerToken }),
        enabled: leaderboardEnabled,
      },
    },
  );
  const scoresMutation = useSubmitPopOrDropScore();
  const updateNameMutation = useUpdatePlayerName();

  function commitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePlayerName(trimmed);
    setPlayerName(trimmed);
    updateNameMutation.mutate({ data: { playerToken, playerName: trimmed } });
  }

  const [currentIndex, setCurrentIndex] = useState(1);
  const [streak, setStreak] = useState(0);
  const [phase, setPhase] = useState<Phase>("guessing");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [alreadyPlayed, setAlreadyPlayed] = useState<SavedState | null>(null);
  const recordedRef = useRef(false);

  const [playerName, setPlayerName] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredPlayerName() : ""
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Restore from localStorage — check both "done" state and "started" state (mid-game lock)
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
          return;
        }
      }
      // If the player started but didn't finish (e.g. refreshed mid-game),
      // treat it as a forfeit and show game-over with streak 0.
      const started = localStorage.getItem(startedKey);
      if (started === "1") {
        const forfeit: SavedState = { done: true, streak: 0, date: todayDate };
        localStorage.setItem(storageKey, JSON.stringify(forfeit));
        setAlreadyPlayed(forfeit);
        setStreak(0);
        setPhase("gameover");
        setLeaderboardEnabled(true);
      }
    } catch {
      /* ignore */
    }
  }, [storageKey, startedKey, todayDate]);

  // Lock: mark the attempt as "started" the moment the player makes their first guess.
  // This prevents replaying by refreshing before game-over is recorded.
  const lockAttempt = useCallback(() => {
    try {
      localStorage.setItem(startedKey, "1");
    } catch {/* ignore */}
  }, [startedKey]);

  const saveResult = useCallback((finalStreak: number) => {
    if (recordedRef.current) return;
    recordedRef.current = true;
    const state: SavedState = { done: true, streak: finalStreak, date: todayDate };
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {/* ignore */}

    scoresMutation.mutate(
      { data: { playerToken, streak: finalStreak, date: todayDate } },
      {
        onSuccess: () => setLeaderboardEnabled(true),
        onError: () => setLeaderboardEnabled(true),
      },
    );

    try {
      const raw = localStorage.getItem("ptq-stats");
      const stats = raw ? JSON.parse(raw) : {};
      const maxRounds = items.length - 1;
      stats.popOrDropTotalPlays = (stats.popOrDropTotalPlays ?? 0) + 1;
      stats.popOrDropBestStreak = Math.max(stats.popOrDropBestStreak ?? 0, finalStreak);
      stats.popOrDropStreakSum = (stats.popOrDropStreakSum ?? 0) + finalStreak;
      stats.popOrDropPerfectGames =
        (stats.popOrDropPerfectGames ?? 0) + (finalStreak >= maxRounds ? 1 : 0);
      localStorage.setItem("ptq-stats", JSON.stringify(stats));
    } catch {/* ignore */}

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
  }, [storageKey, todayDate, scoresMutation, playerToken, items.length]);

  const handleGuess = useCallback((guess: "higher" | "lower") => {
    if (phase !== "guessing" || items.length < 2) return;

    // Lock the attempt on first guess to prevent mid-game refresh exploits
    lockAttempt();

    const leftItem = items[currentIndex - 1];
    const rightItem = items[currentIndex];
    const isHigher = rightItem.value > leftItem.value;
    const isCorrect = guess === "higher" ? isHigher : !isHigher;
    const actuallyCorrect = rightItem.value === leftItem.value ? true : isCorrect;

    if (actuallyCorrect) {
      const newStreak = streak + 1;
      setFlash("correct");
      setPhase("revealing-correct");
      playCorrect();
      hapticCorrect();

      if (newStreak === 10 || newStreak === 20) {
        fireBigCelebration();
      } else if (newStreak % 5 === 0) {
        fireConfetti("rainbow");
      }

      toast({
        title: `Correct! 🔥 Streak: ${newStreak}`,
        description: `${rightItem.name}: ${formatValue(rightItem.value)}`,
        className: "border-[3px] border-black bg-[#00C853] text-black font-bold",
      });

      setTimeout(() => {
        setFlash(null);
        const nextIndex = currentIndex + 1;
        if (nextIndex >= items.length) {
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
        description: `${rightItem.name} was actually ${formatValue(rightItem.value)}`,
        className: "border-[3px] border-black bg-[#FF1744] text-white font-bold",
        variant: "destructive",
      });

      setTimeout(() => {
        setFlash(null);
        setPhase("gameover");
        saveResult(streak);
      }, reduced ? 600 : 1400);
    }
  }, [phase, items, currentIndex, streak, reduced, playCorrect, playWrong, playVictory, toast, saveResult, lockAttempt]);

  const handleShare = useCallback(() => {
    const maxPossible = items.length - 1;
    const text = [
      `🎯 Pop or Drop — ${todayDate}`,
      `Streak: ${streak} / ${maxPossible}`,
      streak >= maxPossible ? "🏆 PERFECT GAME!" : streak >= 10 ? "🔥 On fire!" : "",
      "#PopOrDrop #PopTheQuestion",
      "popthequestion.replit.app",
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied to clipboard!", description: text });
    });
  }, [streak, items.length, todayDate, toast]);

  const leaderboard = leaderboardQuery.data;

  // Use server-returned rank; fall back to position outside top 10 only if player exists
  const serverRank = leaderboard?.playerRank ?? null;
  const myRankInTop10 = leaderboard
    ? leaderboard.top10.findIndex((e) => e.playerToken === playerToken) + 1
    : 0;
  const myRank = serverRank ?? (myRankInTop10 > 0 ? myRankInTop10 : null);
  const rankPercentile =
    myRank !== null && leaderboard && leaderboard.totalPlayers > 0
      ? Math.round((1 - (myRank - 1) / leaderboard.totalPlayers) * 100)
      : null;

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
            /* Game over panel */
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

                <p className="font-display font-black text-4xl text-black">
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
                  <span className="font-display font-black text-6xl text-black">
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

              <PersonalBestCard streak={streak} />

              {/* Countdown */}
              <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-black" />
                  <span className="font-bold text-sm uppercase tracking-wide">Next challenge</span>
                </div>
                <span className="font-display font-black text-2xl text-black">{countdown}</span>
              </div>

              {/* Leaderboard */}
              {leaderboardEnabled && (
                <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] overflow-hidden">
                  <div className="bg-black px-4 py-2 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#FFD700]" />
                    <span className="text-white font-display font-black text-sm uppercase">
                      Today's Leaderboard
                    </span>
                    {leaderboard && (
                      <Badge className="ml-auto bg-[#FF1493] text-white border-[#FF1493]">
                        {leaderboard.totalPlayers} played
                      </Badge>
                    )}
                  </div>
                  {leaderboardQuery.isPending ? (
                    <div className="px-4 py-3 text-center text-sm text-black/50">Loading…</div>
                  ) : leaderboard && leaderboard.top10.length > 0 ? (
                    <>
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
                              {isMe ? (
                                <span className="flex-1 flex items-center gap-1 min-w-0">
                                  {isEditingName ? (
                                    <>
                                      <input
                                        autoFocus
                                        value={editNameValue}
                                        onChange={(e) => setEditNameValue(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                          else if (e.key === "Escape") { setIsEditingName(false); }
                                        }}
                                        maxLength={20}
                                        placeholder="Your name"
                                        className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1"
                                      />
                                      <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="p-0.5 text-black hover:text-[#FF1493]" aria-label="Save name"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setIsEditingName(false)} className="p-0.5 text-black/50 hover:text-black" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold text-sm truncate">{playerName || "You"}</span>
                                      <button onClick={() => { setEditNameValue(playerName); setIsEditingName(true); }} className="p-0.5 text-black/40 hover:text-black shrink-0" aria-label="Edit name"><Pencil className="w-3 h-3" /></button>
                                    </>
                                  )}
                                </span>
                              ) : (
                                <span className="flex-1 font-bold text-sm">
                                  {entry.playerName ?? `Player ${entry.playerToken.slice(0, 4)}`}
                                </span>
                              )}
                              <div className="flex items-center gap-1">
                                <Flame className="w-3 h-3 text-[#FF1493]" />
                                <span className="font-display font-black text-sm">{entry.streak}</span>
                              </div>
                            </div>
                          );
                        })}
                        {myRank !== null && myRankInTop10 === 0 && (
                          <div className="flex items-center gap-3 px-4 py-2 bg-[#FFD700] border-l-4 border-[#FF1493]">
                            <span className="font-display font-black text-sm w-6 text-center">#{myRank}</span>
                            <span className="flex-1 flex items-center gap-1 min-w-0">
                              {isEditingName ? (
                                <>
                                  <input
                                    autoFocus
                                    value={editNameValue}
                                    onChange={(e) => setEditNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                      else if (e.key === "Escape") { setIsEditingName(false); }
                                    }}
                                    maxLength={20}
                                    placeholder="Your name"
                                    className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1"
                                  />
                                  <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="p-0.5 text-black hover:text-[#FF1493]" aria-label="Save name"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => setIsEditingName(false)} className="p-0.5 text-black/50 hover:text-black" aria-label="Cancel"><X className="w-3.5 h-3.5" /></button>
                                </>
                              ) : (
                                <>
                                  <span className="font-bold text-sm truncate">{playerName || "You"}</span>
                                  <button onClick={() => { setEditNameValue(playerName); setIsEditingName(true); }} className="p-0.5 text-black/40 hover:text-black shrink-0" aria-label="Edit name"><Pencil className="w-3 h-3" /></button>
                                </>
                              )}
                            </span>
                            <div className="flex items-center gap-1">
                              <Flame className="w-3 h-3 text-[#FF1493]" />
                              <span className="font-display font-black text-sm">{streak}</span>
                            </div>
                          </div>
                        )}
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
                    </>
                  ) : (
                    <div className="px-4 py-3 text-center text-sm text-black/50">Be the first to complete today's challenge!</div>
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

      <div className="mt-10 flex justify-center">
        <button
          onClick={() => setLocation("/archive")}
          className="py-3 px-6 bg-[#00B4FF] border-[4px] border-black shadow-[4px_4px_0_#000] font-display font-black text-base text-black uppercase rounded-[12px] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-75 cursor-pointer"
        >
          Not your jam? Check out the archives
        </button>
      </div>
    </div>
  );
}

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
