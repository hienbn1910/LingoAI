import mammoth from "mammoth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

import { translateWithAI } from "../services/llmService.js";
import TranslationHistory from "../models/TranslationHistory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supportedLanguages = new Set([
  "vi",
  "en",
  "ja",
  "ko",
  "zh",
  "fr",
  "de",
  "es",
]);

function sanitizeDocumentText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

async function extractTextFromDocument(file) {
  const fileName = file.originalname.toLowerCase();

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({
      buffer: file.buffer,
    });

    return sanitizeDocumentText(result.value);
  }

  if (fileName.endsWith(".pdf")) {
    const pdfModule = await import("pdf-parse");
    const pdfParse = pdfModule.default ?? pdfModule;
    const result = await pdfParse(file.buffer);

    return sanitizeDocumentText(result.text);
  }

  throw new Error("Định dạng file không được hỗ trợ.");
}

export async function createDocumentTranslation(req, res) {
  const file = req.file;
  const sourceLanguage = req.body?.sourceLanguage || "auto";
  const targetLanguage = req.body?.targetLanguage || "en";

  if (!file) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn file DOCX hoặc PDF để dịch.",
    });
  }

  if (!supportedLanguages.has(targetLanguage)) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn ngôn ngữ đích hợp lệ.",
    });
  }

  if (sourceLanguage !== "auto" && !supportedLanguages.has(sourceLanguage)) {
    return res.status(400).json({
      success: false,
      message: "Ngôn ngữ nguồn không được hỗ trợ.",
    });
  }

  try {
    const extractedText = await extractTextFromDocument(file);

    if (!extractedText) {
      return res.status(400).json({
        success: false,
        message: "Tài liệu không chứa nội dung để dịch.",
      });
    }

    const result = await translateWithAI({
      text: extractedText,
      sourceLanguage,
      targetLanguage,
    });

    // Lưu file gốc vào src/uploads.
    const extension = path.extname(file.originalname);
    const fileName = `${uuidv4()}${extension}`;
    const relativeFilePath = `src/uploads/${fileName}`;
    const uploadDir = path.join(__dirname, "..", "uploads");

    fs.mkdirSync(uploadDir, { recursive: true });

    const fullPath = path.join(uploadDir, fileName);
    fs.writeFileSync(fullPath, file.buffer);

    await TranslationHistory.create({
      originalText: extractedText,
      translatedText: result.translatedText,
      sourceLanguage,
      targetLanguage,
      type: "document",
      filePath: relativeFilePath,
      fileName: file.originalname,
    });

    return res.status(200).json({
      success: true,
      message: "Dịch tài liệu thành công.",
      data: {
        fileName: file.originalname,
        sourceLanguage,
        targetLanguage,
        translatedText: result.translatedText,
        detectedLanguage: result.detectedLanguage,
      },
    });
  } catch (error) {
    console.error("Lỗi dịch tài liệu:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Không thể dịch tài liệu. Vui lòng thử lại.",
    });
  }
}
