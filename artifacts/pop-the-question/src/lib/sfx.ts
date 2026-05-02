import { useEffect, useRef, useSyncExternalStore } from "react";

type SfxName = "correct" | "wrong" | "strike" | "tick" | "victory" | "tap" | "whoosh";

const STORAGE_KEY = "ptq-sfx-muted";

let listeners = new Set<() => void>();
let mutedState: boolean = (() => {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  // Default muted to avoid surprising users on first load.
  if (stored === null) return true;
  return stored === "1";
})();

function notify() {
  listeners.forEach((l) => l());
}

export function setMuted(value: boolean) {
  mutedState = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  }
  notify();
}

export function getMuted(): boolean {
  return mutedState;
}

export function subscribeMuted(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let audioCtx: AudioContext | null = null;

interface WindowWithWebkitAudio {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as WindowWithWebkitAudio;
  const Ctx: typeof AudioContext | undefined = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

interface ToneOptions {
  type?: OscillatorType;
  freq: number;
  endFreq?: number;
  duration: number;
  volume?: number;
  delay?: number;
  attack?: number;
  release?: number;
}

function playTone(opts: ToneOptions) {
  const ctx = getCtx();
  if (!ctx) return;
  const start = ctx.currentTime + (opts.delay ?? 0);
  const end = start + opts.duration;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, start);
  if (opts.endFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.endFreq), end);
  }
  const peak = opts.volume ?? 0.18;
  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? Math.min(0.2, opts.duration * 0.6);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, end - 0.001);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(end + release);
}

function playNoise(duration: number, volume = 0.08) {
  const ctx = getCtx();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.connect(gain).connect(ctx.destination);
  src.start();
}

const players: Record<SfxName, () => void> = {
  correct: () => {
    playTone({ type: "triangle", freq: 660, endFreq: 990, duration: 0.13, volume: 0.18 });
    playTone({ type: "triangle", freq: 990, endFreq: 1320, duration: 0.16, volume: 0.14, delay: 0.09 });
  },
  wrong: () => {
    playTone({ type: "sawtooth", freq: 220, endFreq: 110, duration: 0.28, volume: 0.16 });
    playNoise(0.12, 0.05);
  },
  strike: () => {
    playTone({ type: "square", freq: 180, endFreq: 80, duration: 0.18, volume: 0.18 });
    playTone({ type: "square", freq: 80, duration: 0.12, volume: 0.14, delay: 0.16 });
  },
  tick: () => {
    playTone({ type: "square", freq: 1200, duration: 0.04, volume: 0.07 });
  },
  victory: () => {
    const notes = [523, 659, 784, 1047]; // C E G C
    notes.forEach((n, i) => {
      playTone({ type: "triangle", freq: n, duration: 0.22, volume: 0.18, delay: i * 0.1 });
    });
    playTone({ type: "sine", freq: 1568, duration: 0.5, volume: 0.12, delay: 0.45 });
  },
  tap: () => {
    playTone({ type: "sine", freq: 440, duration: 0.04, volume: 0.06 });
  },
  whoosh: () => {
    playTone({ type: "sine", freq: 800, endFreq: 200, duration: 0.22, volume: 0.08 });
  },
};

export function playSfx(name: SfxName) {
  if (mutedState) return;
  try {
    players[name]();
  } catch {
    /* no-op */
  }
}

export function unlockAudio() {
  if (mutedState) return;
  getCtx();
}

export function useSfx() {
  return {
    playCorrect: () => playSfx("correct"),
    playWrong: () => playSfx("wrong"),
    playStrike: () => playSfx("strike"),
    playTick: () => playSfx("tick"),
    playVictory: () => playSfx("victory"),
    playTap: () => playSfx("tap"),
    playWhoosh: () => playSfx("whoosh"),
  };
}

export function useMutedState(): [boolean, (v: boolean) => void] {
  const muted = useSyncExternalStore(subscribeMuted, getMuted, getMuted);
  return [muted, setMuted];
}

export function useUnlockOnFirstInteraction() {
  const did = useRef(false);
  useEffect(() => {
    if (did.current) return;
    const handler = () => {
      did.current = true;
      unlockAudio();
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
    };
  }, []);
}
