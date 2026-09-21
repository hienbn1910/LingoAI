import { Router } from "express";
import { getHistory, clearHistory, deleteHistoryItem } from "../controllers/historyController.js";

const router = Router();

router.get("/", getHistory);
router.delete("/", clearHistory);
router.delete("/:id", deleteHistoryItem);

export default router;
