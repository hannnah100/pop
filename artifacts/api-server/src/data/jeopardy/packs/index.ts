import { popCulture2000s } from "./2000s-pop-culture";
import { musicAndLyrics } from "./music-and-lyrics";
import { moviesAndTV } from "./movies-and-tv";
import type { JeopardyPack } from "../types";

export const JEOPARDY_PACKS: JeopardyPack[] = [
  popCulture2000s,
  musicAndLyrics,
  moviesAndTV,
];

export function getJeopardyPack(id: string): JeopardyPack | undefined {
  return JEOPARDY_PACKS.find((p) => p.id === id);
}

export function getRandomJeopardyPack(): JeopardyPack {
  return JEOPARDY_PACKS[Math.floor(Math.random() * JEOPARDY_PACKS.length)]!;
}
