import { Router } from "express";
import {
  saveHistoryEdit,
  restoreHistoryTranslation,
} from "../controllers/historyEditController.js";

const router = Router();
router.patch("/:id/content", saveHistoryEdit);
router.post("/:id/restore", restoreHistoryTranslation);
export default router;
