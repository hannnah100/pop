import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface BackArrowProps {
  href?: string;
  label?: string;
  className?: string;
}

export function BackArrow({ href = "/", label = "Back to home", className }: BackArrowProps) {
  const [, setLocation] = useLocation();

  return (
    <button
      onClick={() => setLocation(href)}
      aria-label={label}
      data-testid="btn-back-arrow"
      className={cn(
        "group inline-flex items-center gap-2 bg-white border-[3px] border-black shadow-[4px_4px_0_#000]",
        "px-4 py-2 font-display font-black text-black uppercase text-sm tracking-wide",
        "hover:shadow-[2px_2px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px]",
        "active:shadow-none active:translate-x-[4px] active:translate-y-[4px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1493] focus-visible:ring-offset-2",
        "transition-[box-shadow,transform] duration-75",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="w-5 h-5 flex-shrink-0"
        aria-hidden
      >
        <path
          d="M19 12H5M5 12L11 6M5 12L11 18"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Back</span>
    </button>
  );
}
