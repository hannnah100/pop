import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface TimerRingProps {
  value: number;
  total: number;
  size?: number;
  thickness?: number;
  label?: string;
  className?: string;
  showLabel?: boolean;
}

export function TimerRing({
  value,
  total,
  size = 84,
  thickness = 8,
  label,
  className,
  showLabel = true,
}: TimerRingProps) {
  const safeTotal = Math.max(1, total);
  const ratio = Math.max(0, Math.min(1, value / safeTotal));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const { color, isLow, isCritical } = useMemo(() => {
    if (ratio > 0.5) return { color: "hsl(var(--success))", isLow: false, isCritical: false };
    if (ratio > 0.25) return { color: "hsl(var(--accent))", isLow: true, isCritical: false };
    return { color: "hsl(var(--destructive))", isLow: true, isCritical: true };
  }, [ratio]);

  const formatted = useMemo(() => {
    if (label) return label;
    const seconds = Math.max(0, Math.ceil(value));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, [value, label]);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        isCritical ? "animate-pulse-glow rounded-full" : "",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className={cn(isLow ? "drop-shadow-[0_0_8px_currentColor]" : "")}
        style={{ color }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--card))"
          strokeWidth={thickness}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
        />
      </svg>
      {showLabel && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center font-mono font-bold",
          )}
          style={{ color }}
        >
          <span style={{ fontSize: size * 0.26 }}>{formatted}</span>
        </div>
      )}
    </div>
  );
}
