import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { useReducedMotion } from "@/lib/motion";

interface CountUpProps {
  value: number;
  duration?: number;
  decimals?: number;
  format?: (n: number) => string;
  className?: string;
  prefix?: string;
  suffix?: string;
  startOnMount?: boolean;
}

export function CountUp({
  value,
  duration = 1.1,
  decimals = 0,
  format,
  className,
  prefix,
  suffix,
  startOnMount = true,
}: CountUpProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced || !startOnMount ? value : 0);
  const previous = useRef<number>(reduced || !startOnMount ? value : 0);

  useEffect(() => {
    if (reduced) {
      previous.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(previous.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
      onComplete: () => {
        previous.current = value;
      },
    });
    return () => controls.stop();
  }, [value, duration, reduced]);

  const formatted = format
    ? format(display)
    : decimals > 0
    ? display.toFixed(decimals)
    : Math.round(display).toString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
