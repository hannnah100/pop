import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export type WofWheelValue = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

export const WHEEL_SEGMENTS: WofWheelValue[] = [
  300, "BANKRUPT", 600, "LOSE_A_TURN", 500, 300, 900,
  "FREE_PLAY", 700, 500, 1000, "BANKRUPT", 600, 800,
  "LOSE_A_TURN", 500, 1500, 300, 2000, "FREE_PLAY",
  800, 500, 2500, "BANKRUPT", 700, 1000, "LOSE_A_TURN",
  300, 1500, 500,
];

const TOTAL = WHEEL_SEGMENTS.length; // 30

function segmentColor(v: WofWheelValue): string {
  if (v === "BANKRUPT") return "#111111";
  if (v === "LOSE_A_TURN") return "#6B7280";
  if (v === "FREE_PLAY") return "#00C853";
  if (v >= 2000) return "#FF1493";
  if (v >= 1000) return "#FF6B35";
  if (v >= 700)  return "#7C3AED";
  return "#FFD700";
}

function segmentTextColor(v: WofWheelValue): string {
  if (v === "BANKRUPT") return "#ffffff";
  if (v === "LOSE_A_TURN") return "#ffffff";
  if (v === "FREE_PLAY") return "#ffffff";
  if (v >= 2000) return "#ffffff";
  if (v >= 1000) return "#ffffff";
  if (v >= 700)  return "#ffffff";
  return "#111111";
}

function segmentLabel(v: WofWheelValue): string {
  if (v === "BANKRUPT") return "BANKRUPT";
  if (v === "LOSE_A_TURN") return "LOSE";
  if (v === "FREE_PLAY") return "FREE";
  return `$${v}`;
}

function segmentLabelLine2(v: WofWheelValue): string {
  if (v === "LOSE_A_TURN") return "TURN";
  if (v === "FREE_PLAY") return "PLAY";
  return "";
}

interface WofWheelProps {
  spinning: boolean;
  spinIndex: number | null;
  value: WofWheelValue | null;
  spinnerName?: string;
  size?: number;
}

