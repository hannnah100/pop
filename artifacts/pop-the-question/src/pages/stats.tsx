import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Trophy, Flame, Target, Clock, CalendarDays } from "lucide-react";
import { BackArrow } from "@/components/ui/BackArrow";
import { CountUp } from "@/components/fx";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function Stats() {
  const [stats, setStats] = useState({
    threeStrikesTotalPlays: 0,
    threeStrikesBestScore: 0,
    crosswordTotalPlays: 0,
    crosswordBestTime: 0,
  });
  const [tsStreak, setTsStreak] = useState(0);
  const [cwStreak, setCwStreak] = useState(0);

  useEffect(() => {
    try {
      const statsStr = localStorage.getItem('ptq-stats');
      if (statsStr) setStats(JSON.parse(statsStr));

      setTsStreak(parseInt(localStorage.getItem('ptq-streak-three-strikes') || '0'));
      setCwStreak(parseInt(localStorage.getItem('ptq-streak-crossword') || '0'));
    } catch {/* ignore */}
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
      <BackArrow className="mb-8" />

      <motion.header
        className="mb-12"
        variants={staggerContainer(0.08)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <h1 className="text-4xl md:text-5xl font-extrabold font-display tracking-tight text-foreground">PERSONAL STATS</h1>
          <div className="heading-divider heading-divider--magenta w-16 h-1 mt-2" />
        </motion.div>
        <motion.p variants={staggerItem} className="text-xl text-muted-foreground mt-2">
          Your history with pop culture.
        </motion.p>
      </motion.header>

      <motion.div
        className="grid md:grid-cols-2 gap-8 mb-12"
        variants={staggerContainer(0.12, 0.1)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <Card className="h-full border-primary/20 bg-card/60 hover:border-primary/40 hover:shadow-[0_18px_60px_-20px_hsl(var(--primary)/0.55)] transition-all">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-display flex items-center gap-2">
                <Target className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
                Three Strikes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/60 rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    <CountUp value={tsStreak} /> <Flame className={`w-6 h-6 ${tsStreak > 0 ? 'text-accent drop-shadow-[0_0_8px_hsl(var(--accent))]' : 'text-muted'}`} />
                  </div>
                </div>
                <div className="bg-background/60 rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Total Plays</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    <CountUp value={stats.threeStrikesTotalPlays} /> <CalendarDays className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="col-span-2 bg-primary/10 rounded-xl p-4 border border-primary/30">
                  <p className="text-sm text-primary/80 font-bold uppercase tracking-wider mb-1">Personal Best</p>
                  <div className="text-4xl font-black text-primary flex items-center gap-2">
                    <CountUp value={stats.threeStrikesBestScore} /> <Trophy className="w-6 h-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary))]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full border-secondary/20 bg-card/60 hover:border-secondary/40 hover:shadow-[0_18px_60px_-20px_hsl(var(--secondary)/0.55)] transition-all">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-display flex items-center gap-2">
                <Clock className="w-6 h-6 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary))]" />
                Mini Crossword
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background/60 rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    <CountUp value={cwStreak} /> <Flame className={`w-6 h-6 ${cwStreak > 0 ? 'text-accent drop-shadow-[0_0_8px_hsl(var(--accent))]' : 'text-muted'}`} />
                  </div>
                </div>
                <div className="bg-background/60 rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Total Plays</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    <CountUp value={stats.crosswordTotalPlays} /> <CalendarDays className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="col-span-2 bg-secondary/10 rounded-xl p-4 border border-secondary/30">
                  <p className="text-sm text-secondary/80 font-bold uppercase tracking-wider mb-1">Best Time</p>
                  <div className="text-4xl font-black text-secondary flex items-center gap-2">
                    {formatTime(stats.crosswordBestTime)} <Trophy className="w-6 h-6 text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary))]" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
