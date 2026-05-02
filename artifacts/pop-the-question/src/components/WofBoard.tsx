import { motion } from "framer-motion";

interface WofBoardCell {
  letter: string;
  revealed: boolean;
}

type WofBoardWord = WofBoardCell[];

interface WofBoardProps {
  board: WofBoardWord[];
  category: string;
  hint?: string;
  compact?: boolean;
}

export function WofBoard({ board, category, hint, compact = false }: WofBoardProps) {
  const cellSize = compact ? "w-8 h-10 text-base" : "w-10 h-12 text-lg md:w-12 md:h-14 md:text-xl";
  const gap = compact ? "gap-1" : "gap-1.5";
  const rowGap = compact ? "gap-y-2" : "gap-y-3";

  return (
    <div className="flex flex-col items-center w-full">
      <div className="mb-3 text-center">
        <span className={`font-display font-black uppercase tracking-widest ${compact ? "text-sm text-black/60" : "text-base md:text-lg text-black/60"}`}>
          {category}
        </span>
        {hint && (
          <p className="text-xs text-black/40 font-sans mt-0.5">{hint}</p>
        )}
      </div>

      <div className={`flex flex-col items-center ${rowGap} w-full`}>
        {board.map((word, wi) => (
          <div key={wi} className={`flex flex-wrap justify-center ${gap}`}>
            {word.map((cell, ci) => (
              <motion.div
                key={`${wi}-${ci}`}
                initial={false}
                animate={{
                  backgroundColor: cell.revealed ? "#FFD700" : "#fff",
                  scale: cell.revealed ? [1, 1.12, 1] : 1,
                }}
                transition={{ duration: 0.35, ease: "backOut" }}
                className={`${cellSize} flex items-center justify-center border-[3px] border-black shadow-[2px_2px_0_#000] font-display font-black`}
              >
                {cell.revealed ? (
                  <span className="text-black">{cell.letter}</span>
                ) : (
                  <span className="text-transparent select-none">{cell.letter}</span>
                )}
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
