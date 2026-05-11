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
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/auth/AuthModal";

import Home from "@/pages/home";
import ThreeFlops from "@/pages/daily/three-flops";
import Crossword from "@/pages/daily/crossword";
import PopBox from "@/pages/daily/pop-box";
import PopOrDrop from "@/pages/daily/pop-or-drop";
import PopOrDropArchive from "@/pages/daily/pop-or-drop-archive";
import ClockIt from "@/pages/daily/ClockIt";
import ReelConnections from "@/pages/daily/reel-connections";
import Host from "@/pages/host";
import Join from "@/pages/join";
import GameHost from "@/pages/game/host";
import GamePlayer from "@/pages/game/player";
import ReadTheRoomHost from "@/pages/game/read-the-room-host";
import ReadTheRoomPlayer from "@/pages/game/read-the-room-player";
import Stats from "@/pages/stats";
import Archive from "@/pages/archive";
import CreateGamePicker from "@/pages/create-game/index";
import JeopardyCreator from "@/pages/create-game/jeopardy";
import WofCreator from "@/pages/create-game/wof";
import QuizCreator from "@/pages/create-game/quiz";
import PollCreator from "@/pages/create-game/poll";
import PoppingListCreator from "@/pages/create-game/popping-list";
import RoastCreator from "@/pages/create-game/roast";
import MyGames from "@/pages/my-games";
import HowToPlay from "@/pages/how-to-play";
import Account from "@/pages/account";

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
          <Route path="/daily/three-flops" component={ThreeFlops} />
          <Route path="/daily/crossword" component={Crossword} />
          <Route path="/daily/pop-box" component={PopBox} />
          <Route path="/daily/pop-or-drop" component={PopOrDrop} />
          <Route path="/daily/pop-or-drop/archive/:id" component={PopOrDropArchive} />
          <Route path="/daily/clock-it" component={ClockIt} />
          <Route path="/daily/reel-connections" component={ReelConnections} />
          <Route path="/host" component={Host} />
          <Route path="/join" component={Join} />
          <Route path="/game/:roomCode/host" component={GameHost} />
          <Route path="/game/:roomCode/player" component={GamePlayer} />
          <Route path="/read-the-room/:roomCode/host" component={ReadTheRoomHost} />
          <Route path="/read-the-room/:roomCode/player" component={ReadTheRoomPlayer} />
          <Route path="/stats" component={Stats} />
          <Route path="/archive" component={Archive} />
          <Route path="/create-game" component={CreateGamePicker} />
          <Route path="/create-game/jeopardy/:id" component={JeopardyCreator} />
          <Route path="/create-game/jeopardy" component={JeopardyCreator} />
          <Route path="/create-game/wof/:id" component={WofCreator} />
          <Route path="/create-game/wof" component={WofCreator} />
          <Route path="/create-game/quiz/:id" component={QuizCreator} />
          <Route path="/create-game/quiz" component={QuizCreator} />
          <Route path="/create-game/poll/:id" component={PollCreator} />
          <Route path="/create-game/poll" component={PollCreator} />
          <Route path="/create-game/popping-list/:id" component={PoppingListCreator} />
          <Route path="/create-game/popping-list" component={PoppingListCreator} />
          <Route path="/create-game/roast/:id" component={RoastCreator} />
          <Route path="/create-game/roast" component={RoastCreator} />
          <Route path="/my-games" component={MyGames} />
          <Route path="/how-to-play" component={HowToPlay} />
          <Route path="/account" component={Account} />
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
      <AuthModal />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
