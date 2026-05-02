import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  useGetTodayPopBox,
  useGetPopBoxById,
  usePopBoxGuess,
  useGetPopBoxAnswers,
  useGetPopBoxArchive,
  getGetTodayPopBoxQueryKey,
  getGetPopBoxByIdQueryKey,
  getGetPopBoxAnswersQueryKey,
} from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { Share2, Home as HomeIcon, ArrowRight, Eye, X, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import {
  CountUp,
  fireConfetti,
  fireBigCelebration,
  Shake,
  ShimmerGrid,
  BannerStack,
} from "@/components/fx";
import { LightningDoodle, StarDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import {
  hapticCorrect,
  hapticTap,
  hapticVictory,
  hapticWrong,
} from "@/lib/haptics";
import { useStreaks, type Banner } from "@/lib/streaks";
import { useReducedMotion, easing } from "@/lib/motion";

interface CellState {
  guess: string | null;
  celebrityId: string | null;
  celebrityName: string | null;
  correct: boolean;
  rarityPercent: number | null;
}

const EMPTY_CELL: CellState = {
  guess: null,
  celebrityId: null,
  celebrityName: null,
  correct: false,
  rarityPercent: null,
};

function useQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

// Higher rarity % = pick was more unique among other players.
function rarityLabel(p: number | null): string {
  if (p == null) return "";
  if (p >= 95) return "Iconic pick";
  if (p >= 80) return "Rare grab";
  if (p >= 50) return "Solid";
  if (p >= 25) return "Common";
  return "Most picked";
}

function rarityColor(p: number | null): string {
  if (p == null) return "bg-white";
  if (p >= 95) return "bg-[#FFD700]";
  if (p >= 80) return "bg-[#00E5FF]";
  if (p >= 50) return "bg-[#00C853]";
  if (p >= 25) return "bg-[#FFF8E7]";
  return "bg-[#FF6B6B]";
}

export default function PopBox() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playStrike, playVictory, playTap } = useSfx();
  const { recordGame } = useStreaks();
  const reduced = useReducedMotion();

  const archiveId = useQueryParam("id");
  const isArchive = !!archiveId;

  const todayQuery = useGetTodayPopBox({
    query: { queryKey: getGetTodayPopBoxQueryKey(), enabled: !isArchive },
  });
  const archiveQuery = useGetPopBoxById(archiveId ?? "", {
    query: {
      queryKey: getGetPopBoxByIdQueryKey(archiveId ?? ""),
      enabled: isArchive,
    },
  });

  const { data: grid, isLoading } = isArchive ? archiveQuery : todayQuery;

  const guessMutation = usePopBoxGuess();

  const [cells, setCells] = useState<CellState[]>(() =>
    Array(9).fill(0).map(() => ({ ...EMPTY_CELL })),
  );
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [shakeKey, setShakeKey] = useState(0);
  const [shakeCellIdx, setShakeCellIdx] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const recordedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<Array<HTMLDivElement | null>>([]);

  const todayDateStr = new Date().toISOString().split("T")[0];
  const storageKey = isArchive
    ? `ptq-archive-pb-${archiveId}`
    : `ptq-pop-box-${todayDateStr}`;

  // Pre-fetch archive list so the "Play Again" button is instant.
  const archiveQueryList = useGetPopBoxArchive();
  const archiveList = archiveQueryList.data ?? [];

  function playRandomArchive() {
    if (!grid || archiveList.length === 0) return;
    const others = archiveList.filter((g) => g.id !== grid.id);
    const pool = others.length > 0 ? others : archiveList;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setLocation(`/daily/pop-box?id=${encodeURIComponent(next.id)}`);
  }

  // Load saved state
  useEffect(() => {
    if (!grid) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.cells) && parsed.cells.length === 9) {
          setCells(parsed.cells);
          if (parsed.gameOver) {
            setGameOver(true);
            recordedRef.current = true;
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, [grid, storageKey]);

  const correctCount = useMemo(
    () => cells.filter((c) => c.correct).length,
    [cells],
  );
  const filledCount = useMemo(
    () => cells.filter((c) => c.guess != null).length,
    [cells],
  );
  const avgRarity = useMemo(() => {
    const rs = cells
      .map((c) => c.rarityPercent)
      .filter((r): r is number => r != null);
    if (rs.length === 0) return null;
    return Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 10) / 10;
  }, [cells]);

  // Persist + record on game over
  useEffect(() => {
    if (!grid) return;
    if (filledCount >= 9 && !gameOver) {
      setGameOver(true);
    }
  }, [filledCount, gameOver, grid]);

  useEffect(() => {
    if (!grid || !gameOver) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          completed: true,
          gameOver: true,
          cells,
          score: correctCount,
        }),
      );
      if (!isArchive) {
        const currentStreak = parseInt(
          localStorage.getItem("ptq-streak-pop-box") ?? "0",
          10,
        );
        const won = correctCount >= 5;
        localStorage.setItem(
          "ptq-streak-pop-box",
          won ? (currentStreak + 1).toString() : "0",
        );
        const statsStr = localStorage.getItem("ptq-stats");
        const stats = statsStr ? JSON.parse(statsStr) : {};
        stats.popBoxTotalPlays = (stats.popBoxTotalPlays ?? 0) + 1;
        stats.popBoxScoreSum = (stats.popBoxScoreSum ?? 0) + correctCount;
        if (correctCount === 9) {
          stats.popBoxPerfectGames = (stats.popBoxPerfectGames ?? 0) + 1;
        }
        if (correctCount > (stats.popBoxBestScore ?? 0)) {
          stats.popBoxBestScore = correctCount;
        }
        // Track best average rarity (HIGHER = rarer picks = better).
        const rarities = cells
          .map((c) => c.rarityPercent)
          .filter((r): r is number => r != null);
        if (rarities.length > 0) {
          const avg = rarities.reduce((s, r) => s + r, 0) / rarities.length;
          if (
            stats.popBoxBestRarity == null ||
            avg > stats.popBoxBestRarity
          ) {
            stats.popBoxBestRarity = Math.round(avg * 10) / 10;
          }
        }
        localStorage.setItem("ptq-stats", JSON.stringify(stats));
      }
    } catch {
      /* ignore */
    }
    if (!recordedRef.current) {
      recordedRef.current = true;
      const newBanners = recordGame("pop-box", correctCount);
      if (correctCount >= 7) {
        playVictory();
        hapticVictory();
        fireBigCelebration();
      }
      if (newBanners.length > 0) setBanners((b) => [...b, ...newBanners]);
    }
  }, [gameOver]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist after each filled cell
  useEffect(() => {
    if (!grid || gameOver) return;
    if (filledCount === 0) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ completed: false, gameOver: false, cells }),
      );
    } catch {
      /* ignore */
    }
  }, [cells, filledCount, gameOver, grid, storageKey]);

  function openCell(idx: number) {
    if (gameOver) return;
    if (cells[idx].guess != null) return;
    playTap();
    hapticTap();
    setActiveCell(idx);
    setCurrentGuess("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function submitGuess(e: React.FormEvent) {
    e.preventDefault();
    if (activeCell == null || !grid) return;
    const guess = currentGuess.trim();
    if (!guess) return;
    if (guess.length < 2) {
      toast({ title: "Too short", description: "Type at least 2 characters." });
      return;
    }

    try {
      const result = await guessMutation.mutateAsync({
        id: grid.id,
        data: { squareIndex: activeCell, guess },
      });

      if (result.correct) {
        playCorrect();
        hapticCorrect();
        setCells((prev) => {
          const next = prev.slice();
          next[activeCell] = {
            guess,
            celebrityId: result.celebrityId ?? null,
            celebrityName: result.celebrityName ?? guess,
            correct: true,
            rarityPercent: result.rarityPercent ?? null,
          };
          return next;
        });
        const cellEl = cellRefs.current[activeCell];
        if (cellEl) {
          const rect = cellEl.getBoundingClientRect();
          const x = (rect.left + rect.width / 2) / window.innerWidth;
          const y = (rect.top + rect.height / 2) / window.innerHeight;
          fireConfetti("green", {
            particleCount: 50,
            spread: 80,
            origin: { x, y },
            startVelocity: 28,
          });
        }
        toast({
          title: `✓ ${result.celebrityName ?? guess}`,
          description: result.rarityPercent != null
            ? `${rarityLabel(result.rarityPercent)} — ${result.rarityPercent}%`
            : "Nice grab",
        });
        setActiveCell(null);
        setCurrentGuess("");
      } else {
        playStrike();
        playWrong();
        hapticWrong();
        setShakeKey((k) => k + 1);
        setShakeCellIdx(activeCell);
        const reasonText =
          result.reason === "wrong_cell"
            ? `${result.celebrityName ?? guess} doesn't fit this cell.`
            : `Hmm, "${guess}" isn't a celeb we know.`;
        toast({
          title: "✗ Not a match",
          description: reasonText,
          variant: "destructive",
        });
        // Lock the cell as wrong
        setCells((prev) => {
          const next = prev.slice();
          next[activeCell] = {
            guess,
            celebrityId: result.celebrityId ?? null,
            celebrityName: result.celebrityName ?? guess,
            correct: false,
            rarityPercent: null,
          };
          return next;
        });
        setActiveCell(null);
        setCurrentGuess("");
      }
    } catch (err) {
      toast({
        title: "Network glitch",
        description: "Try that one again.",
        variant: "destructive",
      });
      console.warn("pop-box guess failed", err);
    }
  }

  function handleShare() {
    if (!grid) return;
    const emoji = (c: CellState) => (c.guess == null ? "⬜" : c.correct ? "🟩" : "🟥");
    const rows: string[] = [];
    for (let r = 0; r < 3; r++) {
      rows.push([0, 1, 2].map((c) => emoji(cells[r * 3 + c])).join(""));
    }
    const text = [
      `Pop: The Question – Pop Box (${grid.date})`,
      `Score: ${correctCount}/9${avgRarity != null ? ` • Rarity ${avgRarity}%` : ""}`,
      "",
      ...rows,
      "",
      "popthequestion.com",
    ].join("\n");
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: "Copied!", description: "Share your grid with friends." }),
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">
        <div className="shimmer-bg h-10 w-2/3" />
        <div className="shimmer-bg h-5 w-1/2" />
        <ShimmerGrid count={9} cols="grid-cols-3" itemClassName="h-28" />
      </div>
    );
  }

  if (!grid) {
    return (
      <div className="flex-1 flex items-center justify-center flex-col gap-4">
        <p className="text-black/60">Pop Box not found.</p>
        <Button variant="outline" onClick={() => setLocation("/archive")}>
          Back to Archive
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 py-6">
      <BannerStack
        banners={banners}
        onDone={(id) => setBanners((b) => b.filter((x) => x.id !== id))}
      />

      <div className="flex items-center gap-3 mb-4">
        <BackArrow
          href={isArchive ? "/archive" : "/"}
          label={isArchive ? "Back to archive" : "Back to home"}
        />
        {isArchive && <Badge variant="outline">📦 Archive Replay</Badge>}
      </div>

      {/* Header */}
      <div className="relative bg-[#FF1493] border-[3px] border-black shadow-[4px_4px_0_#000] px-5 py-4 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 overflow-hidden">
        <StarDoodle className="absolute top-2 right-4 w-7 h-7 text-[#FFD700] opacity-70" />
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
            Pop Box
          </h1>
          <p className="text-sm text-white/90 font-sans mt-1">
            Name a celeb that fits BOTH the row and the column. 9 picks.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border-[3px] border-black shadow-[3px_3px_0_#000] px-4 py-3 flex-shrink-0">
          <span className="font-display font-black text-sm text-black uppercase tracking-wide">
            Score
          </span>
          <span className="font-display font-black text-2xl text-black">
            <CountUp value={correctCount} duration={0.4} />
            /9
          </span>
          <Badge variant="outline" className="ml-2 capitalize border-black">
            {grid.difficulty}
          </Badge>
        </div>
      </div>

      {/* The grid: 4×4 (1 corner + 3 col headers / 3 row headers + 9 cells) */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        {/* Top-left corner */}
        <div className="aspect-square bg-[#FFD700] border-[3px] border-black shadow-[3px_3px_0_#000] flex items-center justify-center">
          <LightningDoodle className="w-7 h-9 text-black opacity-50" />
        </div>
        {/* Column headers */}
        {grid.columnCategories.map((cat) => (
          <div
            key={cat.id}
            className="aspect-square bg-[#00E5FF] border-[3px] border-black shadow-[3px_3px_0_#000] p-1 flex items-center justify-center text-center"
          >
            <span className="font-display font-black text-[10px] sm:text-xs leading-tight uppercase text-black">
              {cat.label}
            </span>
          </div>
        ))}

        {/* Rows */}
        {grid.rowCategories.map((rowCat, r) => (
          <Row
            key={rowCat.id}
            rowCat={rowCat}
            r={r}
            cells={cells}
            activeCell={activeCell}
            onOpen={openCell}
            shakeKey={shakeKey}
            shakeCellIdx={shakeCellIdx}
            gameOver={gameOver}
            reduced={reduced}
            registerRef={(idx, el) => {
              cellRefs.current[idx] = el;
            }}
          />
        ))}
      </div>

      {/* Active input bar (sticky bottom) */}
      <AnimatePresence>
        {activeCell != null && !gameOver && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.15 }}
            className="sticky bottom-3 z-10"
          >
            <Shake trigger={shakeKey}>
              <form
                onSubmit={submitGuess}
                className="flex flex-col gap-2 bg-[#FFF8E7] border-[3px] border-black shadow-[4px_4px_0_#000] p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-black uppercase text-xs text-black/70">
                    Cell {Math.floor(activeCell / 3) + 1}-
                    {(activeCell % 3) + 1}:{" "}
                    <span className="text-black">
                      {grid.rowCategories[Math.floor(activeCell / 3)].label}
                    </span>{" "}
                    ×{" "}
                    <span className="text-black">
                      {grid.columnCategories[activeCell % 3].label}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCell(null);
                      setCurrentGuess("");
                    }}
                    className="text-black/60 hover:text-black"
                    data-testid="btn-pop-box-cancel"
                    aria-label="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={currentGuess}
                    onChange={(e) => setCurrentGuess(e.target.value)}
                    placeholder="Type a celebrity name…"
                    className="text-base h-11 border-[3px] border-black bg-white focus-visible:ring-[#FF1493]"
                    autoFocus
                    data-testid="input-pop-box-guess"
                    disabled={guessMutation.isPending}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 px-5 font-display uppercase"
                    disabled={guessMutation.isPending}
                    data-testid="btn-pop-box-submit"
                  >
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </div>
              </form>
            </Shake>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game-over panel */}
      {gameOver && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 20 }}
          className={`max-w-xl mx-auto w-full border-[3px] border-black shadow-[6px_6px_0_#000] p-6 md:p-8 text-center ${
            correctCount >= 7
              ? "bg-[#00C853]"
              : correctCount >= 5
                ? "bg-[#FFD700]"
                : "bg-[#FF6B6B]"
          }`}
        >
          {correctCount >= 7 ? (
            <StarDoodle className="w-14 h-14 text-[#FFD700] mx-auto mb-3" />
          ) : (
            <LightningDoodle className="w-10 h-14 text-black mx-auto mb-3 opacity-60" />
          )}
          <h2 className="font-display text-3xl md:text-4xl font-black text-black uppercase mb-2">
            {correctCount === 9
              ? "Perfect Box!"
              : correctCount >= 7
                ? "Great Box!"
                : correctCount >= 5
                  ? "Solid"
                  : "Tough Box"}
          </h2>
          <p className="text-lg text-black/80 font-sans mb-2">
            <CountUp className="font-black text-black" value={correctCount} /> of{" "}
            <span className="font-black text-black">9</span> cells filled
          </p>
          {avgRarity != null && (
            <p
              className="text-base sm:text-lg text-black/90 font-sans mb-6"
              data-testid="text-pop-box-avg-rarity"
            >
              Overall rarity:{" "}
              <span className="font-black text-black text-xl sm:text-2xl">
                {avgRarity}%
              </span>{" "}
              <span className="text-sm text-black/70">({rarityLabel(avgRarity)})</span>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            <Button
              size="lg"
              onClick={handleShare}
              className="bg-black text-[#FFD700] hover:bg-[#FF1493] hover:text-black border-[3px] border-black shadow-[3px_3px_0_rgba(0,0,0,0.3)]"
              data-testid="btn-pop-box-share"
            >
              <Share2 className="w-5 h-5 mr-2" /> Share Result
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setShowAnswers((s) => !s)}
              data-testid="btn-pop-box-show-answers"
              className="border-[3px] border-black"
            >
              <Eye className="w-5 h-5 mr-2" />
              {showAnswers ? "Hide" : "Show"} all answers
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={playRandomArchive}
              disabled={!archiveList || archiveList.length === 0}
              data-testid="btn-pop-box-play-again"
              className="border-[3px] border-black bg-[#00E5FF]/30 hover:bg-[#00E5FF]/60"
            >
              <Shuffle className="w-5 h-5 mr-2" /> Play Again
            </Button>
            {isArchive ? (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/archive")}
                className="border-[3px] border-black"
              >
                <HomeIcon className="w-5 h-5 mr-2" /> Back to Archive
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/")}
                className="border-[3px] border-black"
              >
                <HomeIcon className="w-5 h-5 mr-2" /> Go Home
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {showAnswers && grid && <AnswersPanel gridId={grid.id} />}
    </div>
  );
}

function Row(props: {
  rowCat: { id: string; label: string };
  r: number;
  cells: CellState[];
  activeCell: number | null;
  onOpen: (idx: number) => void;
  shakeKey: number;
  shakeCellIdx: number | null;
  gameOver: boolean;
  reduced: boolean;
  registerRef: (idx: number, el: HTMLDivElement | null) => void;
}) {
  const { rowCat, r, cells, activeCell, onOpen, shakeKey, shakeCellIdx, gameOver, reduced, registerRef } = props;
  return (
    <>
      {/* Row header */}
      <div className="aspect-square bg-[#00E5FF] border-[3px] border-black shadow-[3px_3px_0_#000] p-1 flex items-center justify-center text-center">
        <span className="font-display font-black text-[10px] sm:text-xs leading-tight uppercase text-black">
          {rowCat.label}
        </span>
      </div>

      {/* 3 cells */}
      {[0, 1, 2].map((c) => {
        const idx = r * 3 + c;
        const cell = cells[idx];
        const isActive = activeCell === idx;
        const filled = cell.guess != null;
        const wrong = filled && !cell.correct;
        const correct = filled && cell.correct;

        const bg = correct
          ? rarityColor(cell.rarityPercent)
          : wrong
            ? "bg-[#FF6B6B]"
            : isActive
              ? "bg-[#FFD700]"
              : "bg-[#FFF8E7]";

        return (
          <motion.div
            key={c}
            ref={(el) => registerRef(idx, el)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: reduced ? 0 : Math.min(idx * 0.03, 0.3),
              duration: 0.18,
              ease: easing.out,
            }}
            className="aspect-square"
          >
            <Shake trigger={shakeCellIdx === idx ? shakeKey : 0}>
              <button
                type="button"
                onClick={() => onOpen(idx)}
                disabled={filled || gameOver}
                className={`w-full h-full border-[3px] border-black shadow-[3px_3px_0_#000] p-1 flex flex-col items-center justify-center text-center transition-none ${bg} ${
                  filled || gameOver
                    ? "cursor-default"
                    : "hover:bg-[#FFD700] cursor-pointer"
                }`}
                data-testid={`cell-pop-box-${idx}`}
              >
                {!filled && !isActive && (
                  <span className="text-3xl font-black text-black/20">+</span>
                )}
                {!filled && isActive && (
                  <span className="text-2xl font-black text-black animate-pulse">
                    ?
                  </span>
                )}
                {filled && correct && (
                  <>
                    <span className="font-display font-black text-lg sm:text-xl leading-tight uppercase text-black line-clamp-2 px-1">
                      {cell.celebrityName}
                    </span>
                    {cell.rarityPercent != null && (
                      <span className="text-[10px] sm:text-xs font-bold text-black/60 mt-0.5">
                        {cell.rarityPercent}%
                      </span>
                    )}
                  </>
                )}
                {filled && wrong && (
                  <>
                    <X className="w-6 h-6 text-black/70" />
                    <span className="font-sans text-[10px] text-black/60 line-clamp-1 mt-0.5">
                      {cell.celebrityName ?? cell.guess}
                    </span>
                  </>
                )}
              </button>
            </Shake>
          </motion.div>
        );
      })}
    </>
  );
}

