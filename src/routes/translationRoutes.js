import { Router } from "express";
import { createTranslation } from "../controllers/translationController.js";

const router = Router();

router.post("/", createTranslation);

export default router;
