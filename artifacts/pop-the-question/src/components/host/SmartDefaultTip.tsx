import { motion, AnimatePresence } from "framer-motion";
import { X, Tv } from "lucide-react";
import { useHostSettings, updateHostSettings } from "@/lib/hostSettings";

interface Props {
  /** When true, render the tip. Parent decides based on player count + mode. */
  visible: boolean;
}

/**
 * Dismissible "💡 Connect to TV for best in-person experience" tip.
 * Persists dismissal across reloads via the host-settings store.
 */
export function SmartDefaultTip({ visible }: Props) {
  const settings = useHostSettings();
  const show = visible && !settings.tvTipDismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed top-6 right-6 z-50 max-w-sm rounded-2xl border-2 border-secondary/40 bg-card/95 backdrop-blur px-5 py-4 shadow-[0_0_40px_-10px_hsl(var(--secondary)/0.6)]"
          data-testid="smart-default-tip"
        >
          <div className="flex items-start gap-3">
            <Tv className="w-6 h-6 text-secondary flex-shrink-0 mt-0.5 drop-shadow-[0_0_8px_hsl(var(--secondary))]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground leading-snug">
                Connect to TV for the best in-person experience
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-snug">
                Or open Settings to switch to Remote mode for screen-sharing.
              </p>
            </div>
            <button
              onClick={() => updateHostSettings({ tvTipDismissed: true })}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label="Dismiss tip"
              data-testid="dismiss-tv-tip"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
