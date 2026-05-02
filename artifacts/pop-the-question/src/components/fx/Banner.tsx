import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Banner as BannerData } from "@/lib/streaks";
import { useReducedMotion } from "@/lib/motion";

interface BannerStackProps {
  banners: BannerData[];
  durationMs?: number;
  onDone?: (id: string) => void;
}

const toneClasses: Record<BannerData["tone"], string> = {
  primary: "from-[hsl(330_100%_60%)] to-[hsl(330_100%_45%)] text-white",
  accent:  "from-[hsl(38_100%_60%)] to-[hsl(18_100%_55%)] text-black",
  gold:    "from-[hsl(48_100%_60%)] to-[hsl(38_100%_55%)] text-black",
  cyan:    "from-[hsl(188_100%_55%)] to-[hsl(210_100%_60%)] text-black",
};

export function BannerStack({ banners, durationMs = 3200, onDone }: BannerStackProps) {
  const [visible, setVisible] = useState<BannerData[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (banners.length === 0) return;
    setVisible((prev) => {
      const ids = new Set(prev.map((b) => b.id));
      const merged = [...prev];
      for (const b of banners) {
        if (!ids.has(b.id)) merged.push(b);
      }
      return merged;
    });
  }, [banners]);

  useEffect(() => {
    if (visible.length === 0) return;
    const first = visible[0];
    const t = window.setTimeout(() => {
      setVisible((prev) => prev.slice(1));
      onDone?.(first.id);
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [visible, durationMs, onDone]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {visible.slice(0, 1).map((b) => (
          <motion.div
            key={b.id}
            initial={reduced ? { opacity: 0 } : { y: -40, opacity: 0, scale: 0.9 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className={cn(
              "px-6 py-3 rounded-full font-bold flex items-center gap-3 shadow-2xl",
              "bg-gradient-to-r",
              toneClasses[b.tone],
            )}
          >
            <span className="text-2xl" aria-hidden>{b.emoji}</span>
            <div className="text-left leading-tight">
              <div className="text-sm md:text-base font-display tracking-tight">{b.title}</div>
              {b.subtitle && <div className="text-xs opacity-80 font-medium">{b.subtitle}</div>}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