function AnswersPanel({ gridId }: { gridId: string }) {
  const { data, isLoading } = useGetPopBoxAnswers(gridId, {
    query: { queryKey: getGetPopBoxAnswersQueryKey(gridId) },
  });

  if (isLoading) {
    return (
      <div className="mt-6 space-y-2">
        <div className="shimmer-bg h-6 w-1/3" />
        <ShimmerGrid count={9} cols="grid-cols-1" itemClassName="h-16" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="mt-6 bg-[#FFF8E7] border-[3px] border-black shadow-[4px_4px_0_#000] p-4">
      <h3 className="font-display font-black text-xl uppercase text-black mb-3">
        All Possible Answers
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.cells.map((cell) => (
          <div
            key={cell.squareIndex}
            className="bg-white border-[3px] border-black p-2"
          >
            <div className="font-display font-black text-[10px] uppercase text-black/60 mb-1">
              Cell {Math.floor(cell.squareIndex / 3) + 1}-
              {(cell.squareIndex % 3) + 1}
            </div>
            <ul className="text-xs space-y-0.5">
              {cell.validCelebrities.length === 0 ? (
                <li className="text-black/40 italic">— none tagged —</li>
              ) : (
                cell.validCelebrities.slice(0, 8).map((celeb) => (
                  <li key={celeb.id} className="flex justify-between gap-2">
                    <span className="font-bold text-black truncate">
                      {celeb.name}
                    </span>
                    {celeb.guessCount > 0 && (
                      <span className="text-black/50">
                        {celeb.rarityPercent}%
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
