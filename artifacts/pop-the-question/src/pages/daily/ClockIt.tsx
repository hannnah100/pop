import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Share2,
  ChevronDown,
  Clock,
  Trophy,
  RotateCcw,
  Lock,
  Unlock,
  BarChart2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
import {
  useGetClockItLeaderboard,
  useSubmitClockItScore,
  useUpdatePlayerName,
  getGetClockItLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { fireConfetti, fireBigCelebration } from "@/components/fx";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticWrong, hapticVictory } from "@/lib/haptics";
import { useReducedMotion } from "@/lib/motion";

const HINT_COLORS = ["#FF1493", "#FF6B35", "#00E5FF"];
const HINT_LABELS = ["HINT 1", "HINT 2", "HINT 3"];

interface Puzzle {
  id: string;
  date: string;
  year: number;
  hints: [string, string, string];
}

interface SavedState {
  completed: boolean;
  score: number;
  hintsUsed: number;
  gaveUp: boolean;
  year?: number;
  date: string;
  inProgress?: boolean;
}

type GamePhase = "playing" | "success" | "failed";

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

function scoreFromHints(hintsUsed: number): number {
  if (hintsUsed === 1) return 3;
  if (hintsUsed === 2) return 2;
  if (hintsUsed === 3) return 1;
  return 0;
}

function scoreEmoji(score: number): string {
  if (score === 3) return "🏆";
  if (score === 2) return "⭐";
  if (score === 1) return "✓";
  return "💀";
}

interface HintCardProps {
  index: number;
  text: string;
  revealed: boolean;
  onReveal: () => void;
  reduced: boolean;
}

