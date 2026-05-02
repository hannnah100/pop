import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AnimatedBackground } from "@/components/fx/AnimatedBackground";
import { MuteToggle } from "@/components/fx/MuteToggle";
import { useUnlockOnFirstInteraction } from "@/lib/sfx";
import { pageTransition } from "@/lib/motion";

import Home from "@/pages/home";
import ThreeStrikes from "@/pages/daily/three-strikes";
import Crossword from "@/pages/daily/crossword";
import Host from "@/pages/host";
import Join from "@/pages/join";
import GameHost from "@/pages/game/host";
import GamePlayer from "@/pages/game/player";
import Stats from "@/pages/stats";
import Archive from "@/pages/archive";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function AnimatedRoutes() {
  const [location] = useLocation();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={pageTransition}
        initial="hidden"
        animate="show"
        exit="exit"
        className="flex flex-col flex-1 min-h-0"
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
          <Route path="/daily/three-strikes" component={ThreeStrikes} />
          <Route path="/daily/crossword" component={Crossword} />
          <Route path="/host" component={Host} />
          <Route path="/join" component={Join} />
          <Route path="/game/:roomCode/host" component={GameHost} />
          <Route path="/game/:roomCode/player" component={GamePlayer} />
          <Route path="/stats" component={Stats} />
          <Route path="/archive" component={Archive} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
  );
}

function Router() {
  useUnlockOnFirstInteraction();
  return (
    <div className="relative min-h-[100dvh] flex flex-col w-full text-foreground">
      <AnimatedBackground />
      <AnimatedRoutes />
      <MuteToggle />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
