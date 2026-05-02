export type QuizRoundType = "multiple-choice" | "open-ended" | "true-false";

export interface MultipleChoiceQuestion {
  type: "multiple-choice";
  prompt: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

export interface OpenEndedQuestion {
  type: "open-ended";
  prompt: string;
  acceptedAnswers: string[];
}

export interface TrueFalseQuestion {
  type: "true-false";
  prompt: string;
  answer: boolean;
}

export type QuizQuestion =
  | MultipleChoiceQuestion
  | OpenEndedQuestion
  | TrueFalseQuestion;

export interface QuizRound {
  name: string;
  roundType: QuizRoundType;
  questions: QuizQuestion[];
}

export interface QuizPack {
  id: string;
  title: string;
  description: string;
  rounds: QuizRound[];
}

export interface QuizPackSummary {
  id: string;
  title: string;
  description: string;
  roundCount: number;
  questionCount: number;
}

export function summarize(pack: QuizPack): QuizPackSummary {
  const questionCount = pack.rounds.reduce(
    (acc, r) => acc + r.questions.length,
    0,
  );
  return {
    id: pack.id,
    title: pack.title,
    description: pack.description,
    roundCount: pack.rounds.length,
    questionCount,
  };
}
