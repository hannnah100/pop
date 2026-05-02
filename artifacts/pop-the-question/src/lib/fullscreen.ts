import { useEffect, useState } from "react";

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(document.fullscreenElement);
}

export async function enterFullscreen(el: Element | null = null): Promise<void> {
  if (typeof document === "undefined") return;
  const target = el ?? document.documentElement;
  if (document.fullscreenElement) return;
  try {
    await target.requestFullscreen();
  } catch {
    /* user-cancelled or unsupported */
  }
}

export async function exitFullscreen(): Promise<void> {
  if (typeof document === "undefined") return;
  if (!document.fullscreenElement) return;
  try {
    await document.exitFullscreen();
  } catch {
    /* ignore */
  }
}

export async function toggleFullscreen(el: Element | null = null): Promise<void> {
  if (isFullscreen()) {
    await exitFullscreen();
  } else {
    await enterFullscreen(el);
  }
}

/**
 * Reactive fullscreen state — re-renders when the user enters or exits
 * fullscreen via any means (button, F11, browser chrome, ESC).
 */
export function useFullscreenState(): boolean {
  const [fs, setFs] = useState<boolean>(() => isFullscreen());
  useEffect(() => {
    const onChange = () => setFs(isFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return fs;
}
