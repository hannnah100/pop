import { useSyncExternalStore } from "react";

export type HostMode = "in-person" | "remote";
export type HostFontSize = "normal" | "large" | "huge";
export type HostAnswerMethod = "voice" | "text" | "both";

export interface HostSettings {
  mode: HostMode;
  fontSize: HostFontSize;
  highContrast: boolean;
  soundEffects: boolean;
  music: boolean;
  timerSeconds: number;
  answerMethod: HostAnswerMethod;
  /** True once the host has manually picked a mode — disables smart-default override. */
  modeOverridden: boolean;
  /** True after the host dismisses the "Connect to TV" tip. */
  tvTipDismissed: boolean;
}

const STORAGE_KEY = "ptq-host-settings-v1";

const DEFAULTS: HostSettings = {
  mode: "in-person",
  fontSize: "normal",
  highContrast: false,
  soundEffects: true,
  music: false,
  timerSeconds: 30,
  answerMethod: "both",
  modeOverridden: false,
  tvTipDismissed: false,
};

function load(): HostSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<HostSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(s: HostSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / disabled storage */
  }
}

let state: HostSettings = load();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function getHostSettings(): HostSettings {
  return state;
}

export function updateHostSettings(patch: Partial<HostSettings>) {
  state = { ...state, ...patch };
  save(state);
  notify();
}

export function resetHostSettings() {
  state = { ...DEFAULTS };
  save(state);
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHostSettings(): HostSettings {
  return useSyncExternalStore(subscribe, getHostSettings, getHostSettings);
}

/**
 * Multipliers used to scale host-side typography via CSS `zoom` on the
 * content area. Keeps all proportions intact — text, padding, gaps all grow.
 */
export const FONT_SIZE_SCALE: Record<HostFontSize, number> = {
  normal: 1,
  large: 1.15,
  huge: 1.3,
};

export const FONT_SIZE_LABELS: Record<HostFontSize, string> = {
  normal: "Normal",
  large: "Large",
  huge: "Huge",
};

/**
 * Smart default mode based on current player count.
 * <6 players → Remote; 6+ → In-Person. Only applied if the host has not
 * manually overridden via the settings drawer.
 */
export function smartDefaultMode(playerCount: number): HostMode {
  return playerCount < 6 ? "remote" : "in-person";
}
