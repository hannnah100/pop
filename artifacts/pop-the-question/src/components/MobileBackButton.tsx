import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";

const isExpoWebView =
  typeof navigator !== "undefined" && /Expo/i.test(navigator.userAgent);
const isMobileQueryOverride =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("mobile") === "true";
const isNative =
  Capacitor.isNativePlatform() || isExpoWebView || isMobileQueryOverride;

export function MobileBackButton() {
  const [location, setLocation] = useLocation();

  if (!isNative) return null;
  if (location === "/") return null;

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/");
    }
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Back"
      data-testid="mobile-back-button"
      className="fixed left-4 z-40 flex items-center justify-center w-12 h-12 bg-[#FFD60A] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_#000]"
      style={{
        top: "calc(env(safe-area-inset-top) + 16px)",
        border: "5px solid #000",
        boxShadow: "6px 6px 0 #000",
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-6 h-6"
        aria-hidden
      >
        <path
          d="M19 12H5M5 12L11 6M5 12L11 18"
          stroke="#000"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export default MobileBackButton;
