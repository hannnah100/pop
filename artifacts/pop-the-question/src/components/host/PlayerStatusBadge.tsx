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
      initial={false}
      animate={false}
      className={cn(
        "inline-flex items-center gap-1.5 border-[2px] px-2 py-0.5 text-xs font-bold leading-none uppercase tracking-wide",
        meta.cls,
        className,
      )}
      data-testid={`status-${state}`}
    >
      <Icon className={cn("w-3.5 h-3.5", meta.iconCls)} />
      {!compact && (
        <span>{meta.label}</span>
      )}
    </motion.span>
  );
}
