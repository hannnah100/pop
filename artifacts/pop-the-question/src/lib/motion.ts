import { useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

export const easing = {
  out: [0.16, 1, 0.3, 1] as [number, number, number, number],
  inOut: [0.65, 0, 0.35, 1] as [number, number, number, number],
  back: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
  snap: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

export const springs = {
  soft: { type: "spring", stiffness: 180, damping: 22 } as Transition,
  pop: { type: "spring", stiffness: 380, damping: 18, mass: 0.7 } as Transition,
  punch: { type: "spring", stiffness: 600, damping: 14, mass: 0.6 } as Transition,
  drift: { type: "spring", stiffness: 80, damping: 26 } as Transition,
};

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

export function staggerContainer(stagger = 0.07, delay = 0): Variants {
  return {
    hidden: {},
    show: {
      transition: { staggerChildren: stagger, delayChildren: delay },
    },
  };
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: easing.out },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4, ease: easing.out } },
};

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 20 },
  },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: easing.out } },
  exit: { opacity: 0, x: -60, transition: { duration: 0.3, ease: easing.inOut } },
};

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easing.out } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.25, ease: easing.inOut } },
};

export const shakeKeyframes = {
  x: [0, -10, 10, -8, 8, -4, 4, 0],
  transition: { duration: 0.45, ease: easing.inOut },
};

export const popKeyframes = {
  scale: [1, 1.18, 0.96, 1.04, 1],
  transition: { duration: 0.45, ease: easing.out },
};
