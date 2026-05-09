import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useGetThreeFlopsLeaderboard,
  useGetPopBoxLeaderboard,
  useGetClockItLeaderboard,
  useGetPopOrDropLeaderboard,
  useGetSkinnyLeaderboard,
  useGetTodayCrossword,
  getGetThreeFlopsLeaderboardQueryKey,
  getGetPopBoxLeaderboardQueryKey,
  getGetClockItLeaderboardQueryKey,
  getGetPopOrDropLeaderboardQueryKey,
  getGetSkinnyLeaderboardQueryKey,
  getGetTodayCrosswordQueryKey,
} from "@workspace/api-client-react";
import { Trophy, Flame, Target, Clock, CalendarDays, Grid3x3, TrendingUp, History } from "lucide-react";
import { BackArrow } from "@/components/ui/BackArrow";
import { CountUp } from "@/components/fx";
import { LightningDoodle, StarDoodle, SmileyDoodle } from "@/components/fx/Doodles";

interface Stats {
  threeFlopsTotalPlays: number;
  threeFlopsBestScore: number;
  crosswordTotalPlays: number;
  crosswordBestTime: number;
  popBoxTotalPlays: number;
  popBoxBestScore: number;
  popBoxBestRarity: number | null;
  popBoxPerfectGames: number;
  popBoxScoreSum: number;
  popOrDropTotalPlays: number;
  popOrDropBestStreak: number;
  popOrDropStreakSum: number;
  popOrDropPerfectGames: number;
  clockItTotalPlays: number;
  clockItBestScore: number;
  clockItPerfectGames: number;
  clockItTotalScore: number;
  clockItHintsSum: number;
}

interface HistoryEntry {
  game: "three-flops" | "skinny" | "pop-box" | "clock-it" | "pop-or-drop";
  date: string;
  scoreLabel: string;
  resultEmoji: string;
  href: string;
}

const GAME_META = {
  "three-flops": { name: "Three Flops", color: "#FFD700", emoji: "🎯", route: "/daily/three-flops" },
  "skinny": { name: "The Skinny", color: "#00C853", emoji: "🧠", route: "/daily/crossword" },
  "pop-box": { name: "Pop Box", color: "#FF1493", emoji: "🎬", route: "/daily/pop-box" },
  "clock-it": { name: "Clock It", color: "#FF6B35", emoji: "⏰", route: "/daily/clock-it" },
  "pop-or-drop": { name: "Pop or Drop", color: "#00E5FF", emoji: "🔥", route: "/daily/pop-or-drop" },
} as const;

function getPlayerToken(): string {
  if (typeof window === "undefined") return "";
  let token = localStorage.getItem("ptq-player-token");
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem("ptq-player-token", token);
  }
  return token;
}

