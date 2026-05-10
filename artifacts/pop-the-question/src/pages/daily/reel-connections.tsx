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
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, Heart, Share2, Home as HomeIcon, Trophy, Pencil, Check, X } from "lucide-react";
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

const TOTAL_CONNECTIONS = 5;

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

interface PersistedState {
  completed: boolean;
  hasWon: boolean;
  score: number;
  total: number;
  finalAnswers: (string | null)[]; // length 5 — null if failed at this step
  failedAt: number | null;
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
  const [livesAtCurrent, setLivesAtCurrent] = useState(1); // 1 = full heart, 0 = strike-pending
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
      setRevealedAnswers(Array(TOTAL_CONNECTIONS).fill(null));
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

  function endGame(won: boolean, finalScore: number, finalAnswers: (string | null)[], failedAt: number | null) {
    setHasWon(won);
    setScore(finalScore);
    setGameOver(true);
    setRevealedAnswers(finalAnswers);
    persist({
      completed: true,
      hasWon: won,
      score: finalScore,
      total: TOTAL_CONNECTIONS,
      finalAnswers,
      failedAt,
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

      if (currentIdx + 1 >= TOTAL_CONNECTIONS) {
        endGame(true, newScore, updated, null);
      } else {
        setCurrentIdx(currentIdx + 1);
        setLivesAtCurrent(1);
      }
    } else {
      void playWrong();
      hapticWrong();
      setShakeKey((k) => k + 1);
      if (livesAtCurrent === 1) {
        setLivesAtCurrent(0);
        toast({ title: "Try again", description: "One more wrong and the game ends." });
        setGuess("");
      } else {
        // Second wrong → game over
        const updated = [...revealedAnswers];
        // Reveal correct answers for ALL remaining connections
        for (let i = currentIdx; i < TOTAL_CONNECTIONS; i++) {
          if (updated[i] === null) {
            updated[i] = puzzle.validAnswers[i]?.[0] ?? null;
          }
        }
        endGame(false, score, updated, currentIdx);
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
    const lines = revealedAnswers
      .map((a, i) => (a !== null && i < score ? "✅" : i < currentIdx || gameOver ? "❌" : "⬜"))
      .join("");
    const text = `Reel Connections ${puzzle.date}\n${score}/${TOTAL_CONNECTIONS}\n${lines}\nptq.app/daily/reel-connections`;
    if (navigator.share) {
      void navigator.share({ text }).catch(() => void navigator.clipboard.writeText(text));
    } else {
      void navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard!" });
    }
  }

  if (isLoading || !puzzle) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#FFF8E7] p-4">
        <p className="font-display text-xl">Loading…</p>
      </div>
    );
  }

  const actors = puzzle.actors;

  return (
    <div className="flex-1 bg-[#FFF8E7] min-h-screen relative overflow-hidden">
      <StarDoodle className="absolute top-6 left-4 w-7 h-7 text-[#FF1493] opacity-50" />
      <LightningDoodle className="absolute top-12 right-6 w-6 h-9 text-[#FFD700] opacity-50" />
      <StarDoodle className="absolute bottom-12 right-8 w-6 h-6 text-[#00E5FF] opacity-50" />

      <BannerStack banners={banners} onDone={(id) => setBanners((prev) => prev.filter((b) => b.id !== id))} />

      <div className="max-w-md mx-auto px-4 py-6 relative">
        <div className="flex items-center justify-between mb-4">
          <BackArrow onClick={() => setLocation("/")} />
          {!gameOver && (
            <div className="flex items-center gap-2" data-testid="lives-indicator">
              <span className="font-display text-sm uppercase">Life:</span>
              <span className="text-2xl">{livesAtCurrent === 1 ? "❤️" : "🖤"}</span>
            </div>
          )}
          {gameOver && (
            <Badge variant="secondary" className="font-display">
              {score}/{TOTAL_CONNECTIONS}
            </Badge>
          )}
        </div>

        <div className="text-center mb-6">
          <h1 className="font-display text-3xl md:text-4xl font-black text-black uppercase tracking-tight">
            Reel Connections
          </h1>
          <p className="text-sm text-black/60 font-sans mt-1">Name a movie or show that connects each pair</p>
        </div>

        {/* Vertical chain */}
        <Shake trigger={shakeKey}>
          <div className="space-y-2">
            {actors.map((actor, i) => (
              <div key={i}>
                {/* Actor row */}
                <div className="bg-white border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-3 text-center">
                  <p className="font-display text-lg md:text-xl font-black text-black uppercase tracking-tight">
                    {actor}
                  </p>
                </div>

                {/* Connection slot (between this actor and next) */}
                {i < actors.length - 1 && (
                  <div className="flex items-center justify-center my-1">
                    <ArrowDown className="w-5 h-5 text-black/60" />
                  </div>
                )}

                {i < actors.length - 1 && (
                  <ConnectionSlot
                    index={i}
                    currentIdx={currentIdx}
                    revealed={revealedAnswers[i] ?? null}
                    gameOver={gameOver}
                    onSubmit={handleSubmit}
                    guess={guess}
                    setGuess={setGuess}
                    inputRef={inputRef}
                  />
                )}

                {i < actors.length - 1 && (
                  <div className="flex items-center justify-center my-1">
                    <ArrowDown className="w-5 h-5 text-black/60" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Shake>

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
              You got <span className="font-black">{score}/{TOTAL_CONNECTIONS}</span> connections correct
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
                  <span>{entry.score}/5</span>
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

interface ConnectionSlotProps {
  index: number;
  currentIdx: number;
  revealed: string | null;
  gameOver: boolean;
  onSubmit: (e: React.FormEvent) => void;
  guess: string;
  setGuess: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function ConnectionSlot({ index, currentIdx, revealed, gameOver, onSubmit, guess, setGuess, inputRef }: ConnectionSlotProps) {
  const isPast = index < currentIdx || (gameOver && revealed !== null);
  const isCurrent = !gameOver && index === currentIdx;

  if (isPast) {
    return (
      <div
        className={`border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-3 text-center ${
          revealed !== null ? "bg-[#00C853] text-white" : "bg-[#FF1493] text-white"
        }`}
        data-testid={`slot-past-${index}`}
      >
        <p className="font-display text-sm md:text-base font-black uppercase tracking-tight">
          {revealed ?? "—"}
        </p>
      </div>
    );
  }

  if (isCurrent) {
    return (
      <form onSubmit={onSubmit} className="bg-[#FFD700] border-[3px] border-black shadow-[4px_4px_0_#000] p-2">
        <Input
          ref={inputRef}
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          placeholder="movie or TV show…"
          className="bg-white border-2 border-black font-display uppercase text-center text-base"
          data-testid={`slot-input-${index}`}
        />
      </form>
    );
  }

  // Future (locked) slot
  return (
    <div
      className="bg-black/10 border-[3px] border-dashed border-black/40 px-4 py-3 text-center"
      data-testid={`slot-locked-${index}`}
    >
      <p className="font-display text-sm font-black uppercase tracking-tight text-black/30">???</p>
    </div>
  );
}
