import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ptq-streaks-v1";
const SEEN_BANNERS_KEY = "ptq-seen-banners-v1";

export type GameKey = "three-strikes" | "crossword" | "pop-the-question" | "roast-roulette";

export interface StreakState {
  totalGames: number;
  perGame: Partial<Record<GameKey, number>>;
  bestScore: Partial<Record<GameKey, number>>;
  dailyStreak: number;
  lastPlayedDate: string | null;
}

const initial: StreakState = {
  totalGames: 0,
  perGame: {},
  bestScore: {},
  dailyStreak: 0,
  lastPlayedDate: null,
};

function read(): StreakState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    return { ...initial, ...JSON.parse(raw) };
  } catch {
    return initial;
  }
}

function write(state: StreakState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seenBanners(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SEEN_BANNERS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function markSeen(key: string) {
  const seen = seenBanners();
  seen.add(key);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SEEN_BANNERS_KEY, JSON.stringify([...seen]));
  }
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

export interface Banner {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  tone: "primary" | "accent" | "gold" | "cyan";
}

export function useStreaks() {
  const [state, setState] = useState<StreakState>(initial);

  useEffect(() => {
    setState(read());
  }, []);

  const recordGame = useCallback(
    (game: GameKey, score?: number): Banner[] => {
      const current = read();
      const today = todayStr();
      const banners: Banner[] = [];

      const next: StreakState = { ...current };
      next.totalGames = (current.totalGames ?? 0) + 1;
      next.perGame = { ...current.perGame, [game]: (current.perGame[game] ?? 0) + 1 };

      if (score != null) {
        const prevBest = current.bestScore[game] ?? 0;
        if (score > prevBest) {
          next.bestScore = { ...current.bestScore, [game]: score };
          if (next.totalGames > 1) {
            banners.push({
              id: `pb-${game}-${score}`,
              emoji: "🏆",
              title: "Personal Best!",
              subtitle: `New high: ${score}`,
              tone: "gold",
            });
          }
        }
      }

      if (current.lastPlayedDate === today) {
        next.dailyStreak = current.dailyStreak;
      } else if (current.lastPlayedDate === yesterdayStr()) {
        next.dailyStreak = (current.dailyStreak ?? 0) + 1;
      } else {
        next.dailyStreak = 1;
      }
      next.lastPlayedDate = today;

      const seen = seenBanners();

      if (next.totalGames === 1 && !seen.has("welcome")) {
        banners.push({
          id: "welcome",
          emoji: "🎉",
          title: "Welcome to Pop!",
          subtitle: "Let's get electric.",
          tone: "primary",
        });
        markSeen("welcome");
      }

      const milestones = [10, 50, 100, 250];
      for (const m of milestones) {
        if (next.totalGames === m && !seen.has(`milestone-${m}`)) {
          banners.push({
            id: `milestone-${m}`,
            emoji: m >= 100 ? "💎" : m >= 50 ? "🌟" : "⭐",
            title: `${m} Games Played!`,
            subtitle: "You're on fire.",
            tone: "accent",
          });
          markSeen(`milestone-${m}`);
        }
      }

      if (
        next.dailyStreak >= 3 &&
        next.dailyStreak !== current.dailyStreak &&
        !seen.has(`streak-${today}-${next.dailyStreak}`)
      ) {
        banners.push({
          id: `streak-${next.dailyStreak}`,
          emoji: "🔥",
          title: `${next.dailyStreak} Day Streak!`,
          subtitle: "Keep it going.",
          tone: "accent",
        });
        markSeen(`streak-${today}-${next.dailyStreak}`);
      }

      write(next);
      setState(next);
      return banners;
    },
    [],
  );

  return { state, recordGame };
}
