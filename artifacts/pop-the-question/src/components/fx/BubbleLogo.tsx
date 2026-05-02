import { type CSSProperties } from "react";

const LETTERS = "THE QUESTION".split("");

const containerStyle: CSSProperties = {
  position: "relative",
  display: "inline-block",
  letterSpacing: "0.05em",
  fontSize: "1.1em",
};

const letterStyle: CSSProperties = {
  display: "inline-block",
  color: "#FFD700",
  WebkitTextFillColor: "#FFD700",
  WebkitTextStroke: "3px #000000",
  // @ts-expect-error: text-stroke is not yet in TS CSSProperties
  textStroke: "3px #000000",
  paintOrder: "stroke fill",
  textShadow: [
    "1px 1px 0 #b8860b",
    "2px 2px 0 #b8860b",
    "3px 4px 8px rgba(150,100,0,0.35)",
  ].join(", "),
};

const spaceStyle: CSSProperties = {
  display: "inline-block",
  width: "0.3em",
};

const shineStyle: CSSProperties = {
  position: "absolute",
  top: "6%",
  left: "4%",
  width: "42%",
  height: "38%",
  borderRadius: "50%",
  background:
    "radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.82) 0%, transparent 70%)",
  mixBlendMode: "overlay",
  pointerEvents: "none",
};

const STAGGER_MS = 55;

export function BubbleLogo() {
  let visibleIndex = 0;
  return (
    <span style={containerStyle} aria-label="THE QUESTION">
      {LETTERS.map((ch, i) => {
        if (ch === " ") {
          return <span key={i} style={spaceStyle} aria-hidden />;
        }
        const delay = visibleIndex * STAGGER_MS;
        visibleIndex += 1;
        return (
          <span
            key={i}
            className="bubble-logo-letter"
            style={{ ...letterStyle, animationDelay: `${delay}ms` }}
            aria-hidden
          >
            {ch}
          </span>
        );
      })}
      <span className="bubble-logo-shine" style={shineStyle} aria-hidden />
    </span>
  );
}
