import { useState } from "react";
import { Link } from "wouter";
import { useGetThreeStrikesArchive, useGetCrosswordArchive } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { ArrowLeft, PlayCircle, Calendar, CheckCircle2, Trophy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShimmerGrid } from "@/components/fx";
import { staggerContainer, staggerItem } from "@/lib/motion";

type Filter = "all" | "three-strikes" | "crossword";

function getArchiveStats(id: string, type: "three-strikes" | "crossword") {
  try {
    const key = type === "three-strikes" ? `ptq-archive-ts-${id}` : `ptq-archive-cw-${id}`;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { completed: boolean; score: number; total: number; strikes?: number };
  } catch {
    return null;
  }
}

export default function Archive() {
  const { data: tsArchive, isLoading: tsLoading } = useGetThreeStrikesArchive();
  const { data: cwArchive, isLoading: cwLoading } = useGetCrosswordArchive();
  const [filter, setFilter] = useState<Filter>("all");

  const isLoading = tsLoading || cwLoading;

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

  const allItems = [...tsItems, ...cwItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const displayed =
    filter === "all" ? allItems :
    filter === "three-strikes" ? tsItems :
    cwItems;

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
      <Link href="/">
        <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back Home
        </Button>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8 rounded-2xl border border-secondary/30 bg-gradient-to-r from-secondary/15 via-primary/10 to-accent/15 px-6 py-4 flex items-center gap-4 shadow-[0_18px_60px_-30px_hsl(var(--secondary)/0.6)]"
      >
        <Sparkles className="w-6 h-6 text-secondary flex-shrink-0 drop-shadow-[0_0_10px_hsl(var(--secondary))]" />
        <div>
          <p className="font-bold text-foreground">Archive is FREE during beta! 🎉</p>
          <p className="text-sm text-muted-foreground">Play any past challenge • Premium feature coming soon</p>
        </div>
      </motion.div>

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
        {(["all", "three-strikes", "crossword"] as Filter[]).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className={filter === f ? "bg-primary text-primary-foreground" : ""}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "three-strikes" ? "Three Strikes" : "Mini Crossword"}
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
            const stats = item.stats;
            const playHref = isTS
              ? `/daily/three-strikes?id=${item.id}`
              : `/daily/crossword`;

            return (
              <motion.div
                key={`${item.type}-${item.id}`}
                variants={staggerItem}
              >
                <Card
                  className={`p-6 flex flex-col h-full group transition-all duration-300
                    ${isTS
                      ? "bg-card/60 hover:bg-card border-border hover:border-primary/60 hover:shadow-[0_16px_50px_-20px_hsl(var(--primary)/0.6)]"
                      : "bg-card/60 hover:bg-card border-border hover:border-secondary/60 hover:shadow-[0_16px_50px_-20px_hsl(var(--secondary)/0.6)]"
                    }
                    ${stats?.completed ? "border-success/30" : ""}
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
                        className={`text-xs ${isTS ? "border-primary/30 text-primary" : "border-secondary/30 text-secondary"}`}
                      >
                        {isTS ? "Three Strikes" : "Crossword"}
                      </Badge>
                      {stats?.completed && (
                        <CheckCircle2 className="w-4 h-4 text-success" />
                      )}
                    </div>
                  </div>

                  <h3
                    className={`text-lg font-bold mb-1 transition-colors
                      ${isTS ? "group-hover:text-primary" : "group-hover:text-secondary"}
                    `}
                  >
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground text-sm line-clamp-2 mb-4 flex-1">
                    {"prompt" in item ? item.prompt : ""}
                  </p>

                  {stats?.completed && isTS && (
                    <div className="flex items-center gap-2 mb-3 text-sm">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-muted-foreground">
                        Best: <span className="text-foreground font-bold">{stats.score}</span>
                        {"totalCount" in item && item.totalCount ? `/${item.totalCount}` : ""} •{" "}
                        {stats.strikes ?? 0} strike{(stats.strikes ?? 0) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}

                  <Link href={playHref}>
                    <Button
                      className={`w-full transition-colors
                        ${isTS
                          ? "bg-primary/10 text-primary hover:bg-primary hover:text-white group-hover:bg-primary group-hover:text-white"
                          : "bg-secondary/10 text-secondary hover:bg-secondary hover:text-secondary-foreground group-hover:bg-secondary group-hover:text-secondary-foreground"
                        }
                      `}
                      data-testid={`btn-play-${item.type}-${item.id}`}
                    >
                      <PlayCircle className="w-4 h-4 mr-2" />
                      {stats?.completed ? "Play Again" : "Play"}
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
