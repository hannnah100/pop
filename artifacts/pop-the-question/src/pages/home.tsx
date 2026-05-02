import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  BarChart2,
  Archive as ArchiveIcon,
  HelpCircle,
  Gamepad2,
  Users,
  CheckCircle2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { RainbowText } from "@/components/fx";

export default function Home() {
  const todayDate = new Date().toISOString().split('T')[0];

  const [tsCompleted, setTsCompleted] = useState(false);
  const [cwCompleted, setCwCompleted] = useState(false);

  useEffect(() => {
    try {
      const tsState = localStorage.getItem(`ptq-three-strikes-${todayDate}`);
      if (tsState) setTsCompleted(JSON.parse(tsState).completed);
      const cwState = localStorage.getItem(`ptq-crossword-${todayDate}`);
      if (cwState) setCwCompleted(JSON.parse(cwState).completed);
    } catch {
      /* ignore */
    }
  }, [todayDate]);

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8 md:py-16">
      <motion.header
        className="mb-12 text-center"
        variants={staggerContainer(0.12, 0.05)}
        initial="hidden"
        animate="show"
      >
        <motion.h1
          variants={staggerItem}
          className="text-[2.25rem] sm:text-5xl md:text-7xl font-black font-display tracking-tight mb-4 leading-[1.05]"
        >
          <RainbowText text="POP: THE QUESTION" />
        </motion.h1>
        <motion.p
          variants={staggerItem}
          className="text-base md:text-lg text-muted-foreground italic font-normal"
        >
          Where pop culture gets personal
        </motion.p>
      </motion.header>

      <motion.main
        className="grid md:grid-cols-2 gap-6 mb-12"
        variants={staggerContainer(0.12, 0.2)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={staggerItem}>
          <Card className="h-full border-primary/20 bg-card/60 backdrop-blur-sm hover:border-primary/40 hover:shadow-[0_18px_60px_-20px_hsl(var(--primary)/0.55)] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-transparent pointer-events-none" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="text-primary w-5 h-5 drop-shadow-[0_0_8px_hsl(var(--primary))]" />
                <Badge variant="outline" className="text-primary border-primary/30">DAILY</Badge>
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">DAILY GAMES</CardTitle>
              <div className="heading-divider heading-divider--orange" />
              <CardDescription className="text-base text-muted-foreground pt-3">
                Fresh pop culture puzzles every day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="bg-background/50 rounded-xl p-4 border border-border hover:border-primary/40 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-display font-extrabold text-xl text-foreground tracking-tight">THREE STRIKES</h3>
                    <p className="text-sm text-muted-foreground">Guess the connections</p>
                  </div>
                  {tsCompleted ? (
                    <Badge className="bg-success/20 text-success border border-success/40"><CheckCircle2 className="w-3 h-3 mr-1" /> Done</Badge>
                  ) : (
                    <Badge variant="secondary">Available</Badge>
                  )}
                </div>
                <Link href="/daily/three-strikes">
                  <Button className="w-full" variant={tsCompleted ? "outline" : "default"} data-testid="link-three-strikes">
                    {tsCompleted ? "View Results" : "Play Now"}
                  </Button>
                </Link>
              </div>

              <div className="bg-background/50 rounded-xl p-4 border border-border hover:border-secondary/40 transition-colors">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-display font-extrabold text-xl text-foreground tracking-tight">MINI CROSSWORD</h3>
                    <p className="text-sm text-muted-foreground">Pop culture quickie</p>
                  </div>
                  {cwCompleted ? (
                    <Badge className="bg-success/20 text-success border border-success/40"><CheckCircle2 className="w-3 h-3 mr-1" /> Done</Badge>
                  ) : (
                    <Badge variant="secondary">Available</Badge>
                  )}
                </div>
                <Link href="/daily/crossword">
                  <Button className="w-full" variant={cwCompleted ? "outline" : "default"} data-testid="link-crossword">
                    {cwCompleted ? "View Results" : "Play Now"}
                  </Button>
                </Link>
              </div>

            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={staggerItem}>
          <Card className="h-full border-accent/20 bg-card/60 backdrop-blur-sm hover:border-accent/40 hover:shadow-[0_18px_60px_-20px_hsl(var(--accent)/0.55)] transition-all duration-300">
            <div className="absolute inset-0 bg-gradient-to-bl from-accent/15 via-transparent to-transparent pointer-events-none" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Users className="text-accent w-5 h-5 drop-shadow-[0_0_8px_hsl(var(--accent))]" />
                <Badge variant="outline" className="text-accent border-accent/30">MULTIPLAYER</Badge>
              </div>
              <CardTitle className="text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground">PARTY GAMES</CardTitle>
              <div className="heading-divider heading-divider--pink" />
              <CardDescription className="text-base text-muted-foreground pt-3">
                Host a game on a big screen. Others join on their phones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex flex-col justify-center h-[calc(100%-120px)]">

              <Link href="/host">
                <Button size="lg" className="w-full h-16 text-lg" data-testid="link-host-game">
                  Host a Game
                </Button>
              </Link>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Link href="/join">
                <Button size="lg" variant="outline" className="w-full h-16 text-lg border-2" data-testid="link-join-game">
                  Join a Game
                </Button>
              </Link>

              <div className="pt-2 border-t border-border/50">
                <Link href="/host?demo=true">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-secondary hover:bg-secondary/10 gap-2"
                    data-testid="link-demo-mode"
                  >
                    <Bot className="w-4 h-4" />
                    Try Demo Mode →
                  </Button>
                </Link>
              </div>

            </CardContent>
          </Card>
        </motion.div>
      </motion.main>

      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-auto pt-8 pb-12 border-t border-border/50 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 text-sm font-medium"
      >
        <Link href="/stats" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-stats">
          <BarChart2 className="w-4 h-4 group-hover:text-primary transition-colors" />
          Personal Stats
        </Link>
        <Link href="/archive" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-archive">
          <ArchiveIcon className="w-4 h-4 group-hover:text-accent transition-colors" />
          Past Puzzles
        </Link>
        <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-how-to-play">
          <HelpCircle className="w-4 h-4 group-hover:text-secondary transition-colors" />
          How to Play
        </button>
      </motion.footer>
    </div>
  );
}
