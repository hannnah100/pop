import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useGetTodayCrossword } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2, Home as HomeIcon, CheckCircle2 } from "lucide-react";
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

const TARGET_TIME = 240;

export default function Crossword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { playCorrect, playWrong, playTick, playVictory } = useSfx();
  const { recordGame } = useStreaks();

  const { data: puzzle, isLoading } = useGetTodayCrossword();

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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (puzzle && gridState.length === 0) {
      const emptyGrid = Array(5).fill(null).map(() => Array(5).fill(''));
      try {
        const savedState = localStorage.getItem(`ptq-crossword-${todayDate}`);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.completed) {
            setGridState(puzzle.grid);
            setIsCompleted(true);
            setElapsedTime(parsed.time);
            recordedRef.current = true;
            return;
          }
        }
      } catch {/* ignore */}
      setGridState(emptyGrid);
      setStartTime(Date.now());
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (!puzzle.blackSquares.some(([br, bc]) => br === r && bc === c)) {
            setSelectedCell([r, c]);
            return;
          }
        }
      }
    }
  }, [puzzle, todayDate, gridState.length]);

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
      while (endC < 5 && !isBlackSquare(r, endC)) endC++;
      endC--;
      for (let i = startC; i <= endC; i++) cells.push([r, i]);
    } else {
      let startR = r;
      while (startR >= 0 && !isBlackSquare(startR, c)) startR--;
      startR++;
      let endR = r;
      while (endR < 5 && !isBlackSquare(endR, c)) endR++;
      endR--;
      for (let i = startR; i <= endR; i++) cells.push([i, c]);
    }
    return cells;
  }, [selectedCell, direction, puzzle, isBlackSquare]);

  const activeWordCells = useMemo(() => getActiveWordCells(), [getActiveWordCells]);

  const triggerPop = (r: number, c: number) => {
    const key = `${r}-${c}`;
    setPopCells((prev) => { const next = new Set(prev); next.add(key); return next; });
    window.setTimeout(() => {
      setPopCells((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }, 320);
  };

  const handleCellClick = (r: number, c: number) => {
    if (isCompleted || isBlackSquare(r, c)) return;
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell([r, c]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompleted || !selectedCell || !puzzle) return;
    const [r, c] = selectedCell;
    if (e.key.match(/^[a-zA-Z]$/)) {
      const char = e.key.toUpperCase();
      const newGrid = [...gridState.map(row => [...row])];
      newGrid[r][c] = char;
      setGridState(newGrid);
      if (char === puzzle.grid[r][c]) triggerPop(r, c);
      if (direction === 'across' && c < 4 && !isBlackSquare(r, c + 1)) setSelectedCell([r, c + 1]);
      else if (direction === 'down' && r < 4 && !isBlackSquare(r + 1, c)) setSelectedCell([r + 1, c]);
    } else if (e.key === 'Backspace') {
      if (gridState[r][c] !== '') {
        const newGrid = [...gridState.map(row => [...row])];
        newGrid[r][c] = '';
        setGridState(newGrid);
      } else {
        if (direction === 'across' && c > 0 && !isBlackSquare(r, c - 1)) setSelectedCell([r, c - 1]);
        else if (direction === 'down' && r > 0 && !isBlackSquare(r - 1, c)) setSelectedCell([r - 1, c]);
      }
    } else if (e.key === 'ArrowRight' && c < 4 && !isBlackSquare(r, c + 1)) { setSelectedCell([r, c + 1]); setDirection('across'); }
    else if (e.key === 'ArrowLeft' && c > 0 && !isBlackSquare(r, c - 1)) { setSelectedCell([r, c - 1]); setDirection('across'); }
    else if (e.key === 'ArrowDown' && r < 4 && !isBlackSquare(r + 1, c)) { setSelectedCell([r + 1, c]); setDirection('down'); }
    else if (e.key === 'ArrowUp' && r > 0 && !isBlackSquare(r - 1, c)) { setSelectedCell([r - 1, c]); setDirection('down'); }
  };

  const handleCheck = () => {
    if (!puzzle) return;
    let isPerfect = true;
    const wrongCells: [number, number][] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
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
      const stats = statsStr ? JSON.parse(statsStr) : { threeStrikesTotalPlays: 0, threeStrikesBestScore: 0, crosswordTotalPlays: 0, crosswordBestTime: 999999 };
      stats.crosswordTotalPlays += 1;
      if (!stats.crosswordBestTime || elapsedTime < stats.crosswordBestTime) stats.crosswordBestTime = elapsedTime;
      localStorage.setItem('ptq-stats', JSON.stringify(stats));
    } catch {/* ignore */}
    if (!recordedRef.current) {
      recordedRef.current = true;
      const newBanners = recordGame("crossword", Math.max(1, TARGET_TIME - elapsedTime));
      if (newBanners.length > 0) setBanners((b) => [...b, ...newBanners]);
    }
  };

  const handleShare = () => {
    if (!puzzle) return;
    const dateStr = new Date().toLocaleDateString();
    const mm = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const ss = (elapsedTime % 60).toString().padStart(2, '0');
    let gridEmoji = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) gridEmoji += isBlackSquare(r, c) ? '⬛' : '🟩';
      gridEmoji += '\n';
    }
    const shareText = `Pop: The Question - The Skinny\n${dateStr}\n\n${gridEmoji}\nTime: ${mm}:${ss}\n\npopthequestion.replit.app`;
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
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (isBlackSquare(r, c)) continue;
        const isAcrossStart = c === 0 || isBlackSquare(r, c - 1);
        const isDownStart = r === 0 || isBlackSquare(r - 1, c);
        if (isAcrossStart || isDownStart) numbers[`${r},${c}`] = currentNum++;
      }
    }
    return numbers;
  }, [puzzle, isBlackSquare]);

  if (isLoading || !puzzle) {
    return (
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        <div className="shimmer-bg h-12 w-1/2" />
        <div className="flex gap-8">
          <ShimmerGrid count={25} cols="grid-cols-5" itemClassName="aspect-square w-12 md:w-16" />
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
      tabIndex={0}
      onKeyDown={handleKeyDown}
      ref={gridRef}
    >
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
        <div className="flex-shrink-0 flex flex-col items-center">
          <Shake trigger={shakeBoardKey}>
            <div className="grid grid-cols-5 gap-[3px] bg-black p-[3px] border-[3px] border-black shadow-[6px_6px_0_#000]">
              {Array.from({ length: 5 }).map((_, r) =>
                Array.from({ length: 5 }).map((_, c) => {
                  const isBlack = isBlackSquare(r, c);
                  const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                  const isActiveWord = activeWordCells.some(([wr, wc]) => wr === r && wc === c);
                  const isShaking = shakeCells.some(([sr, sc]) => sr === r && sc === c);
                  const isPopping = popCells.has(`${r}-${c}`);

                  let bg = "bg-white";
                  if (isBlack) bg = "bg-black";
                  else if (isSelected) bg = "bg-[#FF1493]";
                  else if (isActiveWord) bg = "bg-[#FFD700]";
                  else if (isCompleted || winFlipping) bg = "bg-[#00C853]";

                  return (
                    <motion.div
                      key={`${r}-${c}`}
                      className={`relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center cursor-pointer select-none ${bg} ${isShaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
                      onClick={() => handleCellClick(r, c)}
                      data-testid={`cell-${r}-${c}`}
                      animate={winFlipping && !isBlack ? { rotateY: [0, 180, 360], scale: [1, 1.1, 1] } : {}}
                      transition={{ delay: winFlipping ? (r + c) * 0.05 : 0, duration: 0.6 }}
                    >
                      {!isBlack && cellNumbers[`${r},${c}`] && (
                        <span className="absolute top-0.5 left-1 text-[9px] md:text-[10px] font-bold text-black/60 leading-none">
                          {cellNumbers[`${r},${c}`]}
                        </span>
                      )}
                      {!isBlack && (
                        <motion.span
                          className={`text-xl md:text-2xl font-black font-display ${isCompleted ? "text-white" : isSelected ? "text-white" : "text-black"}`}
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="mt-6 bg-[#00C853] border-[3px] border-black shadow-[4px_4px_0_#000] p-6 text-center w-full max-w-[340px]"
            >
              <CheckCircle2 className="w-12 h-12 text-black mx-auto mb-3" />
              <h3 className="font-display text-2xl font-black text-black uppercase mb-1">Solved!</h3>
              <p className="text-black/70 font-sans mb-4">
                Time: <span className="font-black text-black">{formatTime(elapsedTime)}</span>
              </p>
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
                    className={`flex gap-3 p-2 border-l-[3px] font-sans text-sm transition-none ${
                      isActive
                        ? "border-[#FF1493] bg-[#FF1493]/10 font-bold text-black"
                        : "border-transparent text-black/60 hover:text-black"
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
                    className={`flex gap-3 p-2 border-l-[3px] font-sans text-sm transition-none ${
                      isActive
                        ? "border-[#00C853] bg-[#00C853]/10 font-bold text-black"
                        : "border-transparent text-black/60 hover:text-black"
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

      <p className="mt-6 text-center text-sm text-black/50 font-sans lg:hidden">
        Tap a cell to select · double-tap to change direction
      </p>
    </div>
  );
}
