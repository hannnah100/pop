import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useGetTodayCrossword,
  useGetCrosswordById,
  useGetSkinnyLeaderboard,
  useSubmitSkinnyScore,
  useUpdatePlayerName,
  getGetSkinnyLeaderboardQueryKey,
  getGetTodayCrosswordQueryKey,
  getGetCrosswordByIdQueryKey,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2, Home as HomeIcon, CheckCircle2, Trophy, BarChart2, Pencil, Check, X } from "lucide-react";
import { BackArrow } from "@/components/ui/BackArrow";
import { useToast } from "@/hooks/use-toast";
import {
  Shake,
  TimerRing,
  fireBigCelebration,
  ShimmerGrid,
  BannerStack,
} from "@/components/fx";
import { StarDoodle, LightningDoodle } from "@/components/fx/Doodles";
import { useSfx } from "@/lib/sfx";
import { hapticCorrect, hapticVictory, hapticWrong } from "@/lib/haptics";
import { useStreaks, type Banner } from "@/lib/streaks";

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

const TARGET_TIME = 240;

export default function Crossword() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const archiveId = new URLSearchParams(search).get("id") ?? undefined;
  const { toast } = useToast();
  const { playCorrect, playWrong, playTick, playVictory } = useSfx();
  const { recordGame } = useStreaks();

  const { data: todayPuzzle, isLoading: todayLoading } = useGetTodayCrossword({ query: { queryKey: getGetTodayCrosswordQueryKey(), enabled: !archiveId } });
  const { data: archivePuzzle, isLoading: archiveLoading } = useGetCrosswordById(archiveId ?? "", { query: { queryKey: getGetCrosswordByIdQueryKey(archiveId ?? ""), enabled: !!archiveId } });
  const puzzle = archiveId ? archivePuzzle : todayPuzzle;
  const isLoading = archiveId ? archiveLoading : todayLoading;

  const [gridState, setGridState] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shakeCells, setShakeCells] = useState<[number, number][]>([]);
  const [popCells, setPopCells] = useState<Set<string>>(new Set());
  const [shakeBoardKey, setShakeBoardKey] = useState(0);
  const [winFlipping, setWinFlipping] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const lastTickRef = useRef(0);
  const recordedRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridSectionRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [leaderboardEnabled, setLeaderboardEnabled] = useState(false);
  const [playerToken] = useState(() => getPlayerToken());
  const [playerName, setPlayerName] = useState(() => getStoredPlayerName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const skinnyLeaderboardQuery = useGetSkinnyLeaderboard(
    { puzzleId: puzzle?.id, playerToken },
    {
      query: {
        queryKey: getGetSkinnyLeaderboardQueryKey({ puzzleId: puzzle?.id, playerToken }),
        enabled: leaderboardEnabled && !archiveId && !!puzzle?.id,
      },
    },
  );
  const scoresMutation = useSubmitSkinnyScore();
  const updateNameMutation = useUpdatePlayerName();

  function commitName(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    savePlayerName(trimmed);
    setPlayerName(trimmed);
    updateNameMutation.mutate({ data: { playerToken, playerName: trimmed } });
  }

  const todayDate = new Date().toISOString().split('T')[0];

  const rows = puzzle ? puzzle.grid.length : 0;
  const cols = puzzle ? (puzzle.grid[0]?.length ?? 0) : 0;

  const cellSize = cols > 6
    ? 'w-9 h-9 md:w-11 md:h-11'
    : cols > 5
      ? 'w-10 h-10 md:w-12 md:h-12'
      : 'w-12 h-12 md:w-16 md:h-16';

  const cellTextSize = cols > 6 ? 'text-base md:text-lg' : 'text-xl md:text-2xl';
  const cellNumSize = cols > 6 ? 'text-[6px] md:text-[8px]' : 'text-[9px] md:text-[10px]';

  useEffect(() => {
    if (puzzle && gridState.length === 0) {
      const numRows = puzzle.grid.length;
      const numCols = puzzle.grid[0]?.length ?? 0;
      const emptyGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(''));
      if (!archiveId) {
        try {
          const savedState = localStorage.getItem(`ptq-crossword-${todayDate}`);
          if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.completed) {
              setGridState(puzzle.grid);
              setIsCompleted(true);
              setElapsedTime(parsed.time);
              recordedRef.current = true;
              setLeaderboardEnabled(true);
              return;
            }
          }
        } catch {/* ignore */}
      }
      setGridState(emptyGrid);
      setStartTime(Date.now());
      for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
          if (!puzzle.blackSquares.some(([br, bc]) => br === r && bc === c)) {
            setSelectedCell([r, c]);
            return;
          }
        }
      }
    }
  }, [puzzle, todayDate, gridState.length, archiveId]);

  useEffect(() => {
    if (startTime && !isCompleted) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTime, isCompleted]);

  const ringRemaining = Math.max(0, TARGET_TIME - elapsedTime);
  const isLowTime = ringRemaining > 0 && ringRemaining < 30;

  useEffect(() => {
    if (isCompleted || !startTime || ringRemaining <= 0 || !isLowTime) return;
    if (lastTickRef.current === elapsedTime) return;
    lastTickRef.current = elapsedTime;
    playTick();
  }, [elapsedTime, isLowTime, isCompleted, startTime, playTick, ringRemaining]);

  const isBlackSquare = useCallback((r: number, c: number) => {
    if (!puzzle) return false;
    return puzzle.blackSquares.some(([br, bc]) => br === r && bc === c);
  }, [puzzle]);

  const getActiveWordCells = useCallback(() => {
    if (!selectedCell || !puzzle) return [];
    const [r, c] = selectedCell;
    const cells: [number, number][] = [];
    if (direction === 'across') {
      let startC = c;
      while (startC >= 0 && !isBlackSquare(r, startC)) startC--;
      startC++;
      let endC = c;
      while (endC < cols && !isBlackSquare(r, endC)) endC++;
      endC--;
      for (let i = startC; i <= endC; i++) cells.push([r, i]);
    } else {
      let startR = r;
      while (startR >= 0 && !isBlackSquare(startR, c)) startR--;
      startR++;
      let endR = r;
      while (endR < rows && !isBlackSquare(endR, c)) endR++;
      endR--;
      for (let i = startR; i <= endR; i++) cells.push([i, c]);
    }
    return cells;
  }, [selectedCell, direction, puzzle, isBlackSquare, rows, cols]);

  const activeWordCells = useMemo(() => getActiveWordCells(), [getActiveWordCells]);

  const triggerPop = (r: number, c: number) => {
    const key = `${r}-${c}`;
    setPopCells((prev) => { const next = new Set(prev); next.add(key); return next; });
    window.setTimeout(() => {
      setPopCells((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 320);
  };

  // Focus the hidden input whenever a cell is selected so the mobile keyboard opens
  useEffect(() => {
    if (selectedCell && !isCompleted) {
      hiddenInputRef.current?.focus({ preventScroll: true });
    }
  }, [selectedCell, isCompleted]);

  const handleCellClick = (r: number, c: number) => {
    if (isCompleted || isBlackSquare(r, c)) return;
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell([r, c]);
    }
    // Always (re-)focus the hidden input on every tap so the keyboard stays open
    hiddenInputRef.current?.focus({ preventScroll: true });
  };

  const processLetter = (char: string) => {
    if (isCompleted || !selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    const upper = char.toUpperCase();
    if (!upper.match(/^[A-Z]$/)) return;
    const newGrid = [...gridState.map(row => [...row])];
    newGrid[r][c] = upper;
    setGridState(newGrid);
    if (upper === puzzle.grid[r][c]) triggerPop(r, c);
    if (direction === 'across' && c < cols - 1 && !isBlackSquare(r, c + 1)) setSelectedCell([r, c + 1]);
    else if (direction === 'down' && r < rows - 1 && !isBlackSquare(r + 1, c)) setSelectedCell([r + 1, c]);
  };

  const handleBackspace = useCallback(() => {
    if (isCompleted || !selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    if (gridState[r][c] !== '') {
      const newGrid = [...gridState.map(row => [...row])];
      newGrid[r][c] = '';
      setGridState(newGrid);
    } else {
      if (direction === 'across' && c > 0 && !isBlackSquare(r, c - 1)) setSelectedCell([r, c - 1]);
      else if (direction === 'down' && r > 0 && !isBlackSquare(r - 1, c)) setSelectedCell([r - 1, c]);
    }
  }, [isCompleted, selectedCell, puzzle, gridState, direction, isBlackSquare]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompleted || !selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    if (e.key.match(/^[a-zA-Z]$/)) {
      e.preventDefault(); // prevent the char from landing in the hidden input (stops onChange double-fire)
      processLetter(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'ArrowRight' && c < cols - 1 && !isBlackSquare(r, c + 1)) { setSelectedCell([r, c + 1]); setDirection('across'); }
    else if (e.key === 'ArrowLeft' && c > 0 && !isBlackSquare(r, c - 1)) { setSelectedCell([r, c - 1]); setDirection('across'); }
    else if (e.key === 'ArrowDown' && r < rows - 1 && !isBlackSquare(r + 1, c)) { setSelectedCell([r + 1, c]); setDirection('down'); }
    else if (e.key === 'ArrowUp' && r > 0 && !isBlackSquare(r - 1, c)) { setSelectedCell([r - 1, c]); setDirection('down'); }
  };

  // onChange fires on Android/iOS when onKeyDown doesn't deliver the key (IME input)
  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    // Extract the last character typed (input was empty before, now has one char)
    processLetter(val[val.length - 1]);
    // Clear the input so it's ready for the next keystroke
    e.target.value = '';
  };

  const handleCheck = () => {
    if (!puzzle) return;
    let isPerfect = true;
    const wrongCells: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!isBlackSquare(r, c)) {
          if (gridState[r][c] !== puzzle.grid[r][c]) {
            isPerfect = false;
            if (gridState[r][c] !== '') wrongCells.push([r, c]);
          }
        }
      }
    }
    if (isPerfect) {
      handleWin();
    } else {
      if (wrongCells.length > 0) { setShakeCells(wrongCells); setShakeBoardKey((k) => k + 1); setTimeout(() => setShakeCells([]), 500); }
      playWrong(); hapticWrong();
      toast({ title: "Keep trying!", description: "Some letters aren't quite right yet.", variant: "destructive" });
    }
  };

  const handleWin = () => {
    setWinFlipping(true);
    playCorrect(); hapticCorrect();
    window.setTimeout(() => {
      setIsCompleted(true); setSelectedCell(null);
      playVictory(); hapticVictory(); fireBigCelebration();
    }, 700);
    localStorage.setItem(`ptq-crossword-${todayDate}`, JSON.stringify({ completed: true, time: elapsedTime }));
    try {
      const currentStreak = parseInt(localStorage.getItem('ptq-streak-crossword') || '0');
      localStorage.setItem('ptq-streak-crossword', (currentStreak + 1).toString());
      const statsStr = localStorage.getItem('ptq-stats');
      const stats = statsStr ? JSON.parse(statsStr) : { threeFlopsTotalPlays: 0, threeFlopsBestScore: 0, crosswordTotalPlays: 0, crosswordBestTime: 999999 };
      stats.crosswordTotalPlays += 1;
      if (!stats.crosswordBestTime || elapsedTime < stats.crosswordBestTime) stats.crosswordBestTime = elapsedTime;
      localStorage.setItem('ptq-stats', JSON.stringify(stats));
    } catch {/* ignore */}
    if (!recordedRef.current) {
      recordedRef.current = true;
      const newBanners = recordGame("crossword", Math.max(1, TARGET_TIME - elapsedTime));
      if (newBanners.length > 0) setBanners((b) => [...b, ...newBanners]);
    }
    if (!archiveId && puzzle?.id) {
      scoresMutation.mutate(
        { data: { playerToken, puzzleId: puzzle.id, completionTimeSecs: elapsedTime } },
        {
          onSettled: () => {
            setLeaderboardEnabled(true);
          },
        },
      );
    }
  };

  const handleShare = () => {
    if (!puzzle) return;
    const dateStr = new Date().toLocaleDateString();
    const mm = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const ss = (elapsedTime % 60).toString().padStart(2, '0');
    let gridEmoji = '';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) gridEmoji += isBlackSquare(r, c) ? '⬛' : '🟩';
      gridEmoji += '\n';
    }
    const shareText = `Pop The Question - The Skinny\n${dateStr}\n\n${gridEmoji}\nTime: ${mm}:${ss}\n\npoptq.com`;
    navigator.clipboard.writeText(shareText).then(() => toast({ title: "Copied!", description: "Share your time with friends." }));
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const cellNumbers = useMemo(() => {
    if (!puzzle) return {};
    const numbers: Record<string, number> = {};
    let currentNum = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (isBlackSquare(r, c)) continue;
        const leftIsBlack = c === 0 || isBlackSquare(r, c - 1);
        const topIsBlack = r === 0 || isBlackSquare(r - 1, c);
        let acrossLen = 0;
        if (leftIsBlack) {
          let ec = c;
          while (ec < cols && !isBlackSquare(r, ec)) { acrossLen++; ec++; }
        }
        let downLen = 0;
        if (topIsBlack) {
          let er = r;
          while (er < rows && !isBlackSquare(er, c)) { downLen++; er++; }
        }
        const isAcrossStart = acrossLen >= 3;
        const isDownStart = downLen >= 3;
        if (isAcrossStart || isDownStart) numbers[`${r},${c}`] = currentNum++;
      }
    }
    return numbers;
  }, [puzzle, isBlackSquare, rows, cols]);

  const clueNumToCell = useMemo(() => {
    const map: Record<number, [number, number]> = {};
    for (const [key, num] of Object.entries(cellNumbers)) {
      const [r, c] = key.split(',').map(Number);
      map[num] = [r, c];
    }
    return map;
  }, [cellNumbers]);

  const handleClueClick = useCallback((num: number, dir: 'across' | 'down') => {
    if (isCompleted) return;
    const cell = clueNumToCell[num];
    if (!cell) return;
    setSelectedCell(cell);
    setDirection(dir);
    hiddenInputRef.current?.focus({ preventScroll: true });
    gridSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isCompleted, clueNumToCell]);

  const lbData = skinnyLeaderboardQuery.data;
  const serverRank = lbData?.playerRank ?? null;
  const myRankInTop10 = lbData?.top10.findIndex((e) => e.playerToken === playerToken) ?? -1;
  const myRank = serverRank ?? (myRankInTop10 >= 0 ? myRankInTop10 + 1 : null);
  const rankPercentile =
    myRank !== null && lbData && lbData.totalPlayers > 0
      ? Math.round(((lbData.totalPlayers - myRank) / lbData.totalPlayers) * 100)
      : null;

  if (isLoading || !puzzle) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="shimmer-bg h-12 w-1/2" />
        <div className="flex gap-8">
          <ShimmerGrid count={84} cols="grid-cols-7" itemClassName="aspect-square w-9 md:w-11" />
        </div>
      </div>
    );
  }

  let activeAcrossClueNum = null;
  let activeDownClueNum = null;
  if (selectedCell) {
    const [r, c] = selectedCell;
    let startC = c;
    while (startC >= 0 && !isBlackSquare(r, startC)) startC--;
    startC++;
    activeAcrossClueNum = cellNumbers[`${r},${startC}`];
    let startR = r;
    while (startR >= 0 && !isBlackSquare(startR, c)) startR--;
    startR++;
    activeDownClueNum = cellNumbers[`${startR},${c}`];
  }

  return (
    <div
      className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8"
      ref={gridRef}
    >
      {/* Hidden input — keeps focus so the mobile virtual keyboard opens on cell tap */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="text"
        readOnly={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        onKeyDown={handleKeyDown}
        onChange={handleHiddenInputChange}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'fixed', top: '-9999px', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
      />
      <BannerStack banners={banners} onDone={(id) => setBanners((b) => b.filter((x) => x.id !== id))} />

      <div className="mb-4">
        <BackArrow />
      </div>

      {/* Header */}
      <header className="relative bg-[#00E5FF] border-[3px] border-black shadow-[4px_4px_0_#000] px-5 py-4 mb-6 flex justify-between items-center overflow-hidden">
        <StarDoodle className="absolute top-2 right-16 w-7 h-7 text-[#FF1493] opacity-40" />
        <div>
          <h1 className="font-display text-3xl font-black text-black uppercase tracking-tight">The Skinny</h1>
          <p className="text-sm font-bold text-black/60 font-sans">{puzzle.date}</p>
        </div>
        <div className="flex-shrink-0">
          <TimerRing
            value={ringRemaining}
            total={TARGET_TIME}
            size={72}
            thickness={7}
            label={formatTime(elapsedTime)}
          />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Grid */}
        <div ref={gridSectionRef} className="flex-shrink-0 flex flex-col items-center">
          <Shake trigger={shakeBoardKey}>
            <div
              className="grid gap-0 bg-[#FFD700] p-[3px] border-[3px] border-black shadow-[6px_6px_0_#000]"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: rows }).map((_, r) =>
                Array.from({ length: cols }).map((_, c) => {
                  const isBlack = isBlackSquare(r, c);
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isActiveWord = activeWordCells.some(([wr, wc]) => wr === r && wc === c);
                  const isShaking = shakeCells.some(([sr, sc]) => sr === r && sc === c);
                  const isPopping = popCells.has(`${r}-${c}`);

                  let bg = "bg-white";
                  if (isBlack) bg = "bg-[#FFD700]";
                  else if (isSelected) bg = "bg-[#FF1493]";
                  else if (isActiveWord) bg = "bg-[#FFFDE7]";
                  else if (isCompleted || winFlipping) bg = "bg-[#00C853]";

                  const cellBorder = isBlack ? "" : "border-[3px] border-black";

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      className={`relative ${cellSize} flex items-center justify-center cursor-pointer select-none ${bg} ${cellBorder} ${isShaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
                      onClick={() => handleCellClick(r, c)}
                      data-testid={`cell-${r}-${c}`}
                      animate={winFlipping && !isBlack ? { rotateY: [0, 180, 360], scale: [1, 1.1, 1] } : {}}
                      transition={{ delay: winFlipping ? (r + c) * 0.04 : 0, duration: 0.5 }}
                    >
                      {!isBlack && cellNumbers[`${r},${c}`] && (
                        <span className={`absolute top-0.5 left-0.5 ${cellNumSize} font-bold text-black/60 leading-none`}>
                          {cellNumbers[`${r},${c}`]}
                        </span>
                      )}
                      {!isBlack && (
                        <motion.span
                          className={`${cellTextSize} font-black font-display ${isCompleted ? "text-white" : isSelected ? "text-white" : "text-black"}`}
                          animate={isPopping ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          {gridState[r]?.[c] || ""}
                        </motion.span>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </Shake>

          {!isCompleted ? (
            <Button
              size="lg"
              onClick={handleCheck}
              className="mt-6 w-full md:w-auto px-12 font-display uppercase tracking-wide"
              data-testid="btn-check"
            >
              Check Grid
            </Button>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 220, damping: 22 }}
                className="mt-6 bg-[#00C853] border-[3px] border-black shadow-[4px_4px_0_#000] p-6 text-center w-full max-w-[340px]"
              >
                <CheckCircle2 className="w-12 h-12 text-black mx-auto mb-3" />
                <h3 className="font-display text-2xl font-black text-black uppercase mb-1">Solved!</h3>
                <p className="text-black/70 font-sans mb-2">
                  Time: <span className="font-black text-black">{formatTime(elapsedTime)}</span>
                </p>
                {rankPercentile !== null && (
                  <p className="text-sm font-bold text-black/80 font-sans mb-4">
                    Faster than <span className="text-black font-black">{rankPercentile}%</span> of players
                  </p>
                )}
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleShare}
                    className="bg-black text-[#FFD700] hover:bg-[#FF1493] hover:text-black border-[3px] border-black shadow-[3px_3px_0_rgba(0,0,0,0.3)]"
                    data-testid="btn-share"
                  >
                    <Share2 className="w-4 h-4 mr-2" /> Share
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="btn-home"
                  >
                    <HomeIcon className="w-4 h-4 mr-2" /> Home
                  </Button>
                </div>
              </motion.div>

              {leaderboardEnabled && !archiveId && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 180, damping: 20 }}
                  className="mt-4 w-full max-w-[340px]"
                >
                  <div className="bg-black border-[3px] border-black shadow-[4px_4px_0_#000] px-4 py-3 flex items-center justify-between mb-0">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-[#FFD700]" />
                      <span className="font-display font-black text-white uppercase tracking-wide text-sm">Leaderboard</span>
                    </div>
                    {lbData && lbData.totalPlayers > 0 && (
                      <span className="bg-[#FFD700] text-black font-black font-display text-xs px-2 py-0.5 border border-black">
                        {lbData.totalPlayers} {lbData.totalPlayers === 1 ? "player" : "players"}
                      </span>
                    )}
                  </div>

                  {lbData && lbData.top10.length > 0 ? (
                    <div className="border-[3px] border-t-0 border-black divide-y divide-black/10">
                      {lbData.top10.map((entry) => {
                        const isMe = entry.playerToken === playerToken;
                        const rankEmoji = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`;
                        return (
                          <div
                            key={entry.playerToken}
                            className={`flex items-center justify-between px-4 py-2 ${isMe ? "bg-[#00C853]/15 font-bold" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="font-black font-display text-sm w-8">{rankEmoji}</span>
                              {isMe ? (
                                isEditingName ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      className="border border-black px-1 py-0.5 text-sm font-sans w-28 focus:outline-none"
                                      value={editNameValue}
                                      onChange={(e) => setEditNameValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          commitName(editNameValue);
                                          setIsEditingName(false);
                                        } else if (e.key === "Escape") {
                                          setIsEditingName(false);
                                        }
                                      }}
                                      autoFocus
                                      maxLength={20}
                                    />
                                    <button
                                      onClick={() => {
                                        commitName(editNameValue);
                                        setIsEditingName(false);
                                      }}
                                      className="text-[#00C853] hover:text-black"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setIsEditingName(false)} className="text-black/40 hover:text-black">
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    className="flex items-center gap-1 text-sm font-bold font-sans hover:underline"
                                    onClick={() => { setEditNameValue(playerName || ""); setIsEditingName(true); }}
                                  >
                                    {playerName || "You"}
                                    <Pencil className="w-3 h-3 text-black/40" />
                                  </button>
                                )
                              ) : (
                                <span className="text-sm font-sans text-black/60">
                                  {entry.playerName ?? `Player ${entry.playerToken.slice(0, 4)}`}
                                </span>
                              )}
                            </div>
                            <span className="font-black font-display text-sm">{formatTime(entry.completionTimeSecs)}</span>
                          </div>
                        );
                      })}

                      {myRank !== null && myRankInTop10 === -1 && (
                        <>
                          <div className="px-4 py-1 text-center text-xs text-black/30 font-sans">• • •</div>
                          <div className="flex items-center justify-between px-4 py-2 bg-[#00C853]/15 font-bold">
                            <div className="flex items-center gap-3">
                              <span className="font-black font-display text-sm w-8">#{myRank}</span>
                              {isEditingName ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    className="border border-black px-1 py-0.5 text-sm font-sans w-28 focus:outline-none"
                                    value={editNameValue}
                                    onChange={(e) => setEditNameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                      else if (e.key === "Escape") { setIsEditingName(false); }
                                    }}
                                    autoFocus
                                    maxLength={20}
                                  />
                                  <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="text-[#00C853] hover:text-black"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setIsEditingName(false)} className="text-black/40 hover:text-black"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <button
                                  className="flex items-center gap-1 text-sm font-bold font-sans hover:underline"
                                  onClick={() => { setEditNameValue(playerName || ""); setIsEditingName(true); }}
                                >
                                  {playerName || "You"}
                                  <Pencil className="w-3 h-3 text-black/40" />
                                </button>
                              )}
                            </div>
                            <span className="font-black font-display text-sm">{formatTime(elapsedTime)}</span>
                          </div>
                        </>
                      )}

                      {lbData.totalPlayers > 0 && (
                        <div className="flex items-center justify-between px-4 py-2 bg-black/5 text-xs text-black/50 font-sans">
                          <div className="flex items-center gap-1">
                            <BarChart2 className="w-3 h-3" />
                            <span>Avg: {formatTime(lbData.avgTimeSecs)}</span>
                          </div>
                          <span>Median: {formatTime(lbData.medianTimeSecs)}</span>
                        </div>
                      )}
                    </div>
                  ) : isCompleted ? (
                    <div className="border-[3px] border-t-0 border-black divide-y divide-black/10">
                      <div className="flex items-center justify-between px-4 py-2 bg-[#00C853]/15 font-bold">
                        <div className="flex items-center gap-3">
                          <span className="font-black font-display text-sm w-8">🥇</span>
                          {isEditingName ? (
                            <div className="flex items-center gap-1">
                              <input
                                className="border border-black px-1 py-0.5 text-sm font-sans w-28 focus:outline-none"
                                value={editNameValue}
                                onChange={(e) => setEditNameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") { commitName(editNameValue); setIsEditingName(false); }
                                  else if (e.key === "Escape") { setIsEditingName(false); }
                                }}
                                autoFocus
                                maxLength={20}
                              />
                              <button onClick={() => { commitName(editNameValue); setIsEditingName(false); }} className="text-[#00C853] hover:text-black"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setIsEditingName(false)} className="text-black/40 hover:text-black"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-1 text-sm font-bold font-sans hover:underline"
                              onClick={() => { setEditNameValue(playerName || ""); setIsEditingName(true); }}
                            >
                              {playerName || "You"}
                              <Pencil className="w-3 h-3 text-black/40" />
                            </button>
                          )}
                        </div>
                        <span className="font-black font-display text-sm">{formatTime(elapsedTime)}</span>
                      </div>
                    </div>
                  ) : skinnyLeaderboardQuery.isPending ? (
                    <div className="border-[3px] border-t-0 border-black p-4 text-center text-sm text-black/50">Loading...</div>
                  ) : (
                    <div className="border-[3px] border-t-0 border-black p-4 text-center text-sm text-black/50 font-sans">
                      Be the first to complete today's puzzle!
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}
        </div>

        {/* Clues */}
        <div className="flex-1 flex flex-col md:flex-row lg:flex-col gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <LightningDoodle className="w-5 h-7 text-[#FF1493]" />
              <h3 className="font-display font-black text-xl text-black uppercase tracking-wide">Across</h3>
            </div>
            <ul className="space-y-1">
              {Object.entries(puzzle.cluesAcross).map(([num, clue]) => {
                const isActive = activeAcrossClueNum?.toString() === num && direction === 'across';
                return (
                  <li
                    key={`across-${num}`}
                    onClick={() => handleClueClick(parseInt(num), 'across')}
                    className={`flex gap-3 p-2 border-l-[3px] font-sans text-sm transition-none cursor-pointer ${
                      isActive
                        ? "border-[#FF1493] bg-[#FF1493]/10 font-bold text-black"
                        : "border-transparent text-black/60 hover:text-black hover:border-[#FF1493]/40"
                    }`}
                  >
                    <span className="font-black w-5 shrink-0 text-black">{num}</span>
                    <span>{clue}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-3">
              <StarDoodle className="w-6 h-6 text-[#00C853]" />
              <h3 className="font-display font-black text-xl text-black uppercase tracking-wide">Down</h3>
            </div>
            <ul className="space-y-1">
              {Object.entries(puzzle.cluesDown).map(([num, clue]) => {
                const isActive = activeDownClueNum?.toString() === num && direction === 'down';
                return (
                  <li
                    key={`down-${num}`}
                    onClick={() => handleClueClick(parseInt(num), 'down')}
                    className={`flex gap-3 p-2 border-l-[3px] font-sans text-sm transition-none cursor-pointer ${
                      isActive
                        ? "border-[#00C853] bg-[#00C853]/10 font-bold text-black"
                        : "border-transparent text-black/60 hover:text-black hover:border-[#00C853]/40"
                    }`}
                  >
                    <span className="font-black w-5 shrink-0 text-black">{num}</span>
                    <span>{clue}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-black/50 font-sans lg:hidden">
        Tap a cell to start typing · tap again to switch direction
      </p>

      <div className="mt-10 flex justify-center">
        <button
          onClick={() => setLocation("/archive")}
          className="py-3 px-6 bg-[#FF1493] border-[4px] border-black shadow-[4px_4px_0_#000] font-display font-black text-base text-black uppercase rounded-[12px] hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none active:translate-x-[4px] active:translate-y-[4px] transition-all duration-75 cursor-pointer"
        >
          Not your jam? Check out the archives
        </button>
      </div>
    </div>
  );
}
