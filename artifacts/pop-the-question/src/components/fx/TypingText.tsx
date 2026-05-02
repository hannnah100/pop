import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";

interface TypingTextProps {
  text: string;
  className?: string;
  speedMs?: number;
  caret?: boolean;
  startDelayMs?: number;
}

export function TypingText({
  text,
  className,
  speedMs = 90,
  caret = true,
  startDelayMs = 100,
}: TypingTextProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? text.length : 0);
  const [done, setDone] = useState(reduced);

  const startTimeoutRef = useRef<number | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduced) {
      setShown(text.length);
      setDone(true);
      return;
    }
    setShown(0);
    setDone(false);
    let i = 0;

    startTimeoutRef.current = window.setTimeout(() => {
      intervalIdRef.current = window.setInterval(() => {
        i += 1;
        setShown(i);
        if (i >= text.length) {
          if (intervalIdRef.current !== null) {
            window.clearInterval(intervalIdRef.current);
            intervalIdRef.current = null;
          }
          setDone(true);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      if (startTimeoutRef.current !== null) {
        window.clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
      if (intervalIdRef.current !== null) {
        window.clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [text, speedMs, startDelayMs, reduced]);

  return (
    <span className={cn(caret && !done ? "caret-blink" : "", className)}>
      {text.slice(0, shown)}
    </span>
  );
}
