import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyRouter from "./daily";
import popBoxRouter from "./popBox";
import popOrDropRouter from "./popOrDrop";
import threeFlopsRouter from "./threeFlops";
import clockItRouter from "./clockIt";
import roomsRouter from "./rooms";
import questionsRouter from "./questions";
import customGamesRouter from "./customGames";
import skinnyRouter from "./skinny";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dailyRouter);
router.use(popBoxRouter);
router.use(popOrDropRouter);
router.use(threeFlopsRouter);
router.use(clockItRouter);
router.use(roomsRouter);
router.use(questionsRouter);
router.use(customGamesRouter);
router.use(skinnyRouter);

export default router;
