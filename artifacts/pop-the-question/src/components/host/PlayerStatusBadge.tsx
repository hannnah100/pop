import { motion } from "framer-motion";
import { CheckCircle2, Pencil, Hourglass, Moon, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlayerStatusState =
  | "answered"
  | "typing"
  | "thinking"
  | "away"
  | "muted";

interface PlayerStatusBadgeProps {
  state: PlayerStatusState;
  compact?: boolean;
  className?: string;
}

const META: Record<
  PlayerStatusState,
  {
    label: string;
    Icon: typeof CheckCircle2;
    cls: string;
    iconCls: string;
    dots?: boolean;
  }
> = {
  answered: {
    label: "Answered",
    Icon: CheckCircle2,
    cls: "bg-[#00C853] border-black text-black",
    iconCls: "text-black",
  },
  typing: {
    label: "Typing",
    Icon: Pencil,
    cls: "bg-[#FFD700] border-black text-black",
    iconCls: "text-black",
    dots: true,
  },
  thinking: {
    label: "Thinking",
    Icon: Hourglass,
    cls: "bg-white border-black text-black/60",
    iconCls: "text-black/60",
  },
  away: {
    label: "Away",
    Icon: Moon,
    cls: "bg-white/60 border-black/40 text-black/40",
    iconCls: "text-black/40",
  },
  muted: {
    label: "Muted",
    Icon: MicOff,
    cls: "bg-[#FF6B6B] border-black text-black",
    iconCls: "text-black",
  },
};

function TypingDots({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-[2px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current"
          animate={{ opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function PlayerStatusBadge({
  state,
  compact = false,
  className,
}: PlayerStatusBadgeProps) {
  const meta = META[state];
  const { Icon } = meta;

  return (
    <motion.span
      key={state}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 border-[2px] px-2 py-0.5 text-xs font-bold leading-none uppercase tracking-wide",
        meta.cls,
        className,
      )}
      data-testid={`status-${state}`}
    >
      <Icon className={cn("w-3.5 h-3.5", meta.iconCls)} />
      {!compact && (
        <span className="flex items-center gap-0.5">
          {meta.label}
          {meta.dots && <TypingDots className="ml-0.5" />}
        </span>
      )}
    </motion.span>
  );
}
