import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import TranslationHistory from '../models/TranslationHistory.js';
import { extractDocument, exportDocument } from '../services/documentService.js';
import { translateDocument } from '../services/documentLlmService.js';
import { exportDocxWithOriginalLayout } from "../services/docxLayoutService.js";
import { exportTranslatedPdf } from "../services/pdfExportService.js";

const uploadDir = fileURLToPath(new URL('../uploads/', import.meta.url));
const supported = new Set(['vi', 'en', 'ja', 'ko', 'zh', 'fr', 'de', 'es']);

export async function createDocumentTranslation(req, res) {
  const { sourceLanguage = 'auto', targetLanguage = 'en' } = req.body || {};
  if (!req.file) return res.status(400).json({ success: false, message: 'Vui lòng chọn file DOCX hoặc PDF.' });
  if (!supported.has(targetLanguage) || (sourceLanguage !== 'auto' && !supported.has(sourceLanguage))) {
    return res.status(400).json({ success: false, message: 'Ngôn ngữ không hợp lệ.' });
  }
  let extracted;
  try { extracted = await extractDocument(req.file); }
  catch (error) {
    console.error('Đọc tài liệu:', error.message);
    return res.status(422).json({ success: false, message: error.message || 'Không đọc được tài liệu. File có thể bị hỏng hoặc được bảo vệ bằng mật khẩu.' });
  }
  let blocks;
  try {
    blocks = await translateDocument({ blocks: extracted.blocks, sourceLanguage, targetLanguage });
  } catch (error) {
    console.error('Dịch tài liệu:', error.message);
    return res.status(error.status || 502).json({ success: false, message: error.message || 'Không dịch được tài liệu.' });
  }
  const fileName = randomUUID() + path.extname(req.file.originalname).toLowerCase();
  const fullPath = path.join(uploadDir, fileName);
  const originalText = blocks.map(b => b.originalText).join('\n\n');
  const translatedText = blocks.map(b => b.translatedText).join('\n\n');
  try {
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(fullPath, req.file.buffer);
    const history = await TranslationHistory.create({
      type: 'document', sourceLanguage, targetLanguage, originalText, translatedText,
      fileName: req.file.originalname, filePath: `src/uploads/${fileName}`, documentBlocks: blocks,
    });
    return res.json({ success: true, message: 'Dịch tài liệu thành công.', data: {
      historyId: history._id, fileName: req.file.originalname,
      sourceLanguage, targetLanguage, translatedText, blocks, warnings: extracted.warnings,
    } });
  } catch (error) {
    await fs.unlink(fullPath).catch(() => {});
    console.error('Lưu tài liệu:', error.message);
    return res.status(500).json({ success: false, message: 'Đã dịch nhưng không lưu được lịch sử. Kiểm tra MongoDB và thư mục uploads.' });
  }
}

export async function downloadDocument(req, res) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) {
    return res
      .status(400)
      .json({ success: false, message: "ID không hợp lệ." });
  }
  try {
    const doc = await TranslationHistory.findOne({
      _id: req.params.id,
      type: "document",
    });
    if (!doc?.documentBlocks?.length) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            "Không tìm thấy bản dịch có cấu trúc. Hãy dịch lại tài liệu.",
        });
    }
    const extension = path.extname(doc.fileName || "").toLowerCase();
    if (![".docx", ".pdf"].includes(extension)) {
      return res
        .status(415)
        .json({ success: false, message: "Chỉ hỗ trợ DOCX và PDF." });
    }
    if (!doc.filePath)
      return res
        .status(404)
        .json({ success: false, message: "Không còn đường dẫn file gốc." });
    const savedName = path.basename(doc.filePath.replace(/\\/g, "/"));
    const originalBuffer = await fs.readFile(path.join(uploadDir, savedName));
    const buffer =
      extension === ".docx"
        ? await exportDocxWithOriginalLayout(originalBuffer, doc.documentBlocks)
        : await exportTranslatedPdf(
            doc.documentBlocks,
            originalBuffer,
            doc.targetLanguage,
          );
    const basename = path.basename(
      (doc.fileName || "document").replace(/\\/g, "/"),
    );
    const name =
      basename.slice(0, -extension.length).replace(/[\r\n\x00-\x1f]/g, "") +
      "-translated" +
      extension;
    const encoded = encodeURIComponent(name).replace(
      /['()*]/g,
      (char) => "%" + char.charCodeAt(0).toString(16).toUpperCase(),
    );
    res.setHeader(
      "Content-Type",
      extension === ".pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="translation${extension}"; filename*=UTF-8''${encoded}`,
    );
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (error) {
    console.error("Tải bản dịch:", error.message);
    return res
      .status(error.code === "ENOENT" ? 404 : error.status || 500)
      .json({
        success: false,
        message:
          error.code === "ENOENT"
            ? "Không còn file gốc trên server. Hãy tải lên và dịch lại tài liệu."
            : error.status === 409
              ? error.message
              : "Không xuất được bản dịch. Kiểm tra log backend và cài đặt Chromium.",
      });
  }
}
