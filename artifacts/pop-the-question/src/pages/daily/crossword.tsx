import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useGetTodayCrossword } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Share2, Home as HomeIcon, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Crossword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: puzzle, isLoading } = useGetTodayCrossword();
  
  const [gridState, setGridState] = useState<string[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [shakeCells, setShakeCells] = useState<[number, number][]>([]);

  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const todayDate = new Date().toISOString().split('T')[0];

  // Initialize grid
  useEffect(() => {
    if (puzzle && gridState.length === 0) {
      const emptyGrid = Array(5).fill(null).map(() => Array(5).fill(''));
      
      // Load saved state if exists
      try {
        const savedState = localStorage.getItem(`ptq-crossword-${todayDate}`);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.completed) {
            setGridState(puzzle.grid);
            setIsCompleted(true);
            setElapsedTime(parsed.time);
            return;
          }
        }
      } catch(e) {}
      
      setGridState(emptyGrid);
      setStartTime(Date.now());
      
      // Find first valid cell
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

  // Timer
  useEffect(() => {
    if (startTime && !isCompleted) {
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTime, isCompleted]);

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

  const handleCellClick = (r: number, c: number) => {
    if (isCompleted || isBlackSquare(r, c)) return;
    
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell([r, c]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isCompleted || !selectedCell) return;
    
    const [r, c] = selectedCell;
    
    if (e.key.match(/^[a-zA-Z]$/)) {
      const char = e.key.toUpperCase();
      const newGrid = [...gridState.map(row => [...row])];
      newGrid[r][c] = char;
      setGridState(newGrid);
      
      // Auto advance
      if (direction === 'across' && c < 4 && !isBlackSquare(r, c + 1)) {
        setSelectedCell([r, c + 1]);
      } else if (direction === 'down' && r < 4 && !isBlackSquare(r + 1, c)) {
        setSelectedCell([r + 1, c]);
      }
    } else if (e.key === 'Backspace') {
      if (gridState[r][c] !== '') {
        const newGrid = [...gridState.map(row => [...row])];
        newGrid[r][c] = '';
        setGridState(newGrid);
      } else {
        // Move back
        if (direction === 'across' && c > 0 && !isBlackSquare(r, c - 1)) {
          setSelectedCell([r, c - 1]);
        } else if (direction === 'down' && r > 0 && !isBlackSquare(r - 1, c)) {
          setSelectedCell([r - 1, c]);
        }
      }
    } else if (e.key === 'ArrowRight' && c < 4 && !isBlackSquare(r, c + 1)) {
      setSelectedCell([r, c + 1]);
      setDirection('across');
    } else if (e.key === 'ArrowLeft' && c > 0 && !isBlackSquare(r, c - 1)) {
      setSelectedCell([r, c - 1]);
      setDirection('across');
    } else if (e.key === 'ArrowDown' && r < 4 && !isBlackSquare(r + 1, c)) {
      setSelectedCell([r + 1, c]);
      setDirection('down');
    } else if (e.key === 'ArrowUp' && r > 0 && !isBlackSquare(r - 1, c)) {
      setSelectedCell([r - 1, c]);
      setDirection('down');
    }
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
            if (gridState[r][c] !== '') {
              wrongCells.push([r, c]);
            }
          }
        }
      }
    }
    
    if (isPerfect) {
      handleWin();
    } else {
      if (wrongCells.length > 0) {
        setShakeCells(wrongCells);
        setTimeout(() => setShakeCells([]), 500);
      }
      toast({
        title: "Keep trying!",
        description: "Some letters aren't quite right yet.",
        variant: "destructive"
      });
    }
  };

  const handleWin = () => {
    setIsCompleted(true);
    setSelectedCell(null);
    
    // Save completion state
    localStorage.setItem(`ptq-crossword-${todayDate}`, JSON.stringify({
      completed: true,
      time: elapsedTime
    }));

    // Update stats
    try {
      const currentStreak = parseInt(localStorage.getItem('ptq-streak-crossword') || '0');
      localStorage.setItem('ptq-streak-crossword', (currentStreak + 1).toString());
      
      const statsStr = localStorage.getItem('ptq-stats');
      const stats = statsStr ? JSON.parse(statsStr) : { threeStrikesTotalPlays: 0, threeStrikesBestScore: 0, crosswordTotalPlays: 0, crosswordBestTime: 999999 };
      stats.crosswordTotalPlays += 1;
      if (!stats.crosswordBestTime || elapsedTime < stats.crosswordBestTime) {
        stats.crosswordBestTime = elapsedTime;
      }
      localStorage.setItem('ptq-stats', JSON.stringify(stats));
    } catch (e) {}
  };

  const handleShare = () => {
    if (!puzzle) return;
    
    const dateStr = new Date().toLocaleDateString();
    const mm = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
    const ss = (elapsedTime % 60).toString().padStart(2, '0');
    
    let gridEmoji = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        gridEmoji += isBlackSquare(r, c) ? '⬛' : '🟩';
      }
      gridEmoji += '\n';
    }
    
    const shareText = `Pop: The Question - Mini Crossword\n${dateStr}\n\n${gridEmoji}\nTime: ${mm}:${ss}\n\npopthequestion.com`;
    
    navigator.clipboard.writeText(shareText).then(() => {
      toast({
        title: "Copied to clipboard!",
        description: "Share your time with friends.",
      });
    });
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Compute cell numbers
  const cellNumbers = useMemo(() => {
    if (!puzzle) return {};
    const numbers: Record<string, number> = {};
    let currentNum = 1;
    
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (isBlackSquare(r, c)) continue;
        
        const isAcrossStart = c === 0 || isBlackSquare(r, c - 1);
        const isDownStart = r === 0 || isBlackSquare(r - 1, c);
        
        if (isAcrossStart || isDownStart) {
          numbers[`${r},${c}`] = currentNum++;
        }
      }
    }
    return numbers;
  }, [puzzle, isBlackSquare]);

  if (isLoading || !puzzle) {
    return <div className="flex-1 flex items-center justify-center">Loading puzzle...</div>;
  }

  // Find active clues
  let activeAcrossClueNum = null;
  let activeDownClueNum = null;
  
  if (selectedCell) {
    const [r, c] = selectedCell;
    
    // Find across start
    let startC = c;
    while (startC >= 0 && !isBlackSquare(r, startC)) startC--;
    startC++;
    activeAcrossClueNum = cellNumbers[`${r},${startC}`];
    
    // Find down start
    let startR = r;
    while (startR >= 0 && !isBlackSquare(startR, c)) startR--;
    startR++;
    activeDownClueNum = cellNumbers[`${startR},${c}`];
  }

  return (
    <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 py-8" tabIndex={0} onKeyDown={handleKeyDown} ref={gridRef}>
      <header className="flex justify-between items-center mb-8 border-b border-border/50 pb-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-primary">Mini Crossword</h1>
          <p className="text-muted-foreground text-sm">{puzzle.date}</p>
        </div>
        <div className="text-2xl font-mono tracking-wider font-medium text-foreground bg-card px-4 py-2 rounded-lg border border-border">
          {formatTime(elapsedTime)}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        {/* Left: Grid */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="grid grid-cols-5 gap-1 bg-border p-1 rounded-lg">
            {Array.from({ length: 5 }).map((_, r) => (
              Array.from({ length: 5 }).map((_, c) => {
                const isBlack = isBlackSquare(r, c);
                const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
                const isActiveWord = activeWordCells.some(([wr, wc]) => wr === r && wc === c);
                const isShaking = shakeCells.some(([sr, sc]) => sr === r && sc === c);
                
                let bgClass = "bg-card";
                if (isBlack) bgClass = "bg-foreground";
                else if (isSelected) bgClass = "bg-primary/30";
                else if (isActiveWord) bgClass = "bg-primary/10";
                else if (isCompleted) bgClass = "bg-success/20";
                
                return (
                  <div
                    key={`${r}-${c}`}
                    className={`relative w-12 h-12 md:w-16 md:h-16 flex items-center justify-center border-0 transition-colors cursor-pointer select-none ${bgClass} ${isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}
                    onClick={() => handleCellClick(r, c)}
                    data-testid={`cell-${r}-${c}`}
                  >
                    {!isBlack && cellNumbers[`${r},${c}`] && (
                      <span className="absolute top-1 left-1 text-[10px] md:text-xs font-semibold text-muted-foreground leading-none">
                        {cellNumbers[`${r},${c}`]}
                      </span>
                    )}
                    {!isBlack && (
                      <span className={`text-2xl md:text-3xl font-bold font-display ${isCompleted ? 'text-success' : 'text-foreground'}`}>
                        {gridState[r]?.[c] || ''}
                      </span>
                    )}
                  </div>
                );
              })
            ))}
          </div>

          {!isCompleted ? (
            <Button size="lg" onClick={handleCheck} className="mt-8 w-full md:w-auto px-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold" data-testid="btn-check">
              Check Grid
            </Button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-8 bg-card p-6 rounded-2xl border border-success/30 text-center w-full max-w-[340px]"
            >
              <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
              <h3 className="text-2xl font-bold font-display mb-2 text-foreground">Puzzle Solved!</h3>
              <p className="text-muted-foreground mb-6">Time: <span className="font-bold text-foreground">{formatTime(elapsedTime)}</span></p>
              <div className="flex gap-2 justify-center">
                <Button onClick={handleShare} className="bg-accent hover:bg-accent/90" data-testid="btn-share">
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
                <Button variant="outline" onClick={() => setLocation("/")} data-testid="btn-home">
                  <HomeIcon className="w-4 h-4 mr-2" /> Home
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Clues */}
        <div className="flex-1 flex flex-col md:flex-row lg:flex-col gap-6">
          <div className="flex-1">
            <h3 className="font-bold font-display text-xl mb-4 text-primary uppercase tracking-wider">Across</h3>
            <ul className="space-y-2">
              {Object.entries(puzzle.cluesAcross).map(([num, clue]) => {
                const isActive = activeAcrossClueNum?.toString() === num && direction === 'across';
                return (
                  <li 
                    key={`across-${num}`}
                    className={`flex gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10 border border-primary/30 text-foreground font-medium' : 'text-muted-foreground hover:bg-card border border-transparent'}`}
                  >
                    <span className="font-bold w-6 shrink-0">{num}</span>
                    <span>{clue}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold font-display text-xl mb-4 text-cyan-400 uppercase tracking-wider">Down</h3>
            <ul className="space-y-2">
              {Object.entries(puzzle.cluesDown).map(([num, clue]) => {
                const isActive = activeDownClueNum?.toString() === num && direction === 'down';
                return (
                  <li 
                    key={`down-${num}`}
                    className={`flex gap-3 p-2 rounded-lg transition-colors ${isActive ? 'bg-cyan-400/10 border border-cyan-400/30 text-foreground font-medium' : 'text-muted-foreground hover:bg-card border border-transparent'}`}
                  >
                    <span className="font-bold w-6 shrink-0">{num}</span>
                    <span>{clue}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
      
      {/* Mobile keyboard hint */}
      <p className="mt-8 text-center text-sm text-muted-foreground lg:hidden">
        Tap a cell to select, double tap to change direction.
      </p>
    </div>
  );
}
