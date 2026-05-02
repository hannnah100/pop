export function AnimatedBackground() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
    >
      <div className="absolute inset-0 grid-overlay opacity-25" />
      {/* Subtle ambient color washes — slow, low opacity, no kiddie blobs. */}
      <div className="absolute -top-[25%] -left-[15%] w-[55vw] h-[55vw] rounded-full blur-[140px] bg-[hsl(343_100%_50%/0.10)] animate-blob-a" />
      <div className="absolute -bottom-[25%] -right-[10%] w-[55vw] h-[55vw] rounded-full blur-[140px] bg-[hsl(15_100%_60%/0.09)]  animate-blob-b" />
      <div className="absolute top-[35%] right-[25%] w-[35vw] h-[35vw] rounded-full blur-[120px] bg-[hsl(51_100%_50%/0.06)]  animate-blob-c" />
      <div className="absolute inset-0 grain-overlay opacity-[0.05] mix-blend-overlay" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/40 to-background/85" />
    </div>
  );
}
