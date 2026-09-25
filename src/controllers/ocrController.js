import multer from "multer";
import { createWorker } from "tesseract.js";
import TranslationHistory from "../models/TranslationHistory.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadImageMiddleware = upload.single("image");

export async function handleOCR(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng tải lên một tệp hình ảnh hợp lệ.",
      });
    }

    // Khởi tạo Tesseract worker (hỗ trợ tiếng Việt 'vie' và tiếng Anh 'eng')
    const worker = await createWorker(["vie", "eng"]);

    // Đọc văn bản trực tiếp từ Buffer của file ảnh mà multer đang giữ
    const ret = await worker.recognize(req.file.buffer);
    await worker.terminate();

    const rawText = ret.data.text.trim();

    // Làm sạch chuỗi: Chuyển ký tự © hoặc các dấu tròn đầu dòng bị nhận diện sai thành dấu '-'
    const cleanedText = rawText
      .replace(/^©\s*/gm, "• ")
      .replace(/\n©\s*/g, "\n• ")
      .replace(/^[o•]\s*/gm, "• ");

    if (!cleanedText) {
      return res.status(400).json({
        success: false,
        message: "Không tìm thấy văn bản nào trong hình ảnh này.",
      });
    }

    const extension = path.extname(req.file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    const relativeFilePath = `src/uploads/${fileName}`;
    const uploadDir = path.join(__dirname, "..", "uploads");
    fs.mkdirSync(uploadDir, { recursive: true });
    const fullPath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullPath, req.file.buffer);

    await TranslationHistory.create({
      originalText: cleanedText,
      sourceLanguage: "auto",
      type: "image",
      filePath: relativeFilePath,
      fileName: req.file.originalname,
    });

    return res.status(200).json({
      success: true,
      message: "Trích xuất văn bản thành công!",
      data: {
        extractedText: cleanedText,
      },
    });
  } catch (error) {
    next(error);
  }
}
