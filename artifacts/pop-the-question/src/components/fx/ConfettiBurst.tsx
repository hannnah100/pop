import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import type { Options as ConfettiOptions } from "canvas-confetti";
import { useReducedMotion } from "@/lib/motion";

export type BurstPreset = "rainbow" | "green" | "fire" | "gold";

const palettes: Record<BurstPreset, string[]> = {
  rainbow: ["#ff3d97", "#22e1c0", "#ffb830", "#3ad4ff", "#a07cff"],
  green:   ["#22e1c0", "#3aff9d", "#0fbd86"],
  fire:    ["#ff5e3a", "#ffb830", "#ff2d55", "#ffd166"],
  gold:    ["#ffd166", "#ffb830", "#ffe082", "#ffffff"],
};

interface ConfettiBurstProps {
  trigger: unknown;
  preset?: BurstPreset;
  origin?: { x?: number; y?: number };
  particleCount?: number;
  spread?: number;
  startVelocity?: number;
  scalar?: number;
}

export function fireConfetti(preset: BurstPreset, options: Partial<ConfettiOptions> = {}) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  void confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 38,
    scalar: 0.95,
    colors: palettes[preset],
    origin: { x: 0.5, y: 0.6 },
    ...options,
  });
}

export function fireBigCelebration() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  fireConfetti("rainbow", { particleCount: 140, spread: 90, startVelocity: 50, origin: { y: 0.65 } });
  setTimeout(() => fireConfetti("gold", { particleCount: 80, spread: 110, origin: { x: 0.2, y: 0.7 } }), 220);
  setTimeout(() => fireConfetti("rainbow", { particleCount: 80, spread: 110, origin: { x: 0.8, y: 0.7 } }), 380);
}

export function ConfettiBurst({
  trigger,
  preset = "rainbow",
  origin,
  particleCount = 80,
  spread = 70,
  startVelocity = 38,
  scalar = 0.95,
}: ConfettiBurstProps) {
  const reduced = useReducedMotion();
  const last = useRef<unknown>(null);

  useEffect(() => {
    if (trigger == null || trigger === false) return;
    if (last.current === trigger) return;
    last.current = trigger;
    if (reduced) return;
    fireConfetti(preset, {
      particleCount,
      spread,
      startVelocity,
      scalar,
      origin: { x: origin?.x ?? 0.5, y: origin?.y ?? 0.6 },
    });
  }, [trigger, preset, particleCount, spread, startVelocity, scalar, origin?.x, origin?.y, reduced]);

  return null;
}
