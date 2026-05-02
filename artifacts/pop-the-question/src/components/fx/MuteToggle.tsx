import { Volume2, VolumeX } from "lucide-react";
import { useMutedState, unlockAudio } from "@/lib/sfx";
import { cn } from "@/lib/utils";

interface MuteToggleProps {
  className?: string;
}

export function MuteToggle({ className }: MuteToggleProps) {
  const [muted, setMuted] = useMutedState();
  return (
    <button
      type="button"
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={!muted}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        if (!next) unlockAudio();
      }}
      data-testid="btn-mute-toggle"
      className={cn(
        "fixed bottom-4 right-4 z-50 h-11 w-11 rounded-full border border-border/60",
        "bg-card/80 backdrop-blur-md text-foreground shadow-[0_4px_18px_-4px_rgba(0,0,0,0.6)]",
        "hover:border-secondary/60 hover:text-secondary transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary",
        "flex items-center justify-center",
        className,
      )}
    >
      {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
    </button>
  );
}
