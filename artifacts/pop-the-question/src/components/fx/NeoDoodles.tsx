import React from "react";

/**
 * Neo-brutalism doodle background. Drop inside a `relative` container
 * with a cream background to scatter playful black/colored shapes behind
 * the content. Pointer-events-none so it never blocks interaction.
 */

type Shape =
  | "star"
  | "bolt"
  | "circle"
  | "ring"
  | "square"
  | "diamond"
  | "triangle"
  | "squiggle"
  | "sparkle"
  | "plus"
  | "cross"
  | "dot"
  | "halfcircle";

interface DoodleSpec {
  shape: Shape;
  top: string;
  left: string;
  size: number;
  rotate: number;
  color: string;
  stroke?: number;
  fill?: boolean;
}

// Deterministic scatter — fixed positions so no reflow on render and
// it visually looks tuned, not random-noisy. Mix of black + pop colors.
// Game-card palette — orange (Roast), lime (Bar Trivia), sky (Pop Quiz), purple (Wheel of Fandom).
// Excludes yellow + pink which are reserved for other game cards.
const PALETTE = {
  orange: "#FF6B35",
  lime: "#00FF7F",
  sky: "#38BDF8",
  purple: "#9370DB",
};

const DOODLES: DoodleSpec[] = [
  // top edge
  { shape: "star", top: "3%", left: "4%", size: 28, rotate: -12, color: PALETTE.orange, fill: true },
  { shape: "bolt", top: "5%", left: "14%", size: 34, rotate: 8, color: PALETTE.purple, stroke: 3 },
  { shape: "ring", top: "2%", left: "23%", size: 22, rotate: 0, color: PALETTE.sky, stroke: 3 },
  { shape: "plus", top: "6%", left: "32%", size: 20, rotate: 15, color: PALETTE.lime, stroke: 3 },
  { shape: "squiggle", top: "4%", left: "44%", size: 48, rotate: -6, color: PALETTE.purple, stroke: 3 },
  { shape: "sparkle", top: "3%", left: "58%", size: 26, rotate: 0, color: PALETTE.orange, fill: true },
  { shape: "triangle", top: "7%", left: "68%", size: 24, rotate: 22, color: PALETTE.sky, stroke: 3 },
  { shape: "dot", top: "5%", left: "76%", size: 10, rotate: 0, color: PALETTE.lime, fill: true },
  { shape: "diamond", top: "4%", left: "84%", size: 22, rotate: 0, color: PALETTE.purple, stroke: 3 },
  { shape: "cross", top: "6%", left: "93%", size: 18, rotate: 18, color: PALETTE.orange, stroke: 3 },

  // upper-mid
  { shape: "circle", top: "15%", left: "2%", size: 18, rotate: 0, color: PALETTE.sky, fill: true },
  { shape: "star", top: "18%", left: "9%", size: 20, rotate: 25, color: PALETTE.lime, fill: true },
  { shape: "halfcircle", top: "14%", left: "88%", size: 28, rotate: 30, color: PALETTE.purple, fill: true },
  { shape: "squiggle", top: "20%", left: "94%", size: 38, rotate: 70, color: PALETTE.orange, stroke: 3 },
  { shape: "bolt", top: "22%", left: "78%", size: 26, rotate: -10, color: PALETTE.sky, fill: true },
  { shape: "plus", top: "16%", left: "50%", size: 16, rotate: 0, color: PALETTE.lime, stroke: 3 },

  // mid edges (avoid central content)
  { shape: "ring", top: "32%", left: "3%", size: 30, rotate: 0, color: PALETTE.purple, stroke: 3 },
  { shape: "sparkle", top: "38%", left: "7%", size: 22, rotate: 0, color: PALETTE.lime, fill: true },
  { shape: "dot", top: "44%", left: "2%", size: 12, rotate: 0, color: PALETTE.orange, fill: true },
  { shape: "triangle", top: "50%", left: "5%", size: 26, rotate: -15, color: PALETTE.sky, fill: true },
  { shape: "cross", top: "58%", left: "3%", size: 18, rotate: 12, color: PALETTE.purple, stroke: 3 },
  { shape: "square", top: "65%", left: "6%", size: 18, rotate: 25, color: PALETTE.lime, stroke: 3 },

  { shape: "diamond", top: "30%", left: "95%", size: 20, rotate: 0, color: PALETTE.orange, fill: true },
  { shape: "bolt", top: "40%", left: "92%", size: 30, rotate: 14, color: PALETTE.lime, stroke: 3 },
  { shape: "star", top: "48%", left: "96%", size: 22, rotate: -10, color: PALETTE.purple, fill: true },
  { shape: "ring", top: "55%", left: "92%", size: 24, rotate: 0, color: PALETTE.sky, stroke: 3 },
  { shape: "squiggle", top: "62%", left: "94%", size: 42, rotate: 55, color: PALETTE.orange, stroke: 3 },
  { shape: "plus", top: "70%", left: "96%", size: 16, rotate: 0, color: PALETTE.purple, stroke: 3 },

  // lower-mid
  { shape: "sparkle", top: "75%", left: "8%", size: 24, rotate: 0, color: PALETTE.sky, fill: true },
  { shape: "dot", top: "78%", left: "14%", size: 8, rotate: 0, color: PALETTE.purple, fill: true },
  { shape: "halfcircle", top: "82%", left: "4%", size: 32, rotate: -45, color: PALETTE.orange, fill: true },
  { shape: "triangle", top: "78%", left: "92%", size: 28, rotate: 55, color: PALETTE.lime, fill: true },
  { shape: "star", top: "85%", left: "88%", size: 20, rotate: 14, color: PALETTE.sky, fill: true },

  // bottom edge
  { shape: "bolt", top: "92%", left: "6%", size: 32, rotate: -8, color: PALETTE.purple, fill: true },
  { shape: "circle", top: "94%", left: "16%", size: 14, rotate: 0, color: PALETTE.sky, fill: true },
  { shape: "ring", top: "93%", left: "26%", size: 22, rotate: 0, color: PALETTE.orange, stroke: 3 },
  { shape: "squiggle", top: "94%", left: "36%", size: 44, rotate: -4, color: PALETTE.lime, stroke: 3 },
  { shape: "plus", top: "92%", left: "50%", size: 18, rotate: 0, color: PALETTE.purple, stroke: 3 },
  { shape: "sparkle", top: "94%", left: "60%", size: 22, rotate: 0, color: PALETTE.orange, fill: true },
  { shape: "diamond", top: "93%", left: "70%", size: 20, rotate: 0, color: PALETTE.sky, fill: true },
  { shape: "cross", top: "94%", left: "80%", size: 18, rotate: 22, color: PALETTE.lime, stroke: 3 },
  { shape: "star", top: "92%", left: "90%", size: 26, rotate: -16, color: PALETTE.orange, fill: true },
];