function formatTime(seconds: number): string {
  if (!seconds) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatHistoryDate(d: string): string {
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const out: HistoryEntry[] = [];
  const dateRe = /^(\d{4}-\d{2}-\d{2})$/;

  const tryParse = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  };

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    let m: RegExpMatchArray | null;
    if ((m = key.match(/^ptq-three-strikes-(.+)$/)) && dateRe.test(m[1])) {
      const data = tryParse<{ completed?: boolean; hasWon?: boolean; score?: number; total?: number }>(localStorage.getItem(key));
      if (data?.completed) {
        out.push({
          game: "three-flops",
          date: m[1],
          scoreLabel: `${data.score ?? 0}/${data.total ?? "?"}`,
          resultEmoji: data.hasWon ? "✓" : "💀",
          href: GAME_META["three-flops"].route,
        });
      }
    } else if ((m = key.match(/^ptq-crossword-(.+)$/)) && dateRe.test(m[1])) {
      const data = tryParse<{ completed?: boolean; time?: number }>(localStorage.getItem(key));
      if (data?.completed) {
        out.push({
          game: "skinny",
          date: m[1],
          scoreLabel: formatTime(data.time ?? 0),
          resultEmoji: "✓",
          href: GAME_META.skinny.route,
        });
      }
    } else if ((m = key.match(/^ptq-pop-box-(.+)$/)) && dateRe.test(m[1])) {
      const data = tryParse<{ completed?: boolean; score?: number }>(localStorage.getItem(key));
      if (data?.completed) {
        const score = data.score ?? 0;
        out.push({
          game: "pop-box",
          date: m[1],
          scoreLabel: `${score}/9`,
          resultEmoji: score === 9 ? "🏆" : score >= 5 ? "✓" : "💀",
          href: GAME_META["pop-box"].route,
        });
      }
    } else if ((m = key.match(/^ptq-guess-the-year-(.+)$/)) && dateRe.test(m[1])) {
      const data = tryParse<{ completed?: boolean; score?: number; gaveUp?: boolean; inProgress?: boolean }>(localStorage.getItem(key));
      if (data?.completed && !data.inProgress) {
        const score = data.score ?? 0;
        out.push({
          game: "clock-it",
          date: m[1],
          scoreLabel: data.gaveUp ? "—" : `${score}pt`,
          resultEmoji: data.gaveUp ? "💀" : score === 3 ? "🏆" : score === 2 ? "⭐" : "✓",
          href: GAME_META["clock-it"].route,
        });
      }
    } else if ((m = key.match(/^ptq-pop-or-drop-(.+)$/)) && dateRe.test(m[1])) {
      const data = tryParse<{ done?: boolean; streak?: number }>(localStorage.getItem(key));
      if (data?.done) {
        out.push({
          game: "pop-or-drop",
          date: m[1],
          scoreLabel: `🔥 ${data.streak ?? 0}`,
          resultEmoji: (data.streak ?? 0) >= 10 ? "🏆" : "✓",
          href: GAME_META["pop-or-drop"].route,
        });
      }
    }
  }

  out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return out;
}

function rankPercentile(rank: number | null | undefined, total: number): number | null {
  if (!rank || !total) return null;
  return Math.round((1 - (rank - 1) / total) * 100);
}

