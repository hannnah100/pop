import { motion, AnimatePresence } from "framer-motion";

export type WofWheelValue = number | "BANKRUPT" | "LOSE_A_TURN" | "FREE_PLAY";

interface WofWheelResultProps {
  value: WofWheelValue | null;
  spinning?: boolean;
  spinnerName?: string;
}

function valueLabel(v: WofWheelValue): string {
  if (v === "BANKRUPT") return "BANKRUPT!";
  if (v === "LOSE_A_TURN") return "LOSE A TURN";
  if (v === "FREE_PLAY") return "FREE PLAY";
  return `$${v.toLocaleString()}`;
}

function valueColors(v: WofWheelValue): { bg: string; text: string; shadow: string } {
  if (v === "BANKRUPT") return { bg: "bg-black", text: "text-white", shadow: "shadow-[6px_6px_0_#FF1493]" };
  if (v === "LOSE_A_TURN") return { bg: "bg-[#6B7280]", text: "text-white", shadow: "shadow-[6px_6px_0_#000]" };
  if (v === "FREE_PLAY") return { bg: "bg-[#00C853]", text: "text-white", shadow: "shadow-[6px_6px_0_#000]" };
  if (v >= 2000) return { bg: "bg-[#FF1493]", text: "text-white", shadow: "shadow-[6px_6px_0_#000]" };
  if (v >= 1000) return { bg: "bg-[#FF6B35]", text: "text-white", shadow: "shadow-[6px_6px_0_#000]" };
  return { bg: "bg-[#FFD700]", text: "text-black", shadow: "shadow-[6px_6px_0_#000]" };
}

export function WofWheelResult({ value, spinning = false, spinnerName }: WofWheelResultProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {spinnerName && (
        <p className="font-display font-black text-black/60 uppercase tracking-widest text-sm">
          {spinnerName} spun the wheel
        </p>
      )}
      <AnimatePresence mode="wait">
        {spinning ? (
          <motion.div
            key="spinning"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-center w-36 h-36 border-[4px] border-black bg-[#FFF8E7] shadow-[6px_6px_0_#000]"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-[4px] border-black border-t-[#FFD700]"
            />
          </motion.div>
        ) : value !== null ? (
          <motion.div
            key={String(value)}
            initial={{ opacity: 0, scale: 0.5, rotate: -15 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 18 }}
            className={`flex items-center justify-center px-8 py-5 border-[4px] border-black font-display font-black uppercase tracking-widest text-2xl md:text-3xl ${valueColors(value).bg} ${valueColors(value).text} ${valueColors(value).shadow}`}
          >
            {valueLabel(value)}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
