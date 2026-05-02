import { type CSSProperties, type HTMLAttributes } from "react";

/**
 * Editorial rainbow palette — used STRATEGICALLY only:
 *   - The "POP: THE QUESTION" logo (homepage hero)
 *   - Room codes
 *   - Top-3 leaderboard player names
 *   - "NEW RECORD" / streak milestones
 *
 * Static colors only (no animation), high contrast against the dark background.
 */
const DEFAULT_PALETTE = [
  "#FF0054", // brand red
  "#FF6B35", // brand orange
  "#FFD700", // brand yellow / gold
  "#00F5A0", // brand green
  "#FF006E", // brand pink
  "#FF1493", // brand magenta
];

export interface RainbowTextProps extends HTMLAttributes<HTMLSpanElement> {
  text: string;
  palette?: string[];
  /** Subtle glow under each letter; defaults to false for a cleaner editorial feel. */
  glow?: boolean;
  startIndex?: number;
}

export function RainbowText({
  text,
  palette = DEFAULT_PALETTE,
  glow = false,
  startIndex = 0,
  className = "",
  ...rest
}: RainbowTextProps) {
  let colorIdx = startIndex;
  return (
    <span {...rest} className={className} aria-label={text}>
      {Array.from(text).map((ch, i) => {
        if (ch === " ") {
          return (
            <span key={i} aria-hidden>
              {"\u00A0"}
            </span>
          );
        }
        const color = palette[colorIdx % palette.length];
        colorIdx += 1;
        const style: CSSProperties = {
          color,
          WebkitTextStroke: "3px #000",
          // @ts-expect-error: text-stroke is not yet in TS CSSProperties
          textStroke: "3px #000",
          paintOrder: "stroke fill",
        };
        return (
          <span key={i} style={style} aria-hidden>
            {ch}
          </span>
        );
      })}
    </span>
  );
}