function HintCard({ index, text, revealed, onReveal, reduced }: HintCardProps) {
  const color = HINT_COLORS[index];
  const label = HINT_LABELS[index];

  return (
    <motion.div
      layout
      className="w-full border-[3px] border-black shadow-[4px_4px_0_#000] overflow-hidden"
      style={{ backgroundColor: revealed ? color : "#e5e5e5" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 border-b-[2px] border-black bg-black/10">
        {revealed ? (
          <Unlock className="w-4 h-4 text-black" />
        ) : (
          <Lock className="w-4 h-4 text-black/50" />
        )}
        <span className="font-display font-black text-xs uppercase tracking-widest text-black">
          {label}
        </span>
        {index === 0 && (
          <Badge className="ml-auto bg-black text-white text-xs border-black">ALWAYS SHOWN</Badge>
        )}
      </div>

      <AnimatePresence mode="wait">
        {revealed ? (
          <motion.div
            key="revealed"
            initial={reduced ? {} : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="px-4 py-4"
          >
            <p className="font-sans text-base font-bold text-black leading-snug">{text}</p>
          </motion.div>
        ) : (
          <motion.button
            key="locked"
            onClick={onReveal}
            className="w-full px-4 py-5 flex items-center justify-center gap-3 cursor-pointer group"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            <Lock className="w-5 h-5 text-black/40 group-hover:text-black/60 transition-colors" />
            <span className="font-display font-black text-sm uppercase tracking-wide text-black/50 group-hover:text-black/70 transition-colors">
              Tap to Reveal
            </span>
            <ChevronDown className="w-5 h-5 text-black/40 group-hover:text-black/60 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ClockIt() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playVictory } = useSfx();
  const reduced = useReducedMotion();
  const countdown = useCountdown();
  const inputRef = useRef<HTMLInputElement>(null);

  const todayDate = new Date().toISOString().split("T")[0];
  // Storage keys (`ptq-guess-the-year-…`, `ptq-streak-guess-the-year`,
  // `ptq-last-guess-the-year`, and the `gty*` fields in `ptq-stats`) are
  // intentionally kept under their legacy names so player progress saved
  // before the rename to "Clock It" still loads. These are internal
  // identifiers only — no UI surface ever shows them.
  const storageKey = `ptq-guess-the-year-${todayDate}`;

  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";
  const [playerName, setPlayerName] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredPlayerName() : ""
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const leaderboardQuery = useGetClockItLeaderboard(
    { date: todayDate, playerToken },
    {
      query: {
        queryKey: getGetClockItLeaderboardQueryKey({ date: todayDate, playerToken }),
        enabled: leaderboardEnabled,
      },
    },
  );
  const scoresMutation = useSubmitClockItScore();
  const updateNameMutation = useUpdatePlayerName();

  function commitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePlayerName(trimmed);
    setPlayerName(trimmed);
    updateNameMutation.mutate({ data: { playerToken, playerName: trimmed } });
  }

  const [hintsRevealed, setHintsRevealed] = useState(1);
  const [yearInput, setYearInput] = useState("");
  const [wrongMessage, setWrongMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<GamePhase>("playing");
  const [finalScore, setFinalScore] = useState(0);
  const [finalYear, setFinalYear] = useState<number | null>(null);
  const [savedState, setSavedState] = useState<SavedState | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const recordedRef = useRef(false);

  useEffect(() => {
    // Re-fetch when the date rolls over (todayDate changes at midnight).
    // useCountdown re-renders every second, so the first post-midnight render
    // will trigger this effect with the new date.
    let active = true;
    setIsLoading(true);
    setIsError(false);
    const fetchPuzzle = async () => {
      try {
        const resp = await fetch("/api/daily/clock-it");
        if (!resp.ok) throw new Error("Failed to fetch");
        const data: Puzzle = await resp.json();
        if (active) {
          setPuzzle(data);
          setFinalYear(data.year);
        }
      } catch {
        if (active) setIsError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void fetchPuzzle();
    return () => { active = false; };
  }, [todayDate]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: SavedState = JSON.parse(saved);
        if (parsed.completed) {
          setSavedState(parsed);
          setFinalScore(parsed.score);
          setFinalYear(parsed.year ?? null);
          setHintsRevealed(parsed.hintsUsed);
          setPhase(parsed.gaveUp ? "failed" : "success");
          recordedRef.current = true;
          setLeaderboardEnabled(true);
        } else if (parsed.inProgress && parsed.hintsUsed > 1) {
          setHintsRevealed(parsed.hintsUsed);
        }
      } else {
        // No save for today — reset to a fresh game. This handles the midnight
        // rollover when the component stays mounted: useCountdown re-renders
        // every second, so storageKey updates at midnight and this branch fires,
        // clearing any completed state from the previous day.
        setSavedState(null);
        setFinalScore(0);
        setFinalYear(null);
        setHintsRevealed(1);
        setPhase("playing");
        recordedRef.current = false;
      }
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const saveResult = useCallback(
    (score: number, hintsUsed: number, gaveUp: boolean, year: number) => {
      if (recordedRef.current) return;
      recordedRef.current = true;

      const state: SavedState = {
        completed: true,
        score,
        hintsUsed,
        gaveUp,
        year,
        date: todayDate,
      };
      try {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch {
        /* ignore */
      }

      if (!gaveUp && score > 0) {
        scoresMutation.mutate(
          { data: { playerToken, score, hintsUsed, date: todayDate } },
          {
            onSettled: () => setLeaderboardEnabled(true),
          },
        );
      } else {
        setLeaderboardEnabled(true);
      }

      try {
        const raw = localStorage.getItem("ptq-stats");
        const stats = raw ? JSON.parse(raw) : {};
        // Read legacy `gty*` as fallback so prior progress carries over;
        // write canonical `clockIt*` going forward.
        const prevPlays = stats.clockItTotalPlays ?? stats.gtyTotalPlays ?? 0;
        const prevTotalScore = stats.clockItTotalScore ?? stats.gtyTotalScore ?? 0;
        const prevBest = stats.clockItBestScore ?? stats.gtyBestScore ?? 0;
        const prevPerfect = stats.clockItPerfectGames ?? stats.gtyPerfectGames ?? 0;
        const prevHints = stats.clockItHintsSum ?? stats.gtyHintsSum ?? 0;
        stats.clockItTotalPlays = prevPlays + 1;
        stats.clockItTotalScore = prevTotalScore + score;
        stats.clockItBestScore = Math.max(prevBest, score);
        stats.clockItPerfectGames = prevPerfect + (score === 3 ? 1 : 0);
        stats.clockItHintsSum = prevHints + hintsUsed;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        // Canonical keys are now `ptq-{streak,last}-clock-it`. We still
        // read AND write the legacy `…-guess-the-year` keys so existing
        // streaks carry forward and any older code paths that still read
        // the legacy keys keep working.
        const lastKeyNew = "ptq-last-clock-it";
        const streakKeyNew = "ptq-streak-clock-it";
        const lastKeyOld = "ptq-last-guess-the-year";
        const streakKeyOld = "ptq-streak-guess-the-year";
        const last = localStorage.getItem(lastKeyNew) ?? localStorage.getItem(lastKeyOld);
        const streakCount = parseInt(
          localStorage.getItem(streakKeyNew) ?? localStorage.getItem(streakKeyOld) ?? "0",
        );
        let nextStreak: string;
        if (last === yesterdayStr) {
          nextStreak = String(streakCount + 1);
        } else if (last === todayDate) {
          nextStreak = String(streakCount);
        } else {
          nextStreak = "1";
        }
        localStorage.setItem(streakKeyNew, nextStreak);
        localStorage.setItem(streakKeyOld, nextStreak);
        localStorage.setItem(lastKeyNew, todayDate);
        localStorage.setItem(lastKeyOld, todayDate);
        localStorage.setItem("ptq-stats", JSON.stringify(stats));
      } catch {
        /* ignore */
      }
    },
    [storageKey, todayDate],
  );

  const handleRevealHint = useCallback(
    (index: number) => {
      if (index !== hintsRevealed || phase !== "playing") return;
      const next = index + 1;
      setHintsRevealed(next);
      setWrongMessage(null);
      try {
        const partial: SavedState = {
          completed: false,
          inProgress: true,
          score: 0,
          hintsUsed: next,
          gaveUp: false,
          date: todayDate,
        };
        localStorage.setItem(storageKey, JSON.stringify(partial));
      } catch {
        /* ignore */
      }
    },
    [hintsRevealed, phase, storageKey, todayDate],
  );

  const handleSubmit = useCallback(async () => {
    if (!puzzle || phase !== "playing") return;
    const year = parseInt(yearInput, 10);
    if (isNaN(year) || yearInput.length !== 4) {
      toast({
        title: "Enter a 4-digit year",
        className: "border-[3px] border-black bg-[#FFD700] text-black font-bold",
      });
      return;
    }

    try {
      const resp = await fetch("/api/daily/clock-it/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: puzzle.id, guess: year }),
      });
      const data: { correct: boolean; year?: number } = await resp.json();

      if (data.correct && data.year !== undefined) {
        const score = scoreFromHints(hintsRevealed);
        setFinalScore(score);
        setFinalYear(data.year);
        setPhase("success");
        playCorrect();
        hapticCorrect();
        if (score === 3) {
          fireBigCelebration();
        } else {
          fireConfetti("rainbow");
        }
        hapticVictory();
        playVictory();
        saveResult(score, hintsRevealed, false, data.year);
      } else {
        setShakeKey((k) => k + 1);
        playWrong();
        hapticWrong();
        const msg = "Not quite — try again!";
        setWrongMessage(msg);
        setYearInput("");
        inputRef.current?.focus();
        toast({
          title: msg,
          className: "border-[3px] border-black bg-[#FF6B35] text-white font-bold",
        });
      }
    } catch {
      toast({
        title: "Something went wrong — try again",
        variant: "destructive",
      });
    }
  }, [puzzle, phase, yearInput, hintsRevealed, playCorrect, playWrong, playVictory, saveResult, toast]);

  const handleGiveUp = useCallback(async () => {
    if (!puzzle || phase !== "playing") return;
    try {
      const resp = await fetch("/api/daily/clock-it/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: puzzle.id, giveUp: true }),
      });
      const data: { correct: boolean; year?: number } = await resp.json();
      const year = data.year ?? 0;
      setFinalScore(0);
      setFinalYear(year);
      setPhase("failed");
      playWrong();
      hapticWrong();
      saveResult(0, hintsRevealed, true, year);
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    }
  }, [puzzle, phase, hintsRevealed, playWrong, saveResult, toast]);

  const handleShare = useCallback(() => {
    if (!puzzle) return;
    const score = savedState?.score ?? finalScore;
    const hintsUsed = savedState?.hintsUsed ?? hintsRevealed;
    const gaveUp = savedState?.gaveUp ?? (phase === "failed");
    // Deterministic en-US date so share text is identical regardless of
    // the player's locale (e.g. "May 3, 2026").
    const humanDate = new Date(puzzle.date + "T00:00:00Z").toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
    });
    const hintLabel = hintsUsed === 1 ? "hint" : "hints";
    const resultEmoji = gaveUp
      ? "💀"
      : score === 3 ? "🏆" : score === 2 ? "⭐" : "✓";
    const text = [
      `Pop The Question - Clock It`,
      humanDate,
      ``,
      gaveUp
        ? `Gave up (the year was ${finalYear}) ${resultEmoji}`
        : `Clocked it in ${hintsUsed} ${hintLabel}! ${resultEmoji}`,
      ``,
      `poptq.com`,
    ].join("\n");

    navigator.clipboard
      .writeText(text)
      .then(() => toast({ title: "Copied to clipboard!", description: text }))
      .catch(() => toast({ title: "Share failed", variant: "destructive" }));
  }, [puzzle, savedState, finalScore, finalYear, hintsRevealed, phase]);

  const stats = (() => {
    try {
      const raw = localStorage.getItem("ptq-stats");
      if (!raw) return null;
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return null;
    }
  })();

  const streak = (() => {
    try {
      return parseInt(
        localStorage.getItem("ptq-streak-clock-it")
          ?? localStorage.getItem("ptq-streak-guess-the-year")
          ?? "0",
      );
    } catch {
      return 0;
    }
  })();

  const lbData = leaderboardQuery.data;
  const serverRank = lbData?.playerRank ?? null;
  const myRankInTop10 = lbData ? lbData.top10.findIndex((e) => e.playerToken === playerToken) + 1 : 0;
  const myRank = serverRank ?? (myRankInTop10 > 0 ? myRankInTop10 : null);
  const rankPercentile =
    myRank !== null && lbData && lbData.totalPlayers > 0
      ? Math.round((1 - (myRank - 1) / lbData.totalPlayers) * 100)
      : null;

  if (isLoading) {
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

  if (isError || !puzzle) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div className="border-[3px] border-black bg-white p-6 shadow-[4px_4px_0_#000]">
          <p className="font-display font-black text-xl">Couldn't load today's puzzle</p>
          <p className="text-sm text-black/60 mt-2">Try refreshing the page</p>
        </div>
      </div>
    );
  }

  const isCompleted = phase !== "playing";

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-x-hidden">
      {/* Header */}
      <header className="bg-[#FFD700] border-b-[4px] border-black px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <BackArrow className="text-black [&_svg]:stroke-black" />
        <div className="text-center">
          <h1 className="font-display font-black text-black text-xl uppercase tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Clock It
          </h1>
          <p className="text-black/70 text-xs font-bold uppercase">Which year is it?</p>
        </div>
        <div className="flex items-center gap-1 bg-black text-[#FFD700] border-[2px] border-black px-2 py-1 shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
          <Trophy className="w-4 h-4" />
          <span className="font-display font-black text-sm">{streak}</span>
        </div>
      </header>
      <div className="flex-1 flex flex-col p-4 gap-4 max-w-xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {!isCompleted ? (
            <motion.div
              key="playing"
              initial={reduced ? {} : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? {} : { opacity: 0, y: -20 }}
              className="flex flex-col gap-4"
            >
              {/* Score preview */}
              <div className="flex items-center gap-2 justify-center">
                {[3, 2, 1].map((pts) => {
                  const hintNeeded = 4 - pts;
                  const active = hintsRevealed <= hintNeeded;
                  return (
                    <div
                      key={pts}
                      className={`flex items-center gap-1 border-[2px] border-black px-3 py-1 transition-all ${
                        active
                          ? "bg-[#00C853] shadow-[2px_2px_0_#000]"
                          : "bg-black/10 opacity-40"
                      }`}
                    >
                      <span className="font-display font-black text-sm">{pts}</span>
                      <span className="text-xs font-bold">pts</span>
                    </div>
                  );
                })}
                <div className="flex items-center gap-1 border-[2px] border-black px-3 py-1 bg-black/10 opacity-40">
                  <span className="font-display font-black text-sm">0</span>
                  <span className="text-xs font-bold">give up</span>
                </div>
              </div>

              {/* Hint cards */}
              {([0, 1, 2] as const).map((i) => (
                <HintCard
                  key={i}
                  index={i}
                  text={puzzle.hints[i]}
                  revealed={i < hintsRevealed}
                  onReveal={() => handleRevealHint(i)}
                  reduced={reduced}
                />
              ))}

              {/* Wrong message */}
              <AnimatePresence>
                {wrongMessage && (
                  <motion.div
                    key={`wrong-${shakeKey}`}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-[#FF6B35] border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-3 text-center"
                  >
                    <p className="font-display font-black text-white text-base uppercase">
                      {wrongMessage}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Year input */}
              <motion.div
                key={`shake-${shakeKey}`}
                animate={
                  shakeKey > 0
                    ? { x: [0, -10, 10, -6, 6, -3, 3, 0] }
                    : {}
                }
                transition={{ duration: 0.4 }}
                className="flex gap-3"
              >
                <input
                  ref={inputRef}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="e.g. 2007"
                  value={yearInput}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                    setYearInput(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleSubmit();
                  }}
                  className="flex-1 border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-4 font-display font-black text-2xl text-center focus:outline-none focus:ring-0 focus:border-[#FF1493] bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ minHeight: 64 }}
                />
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={yearInput.length !== 4}
                  className="h-auto px-6 font-display font-black text-base uppercase bg-[#FF1493] text-white border-[3px] border-black shadow-[4px_4px_0_#000] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all comic-headline disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_#000]"
                >
                  Guess!
                </Button>
              </motion.div>

              {/* Give up */}
              <button
                onClick={() => void handleGiveUp()}
                className="text-center text-sm text-black/50 hover:text-black/80 font-bold uppercase tracking-wide transition-colors flex items-center justify-center gap-1"
              >
                <RotateCcw className="w-4 h-4" />
                Give up — show me the year
              </button>
            </motion.div>
          ) : (
            /* Results screen */
            (<motion.div
              key="results"
              initial={reduced ? {} : { opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Result banner */}
              <div
                className="border-[4px] border-black shadow-[6px_6px_0_#000] p-6 text-center relative overflow-hidden"
                style={{
                  backgroundColor:
                    phase === "failed"
                      ? "#000"
                      : finalScore === 3
                      ? "#FFD700"
                      : finalScore === 2
                      ? "#FF6B35"
                      : "#00E5FF",
                }}
              >
                <StarDoodle className="absolute top-2 left-3 w-8 h-8 text-white/30" />
                <LightningDoodle className="absolute bottom-2 right-3 w-6 h-10 text-white/20" />

                <p
                  className="font-display font-black text-4xl"
                  style={{ color: phase === "failed" ? "#FF1493" : "#000" }}
                >
                  {phase === "failed"
                    ? "GAVE UP 💀"
                    : finalScore === 3
                    ? "PERFECT! 🏆"
                    : finalScore === 2
                    ? "NICE! ⭐"
                    : "CLOCKED IT! ✓"}
                </p>

                <div className="mt-3 flex items-center justify-center gap-3">
                  <Calendar
                    className="w-8 h-8"
                    style={{ color: phase === "failed" ? "#FF1493" : "#000" }}
                  />
                  <span
                    className="font-display font-black text-6xl"
                    style={{ color: phase === "failed" ? "#FF1493" : "#000" }}
                  >
                    {finalYear}
                  </span>
                </div>

                {phase !== "failed" && (
                  <div className="mt-3 inline-block bg-black text-white px-3 py-1 font-bold text-sm border-[2px] border-black">
                    {finalScore} point{finalScore !== 1 ? "s" : ""} — hint {hintsRevealed} of 3
                  </div>
                )}
                {rankPercentile !== null && (
                  <div className="mt-2 inline-block bg-black text-white px-3 py-1 font-bold text-sm border-[2px] border-black">
                    Top {100 - rankPercentile + 1}% of players today
                  </div>
                )}
              </div>
              {/* All hints revealed */}
              <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] overflow-hidden">
                <div className="bg-black px-4 py-2">
                  <p className="text-white font-display font-black text-sm uppercase">All Hints</p>
                </div>
                <div className="divide-y divide-black/10">
                  {puzzle.hints.map((hint, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <span
                        className="w-3 h-3 rounded-full mt-1 flex-shrink-0 border-2 border-black"
                        style={{ backgroundColor: HINT_COLORS[i] }}
                      />
                      <p className="text-sm font-sans text-black/80">{hint}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Personal stats */}
              {stats && ((stats.clockItTotalPlays ?? stats.gtyTotalPlays) ?? 0) > 0 && (
                <div className="border-[3px] border-black bg-[#FFF8E7] shadow-[3px_3px_0_#000] p-4">
                  <p className="font-display font-black text-sm uppercase mb-3">Your Stats</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="font-display font-black text-2xl">{stats.clockItTotalPlays ?? stats.gtyTotalPlays ?? 0}</p>
                      <p className="text-xs text-black/50 font-bold uppercase">Played</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-black text-2xl">{streak}</p>
                      <p className="text-xs text-black/50 font-bold uppercase">Streak</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display font-black text-2xl">
                        {(() => {
                          const plays = stats.clockItTotalPlays ?? stats.gtyTotalPlays;
                          const hints = stats.clockItHintsSum ?? stats.gtyHintsSum;
                          return plays && hints ? (hints / plays).toFixed(1) : "—";
                        })()}
                      </p>
                      <p className="text-xs text-black/50 font-bold uppercase">Avg Hints</p>
                    </div>
                  </div>
                </div>
              )}
              {/* Leaderboard */}
              {leaderboardEnabled && (
                <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] overflow-hidden">
                  <div className="bg-black px-4 py-2 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#FFD700]" />
                    <span className="text-white font-display font-black text-sm uppercase">Today's Leaderboard</span>
                    {lbData && (
                      <Badge className="ml-auto bg-[#FFD700] text-black border-[#FFD700]">
                        {lbData.totalPlayers} played
                      </Badge>
                    )}
                  </div>
                  {lbData && lbData.top10.length > 0 ? (
                    <>
                      <div className="divide-y divide-black/10">
                        {lbData.top10.map((entry) => {
                          const isMe = entry.playerToken === playerToken;
                          const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
                          return (
                            <div
                              key={entry.playerToken}
                              className={`flex items-center gap-3 px-4 py-2 ${isMe ? "bg-[#FFD700] border-l-4 border-[#FF1493]" : ""}`}
                            >
                              <span className="font-display font-black text-sm w-6 text-center">{rankEmoji}</span>
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
                              <span className="font-display font-black text-sm">{entry.score}pt</span>
                            </div>
                          );
                        })}
                        {myRank !== null && myRankInTop10 === 0 && (
                          <div className="flex items-center gap-3 px-4 py-2 bg-[#FFD700] border-l-4 border-[#FF1493]">
                            <span className="font-display font-black text-sm w-6 text-center">#{myRank}</span>
                            <span className="flex-1 flex items-center gap-1 min-w-0">
                              {isEditingName ? (
                                <>
                                  <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); } else if (e.key === "Escape") { setIsEditingName(false); } }} maxLength={20} placeholder="Your name" className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1" />
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
                            <span className="font-display font-black text-sm">{finalScore}pt</span>
                          </div>
                        )}
                      </div>
                      {lbData.avgScore > 0 && (
                        <div className="bg-black/5 px-4 py-2 flex gap-4 text-xs font-bold text-black/60">
                          <span className="flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" />
                            Avg: {lbData.avgScore}pt
                          </span>
                        </div>
                      )}
                    </>
                  ) : isCompleted ? (
                    <div className="divide-y divide-black/10">
                      <div className="flex items-center gap-3 px-4 py-2 bg-[#FFD700] border-l-4 border-[#FF1493]">
                        <span className="font-display font-black text-sm w-6 text-center">🥇</span>
                        <span className="flex-1 flex items-center gap-1 min-w-0">
                          {isEditingName ? (
                            <>
                              <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); } else if (e.key === "Escape") { setIsEditingName(false); } }} maxLength={20} placeholder="Your name" className="font-bold text-sm bg-white border-b-2 border-black outline-none w-28 px-1" />
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
                        <span className="font-display font-black text-sm">{finalScore}pt</span>
                      </div>
                    </div>
                  ) : leaderboardQuery.isPending ? (
                    <div className="px-4 py-3 text-center text-sm text-black/50">Loading…</div>
                  ) : (
                    <div className="px-4 py-3 text-center text-sm text-black/50">Be the first to complete today's puzzle!</div>
                  )}
                </div>
              )}

              {/* Countdown */}
              <div className="border-[3px] border-black bg-white shadow-[3px_3px_0_#000] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-black" />
                  <span className="font-bold text-sm uppercase tracking-wide">Next puzzle</span>
                </div>
                <span className="font-display font-black text-2xl text-black">{countdown}</span>
              </div>
              {/* Share */}
              <Button
                onClick={handleShare}
                className="w-full h-14 font-display font-black text-base uppercase bg-black text-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_rgba(0,0,0,0.3)] hover:shadow-[2px_2px_0_rgba(0,0,0,0.3)] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all gap-2 comic-headline"
              >
                <Share2 className="w-5 h-5" />
                Share Result
              </Button>
            </motion.div>)
          )}
        </AnimatePresence>
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={() => setLocation("/archive")}
          className="py-3 px-6 bg-[#00CED1] border-[4px] border-black shadow-[4px_4px_0_#000] font-display font-black text-base text-black uppercase rounded-[12px] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-75 cursor-pointer"
        >
          Not your jam? Check out the archives
        </button>
      </div>
    </div>
  );
}
