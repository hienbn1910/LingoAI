import express from "express";
import {
  uploadImageMiddleware,
  handleOCR,
} from "../controllers/ocrController.js";

const router = express.Router();

// Xử lý POST request gửi tới /api/ocr
router.post("/", uploadImageMiddleware, handleOCR);

export default router;