export function WofWheel({ spinning, spinIndex, value, spinnerName, size = 280 }: WofWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [displayAngle, setDisplayAngle] = useState(0);
  const targetAngleRef = useRef(0);
  const currentAngleRef = useRef(0);
  const isSpinningRef = useRef(false);

  const segAngle = 360 / TOTAL;

  // Draw wheel on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const r = size / 2;
    const cx = r;
    const cy = r;

    ctx.clearRect(0, 0, size, size);

    WHEEL_SEGMENTS.forEach((seg, i) => {
      const start = ((i * segAngle - 90) * Math.PI) / 180 + (displayAngle * Math.PI) / 180;
      const end = (((i + 1) * segAngle - 90) * Math.PI) / 180 + (displayAngle * Math.PI) / 180;

      // Slice
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r - 4, start, end);
      ctx.closePath();
      ctx.fillStyle = segmentColor(seg);
      ctx.fill();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      const midAngle = (start + end) / 2;
      const textR = r * 0.68;
      const tx = cx + textR * Math.cos(midAngle);
      const ty = cy + textR * Math.sin(midAngle);

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(midAngle + Math.PI / 2);
      ctx.fillStyle = segmentTextColor(seg);
      // Font scales with diameter: ~8.5px at size 280, ~14px at size 460
      const fontPx = Math.max(7, Math.round(size / 32));
      ctx.font = `bold ${fontPx}px 'Arial', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const l1 = segmentLabel(seg);
      const l2 = segmentLabelLine2(seg);
      const lineGap = Math.max(4, Math.round(size / 56));
      if (l2) {
        ctx.fillText(l1, 0, -lineGap);
        ctx.fillText(l2, 0, lineGap);
      } else {
        ctx.fillText(l1, 0, 0);
      }
      ctx.restore();
    });

    // Center hub
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.13, 0, 2 * Math.PI);
    ctx.fillStyle = "#111111";
    ctx.fill();
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.stroke();
  }, [displayAngle, size, segAngle]);

  // Animate spin
  useEffect(() => {
    if (!spinning) return;

    isSpinningRef.current = true;
    let startTime: number | null = null;
    const spinDuration = 2500;
    const extraSpins = 6 * 360;
    const fromAngle = currentAngleRef.current;

    const tick = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / spinDuration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const angle = fromAngle + extraSpins * eased;
      currentAngleRef.current = angle % 360;
      setDisplayAngle(angle % 360);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      } else {
        isSpinningRef.current = false;
      }
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [spinning]);

  // Snap to correct segment when result arrives
  useEffect(() => {
    if (spinning || spinIndex === null) return;
    if (isSpinningRef.current) return;

    // Target angle: segment `spinIndex` should be at the top (12 o'clock = pointer)
    // Segment i starts at i * segAngle degrees from top (before rotation offset)
    // We want segment center at top → angle such that -(spinIndex + 0.5) * segAngle lands at top
    const targetBase = -(spinIndex + 0.5) * segAngle;
    // Normalize to land after current angle
    let target = targetBase % 360;
    if (target < 0) target += 360;
    // Make sure we land at the nearest equivalent ≥ current
    while (target < currentAngleRef.current) target += 360;

    let startTime: number | null = null;
    const from = currentAngleRef.current;
    const delta = target - from;
    const dur = 800;

    const tick = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const angle = from + delta * eased;
      currentAngleRef.current = angle;
      setDisplayAngle(angle % 360);
      if (p < 1) animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [spinning, spinIndex, segAngle]);

  return (
    <div className="relative flex flex-col items-center gap-2">
      {spinnerName && (
        <p className="font-display font-black text-black/60 uppercase tracking-widest text-xs">
          {spinnerName}
        </p>
      )}
      <div className="relative" style={{ width: size, height: size }}>
        {/* Pointer triangle at top — scales with wheel */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10"
          style={{
            width: 0,
            height: 0,
            borderLeft: `${Math.round(size * 0.04)}px solid transparent`,
            borderRight: `${Math.round(size * 0.04)}px solid transparent`,
            borderTop: `${Math.round(size * 0.075)}px solid #FF1493`,
            filter: "drop-shadow(2px 2px 0 #000)",
          }}
        />
        {/* Drop shadow ring */}
        <div
          className="absolute inset-0 rounded-full border-[5px] border-black shadow-[6px_6px_0_#000]"
          style={{ width: size, height: size }}
        />
        <canvas ref={canvasRef} width={size} height={size} className="rounded-full" />
      </div>

      {/* Result banner — large, color-matched to landed slice */}
      <AnimatePresence mode="wait">
        {!spinning && value !== null && (
          <motion.div
            key={String(value)}
            initial={{ scale: 0.4, opacity: 0, y: -16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            className={`mt-4 px-10 py-5 border-[5px] border-black font-display font-black uppercase tracking-wider text-5xl sm:text-6xl shadow-[8px_8px_0_#000] leading-none
              ${value === "BANKRUPT" ? "bg-black text-white" :
                value === "LOSE_A_TURN" ? "bg-[#6B7280] text-white" :
                value === "FREE_PLAY" ? "bg-[#00C853] text-white" :
                (value as number) >= 2000 ? "bg-[#FF1493] text-white" :
                (value as number) >= 1000 ? "bg-[#FF6B35] text-white" :
                (value as number) >= 700 ? "bg-[#7C3AED] text-white" :
                "bg-[#FFD700] text-black"
              }`}
            data-testid="wof-result-banner"
          >
            {value === "BANKRUPT" ? "BANKRUPT!" :
             value === "LOSE_A_TURN" ? "LOSE A TURN" :
             value === "FREE_PLAY" ? "FREE PLAY!" :
             `$${(value as number).toLocaleString()}`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