export default function Stats() {
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";
  const todayDate = new Date().toISOString().split("T")[0];

  const [stats, setStats] = useState<Stats>({
    threeFlopsTotalPlays: 0,
    threeFlopsBestScore: 0,
    crosswordTotalPlays: 0,
    crosswordBestTime: 0,
    popBoxTotalPlays: 0,
    popBoxBestScore: 0,
    popBoxBestRarity: null,
    popBoxPerfectGames: 0,
    popBoxScoreSum: 0,
    popOrDropTotalPlays: 0,
    popOrDropBestStreak: 0,
    popOrDropStreakSum: 0,
    popOrDropPerfectGames: 0,
    clockItTotalPlays: 0,
    clockItBestScore: 0,
    clockItPerfectGames: 0,
    clockItTotalScore: 0,
    clockItHintsSum: 0,
  });
  const [tsStreak, setTsStreak] = useState(0);
  const [cwStreak, setCwStreak] = useState(0);
  const [pbStreak, setPbStreak] = useState(0);
  const [podStreak, setPodStreak] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ptq-stats");
      const parsed = raw ? JSON.parse(raw) : {};
      setStats((prev) => ({
        ...prev,
        ...parsed,
        // Legacy three-strikes / gty keys persisted before renames; fall back so player history doesn't appear to reset.
        threeFlopsTotalPlays: parsed.threeFlopsTotalPlays ?? parsed.threeStrikesTotalPlays ?? 0,
        threeFlopsBestScore: parsed.threeFlopsBestScore ?? parsed.threeStrikesBestScore ?? 0,
        clockItTotalPlays: parsed.clockItTotalPlays ?? parsed.gtyTotalPlays ?? 0,
        clockItBestScore: parsed.clockItBestScore ?? parsed.gtyBestScore ?? 0,
        clockItPerfectGames: parsed.clockItPerfectGames ?? parsed.gtyPerfectGames ?? 0,
        clockItTotalScore: parsed.clockItTotalScore ?? parsed.gtyTotalScore ?? 0,
        clockItHintsSum: parsed.clockItHintsSum ?? parsed.gtyHintsSum ?? 0,
      }));

      setTsStreak(parseInt(
        localStorage.getItem("ptq-streak-three-flops")
          ?? localStorage.getItem("ptq-streak-three-strikes")
          ?? "0"));
      setCwStreak(parseInt(localStorage.getItem("ptq-streak-crossword") || "0"));
      setPbStreak(parseInt(localStorage.getItem("ptq-streak-pop-box") || "0"));
      setPodStreak(parseInt(localStorage.getItem("ptq-streak-pop-or-drop") || "0"));
      setHistory(readHistory());
    } catch {/* ignore */}
  }, []);

  // Today's leaderboard rankings — server queries.
  const tfLb = useGetThreeFlopsLeaderboard(
    { date: todayDate, playerToken },
    { query: { queryKey: getGetThreeFlopsLeaderboardQueryKey({ date: todayDate, playerToken }), enabled: !!playerToken } },
  );
  const pbLb = useGetPopBoxLeaderboard(
    { date: todayDate, playerToken },
    { query: { queryKey: getGetPopBoxLeaderboardQueryKey({ date: todayDate, playerToken }), enabled: !!playerToken } },
  );
  const ciLb = useGetClockItLeaderboard(
    { date: todayDate, playerToken },
    { query: { queryKey: getGetClockItLeaderboardQueryKey({ date: todayDate, playerToken }), enabled: !!playerToken } },
  );
  const podLb = useGetPopOrDropLeaderboard(
    { date: todayDate, playerToken },
    { query: { queryKey: getGetPopOrDropLeaderboardQueryKey({ date: todayDate, playerToken }), enabled: !!playerToken } },
  );
  // Skinny needs a puzzleId — fetch today's puzzle to get it.
  const todaySkinny = useGetTodayCrossword({
    query: { queryKey: getGetTodayCrosswordQueryKey() },
  });
  const skinnyPuzzleId = todaySkinny.data?.id;
  const skLb = useGetSkinnyLeaderboard(
    { puzzleId: skinnyPuzzleId, playerToken },
    {
      query: {
        queryKey: getGetSkinnyLeaderboardQueryKey({ puzzleId: skinnyPuzzleId, playerToken }),
        enabled: !!playerToken && !!skinnyPuzzleId,
      },
    },
  );

  const rankings = useMemo(() => {
    return [
      {
        key: "three-flops" as const,
        rank: tfLb.data?.playerRank ?? null,
        total: tfLb.data?.totalPlayers ?? 0,
        loading: tfLb.isPending,
      },
      {
        key: "skinny" as const,
        rank: skLb.data?.playerRank ?? null,
        total: skLb.data?.totalPlayers ?? 0,
        loading: skLb.isPending || todaySkinny.isPending,
      },
      {
        key: "pop-box" as const,
        rank: pbLb.data?.playerRank ?? null,
        total: pbLb.data?.totalPlayers ?? 0,
        loading: pbLb.isPending,
      },
      {
        key: "clock-it" as const,
        rank: ciLb.data?.playerRank ?? null,
        total: ciLb.data?.totalPlayers ?? 0,
        loading: ciLb.isPending,
      },
      {
        key: "pop-or-drop" as const,
        rank: podLb.data?.playerRank ?? null,
        total: podLb.data?.totalPlayers ?? 0,
        loading: podLb.isPending,
      },
    ];
  }, [tfLb.data, tfLb.isPending, skLb.data, skLb.isPending, pbLb.data, pbLb.isPending, ciLb.data, ciLb.isPending, podLb.data, podLb.isPending, todaySkinny.isPending]);

  const totalPlays =
    stats.threeFlopsTotalPlays + stats.crosswordTotalPlays + stats.popBoxTotalPlays + stats.popOrDropTotalPlays + stats.clockItTotalPlays;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
      <div className="mb-4">
        <BackArrow href="/" label="Back to home" />
      </div>

      {/* HEADER */}
      <div className="relative bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] px-5 py-5 mb-8 overflow-hidden">
        <LightningDoodle className="absolute top-2 right-3 w-7 h-10 text-[#FF6B35] opacity-60" />
        <StarDoodle className="absolute bottom-1 right-16 w-5 h-5 text-[#FF1493] opacity-70" />
        <h1 className="font-display text-3xl md:text-5xl font-black text-black uppercase tracking-tight">
          Your Scores
        </h1>
        <p className="text-base text-black/70 font-sans font-bold mt-1">
          Personal stats, history, and today's rankings
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <span className="inline-flex items-center gap-1 bg-black text-white border-[3px] border-black px-3 py-1 font-display font-black text-sm uppercase tracking-wider">
            <CalendarDays className="w-3.5 h-3.5" />
            <CountUp value={totalPlays} /> total plays
          </span>
        </div>
      </div>

      {/* PERSONAL STATS — game cards */}
      <h2 className="font-display text-2xl md:text-3xl font-black text-black uppercase tracking-tight mb-4">
        Personal Stats
      </h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {/* Three Flops */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
          <LightningDoodle className="absolute top-2 right-3 w-5 h-7 text-[#FFD700] opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-5 h-5 text-black" />
            <h3 className="font-display text-xl font-black text-black uppercase">Three Flops</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Streak" value={tsStreak} icon={<Flame className={`w-4 h-4 ${tsStreak > 0 ? "text-[#FF6B35]" : "text-black/30"}`} />} bg="#FFD700" />
            <StatTile label="Plays" value={stats.threeFlopsTotalPlays} icon={<CalendarDays className="w-4 h-4" />} />
            <div className="col-span-2 bg-[#FFD700] border-[3px] border-black p-3">
              <p className="text-[10px] text-black/70 font-display font-black uppercase tracking-wider">Personal Best</p>
              <div className="text-3xl font-display font-black flex items-center gap-2 mt-0.5">
                <CountUp value={stats.threeFlopsBestScore} />
                <Trophy className="w-5 h-5 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* The Skinny */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
          <StarDoodle className="absolute top-2 right-3 w-6 h-6 text-[#00C853] opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-black" />
            <h3 className="font-display text-xl font-black text-black uppercase">The Skinny</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Streak" value={cwStreak} icon={<Flame className={`w-4 h-4 ${cwStreak > 0 ? "text-[#FF6B35]" : "text-black/30"}`} />} bg="#00C853" />
            <StatTile label="Plays" value={stats.crosswordTotalPlays} icon={<CalendarDays className="w-4 h-4" />} />
            <div className="col-span-2 bg-[#00C853] border-[3px] border-black p-3">
              <p className="text-[10px] text-black/70 font-display font-black uppercase tracking-wider">Best Time</p>
              <div className="text-3xl font-display font-black flex items-center gap-2 mt-0.5">
                {formatTime(stats.crosswordBestTime)}
                <Trophy className="w-5 h-5 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Pop Box */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
          <SmileyDoodle className="absolute top-2 right-3 w-6 h-6 text-[#FF1493] opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <Grid3x3 className="w-5 h-5 text-black" />
            <h3 className="font-display text-xl font-black text-black uppercase">Pop Box</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Streak" value={pbStreak} icon={<Flame className={`w-4 h-4 ${pbStreak > 0 ? "text-[#FF6B35]" : "text-black/30"}`} />} bg="#FF1493" textWhite />
            <StatTile label="Plays" value={stats.popBoxTotalPlays} icon={<CalendarDays className="w-4 h-4" />} />
            <StatTile label="Perfect" value={stats.popBoxPerfectGames} icon={<Trophy className={`w-4 h-4 ${stats.popBoxPerfectGames > 0 ? "text-[#FFD700]" : "text-black/30"}`} />} />
            <StatTile
              label="Avg /9"
              value={stats.popBoxTotalPlays > 0 ? Math.round(((stats.popBoxScoreSum ?? 0) / stats.popBoxTotalPlays) * 10) / 10 : "—"}
              icon={<Target className="w-4 h-4" />}
            />
            <div className="col-span-2 bg-[#FF1493] border-[3px] border-black p-3">
              <p className="text-[10px] text-white/90 font-display font-black uppercase tracking-wider">Personal Best</p>
              <div className="text-3xl font-display font-black flex items-center gap-2 mt-0.5 text-white">
                <CountUp value={stats.popBoxBestScore} /><span className="text-xl">/9</span>
                <Trophy className="w-5 h-5 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Clock It */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
          <StarDoodle className="absolute top-2 right-3 w-6 h-6 text-[#FF6B35] opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-black" />
            <h3 className="font-display text-xl font-black text-black uppercase">Clock It</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Plays" value={stats.clockItTotalPlays} icon={<CalendarDays className="w-4 h-4" />} />
            <StatTile label="Perfect" value={stats.clockItPerfectGames} icon={<Trophy className={`w-4 h-4 ${stats.clockItPerfectGames > 0 ? "text-[#FFD700]" : "text-black/30"}`} />} />
            <StatTile
              label="Avg Hints"
              value={stats.clockItTotalPlays && stats.clockItHintsSum ? (stats.clockItHintsSum / stats.clockItTotalPlays).toFixed(1) : "—"}
              icon={<Target className="w-4 h-4" />}
            />
            <StatTile
              label="Avg Pts"
              value={stats.clockItTotalPlays && stats.clockItTotalScore ? (stats.clockItTotalScore / stats.clockItTotalPlays).toFixed(1) : "—"}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <div className="col-span-2 bg-[#FF6B35] border-[3px] border-black p-3">
              <p className="text-[10px] text-black/70 font-display font-black uppercase tracking-wider">Personal Best</p>
              <div className="text-3xl font-display font-black flex items-center gap-2 mt-0.5">
                <CountUp value={stats.clockItBestScore} /><span className="text-xl">pt</span>
                <Trophy className="w-5 h-5 ml-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Pop or Drop */}
        <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-5 relative overflow-hidden">
          <LightningDoodle className="absolute top-2 right-3 w-5 h-7 text-[#00E5FF] opacity-60" />
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-black" />
            <h3 className="font-display text-xl font-black text-black uppercase">Pop or Drop</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Streak" value={podStreak} icon={<Flame className={`w-4 h-4 ${podStreak > 0 ? "text-[#FF6B35]" : "text-black/30"}`} />} bg="#00E5FF" />
            <StatTile label="Plays" value={stats.popOrDropTotalPlays} icon={<CalendarDays className="w-4 h-4" />} />
            <StatTile label="Perfect" value={stats.popOrDropPerfectGames} icon={<Trophy className={`w-4 h-4 ${stats.popOrDropPerfectGames > 0 ? "text-[#FFD700]" : "text-black/30"}`} />} />
            <StatTile
              label="Avg Streak"
              value={stats.popOrDropTotalPlays > 0 ? Math.round(((stats.popOrDropStreakSum ?? 0) / stats.popOrDropTotalPlays) * 10) / 10 : "—"}
              icon={<Target className="w-4 h-4" />}
            />
            <div className="col-span-2 bg-[#00E5FF] border-[3px] border-black p-3">
              <p className="text-[10px] text-black/70 font-display font-black uppercase tracking-wider">Best Streak</p>
              <div className="text-3xl font-display font-black flex items-center gap-2 mt-0.5">
                <CountUp value={stats.popOrDropBestStreak} />
                <Flame className="w-5 h-5 text-[#FF1493] ml-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* TODAY'S LEADERBOARD RANKINGS */}
      <h2 className="font-display text-2xl md:text-3xl font-black text-black uppercase tracking-tight mb-4">
        Today's Rankings
      </h2>
      <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] divide-y-[3px] divide-black mb-12">
        {rankings.map(({ key, rank, total, loading }) => {
          const meta = GAME_META[key];
          const pct = rankPercentile(rank, total);
          return (
            <Link key={key} href={meta.route}>
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 cursor-pointer">
                <span
                  className="inline-flex items-center justify-center w-9 h-9 border-[3px] border-black font-display font-black text-base shrink-0"
                  style={{ background: meta.color }}
                >
                  {meta.emoji}
                </span>
                <span className="flex-1 font-display font-black text-base uppercase tracking-tight">{meta.name}</span>
                {loading ? (
                  <span className="text-sm text-black/50 font-sans">Loading…</span>
                ) : rank ? (
                  <div className="flex items-center gap-3">
                    <span className="font-display font-black text-lg">#{rank}</span>
                    {pct !== null && (
                      <span className="bg-[#FFD700] border-[3px] border-black px-2 py-0.5 font-display font-black text-xs uppercase">
                        Top {Math.max(1, 100 - pct)}%
                      </span>
                    )}
                    <span className="text-xs font-bold text-black/60 hidden sm:inline">
                      of {total}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-black/50 font-sans italic">Not played today</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* GAME HISTORY */}
      <h2 className="font-display text-2xl md:text-3xl font-black text-black uppercase tracking-tight mb-4 flex items-center gap-2">
        <History className="w-6 h-6" />
        Recent Games
      </h2>
      <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] mb-12">
        {history.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="font-display font-black text-lg text-black/60 uppercase">No games played yet</p>
            <p className="text-sm text-black/50 font-sans mt-1">Try a daily puzzle to start your streak!</p>
            <Link href="/">
              <span className="mt-4 inline-flex items-center bg-[#FF1493] text-white border-[3px] border-black shadow-[3px_3px_0_#000] px-5 py-2 font-display font-black text-sm uppercase tracking-wider hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] transition-all cursor-pointer">
                Play Now
              </span>
            </Link>
          </div>
        ) : (
          <div className="divide-y-[3px] divide-black">
            {history.slice(0, 12).map((entry, idx) => {
              const meta = GAME_META[entry.game];
              return (
                <Link key={`${entry.game}-${entry.date}-${idx}`} href={entry.href}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/5 cursor-pointer">
                    <span
                      className="inline-flex items-center justify-center w-9 h-9 border-[3px] border-black font-display font-black text-base shrink-0"
                      style={{ background: meta.color }}
                    >
                      {meta.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-black text-base uppercase tracking-tight truncate">{meta.name}</div>
                      <div className="text-xs text-black/60 font-sans">{formatHistoryDate(entry.date)}</div>
                    </div>
                    <span className="font-display font-black text-base">{entry.scoreLabel}</span>
                    <span className="text-lg shrink-0">{entry.resultEmoji}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  icon,
  bg,
  textWhite,
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  bg?: string;
  textWhite?: boolean;
}) {
  return (
    <div
      className="border-[3px] border-black p-2.5"
      style={{ background: bg ?? "#FFF8E7" }}
    >
      <p className={`text-[10px] font-display font-black uppercase tracking-wider ${textWhite ? "text-white/90" : "text-black/70"}`}>{label}</p>
      <div className={`text-2xl font-display font-black flex items-center gap-1.5 mt-0.5 ${textWhite ? "text-white" : "text-black"}`}>
        {typeof value === "number" ? <CountUp value={value} /> : value}
        {icon}
      </div>
    </div>
  );
}
