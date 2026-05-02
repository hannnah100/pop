function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

export const hapticTap = () => vibrate(8);
export const hapticCorrect = () => vibrate(15);
export const hapticWrong = () => vibrate([20, 40, 20]);
export const hapticStrike = () => vibrate([30, 60, 30]);
export const hapticVictory = () => vibrate([10, 30, 10, 30, 10, 100]);

export function useHaptics() {
  return {
    hapticTap,
    hapticCorrect,
    hapticWrong,
    hapticStrike,
    hapticVictory,
  };
}
