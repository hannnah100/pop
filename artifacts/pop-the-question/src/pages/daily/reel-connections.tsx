import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGetTodayReelConnections,
  useGetReelConnectionsById,
  useGetReelConnectionsLeaderboard,
  useSubmitReelConnectionsScore,
  useUpdatePlayerName,
  getGetTodayReelConnectionsQueryKey,
  getGetReelConnectionsByIdQueryKey,
  getGetReelConnectionsLeaderboardQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Share2, Home as HomeIcon, Trophy, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import { Shake, fireBigCelebration, BannerStack } from "@/components/fx";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticVictory, hapticWrong } from "@/lib/haptics";
import { useStreaks, type Banner } from "@/lib/streaks";

function useQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function isCorrect(guess: string, validAnswers: string[]): boolean {
  const g = normalize(guess);
  if (g.length < 2) return false;
  return validAnswers.some((a) => normalize(a) === g);
}

const TOTAL_LIVES = 5;

interface PersistedState {
  completed: boolean;
  hasWon: boolean;
  score: number;
  total: number;
  finalAnswers: (string | null)[]; // one entry per connection — null if failed at this step
  failedAt: number | null;
  livesRemaining?: number;
}

export default function ReelConnections() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playVictory } = useSfx();
  const { recordGame } = useStreaks();

  const archiveId = useQueryParam("id");
  const isArchive = !!archiveId;

  const todayQuery = useGetTodayReelConnections({
    query: { queryKey: getGetTodayReelConnectionsQueryKey(), enabled: !isArchive },
  });
  const archiveQuery = useGetReelConnectionsById(archiveId ?? "", {
    query: { queryKey: getGetReelConnectionsByIdQueryKey(archiveId ?? ""), enabled: isArchive },
  });
  const { data: puzzle, isLoading } = isArchive ? archiveQuery : todayQuery;

  const todayDate = new Date().toISOString().split("T")[0];
  const storageKey = isArchive
    ? `ptq-reel-connections-archive-${archiveId}`
    : `ptq-reel-connections-${puzzle?.date ?? todayDate}`;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [lives, setLives] = useState(TOTAL_LIVES);
  const [guess, setGuess] = useState("");
  const [revealedAnswers, setRevealedAnswers] = useState<(string | null)[]>([]); // canonical answer revealed for that step (null until correct or failed)
  const [gameOver, setGameOver] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [score, setScore] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const recordedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const playerToken = typeof window !== "undefined" ? getPlayerToken() : "";
  const [playerName, setPlayerName] = useState<string>(() =>
    typeof window !== "undefined" ? getStoredPlayerName() : "",
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const leaderboardQuery = useGetReelConnectionsLeaderboard(
    { date: puzzle?.date ?? todayDate, playerToken },
    {
      query: {
        queryKey: getGetReelConnectionsLeaderboardQueryKey({ date: puzzle?.date ?? todayDate, playerToken }),
        enabled: leaderboardEnabled && !isArchive,
      },
    },
  );
  const scoresMutation = useSubmitReelConnectionsScore();
  const updateNameMutation = useUpdatePlayerName();

  // Restore persisted state
  useEffect(() => {
    if (!puzzle) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed.completed) {
        setRevealedAnswers(parsed.finalAnswers);
        setScore(parsed.score);
        setHasWon(parsed.hasWon);
        setLives(parsed.livesRemaining ?? 0);
        setGameOver(true);
        recordedRef.current = true;
        if (!isArchive) setLeaderboardEnabled(true);
      }
    } catch {
      /* ignore */
    }
  }, [puzzle, storageKey, isArchive]);

  // Initialize revealed answers array when puzzle loads (and no saved state)
  useEffect(() => {
    if (puzzle && revealedAnswers.length === 0 && !gameOver) {
      setRevealedAnswers(Array(puzzle.validAnswers.length).fill(null));
    }
  }, [puzzle, revealedAnswers.length, gameOver]);

  // Auto-focus input when current connection changes
  useEffect(() => {
    if (!gameOver && inputRef.current) inputRef.current.focus();
  }, [currentIdx, gameOver]);

  function persist(state: PersistedState) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }

  function endGame(
    won: boolean,
    finalScore: number,
    finalAnswers: (string | null)[],
    failedAt: number | null,
    livesRemaining: number,
  ) {
    if (!puzzle) return;
    setHasWon(won);
    setScore(finalScore);
    setGameOver(true);
    setRevealedAnswers(finalAnswers);
    setLives(livesRemaining);
    persist({
      completed: true,
      hasWon: won,
      score: finalScore,
      total: puzzle.validAnswers.length,
      finalAnswers,
      failedAt,
      livesRemaining,
    });
    if (!isArchive && !recordedRef.current) {
      recordedRef.current = true;
      const newBanners = recordGame("reel-connections", finalScore);
      if (newBanners.length > 0) setBanners((prev) => [...prev, ...newBanners]);
      // Submit score to leaderboard
      if (puzzle) {
        scoresMutation.mutate(
          { data: { playerToken, score: finalScore, date: puzzle.date } },
          { onSuccess: () => setLeaderboardEnabled(true) },
        );
      }
    }
    if (won) {
      void playVictory();
      hapticVictory();
      fireBigCelebration();
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (gameOver || !puzzle) return;
    const trimmed = guess.trim();
    if (trimmed.length === 0) return;

    const valid = puzzle.validAnswers[currentIdx] ?? [];
    if (isCorrect(trimmed, valid)) {
      void playCorrect();
      hapticCorrect();
      const updated = [...revealedAnswers];
      updated[currentIdx] = trimmed;
      setRevealedAnswers(updated);
      const newScore = score + 1;
      setScore(newScore);
      setGuess("");

      if (currentIdx + 1 >= puzzle.validAnswers.length) {
        endGame(true, newScore, updated, null, lives);
      } else {
        setCurrentIdx(currentIdx + 1);
      }
    } else {
      void playWrong();
      hapticWrong();
      setShakeKey((k) => k + 1);
      const newLives = lives - 1;
      setLives(newLives);
      if (newLives <= 0) {
        // Out of lives → reveal remaining and end the game
        const updated = [...revealedAnswers];
        for (let i = currentIdx; i < puzzle.validAnswers.length; i++) {
          if (updated[i] === null) {
            updated[i] = puzzle.validAnswers[i]?.[0] ?? null;
          }
        }
        endGame(false, score, updated, currentIdx, 0);
      } else {
        toast({
          title: "Wrong!",
          description: `${newLives} ${newLives === 1 ? "life" : "lives"} left`,
        });
        setGuess("");
      }
    }
  }

  function commitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePlayerName(trimmed);
    setPlayerName(trimmed);
    updateNameMutation.mutate({ data: { playerToken, playerName: trimmed } });
  }

  function handleShare() {
    if (!puzzle) return;
    const total = puzzle.validAnswers.length;
    const livesLabel = lives === 1 ? "1 life remaining" : `${lives} lives remaining`;
    const text = `I completed today's REEL CONNECTIONS! 🎬\n${score}/${total} connections - ${livesLabel}\nPlay at popthequestion.replit.app`;
    void navigator.clipboard.writeText(text);
    toast({ title: "Copied!" });
  }

  if (isLoading || !puzzle) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8E7] p-4">
        <p className="font-display text-xl">Loading…</p>
      </div>
    );
  }

  const actors = puzzle.actors;
  const totalConnections = puzzle.validAnswers.length;
  const isCircular = totalConnections === actors.length;

  // Rectangle layout: 3 actors on top row (i=0,1,2 left→right),
  // 3 on bottom row (i=3,4,5 right→left visually), clockwise flow.
  // Slot indices: 0,1 = top arrows (→), 2 = right side (↓),
  // 3,4 = bottom arrows (←), 5 = left side (↑).
  const ARROW_GLYPH = { right: "→", down: "↓", left: "←", up: "↑" } as const;
  type FlowDir = keyof typeof ARROW_GLYPH;

  function ArrowSlot({ index, dir, size }: { index: number; dir: FlowDir; size: "h" | "v" }) {
    const succeeded = index < score;
    const isCurrent = !gameOver && index === currentIdx;
    const failed = gameOver && !succeeded;
    // Smooth viewport scaling so arrows grow with the puzzle.
    const fontSize =
      size === "v" ? "clamp(2.75rem, 9vw, 4.5rem)" : "clamp(1.75rem, 5.5vw, 3rem)";
    const baseCls = "font-display font-black leading-none";
    if (succeeded) {
      return (
        <span
          className={`${baseCls} text-[#00C853]`}
          style={{ fontSize }}
          data-testid={`slot-${index}`}
        >
          ✓
        </span>
      );
    }
    if (failed) {
      return (
        <span
          className={`${baseCls} text-[#FF1493]`}
          style={{ fontSize }}
          data-testid={`slot-${index}`}
        >
          ✗
        </span>
      );
    }
    return (
      <span
        className={`${baseCls} ${isCurrent ? "text-[#38BDF8] animate-pulse" : "text-black/30"}`}
        style={
          isCurrent
            ? {
                fontSize,
                textShadow:
                  "1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              }
            : { fontSize }
        }
        data-testid={`slot-${index}`}
      >
        {ARROW_GLYPH[dir]}
      </span>
    );
  }

  function ActorCard({ index }: { index: number }) {
    const involvedInCurrent =
      !gameOver && (index === currentIdx || index === (currentIdx + 1) % actors.length);
    return (
      <div
        className={`w-[28%] min-w-0 max-w-[200px] border-[3px] md:border-[4px] border-black shadow-[3px_3px_0_#000] md:shadow-[5px_5px_0_#000] px-2 py-2.5 md:px-3 md:py-3 text-center transition-colors ${
          involvedInCurrent ? "bg-[#FFD700]" : "bg-white"
        }`}
        data-testid={`actor-${index}`}
      >
        <p
          className="font-display font-black text-black uppercase tracking-tight leading-tight"
          style={{ fontSize: "clamp(0.8rem, 2.6vw, 1.25rem)" }}
        >
          {actors[index]}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#FFF8E7] min-h-screen relative overflow-hidden">
      <StarDoodle className="absolute top-6 left-4 w-7 h-7 text-[#FF1493] opacity-50" />
      <LightningDoodle className="absolute top-12 right-6 w-6 h-9 text-[#FFD700] opacity-50" />
      <StarDoodle className="absolute bottom-12 right-8 w-6 h-6 text-[#00E5FF] opacity-50" />

      <BannerStack banners={banners} onDone={(id) => setBanners((prev) => prev.filter((b) => b.id !== id))} />

      <div className="max-w-2xl mx-auto px-3 md:px-6 py-6 relative">
        <div className="flex items-center justify-between mb-4">
          <BackArrow onClick={() => setLocation("/")} />
          {!gameOver && (
            <div className="flex items-center gap-1.5" data-testid="lives-indicator">
              <span className="font-display text-xs uppercase mr-1">Lives:</span>
              <div className="flex gap-0.5">
                {Array.from({ length: TOTAL_LIVES }).map((_, i) => (
                  <span
                    key={i}
                    className="text-lg leading-none"
                    aria-label={i < lives ? "life remaining" : "life lost"}
                  >
                    {i < lives ? "❤️" : "🖤"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {gameOver && (
            <Badge variant="secondary" className="font-display">
              {score}/{totalConnections}
            </Badge>
          )}
        </div>

        <div className="text-center mb-4">
          <h1 className="font-display text-3xl md:text-4xl font-black text-black uppercase tracking-tight">
            Reel Connections
          </h1>
          <p className="text-sm text-black/60 font-sans mt-1">
            Name a movie or show that connects each pair around the loop
          </p>
        </div>

        {/* Rectangle loop — clockwise flow, generous breathing room between rows */}
        <Shake trigger={shakeKey}>
          <div className="w-full my-4">
            {/* Top row: actor 0 → actor 1 → actor 2 */}
            <div className="flex items-center justify-between gap-1">
              <ActorCard index={0} />
              <ArrowSlot index={0} dir="right" size="h" />
              <ActorCard index={1} />
              <ArrowSlot index={1} dir="right" size="h" />
              <ActorCard index={2} />
            </div>

            {/* Side arrows — generous vertical gap between rows */}
            <div className="flex items-center justify-between py-8 md:py-10">
              <div className="w-[28%] flex justify-center">
                {isCircular ? (
                  <ArrowSlot index={5} dir="up" size="v" />
                ) : (
                  <span aria-hidden />
                )}
              </div>
              <div className="flex-1" />
              <div className="w-[28%] flex justify-center">
                <ArrowSlot index={2} dir="down" size="v" />
              </div>
            </div>

            {/* Bottom row (visual order is reversed from index order): actor 5 ← actor 4 ← actor 3 */}
            <div className="flex items-center justify-between gap-1">
              <ActorCard index={5} />
              <ArrowSlot index={4} dir="left" size="h" />
              <ActorCard index={4} />
              <ArrowSlot index={3} dir="left" size="h" />
              <ActorCard index={3} />
            </div>
          </div>
        </Shake>

        {/* Active connection input panel */}
        {!gameOver && currentIdx < totalConnections && (
          <Shake trigger={shakeKey}>
            <div
              className="mt-4 bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-3"
              data-testid="active-panel"
            >
              <p className="font-display text-xs md:text-sm font-black text-black uppercase tracking-tight text-center mb-2">
                <span className="text-black/60">Connection {currentIdx + 1} of {totalConnections}:</span>{" "}
                {actors[currentIdx]} <span className="text-black/60">×</span>{" "}
                {actors[(currentIdx + 1) % actors.length]}
              </p>
              <form onSubmit={handleSubmit} className="bg-white border-2 border-black p-1.5">
                <Input
                  ref={inputRef}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  placeholder="movie or TV show…"
                  className="bg-white border-0 font-display uppercase text-center text-base focus-visible:ring-0"
                  data-testid={`slot-input-${currentIdx}`}
                />
              </form>
            </div>
          </Shake>
        )}

        {/* Revealed answers list (after game over) */}
        {gameOver && (
          <div className="mt-4 space-y-2" data-testid="revealed-list">
            {revealedAnswers.map((ans, i) => (
              <div
                key={`reveal-${i}`}
                className={`border-[3px] border-black shadow-[3px_3px_0_#000] px-3 py-2 ${
                  ans !== null && i < score ? "bg-[#00C853] text-white" : "bg-[#FF1493] text-white"
                }`}
                data-testid={`reveal-${i}`}
              >
                <p className="font-sans text-[10px] uppercase tracking-wide opacity-80">
                  {actors[i]} × {actors[(i + 1) % actors.length]}
                </p>
                <p className="font-display text-sm md:text-base font-black uppercase tracking-tight">
                  {ans ?? "—"}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Game over panel */}
        {gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-5 text-center"
            data-testid="gameover-panel"
          >
            <h2 className="font-display text-3xl font-black text-black uppercase mb-2">
              {hasWon ? "You Won!" : "Game Over!"}
            </h2>
            <p className="font-sans text-black/80 mb-4">
              You got <span className="font-black">{score}/{totalConnections}</span> connections correct
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={handleShare} className="font-display uppercase" data-testid="share-btn">
                <Share2 className="w-4 h-4 mr-1" /> Share
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="font-display uppercase"
                data-testid="home-btn"
              >
                <HomeIcon className="w-4 h-4 mr-1" /> Home
              </Button>
            </div>
            {!isArchive && <p className="text-sm text-black/60 mt-3 font-sans">Play Again Tomorrow</p>}
          </motion.div>
        )}

        {/* Leaderboard (only when not archive and game over) */}
        {gameOver && !isArchive && leaderboardEnabled && leaderboardQuery.data && (
          <div className="mt-4 bg-white border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-black uppercase flex items-center gap-2">
                <Trophy className="w-5 h-5 text-[#FFD700]" /> Leaderboard
              </h3>
              {!isEditingName ? (
                <button
                  onClick={() => {
                    setIsEditingName(true);
                    setEditNameValue(playerName);
                  }}
                  className="text-xs font-sans flex items-center gap-1 text-black/60 hover:text-black"
                  data-testid="edit-name"
                >
                  <Pencil className="w-3 h-3" /> {playerName || "Set name"}
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <Input
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    maxLength={20}
                    className="h-7 text-xs w-24"
                  />
                  <button
                    onClick={() => {
                      commitName(editNameValue);
                      setIsEditingName(false);
                    }}
                  >
                    <Check className="w-4 h-4 text-green-600" />
                  </button>
                  <button onClick={() => setIsEditingName(false)}>
                    <X className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-1 text-sm font-sans">
              {leaderboardQuery.data.top10.map((entry) => (
                <div
                  key={entry.playerToken}
                  className={`flex justify-between px-2 py-1 ${
                    entry.playerToken === playerToken ? "bg-[#FFD700] font-bold" : ""
                  }`}
                >
                  <span>
                    #{entry.rank} {entry.playerName ?? "Anonymous"}
                  </span>
                  <span>{entry.score}/{totalConnections}</span>
                </div>
              ))}
              {leaderboardQuery.data.top10.length === 0 && (
                <p className="text-black/50 text-center">No scores yet — be first!</p>
              )}
            </div>
            <p className="text-xs text-black/50 mt-2 text-center">
              {leaderboardQuery.data.totalPlayers} players · avg {leaderboardQuery.data.avgScore.toFixed(1)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

