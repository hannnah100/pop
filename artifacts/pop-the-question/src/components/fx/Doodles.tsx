import type { SVGProps } from "react";

type DoodleProps = SVGProps<SVGSVGElement> & { className?: string };

export function StarDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden {...props}>
      <polygon
        points="24,3 29,18 45,18 32,28 37,44 24,34 11,44 16,28 3,18 19,18"
        fill="currentColor"
        stroke="#000"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LightningDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 32 48" fill="none" className={className} aria-hidden {...props}>
      <path
        d="M20 2L4 28h12l-4 18 20-28H20L24 2z"
        fill="currentColor"
        stroke="#000"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SmileyDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden {...props}>
      <circle cx="24" cy="24" r="21" fill="currentColor" stroke="#000" strokeWidth="3" />
      <circle cx="16" cy="19" r="3" fill="#000" />
      <circle cx="32" cy="19" r="3" fill="#000" />
      <path
        d="M14 30 Q24 40 34 30"
        stroke="#000"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function SpeechBubbleDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 56 48" fill="none" className={className} aria-hidden {...props}>
      <rect x="2" y="2" width="48" height="36" rx="8" fill="currentColor" stroke="#000" strokeWidth="3" />
      <path
        d="M12 38 L8 46 L22 40"
        fill="currentColor"
        stroke="#000"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GameControllerDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 40" fill="none" className={className} aria-hidden {...props}>
      <rect x="2" y="10" width="60" height="22" rx="11" fill="currentColor" stroke="#000" strokeWidth="3" />
      <rect x="6" y="14" width="18" height="14" rx="4" fill="#FFF8E7" stroke="#000" strokeWidth="2" />
      <rect x="40" y="14" width="18" height="14" rx="4" fill="#FFF8E7" stroke="#000" strokeWidth="2" />
      <rect x="13" y="16" width="4" height="10" rx="1" fill="#000" />
      <rect x="9" y="20" width="12" height="3" rx="1" fill="#000" />
      <circle cx="46" cy="17.5" r="2.5" fill="#FF1493" />
      <circle cx="52" cy="21" r="2.5" fill="#FFD700" />
      <circle cx="46" cy="24.5" r="2.5" fill="#00C853" />
      <circle cx="40" cy="21" r="2.5" fill="#00E5FF" />
    </svg>
  );
}

export function ConfettiDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden {...props}>
      <rect x="6" y="8" width="8" height="8" rx="1" fill="#FF1493" stroke="#000" strokeWidth="2" transform="rotate(15 10 12)" />
      <rect x="48" y="4" width="8" height="8" rx="1" fill="#FFD700" stroke="#000" strokeWidth="2" transform="rotate(-20 52 8)" />
      <rect x="28" y="2" width="6" height="6" rx="1" fill="#00E5FF" stroke="#000" strokeWidth="2" transform="rotate(30 31 5)" />
      <circle cx="54" cy="36" r="4" fill="#FF6B35" stroke="#000" strokeWidth="2" />
      <circle cx="10" cy="44" r="4" fill="#00C853" stroke="#000" strokeWidth="2" />
      <circle cx="32" cy="56" r="3" fill="#FF1493" stroke="#000" strokeWidth="2" />
      <line x1="20" y1="20" x2="20" y2="32" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
      <line x1="44" y1="50" x2="56" y2="50" stroke="#FF1493" strokeWidth="3" strokeLinecap="round" />
      <line x1="4" y1="28" x2="14" y2="38" stroke="#00E5FF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 32" fill="none" className={className} aria-hidden {...props}>
      <path
        d="M2 24 Q16 4 36 16"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M30 10 L38 18 L26 20"
        fill="currentColor"
        stroke="#000"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FlowerDoodle({ className, ...props }: DoodleProps) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden {...props}>
      <ellipse cx="24" cy="10" rx="6" ry="9" fill="currentColor" stroke="#000" strokeWidth="2.5" />
      <ellipse cx="24" cy="38" rx="6" ry="9" fill="currentColor" stroke="#000" strokeWidth="2.5" />
      <ellipse cx="10" cy="24" rx="9" ry="6" fill="currentColor" stroke="#000" strokeWidth="2.5" />
      <ellipse cx="38" cy="24" rx="9" ry="6" fill="currentColor" stroke="#000" strokeWidth="2.5" />
      <ellipse cx="13" cy="13" rx="6" ry="8" fill="currentColor" stroke="#000" strokeWidth="2.5" transform="rotate(45 13 13)" />
      <ellipse cx="35" cy="13" rx="6" ry="8" fill="currentColor" stroke="#000" strokeWidth="2.5" transform="rotate(-45 35 13)" />
      <ellipse cx="13" cy="35" rx="6" ry="8" fill="currentColor" stroke="#000" strokeWidth="2.5" transform="rotate(-45 13 35)" />
      <ellipse cx="35" cy="35" rx="6" ry="8" fill="currentColor" stroke="#000" strokeWidth="2.5" transform="rotate(45 35 35)" />
      <circle cx="24" cy="24" r="7" fill="#FFD700" stroke="#000" strokeWidth="2.5" />
    </svg>
  );
}
