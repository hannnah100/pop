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
  /** Game content to render. */
  children: ReactNode;
  /** Number of non-host players — used for smart default mode. */
  playerCount: number;
  /** Game-contextual controls (Next, Reveal, Skip, etc). */
  controls?: ReactNode;
  /** Called when host clicks End Game (after confirmation). */
  onEndGame?: () => void;
  /** Called with the new paused state when host toggles pause. */
  onPauseChange?: (paused: boolean) => void;
  /** Called when host updates the answer method via the settings drawer. */
  onAnswerMethodChange?: (method: HostAnswerMethod) => void;
  /** Imperative handle to push notifications from parent. */
  notificationsRef?: React.RefObject<HostNotificationsHandle | null>;
  /** Hide the End Game button (e.g. on lobby/finished screens). */
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

  // Smart default mode — apply once based on player count, until user
  // manually overrides via the settings drawer.
  useEffect(() => {
    if (settings.modeOverridden) return;
    const def = smartDefaultMode(playerCount);
    if (def !== settings.mode) {
      updateHostSettings({ mode: def });
    }
  }, [playerCount, settings.mode, settings.modeOverridden]);

  // Show "Press ESC to exit" hint on fullscreen entry, fade after 3.5s.
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

  // F11 hotkey for fullscreen toggle (and just in case ESC does not
  // fire fullscreenchange on some browsers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePauseToggle = () => {
    const next = !paused;
    setPaused(next);
    onPauseChange?.(next);
  };

  const showTvTip =
    settings.mode === "in-person" && !isFs && playerCount > 0;

  return (
    <div
      className={cn(
        "host-shell relative flex flex-col flex-1 min-h-0",
        settings.mode === "in-person" ? "host-mode-in-person" : "host-mode-remote",
        settings.highContrast && "host-high-contrast",
      )}
      style={{
        ["--host-typo-scale" as string]: String(FONT_SIZE_SCALE[settings.fontSize]),
      }}
      data-testid="host-shell"
      data-host-mode={settings.mode}
    >
      {/* ESC hint after entering fullscreen */}
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

      {/* Smart-default Connect-to-TV tip */}
      <SmartDefaultTip visible={showTvTip} />

      {/* Host notifications */}
      <HostNotifications ref={notificationsRef} />

      {/* Paused overlay */}
      <AnimatePresence>
        {paused && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
            data-testid="paused-overlay"
          >
            <Pause className="w-24 h-24 text-primary drop-shadow-[0_0_24px_hsl(var(--primary))]" />
            <h2 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight text-foreground">
              PAUSED
            </h2>
            <p className="text-lg text-muted-foreground">Click Resume in the bar below to continue.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game content — scaled by typography zoom + safe-zone padding */}
      <div className="host-shell-content flex flex-col flex-1 min-h-0">
        <div className="host-safe-zone flex flex-col flex-1 min-h-0">{children}</div>
      </div>

      {/* Persistent host controls bar */}
      <div className="host-controls-bar" data-testid="host-controls-bar">
        <div className="flex items-center gap-2 flex-1 justify-center max-w-5xl">
          {/* Game-contextual actions */}
          {controls}

          {/* Pause / Resume */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={paused ? "default" : "outline"}
                size="lg"
                onClick={handlePauseToggle}
                className="font-bold gap-2"
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
                  className="font-bold gap-2 text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  data-testid="btn-end-game"
                >
                  <PowerOff className="w-4 h-4" />
                  End Game
                </Button>
              </TooltipTrigger>
              <TooltipContent>Finish the game now and show scores</TooltipContent>
            </Tooltip>
          )}

          <div className="w-px h-8 bg-border mx-1" />

          {/* Fullscreen */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => toggleFullscreen()}
                className="font-bold gap-2"
                data-testid="btn-fullscreen-bar"
                aria-label={isFs ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {isFs ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFs ? "Exit fullscreen (ESC)" : "Fullscreen (F11)"}</TooltipContent>
          </Tooltip>

          {/* Settings gear */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={() => setDrawerOpen(true)}
                className="font-bold gap-2"
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

      {/* Settings drawer */}
      <HostSettingsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAnswerMethodChange={onAnswerMethodChange}
      />

      {/* End-game confirmation */}
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmEnd(false);
                onEndGame?.();
              }}
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
