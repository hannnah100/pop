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
  /** Compact = chip-only (no label). Full = chip + label text. */
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
    pulse?: boolean;
  }
> = {
  answered: {
    label: "Answered",
    Icon: CheckCircle2,
    cls: "bg-success/20 border-success/50 text-success",
    iconCls: "text-success",
  },
  typing: {
    label: "Typing…",
    Icon: Pencil,
    cls: "bg-yellow-500/20 border-yellow-500/50 text-yellow-300",
    iconCls: "text-yellow-300",
    pulse: true,
  },
  thinking: {
    label: "Thinking…",
    Icon: Hourglass,
    cls: "bg-muted/60 border-border text-muted-foreground",
    iconCls: "text-muted-foreground",
  },
  away: {
    label: "Away",
    Icon: Moon,
    cls: "bg-muted/40 border-border/50 text-muted-foreground/70",
    iconCls: "text-muted-foreground/70",
  },
  muted: {
    label: "Muted",
    Icon: MicOff,
    cls: "bg-destructive/20 border-destructive/50 text-destructive",
    iconCls: "text-destructive",
  },
};

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
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 20 }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold leading-none",
        meta.cls,
        meta.pulse && "animate-pulse",
        className,
      )}
      data-testid={`status-${state}`}
    >
      <Icon className={cn("w-3.5 h-3.5", meta.iconCls)} />
      {!compact && <span>{meta.label}</span>}
    </motion.span>
  );
}
