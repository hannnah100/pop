export interface JeopardyClue {
  value: number;
  question: string;
  answer: string;
  acceptedAnswers?: string[];
  isDailyDouble?: boolean;
}

export interface JeopardyCategory {
  name: string;
  clues: [JeopardyClue, JeopardyClue, JeopardyClue, JeopardyClue, JeopardyClue];
}

export interface JeopardyFinalClue {
  category: string;
  question: string;
  answer: string;
  acceptedAnswers?: string[];
}

export interface JeopardyPack {
  id: string;
  title: string;
  description: string;
  categories: [
    JeopardyCategory,
    JeopardyCategory,
    JeopardyCategory,
    JeopardyCategory,
    JeopardyCategory,
    JeopardyCategory,
  ];
  final: JeopardyFinalClue;
}

export interface JeopardyPackSummary {
  id: string;
  title: string;
  description: string;
  categoryCount: number;
  clueCount: number;
}

export function summarizeJeopardyPack(pack: JeopardyPack): JeopardyPackSummary {
  const clueCount = pack.categories.reduce((acc, c) => acc + c.clues.length, 0);
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    categoryCount: pack.categories.length,
    clueCount,
  };
}
