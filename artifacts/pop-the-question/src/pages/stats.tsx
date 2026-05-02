import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, Flame, Target, Clock, CalendarDays } from "lucide-react";

export default function Stats() {
  const [stats, setStats] = useState({
    threeStrikesTotalPlays: 0,
    threeStrikesBestScore: 0,
    crosswordTotalPlays: 0,
    crosswordBestTime: 0
  });
  const [tsStreak, setTsStreak] = useState(0);
  const [cwStreak, setCwStreak] = useState(0);

  useEffect(() => {
    try {
      const statsStr = localStorage.getItem('ptq-stats');
      if (statsStr) setStats(JSON.parse(statsStr));
      
      setTsStreak(parseInt(localStorage.getItem('ptq-streak-three-strikes') || '0'));
      setCwStreak(parseInt(localStorage.getItem('ptq-streak-crossword') || '0'));
    } catch(e) {}
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12">
      <Link href="/">
        <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back Home
        </Button>
      </Link>

      <header className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black font-display text-primary">Personal Stats</h1>
        <p className="text-xl text-muted-foreground mt-2">Your history with pop culture.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Three Strikes Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="h-full border-primary/20 bg-card/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-display flex items-center gap-2">
                <Target className="w-6 h-6 text-primary" />
                Three Strikes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    {tsStreak} <Flame className={`w-6 h-6 ${tsStreak > 0 ? 'text-accent' : 'text-muted'}`} />
                  </div>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Total Plays</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    {stats.threeStrikesTotalPlays} <CalendarDays className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="col-span-2 bg-primary/10 rounded-xl p-4 border border-primary/30">
                  <p className="text-sm text-primary/80 font-bold uppercase tracking-wider mb-1">Personal Best</p>
                  <div className="text-4xl font-black text-primary flex items-center gap-2">
                    {stats.threeStrikesBestScore} <Trophy className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Crossword Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full border-cyan-400/20 bg-card/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-display flex items-center gap-2">
                <Clock className="w-6 h-6 text-cyan-400" />
                Mini Crossword
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    {cwStreak} <Flame className={`w-6 h-6 ${cwStreak > 0 ? 'text-accent' : 'text-muted'}`} />
                  </div>
                </div>
                <div className="bg-background rounded-xl p-4 border border-border">
                  <p className="text-sm text-muted-foreground mb-1">Total Plays</p>
                  <div className="text-3xl font-black flex items-center gap-2">
                    {stats.crosswordTotalPlays} <CalendarDays className="w-6 h-6 text-muted-foreground" />
                  </div>
                </div>
                <div className="col-span-2 bg-cyan-400/10 rounded-xl p-4 border border-cyan-400/30">
                  <p className="text-sm text-cyan-400/80 font-bold uppercase tracking-wider mb-1">Best Time</p>
                  <div className="text-4xl font-black text-cyan-400 flex items-center gap-2">
                    {formatTime(stats.crosswordBestTime)} <Trophy className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
