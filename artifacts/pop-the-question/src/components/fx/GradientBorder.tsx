import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GradientBorderProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  rounded?: string;
  intensity?: "soft" | "strong";
}

export function GradientBorder({
  children,
  className,
  innerClassName,
  rounded = "rounded-3xl",
  intensity = "strong",
}: GradientBorderProps) {
  return (
    <div
      className={cn(
        "relative p-[2px]",
        rounded,
        intensity === "strong"
          ? "bg-gradient-to-br from-[hsl(188_100%_55%)] via-[hsl(330_100%_60%)] to-[hsl(38_100%_60%)]"
          : "bg-gradient-to-br from-[hsl(188_100%_55%/0.5)] via-[hsl(330_100%_60%/0.5)] to-[hsl(38_100%_60%/0.5)]",
        intensity === "strong" ? "shadow-[0_0_36px_-6px_hsl(330_100%_60%/0.55)]" : "",
        className,
      )}
    >
      <div className={cn("h-full w-full bg-card", rounded, innerClassName)}>
        {children}
      </div>
    </div>
  );
}
