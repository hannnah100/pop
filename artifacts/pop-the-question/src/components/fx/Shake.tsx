import { useEffect, type ReactNode } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { useReducedMotion, popKeyframes, shakeKeyframes } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface ShakeProps {
  trigger: unknown;
  children: ReactNode;
  className?: string;
  asTag?: "div" | "span";
}

export function Shake({ trigger, children, className, asTag = "div" }: ShakeProps) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trigger == null || trigger === false) return;
    if (reduced) return;
    void controls.start(shakeKeyframes);
  }, [trigger, controls, reduced]);

  const Comp = asTag === "span" ? motion.span : motion.div;
  return (
    <Comp animate={controls} className={cn(className)}>
      {children}
    </Comp>
  );
}

interface PopInProps {
  trigger: unknown;
  children: ReactNode;
  className?: string;
  asTag?: "div" | "span";
}

export function Pop({ trigger, children, className, asTag = "div" }: PopInProps) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();

  useEffect(() => {
    if (trigger == null || trigger === false) return;
    if (reduced) return;
    void controls.start(popKeyframes);
  }, [trigger, controls, reduced]);

  const Comp = asTag === "span" ? motion.span : motion.div;
  return (
    <Comp animate={controls} className={cn(className)}>
      {children}
    </Comp>
  );
}
