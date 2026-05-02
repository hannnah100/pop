import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetDailyStatus } from "@workspace/api-client-react";
import { motion } from "framer-motion";
import { 
  BarChart2, 
  Archive as ArchiveIcon, 
  HelpCircle, 
  Gamepad2, 
  Users,
  CheckCircle2,
  Play,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Home() {
  const { data: dailyStatus, isLoading } = useGetDailyStatus();
  
  const todayDate = new Date().toISOString().split('T')[0];
  
  // Local storage checks
  const [tsCompleted, setTsCompleted] = useState(false);
  const [cwCompleted, setCwCompleted] = useState(false);
  
  useEffect(() => {
    try {
      const tsState = localStorage.getItem(`ptq-three-strikes-${todayDate}`);
      if (tsState) setTsCompleted(JSON.parse(tsState).completed);
      
      const cwState = localStorage.getItem(`ptq-crossword-${todayDate}`);
      if (cwState) setCwCompleted(JSON.parse(cwState).completed);
    } catch (e) {
      // Ignore
    }
  }, [todayDate]);

  return (
    <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-8 md:py-16">
      
      <header className="mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent mb-4">
            POP: THE QUESTION
          </h1>
          <p className="text-xl text-muted-foreground uppercase tracking-widest font-medium">
            Where pop culture gets personal
          </p>
        </motion.div>
      </header>

      <main className="grid md:grid-cols-2 gap-6 mb-12">
        {/* Daily Games Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card className="h-full border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Gamepad2 className="text-primary w-5 h-5" />
                <Badge variant="outline" className="text-primary border-primary/30">DAILY</Badge>
              </div>
              <CardTitle className="text-3xl">Daily Games</CardTitle>
              <CardDescription className="text-base">
                Fresh pop culture puzzles every day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10">
              
              <div className="bg-background/50 rounded-xl p-4 border border-border">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-bold text-lg">Three Strikes</h3>
                    <p className="text-sm text-muted-foreground">Guess the connections</p>
                  </div>
                  {tsCompleted ? (
                    <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Done</Badge>
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

              <div className="bg-background/50 rounded-xl p-4 border border-border">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <h3 className="font-bold text-lg">Mini Crossword</h3>
                    <p className="text-sm text-muted-foreground">Pop culture quickie</p>
                  </div>
                  {cwCompleted ? (
                    <Badge className="bg-success text-success-foreground"><CheckCircle2 className="w-3 h-3 mr-1" /> Done</Badge>
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

        {/* Party Games Card */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-full border-accent/20 bg-card/50 backdrop-blur-sm overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-bl from-accent/10 to-transparent pointer-events-none" />
            <CardHeader>
              <div className="flex items-center gap-2 mb-2">
                <Users className="text-accent w-5 h-5" />
                <Badge variant="outline" className="text-accent border-accent/30">MULTIPLAYER</Badge>
              </div>
              <CardTitle className="text-3xl">Party Games</CardTitle>
              <CardDescription className="text-base">
                Host a game on a big screen. Others join on their phones.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 relative z-10 flex flex-col justify-center h-[calc(100%-120px)]">
              
              <Link href="/host">
                <Button size="lg" className="w-full h-16 text-lg bg-accent hover:bg-accent/90 text-white" data-testid="link-host-game">
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
                    className="w-full text-muted-foreground hover:text-primary hover:bg-primary/10 gap-2"
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
      </main>

      <footer className="mt-auto pt-8 pb-4 border-t border-border/50 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 text-sm font-medium">
        <Link href="/stats" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-stats">
          <BarChart2 className="w-4 h-4 group-hover:text-primary transition-colors" />
          Personal Stats
        </Link>
        <Link href="/archive" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-archive">
          <ArchiveIcon className="w-4 h-4 group-hover:text-accent transition-colors" />
          Past Puzzles
        </Link>
        <button className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group" data-testid="link-how-to-play">
          <HelpCircle className="w-4 h-4 group-hover:text-cyan-400 transition-colors" />
          How to Play
        </button>
      </footer>
    </div>
  );
}
