import { useParams } from "wouter";
import { useGetPopOrDropById } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import {
  Calendar,
  Flame,
  Trophy,
  ChevronUp,
  ChevronDown,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BackArrow } from "@/components/ui/BackArrow";
import { Link } from "wouter";
import { staggerContainer, staggerItem } from "@/lib/motion";

interface Item {
  id: string;
  name: string;
  value: number;
  unit: string;
  metricLabel: string;
  category: string;
}

interface SavedState {
  done: boolean;
  streak: number;
  date: string;
}

const CARD_COLORS = [
  "#FF6B35", "#00E5FF", "#FF1493", "#FFD700", "#00C853",
  "#7C4DFF", "#FF6EC7", "#00BCD4", "#FF5722", "#76FF03",
  "#FF9800", "#E91E63", "#03A9F4", "#CDDC39", "#9C27B0",
  "#FF3D00", "#1DE9B6", "#FF4081", "#C6FF00", "#40C4FF",
  "#FF6B35",
];

function cardColor(index: number): string {
  return CARD_COLORS[index % CARD_COLORS.length];
}

function formatValue(value: number, _unit: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}T`;
  return `${sign}${abs.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

interface ResultItemCardProps {
  item: Item;
  colorIndex: number;
  highlight?: "correct" | "wrong";
}

function ResultItemCard({ item, colorIndex, highlight }: ResultItemCardProps) {
  const bg = highlight === "correct" ? "#00C853" : highlight === "wrong" ? "#FF1744" : cardColor(colorIndex);
  const displayValue = `${formatValue(item.value, item.unit)}${item.unit ? " " + item.unit : ""}`;

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-2 min-w-0 w-full shadow-lg"
      style={{ background: bg }}
    >
      <span className="text-white/70 text-xs font-bold uppercase tracking-widest">
        {item.category}
      </span>
      <span className="text-white font-black text-lg leading-tight">{item.name}</span>
      <div className="flex flex-col mt-1">
        <span className="text-white/80 text-xs">{item.metricLabel}</span>
        <span className="text-white font-black text-2xl">{displayValue}</span>
      </div>
    </div>
  );
}

