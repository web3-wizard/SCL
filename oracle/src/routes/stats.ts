import { Router, Request, Response } from "express";
import { stats } from "../services/stats";

const router = Router();

router.get("/stats", (_req: Request, res: Response) => {
  res.json(stats.getStats());
});

export default router;
