import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dailyRouter from "./daily";
import roomsRouter from "./rooms";
import questionsRouter from "./questions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dailyRouter);
router.use(roomsRouter);
router.use(questionsRouter);

export default router;