function ShapeSvg({ shape, color, stroke, fill, size }: Pick<DoodleSpec, "shape" | "color" | "stroke" | "fill" | "size">) {
  const sw = stroke ?? 3;
  const f = fill ? color : "none";
  const s = fill ? "none" : color;
  const common = { width: size, height: size, viewBox: "0 0 40 40" };
  switch (shape) {
    case "star":
      return (
        <svg {...common}>
          <path d="M20 3 L24 16 L37 16 L26 24 L30 37 L20 29 L10 37 L14 24 L3 16 L16 16 Z"
                fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M22 2 L8 23 L18 23 L14 38 L32 15 L22 15 Z"
                fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "circle":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="14" fill={f} stroke={s} strokeWidth={sw} />
        </svg>
      );
    case "ring":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="14" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="6" y="6" width="28" height="28" fill={f} stroke={s} strokeWidth={sw} />
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <rect x="10" y="10" width="20" height="20" transform="rotate(45 20 20)"
                fill={f} stroke={s} strokeWidth={sw} />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M20 5 L36 33 L4 33 Z"
                fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "squiggle":
      return (
        <svg {...common} viewBox="0 0 60 20">
          <path d="M2 10 Q 10 0, 18 10 T 34 10 T 50 10 T 58 10"
                fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path d="M20 4 L23 17 L36 20 L23 23 L20 36 L17 23 L4 20 L17 17 Z"
                fill={f} stroke={s} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M20 6 V34 M6 20 H34" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "cross":
      return (
        <svg {...common}>
          <path d="M8 8 L32 32 M32 8 L8 32" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "dot":
      return (
        <svg {...common}>
          <circle cx="20" cy="20" r="8" fill={f} stroke={s} strokeWidth={sw} />
        </svg>
      );
    case "halfcircle":
      return (
        <svg {...common}>
          <path d="M5 25 A 15 15 0 0 1 35 25 Z" fill={f} stroke={s} strokeWidth={sw} />
        </svg>
      );
  }
}

interface NeoDoodlesProps {
  /** Optional opacity for the whole doodle layer (default 1). */
  opacity?: number;
  /** Override the default scatter (advanced). */
  doodles?: DoodleSpec[];
  className?: string;
}

export function NeoDoodles({ opacity = 1, doodles = DOODLES, className = "" }: NeoDoodlesProps) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ opacity, zIndex: 0 }}
    >
      {doodles.map((d, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: d.top,
            left: d.left,
            transform: `translate(-50%, -50%) rotate(${d.rotate}deg)`,
          }}
        >
          <ShapeSvg shape={d.shape} color={d.color} stroke={d.stroke} fill={d.fill} size={d.size} />
        </div>
      ))}
    </div>
  );
}

export default NeoDoodles;
