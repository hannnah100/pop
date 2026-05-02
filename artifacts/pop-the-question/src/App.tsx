import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

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

function Router() {
  return (
    <div className="min-h-[100dvh] flex flex-col w-full bg-background text-foreground">
      <Switch>
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
