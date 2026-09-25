import { Router } from "express";
import multer from "multer";
import { createDocumentTranslation } from "../controllers/documentController.js";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 20 * 1024 * 1024,
  },

  fileFilter: (_req, file, callback) => {
    const name = file.originalname.toLowerCase();
    const allowed = name.endsWith(".docx") || name.endsWith(".pdf");

    if (!allowed) {
      return callback(new Error("Chỉ hỗ trợ file DOCX và PDF."));
    }

    callback(null, true);
  },
});

router.post("/", upload.single("file"), createDocumentTranslation);

export default router;