function getSavedState(date: string): SavedState | null {
  try {
    const raw = localStorage.getItem(`ptq-pop-or-drop-${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedState;
    return parsed.done ? parsed : null;
  } catch {
    return null;
  }
}

export default function PopOrDropArchive() {
  const { id } = useParams<{ id: string }>();
  const { data: sequence, isLoading } = useGetPopOrDropById(id ?? "");
  const saved = id ? getSavedState(id) : null;

  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(id)) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <BackArrow className="mb-8" />
        <p className="text-muted-foreground">Invalid date.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
        <BackArrow className="mb-8" />
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 rounded-full border-2 border-[#FF1493] border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  const items = sequence?.items as Item[] | undefined;
  const streak = saved?.streak ?? 0;
  const isPerfect = streak === 20;
  const hasSaved = !!saved;

  const missedLeft = items && !isPerfect && hasSaved ? items[streak] : undefined;
  const missedRight = items && !isPerfect && hasSaved ? items[streak + 1] : undefined;
  const correctAnswer =
    missedLeft && missedRight
      ? missedRight.value > missedLeft.value
        ? "Higher"
        : "Lower"
      : undefined;

  return (
    <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-12">
      <BackArrow className="mb-8" />

      <motion.div
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="show"
        className="flex flex-col gap-8"
      >
        <motion.header variants={staggerItem} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Calendar className="w-4 h-4" />
            {formatDate(id)}
          </div>
          <h1 className="text-3xl font-black tracking-tight" style={{ color: "#FF1493" }}>
            Pop or Drop
          </h1>
          <p className="text-muted-foreground">Past results — read-only</p>
        </motion.header>

        {!hasSaved ? (
          <motion.div
            variants={staggerItem}
            className="rounded-2xl border border-border bg-card/60 p-10 flex flex-col items-center gap-4 text-center"
          >
            <Archive className="w-10 h-10 text-muted-foreground" />
            <p className="text-lg font-bold">No results saved</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              You didn't play Pop or Drop on this date, or results weren't saved on this device.
            </p>
            <Link href="/archive">
              <Button variant="outline" size="sm">
                Back to Archive
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <motion.div
              variants={staggerItem}
              className="rounded-2xl border border-[#FF1493]/30 bg-card/60 p-6 flex flex-col gap-4"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                Your Result
              </h2>

              <div className="flex items-center gap-4">
                <div
                  className="flex items-center justify-center w-20 h-20 rounded-2xl font-black text-3xl text-white shadow-lg"
                  style={{ background: isPerfect ? "#FFD700" : "#FF1493" }}
                >
                  {streak}
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-[#FF1493]" />
                    <span className="text-2xl font-black">
                      {streak}
                      <span className="text-muted-foreground font-normal text-base">/20</span>
                    </span>
                  </div>
                  {isPerfect ? (
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold text-sm">Perfect game!</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      Went wrong on round {streak + 1}
                    </span>
                  )}
                </div>
              </div>

              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(streak / 20) * 100}%`,
                    background: isPerfect
                      ? "linear-gradient(90deg, #FFD700, #FF9800)"
                      : "linear-gradient(90deg, #FF1493, #7C4DFF)",
                  }}
                />
              </div>
            </motion.div>

            {!isPerfect && missedLeft && missedRight && correctAnswer && (
              <motion.div variants={staggerItem} className="flex flex-col gap-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  Where you went wrong — Round {streak + 1}
                </h2>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground font-medium text-center">Anchor</span>
                    <ResultItemCard item={missedLeft} colorIndex={streak} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs text-muted-foreground font-medium text-center">Answer</span>
                    <ResultItemCard item={missedRight} colorIndex={streak + 1} highlight="wrong" />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card/60 p-4 flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-muted-foreground">Correct answer was</span>
                    <span className="font-bold text-lg">{correctAnswer}</span>
                    <span className="text-xs text-muted-foreground">
                      {missedRight.name} had{" "}
                      <span className="text-foreground font-semibold">
                        {formatValue(missedRight.value, missedRight.unit)}{missedRight.unit ? ` ${missedRight.unit}` : ""}
                      </span>{" "}
                      vs. {missedLeft.name}'s{" "}
                      <span className="text-foreground font-semibold">
                        {formatValue(missedLeft.value, missedLeft.unit)}{missedLeft.unit ? ` ${missedLeft.unit}` : ""}
                      </span>
                    </span>
                  </div>
                  <div
                    className="flex items-center justify-center w-12 h-12 rounded-xl text-white shadow"
                    style={{ background: correctAnswer === "Higher" ? "#00C853" : "#FF1744" }}
                  >
                    {correctAnswer === "Higher" ? (
                      <ChevronUp className="w-6 h-6 font-black" strokeWidth={3} />
                    ) : (
                      <ChevronDown className="w-6 h-6 font-black" strokeWidth={3} />
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {isPerfect && (
              <motion.div
                variants={staggerItem}
                className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
                style={{ background: "linear-gradient(135deg, #FFD700 0%, #FF9800 100%)" }}
              >
                <Trophy className="w-10 h-10 text-white" />
                <p className="text-white font-black text-xl">Flawless! You nailed all 20 rounds.</p>
                <Badge className="bg-white/20 text-white border-white/30 text-sm">
                  Perfect Game
                </Badge>
              </motion.div>
            )}

            <motion.div variants={staggerItem} className="flex gap-3">
              <Link href="/archive" className="flex-1">
                <Button variant="outline" className="w-full">
                  Back to Archive
                </Button>
              </Link>
              <Link href="/daily/pop-or-drop" className="flex-1">
                <Button
                  className="w-full text-white"
                  style={{ background: "#FF1493" }}
                >
                  Play Today's
                </Button>
              </Link>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
