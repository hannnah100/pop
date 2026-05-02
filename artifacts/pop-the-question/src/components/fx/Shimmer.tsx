import { cn } from "@/lib/utils";

interface ShimmerProps {
  className?: string;
  rounded?: string;
}

export function Shimmer({ className, rounded = "rounded-xl" }: ShimmerProps) {
  return (
    <div
      aria-hidden
      className={cn("shimmer-bg border border-border/40", rounded, className)}
    />
  );
}

interface ShimmerListProps {
  count?: number;
  itemClassName?: string;
  className?: string;
}

export function ShimmerList({ count = 4, itemClassName, className }: ShimmerListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className={cn("h-20 w-full", itemClassName)} />
      ))}
    </div>
  );
}

interface ShimmerGridProps {
  count?: number;
  cols?: string;
  itemClassName?: string;
  className?: string;
}

export function ShimmerGrid({
  count = 6,
  cols = "grid-cols-2 md:grid-cols-3",
  itemClassName,
  className,
}: ShimmerGridProps) {
  return (
    <div className={cn("grid gap-4", cols, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Shimmer key={i} className={cn("h-40 w-full", itemClassName)} />
      ))}
    </div>
  );
}
