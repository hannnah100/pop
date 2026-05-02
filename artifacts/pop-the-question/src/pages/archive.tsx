import { useState } from "react";
import { Link } from "wouter";
import {
  useGetThreeStrikesArchive,
  useGetCrosswordArchive,
  useGetPopBoxArchive,
  useGetPopOrDropArchive,
} from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { PlayCircle, Calendar, CheckCircle2, Trophy, Sparkles, Star, Eye, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackArrow } from "@/components/ui/BackArrow";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShimmerGrid } from "@/components/fx";
import { staggerContainer, staggerItem } from "@/lib/motion";

type Filter = "all" | "three-strikes" | "crossword" | "pop-box" | "pop-or-drop";

function getArchiveStats(id: string, type: "three-strikes" | "crossword" | "pop-box") {
  try {
    const key =
      type === "three-strikes"
        ? `ptq-archive-ts-${id}`
        : type === "crossword"
          ? `ptq-archive-cw-${id}`
          : `ptq-archive-pb-${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { completed: boolean; score: number; total?: number; strikes?: number };
  } catch {
    return null;
  }
}

function getPodStats(date: string) {
  try {
    const raw = localStorage.getItem(`ptq-pop-or-drop-${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { done: boolean; streak: number; date: string };
    if (!parsed.done) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function Archive() {
  const { data: tsArchive, isLoading: tsLoading } = useGetThreeStrikesArchive();
  const { data: cwArchive, isLoading: cwLoading } = useGetCrosswordArchive();
  const { data: pbArchive, isLoading: pbLoading } = useGetPopBoxArchive();
  const { data: podArchive, isLoading: podLoading } = useGetPopOrDropArchive();
  const [filter, setFilter] = useState<Filter>("all");

  const isLoading = tsLoading || cwLoading || pbLoading || podLoading;

  const tsItems = (tsArchive ?? []).map((item) => ({
    ...item,
    type: "three-strikes" as const,
    stats: getArchiveStats(item.id, "three-strikes"),
  }));

  const cwItems = (cwArchive ?? []).map((item) => ({
    ...item,
    type: "crossword" as const,
    title: "Mini Crossword",
    prompt: "Pop culture crossword puzzle",
    totalCount: undefined as number | undefined,
    stats: getArchiveStats(item.id, "crossword"),
  }));

  const pbItems = (pbArchive ?? []).map((item) => ({
    ...item,
    type: "pop-box" as const,
    title: `Pop Box · ${item.difficulty}`,
    prompt: "9-cell celebrity-grid game. One pick per cell.",
    totalCount: 9,
    stats: getArchiveStats(item.id, "pop-box"),
  }));

  const podItems = (podArchive ?? []).map((item) => ({
    ...item,
    type: "pop-or-drop" as const,
    podStats: getPodStats(item.date),
  }));

  const allItems = [...tsItems, ...cwItems, ...pbItems, ...podItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const displayed =
    filter === "all" ? allItems :
    filter === "three-strikes" ? tsItems :
    filter === "crossword" ? cwItems :
    filter === "pop-or-drop" ? podItems :
    pbItems;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
      <BackArrow className="mb-8" />

      <div className="relative mb-10 mt-2 flex justify-center md:justify-start">
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
          animate={{ opacity: 1, scale: 1, rotate: -2.5 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.05 }}
          className="relative inline-block"
        >
          <div
            className="relative thick-border bold-shadow-lg bg-accent text-accent-foreground px-5 py-4 sm:px-7 sm:py-5 rounded-[28px_8px_28px_8px] flex items-center gap-3 sm:gap-4 max-w-[19rem] sm:max-w-xl"
          >
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0" strokeWidth={2.5} />
            <div className="min-w-0">
              <p className="font-display uppercase tracking-tight leading-none text-xl sm:text-2xl">
                Archive is{" "}
                <span className="comic-headline inline-block -rotate-3 text-2xl sm:text-3xl align-baseline">FREE</span>{" "}
                during beta!
              </p>
              <p className="mt-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wide leading-snug">
                Play any past challenge • Premium feature coming soon
              </p>
            </div>
          </div>

          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-4 left-[18%] w-3 h-5 bg-[hsl(var(--gold))] border-2 border-black rotate-[12deg]"
            style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-4 right-[28%] w-3 h-5 bg-[hsl(var(--gold))] border-2 border-black rotate-[200deg]"
            style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
          />
          <span
            aria-hidden="true"
            className="hidden sm:block pointer-events-none absolute top-1/2 -translate-y-1/2 -right-5 w-5 h-3 bg-[hsl(var(--gold))] border-2 border-black"
            style={{ clipPath: "polygon(0 0, 100% 50%, 0 100%)" }}
          />

          <Star
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 -left-4 w-7 h-7 text-[hsl(var(--pink))] rotate-12"
            fill="currentColor"
            stroke="#000"
            strokeWidth={1.75}
          />
          <Star
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-4 -right-3 w-8 h-8 text-[hsl(var(--secondary))] -rotate-12"
            fill="currentColor"
            stroke="#000"
            strokeWidth={1.75}
          />
          <Sparkles
            aria-hidden="true"
            className="pointer-events-none absolute -top-6 right-6 sm:right-10 w-5 h-5"
            strokeWidth={2.5}
            style={{ color: "var(--y2k-cyan)" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 -left-7 w-3 h-3 rounded-full bg-[hsl(var(--gold))] border-2 border-black"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-6 left-10 w-2.5 h-2.5 rounded-full bg-[hsl(var(--pink))] border-2 border-black"
          />
        </motion.div>
      </div>

      <motion.header
        className="mb-8"
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-foreground">PUZZLE ARCHIVE</h1>
          <div className="heading-divider heading-divider--green w-16 h-1 mt-2" />
        </motion.div>
        <motion.p variants={staggerItem} className="text-xl text-muted-foreground mt-2">Missed a day? Catch up here.</motion.p>
      </motion.header>

      <div className="flex gap-2 mb-8 flex-wrap">
        {(["all", "three-strikes", "crossword", "pop-box", "pop-or-drop"] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className={filter === f ? "bg-primary text-primary-foreground" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "all"
              ? "All"
              : f === "three-strikes"
                ? "Three Strikes"
                : f === "crossword"
                  ? "Mini Crossword"
                  : f === "pop-box"
                    ? "Pop Box"
                    : "Pop or Drop"}
          </Button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground self-center">
          {displayed.length} challenge{displayed.length !== 1 ? "s" : ""}
        </span>
      </div>

      {isLoading ? (
        <ShimmerGrid count={6} cols="md:grid-cols-2 lg:grid-cols-3" itemClassName="h-48" />
      ) : displayed.length === 0 ? (
        <div className="text-center py-24 text-muted-foreground">No challenges yet.</div>
      ) : (
        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer(0.05)}
          initial="hidden"
          animate="show"
        >
          {displayed.map((item) => {
            const isTS = item.type === "three-strikes";
            const isPB = item.type === "pop-box";
            const isPOD = item.type === "pop-or-drop";
            const stats = "stats" in item ? item.stats : undefined;
            const podStats = "podStats" in item ? item.podStats : undefined;
            const played = isPOD ? !!podStats : !!stats?.completed;

            const playHref =
              item.type === "three-strikes"
                ? `/daily/three-strikes?id=${item.id}`
                : item.type === "pop-box"
                  ? `/daily/pop-box?id=${item.id}`
                  : item.type === "pop-or-drop"
                    ? `/daily/pop-or-drop/archive/${item.id}`
                    : `/daily/crossword`;

            const accentClasses = isTS
              ? {
                  cardHover:
                    "hover:border-primary/60 hover:shadow-[0_16px_50px_-20px_hsl(var(--primary)/0.6)]",
                  badge: "border-primary/30 text-primary",
                  heading: "group-hover:text-primary",
                  button:
                    "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground group-hover:bg-primary group-hover:text-primary-foreground",
                }
              : isPB
                ? {
                    cardHover:
                      "hover:border-accent/60 hover:shadow-[0_16px_50px_-20px_hsl(var(--accent)/0.6)]",
                    badge: "border-accent/30 text-accent",
                    heading: "group-hover:text-accent",
                    button:
                      "bg-accent/10 text-accent hover:bg-accent hover:text-accent-foreground group-hover:bg-accent group-hover:text-accent-foreground",
                  }
                : isPOD
                  ? {
                      cardHover:
                        "hover:border-[#FF1493]/60 hover:shadow-[0_16px_50px_-20px_rgba(255,20,147,0.5)]",
                      badge: "border-[#FF1493]/40 text-[#FF1493]",
                      heading: "group-hover:text-[#FF1493]",
                      button:
                        "bg-[#FF1493]/10 text-[#FF1493] hover:bg-[#FF1493] hover:text-white group-hover:bg-[#FF1493] group-hover:text-white",
                    }
                  : {
                      cardHover:
                        "hover:border-secondary/60 hover:shadow-[0_16px_50px_-20px_hsl(var(--secondary)/0.6)]",
                      badge: "border-secondary/30 text-secondary",
                      heading: "group-hover:text-secondary",
                      button:
                        "bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground group-hover:bg-secondary group-hover:text-secondary-foreground",
                    };

            const badgeLabel = isTS
              ? "Three Strikes"
              : isPB
                ? "Pop Box"
                : isPOD
                  ? "Pop or Drop"
                  : "Crossword";

            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                variants={staggerItem}
              >
                <Card
                  className={`p-6 flex flex-col h-full group transition-all duration-300 bg-card/60 hover:bg-card border-border ${accentClasses.cardHover}
                    ${played ? "border-success/30" : ""}
                  `}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                      <Calendar className="w-3 h-3" />
                      {item.date}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${accentClasses.badge}`}
                      >
                        {badgeLabel}
                      </Badge>
                      {played && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                    </div>
                  </div>

                  <h3 className={`text-lg font-bold mb-1 transition-colors ${accentClasses.heading}`}>
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">
                    {"prompt" in item ? item.prompt : ""}
                  </p>

                  {stats?.completed && (isTS || isPB) && (
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-muted-foreground">
                        Best: <span className="text-foreground font-bold">{stats.score}</span>
                        {isPB
                          ? "/9"
                          : "totalCount" in item && item.totalCount
                            ? `/${item.totalCount}`
                            : ""}
                        {isTS && (
                          <>
                            {" "}• {stats.strikes ?? 0} strike{(stats.strikes ?? 0) !== 1 ? "s" : ""}
                          </>
                        )}
                      </span>
                    </div>
                  )}

                  {isPOD && podStats && (
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <Flame className="w-4 h-4 text-[#FF1493]" />
                      <span className="text-muted-foreground">
                        Best: <span className="text-foreground font-bold">{podStats.streak}/20</span>
                        {podStats.streak === 20 && (
                          <span className="ml-1.5 text-yellow-400 font-bold">Perfect!</span>
                        )}
                      </span>
                    </div>
                  )}

                  <Link href={playHref}>
                    <Button
                      className={`w-full transition-colors ${accentClasses.button}`}
                      data-testid={`btn-play-${item.type}-${item.id}`}
                    >
                      {isPOD ? (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          View Results
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-4 h-4 mr-2" />
                          {stats?.completed ? "Play Again" : "Play"}
                        </>
                      )}
                    </Button>
                  </Link>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
