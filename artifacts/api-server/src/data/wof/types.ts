export interface WofPuzzle {
  answer: string;
  category: string;
  hint?: string;
}

export interface WofPack {
  id: string;
  title: string;
  description: string;
  puzzles: WofPuzzle[];
}

export interface WofPackSummary {
  id: string;
  title: string;
  description: string;
  puzzleCount: number;
}

export function summarizeWofPack(pack: WofPack): WofPackSummary {
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    puzzleCount: pack.puzzles.length,
  };
}
