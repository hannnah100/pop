import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyRouter from "./daily";
import popBoxRouter from "./popBox";
import popOrDropRouter from "./popOrDrop";
import clockItRouter from "./clockIt";
import roomsRouter from "./rooms";
import questionsRouter from "./questions";
import customGamesRouter from "./customGames";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dailyRouter);
router.use(popBoxRouter);
router.use(popOrDropRouter);
router.use(clockItRouter);
router.use(roomsRouter);
router.use(questionsRouter);
router.use(customGamesRouter);

export default router;
