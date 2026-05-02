import { generalPopCulture } from "./general-pop-culture";
import { throwback2000s } from "./2000s-throwback";
import { movieQuotes } from "./movie-quotes";
import { tvShowTrivia } from "./tv-show-trivia";
import { trueFalseLightning } from "./true-false-lightning";
import type { QuizPack } from "../types";

// NOTE: Picture rounds and music rounds are intentionally not implemented yet — see task #2 out-of-scope.
// They can be added by introducing new roundType values + question shapes (e.g. "picture", "music")
// alongside the existing multiple-choice / open-ended / true-false types.
export const QUIZ_PACKS: QuizPack[] = [
  generalPopCulture,
  throwback2000s,
  movieQuotes,
  tvShowTrivia,
  trueFalseLightning,
];

export function getQuizPack(id: string): QuizPack | undefined {
  return QUIZ_PACKS.find((pack) => pack.id === id);
}

export function getRandomQuizPack(): QuizPack {
  return QUIZ_PACKS[Math.floor(Math.random() * QUIZ_PACKS.length)]!;
}
