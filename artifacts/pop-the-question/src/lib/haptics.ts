import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const isNative = (): boolean => Capacitor.isNativePlatform();

function vibrate(pattern: number | number[]) {
  if (typeof navigator === "undefined") return;
  if (typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* no-op */
  }
}

function nativeImpact(style: ImpactStyle) {
  Haptics.impact({ style }).catch(() => {});
}

function nativeNotification(type: NotificationType) {
  Haptics.notification({ type }).catch(() => {});
}

export const hapticTap = () => {
  if (isNative()) return nativeImpact(ImpactStyle.Light);
  vibrate(8);
};

export const hapticCorrect = () => {
  if (isNative()) return nativeNotification(NotificationType.Success);
  vibrate(15);
};

export const hapticWrong = () => {
  if (isNative()) return nativeNotification(NotificationType.Error);
  vibrate([20, 40, 20]);
};

export const hapticStrike = () => {
  if (isNative()) return nativeImpact(ImpactStyle.Heavy);
  vibrate([30, 60, 30]);
};

export const hapticVictory = () => {
  if (isNative()) return nativeNotification(NotificationType.Success);
  vibrate([10, 30, 10, 30, 10, 100]);
};

export function useHaptics() {
  return {
    hapticTap,
    hapticCorrect,
    hapticWrong,
    hapticStrike,
    hapticVictory,
  };
}
