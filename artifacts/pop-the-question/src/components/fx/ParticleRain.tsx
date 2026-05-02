import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/motion";

interface ParticleRainProps {
  emoji?: string;
  variant?: "fire" | "sparkle";
  density?: number;
  className?: string;
  active?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  life: number;
  ttl: number;
}

export function ParticleRain({
  emoji,
  variant = "fire",
  density = 1,
  className,
  active = true,
}: ParticleRainProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!active || reduced) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let particles: Particle[] = [];
    let running = true;
    let lastSpawn = performance.now();

    const symbol = emoji ?? (variant === "fire" ? "🔥" : "✨");
    const spawnIntervalMs = variant === "fire" ? 60 : 90;
    const spawnPerTick = Math.max(1, Math.round(density));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const spawn = () => {
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < spawnPerTick; i++) {
        const fromBottom = variant === "fire";
        const x = Math.random() * rect.width;
        const y = fromBottom ? rect.height + 10 : -10;
        const vy = fromBottom ? -(0.6 + Math.random() * 1.6) : (0.4 + Math.random() * 1.0);
        const vx = (Math.random() - 0.5) * 0.6;
        particles.push({
          x,
          y,
          vx,
          vy,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.06,
          size: 18 + Math.random() * 18,
          life: 0,
          ttl: 1400 + Math.random() * 1400,
        });
      }
    };

    const tick = (now: number) => {
      if (!running) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (now - lastSpawn > spawnIntervalMs) {
        spawn();
        lastSpawn = now;
      }

      ctx.font = "24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      particles = particles.filter((p) => {
        p.life += 16;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += variant === "fire" ? -0.005 : 0.012;
        p.rot += p.vr;
        const remaining = 1 - p.life / p.ttl;
        if (remaining <= 0) return false;
        if (p.y < -40 || p.y > rect.height + 40) return false;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, Math.min(1, remaining));
        ctx.font = `${p.size}px sans-serif`;
        ctx.fillText(symbol, 0, 0);
        ctx.restore();
        return true;
      });

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [active, reduced, emoji, variant, density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className ?? "pointer-events-none absolute inset-0 w-full h-full"}
    />
  );
}
