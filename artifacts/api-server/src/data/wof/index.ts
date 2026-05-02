import { popCulture, nostalgia, viralMoments } from "./packs";
import type { WofPack } from "./types";

export type { WofPack, WofPuzzle, WofPackSummary } from "./types";
export { summarizeWofPack } from "./types";

export const WOF_PACKS: WofPack[] = [popCulture, nostalgia, viralMoments];

export function getWofPack(id: string): WofPack | undefined {
  return WOF_PACKS.find((p) => p.id === id);
}

export function getRandomWofPack(): WofPack {
  return WOF_PACKS[Math.floor(Math.random() * WOF_PACKS.length)]!;
}
