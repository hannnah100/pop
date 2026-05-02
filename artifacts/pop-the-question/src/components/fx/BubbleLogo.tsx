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
  color: "#00c853",
  WebkitTextFillColor: "#00c853",
  WebkitTextStroke: "3px #ffffff",
  // @ts-expect-error: text-stroke is not yet in TS CSSProperties
  textStroke: "3px #ffffff",
  paintOrder: "stroke fill",
  textShadow: [
    "1px 1px 0 #007a30",
    "2px 2px 0 #007a30",
    "3px 4px 8px rgba(0,100,40,0.35)",
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

export function BubbleLogo() {
  return (
    <span style={containerStyle} aria-label="THE QUESTION">
      {LETTERS.map((ch, i) =>
        ch === " " ? (
          <span key={i} style={spaceStyle} aria-hidden />
        ) : (
          <span key={i} style={letterStyle} aria-hidden>
            {ch}
          </span>
        )
      )}
      <span style={shineStyle} aria-hidden />
    </span>
  );
}
