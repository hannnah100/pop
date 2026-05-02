import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  Pause,
  Play,
  PowerOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useHostSettings,
  updateHostSettings,
  smartDefaultMode,
  FONT_SIZE_SCALE,
  type HostAnswerMethod,
} from "@/lib/hostSettings";
import {
  toggleFullscreen,
  useFullscreenState,
} from "@/lib/fullscreen";
import { HostSettingsDrawer } from "./HostSettingsDrawer";
import {
  HostNotifications,
  type HostNotificationsHandle,
} from "./HostNotifications";
import { SmartDefaultTip } from "./SmartDefaultTip";
import { cn } from "@/lib/utils";

interface HostShellProps {
  children: ReactNode;
  playerCount: number;
  controls?: ReactNode;
  onEndGame?: () => void;
  onPauseChange?: (paused: boolean) => void;
  onAnswerMethodChange?: (method: HostAnswerMethod) => void;
  notificationsRef?: React.RefObject<HostNotificationsHandle | null>;
  hideEndGame?: boolean;
}

export function HostShell({
  children,
  playerCount,
  controls,
  onEndGame,
  onPauseChange,
  onAnswerMethodChange,
  notificationsRef,
  hideEndGame = false,
}: HostShellProps) {
  const settings = useHostSettings();
  const isFs = useFullscreenState();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showFsHint, setShowFsHint] = useState(false);
  const lastFsRef = useRef(isFs);

  useEffect(() => {
    if (settings.modeOverridden) return;
    const def = smartDefaultMode(playerCount);
    if (def !== settings.mode) updateHostSettings({ mode: def });
  }, [playerCount, settings.mode, settings.modeOverridden]);

  useEffect(() => {
    if (isFs && !lastFsRef.current) {
      setShowFsHint(true);
      const t = window.setTimeout(() => setShowFsHint(false), 3500);
      lastFsRef.current = isFs;
      return () => window.clearTimeout(t);
    }
    lastFsRef.current = isFs;
    return undefined;
  }, [isFs]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") { e.preventDefault(); toggleFullscreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePauseToggle = () => {
    const next = !paused;
    setPaused(next);
    onPauseChange?.(next);
  };

  const showTvTip = settings.mode === "in-person" && !isFs && playerCount > 0;

  return (
    <div
      className={cn(
        "host-shell relative flex flex-col flex-1 min-h-0",
        settings.mode === "in-person" ? "host-mode-in-person" : "host-mode-remote",
        settings.highContrast && "host-high-contrast",
      )}
      style={{ ["--host-typo-scale" as string]: String(FONT_SIZE_SCALE[settings.fontSize]) }}
      data-testid="host-shell"
      data-host-mode={settings.mode}
    >
      {/* ESC fullscreen hint */}
      <AnimatePresence>
        {showFsHint && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="host-fullscreen-hint"
            data-testid="fullscreen-hint"
          >
            Press ESC to exit fullscreen
          </motion.div>
        )}
      </AnimatePresence>

      <SmartDefaultTip visible={showTvTip} />
      <HostNotifications ref={notificationsRef} />

      {/* Paused overlay — solid hot pink, no blur */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-[#FF1493]/90 flex flex-col items-center justify-center gap-6"
            data-testid="paused-overlay"
          >
            <Pause className="w-20 h-20 text-[#FFD700]" style={{ filter: "drop-shadow(3px 3px 0 #000)" }} />
            <h2
              className="font-display font-black text-[#FFD700] uppercase"
              style={{ fontSize: "clamp(3rem, 10vw, 5rem)", textShadow: "4px 4px 0 #000" }}
            >
              PAUSED
            </h2>
            <p className="text-white font-bold font-sans text-lg">Click Resume below to continue.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game content */}
      <div className="host-shell-content flex flex-col flex-1 min-h-0">
        <div className="host-safe-zone flex flex-col flex-1 min-h-0">{children}</div>
      </div>

      {/* Controls bar — solid black */}
      <div className="host-controls-bar" data-testid="host-controls-bar">
        <div className="flex items-center gap-2 flex-1 justify-center max-w-5xl">
          {controls}

          {/* Pause/Resume */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={paused ? "secondary" : "outline"}
                size="lg"
                onClick={handlePauseToggle}
                className={`font-display uppercase tracking-wide gap-2 ${paused ? "bg-[#00C853] text-black border-[3px] border-[#00C853]" : "bg-white text-black border-[3px] border-white"}`}
                data-testid="btn-pause"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {paused ? "Resume" : "Pause"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{paused ? "Resume the game" : "Pause everyone"}</TooltipContent>
          </Tooltip>

          {/* End Game */}
          {!hideEndGame && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setConfirmEnd(true)}
                  className="font-display uppercase tracking-wide gap-2 bg-[#FF0000] text-white border-[3px] border-white hover:bg-[#FF6B6B] hover:text-black"
                  data-testid="btn-end-game"
                >
                  <PowerOff className="w-4 h-4" />
                  End
                </Button>
              </TooltipTrigger>
              <TooltipContent>Finish the game now and show scores</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-8 bg-white/30 mx-1" />

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => toggleFullscreen()}
                className="text-white hover:bg-white/10 hover:text-white"
                data-testid="btn-fullscreen-bar"
                aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFs ? "Exit fullscreen (ESC)" : "Fullscreen (F11)"}</TooltipContent>
          </Tooltip>

          {/* Settings */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setDrawerOpen(true)}
                className="text-white hover:bg-white/10 hover:text-white"
                data-testid="btn-settings"
                aria-label="Host settings"
              >
                <Settings className="w-5 h-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Host settings</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <HostSettingsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAnswerMethodChange={onAnswerMethodChange}
      />

      <AlertDialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the game now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will jump straight to the final scoreboard. Players cannot rejoin this round.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-end-cancel">Keep playing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#FF0000] text-white border-[3px] border-black hover:bg-[#FF6B6B]"
              onClick={() => { setConfirmEnd(false); onEndGame?.(); }}
              data-testid="btn-end-confirm"
            >
              End Game
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
