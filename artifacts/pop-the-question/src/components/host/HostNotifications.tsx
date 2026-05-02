import { useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface HostNotification {
  id: string;
  message: string;
  /** ms before auto-dismiss. Default 4500. */
  duration?: number;
  variant?: "info" | "success" | "warn";
}

export interface HostNotificationsHandle {
  push: (n: Omit<HostNotification, "id"> & { id?: string }) => void;
  clear: () => void;
}

interface Props {
  /** Position: top-center is default; bottom-center keeps clear of host bar. */
  position?: "top" | "bottom";
}

const VARIANT_STYLES: Record<NonNullable<HostNotification["variant"]>, string> = {
  info: "bg-card/90 border-secondary/40 text-foreground shadow-[0_0_28px_-8px_hsl(var(--secondary)/0.5)]",
  success:
    "bg-success/15 border-success/50 text-success shadow-[0_0_28px_-8px_hsl(var(--success)/0.5)]",
  warn: "bg-accent/15 border-accent/50 text-accent shadow-[0_0_28px_-8px_hsl(var(--accent)/0.5)]",
};

/**
 * Stacked transient notifications surfaced inside the host viewport
 * (separate from app-level toasts so they don't get hidden in fullscreen
 * and can be styled bigger for screen-share readability).
 */
export const HostNotifications = forwardRef<HostNotificationsHandle, Props>(
  function HostNotifications({ position = "top" }, ref) {
    const [items, setItems] = useState<HostNotification[]>([]);

    const dismiss = useCallback((id: string) => {
      setItems((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const push = useCallback<HostNotificationsHandle["push"]>(
      (n) => {
        const id = n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const duration = n.duration ?? 4500;
        setItems((prev) => {
          // Prevent rapid duplicates of the same message
          const last = prev[prev.length - 1];
          if (last && last.message === n.message) return prev;
          return [...prev, { ...n, id }].slice(-4);
        });
        if (duration > 0) {
          window.setTimeout(() => dismiss(id), duration);
        }
      },
      [dismiss],
    );

    useImperativeHandle(ref, () => ({ push, clear: () => setItems([]) }), [push]);

    // Pause auto-dismiss on tab hide so notifications don't all evaporate
    // while the host is reading them on a screen-share dialog.
    useEffect(() => {
      // Currently all dismissals are scheduled with setTimeout above; this
      // hook is a placeholder for future visibility-aware logic.
    }, []);

    const containerCls =
      position === "top"
        ? "top-6 left-1/2 -translate-x-1/2"
        : "bottom-28 left-1/2 -translate-x-1/2";

    return (
      <div
        className={`pointer-events-none fixed z-[60] flex flex-col items-center gap-2 ${containerCls}`}
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence initial={false}>
          {items.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: position === "top" ? -16 : 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: position === "top" ? -8 : 8, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className={`pointer-events-auto rounded-full border-2 px-5 py-2.5 backdrop-blur font-bold text-base ${VARIANT_STYLES[n.variant ?? "info"]}`}
              data-testid="host-notification"
            >
              {n.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  },
);
