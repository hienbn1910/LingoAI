import { translateWithAI } from "../services/llmService.js";
import TranslationHistory from "../models/TranslationHistory.js";

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

const MAX_TEXT_LENGTH = 5000;

export async function createTranslation(req, res) {
  const { text, sourceLanguage = "auto", targetLanguage } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập văn bản cần dịch.",
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return res.status(400).json({
      success: false,
      message: `Văn bản không được vượt quá ${MAX_TEXT_LENGTH} ký tự.`,
    });
  }

  if (sourceLanguage !== "auto" && !supportedLanguages.has(sourceLanguage)) {
    return res.status(400).json({
      success: false,
      message: "Ngôn ngữ nguồn không được hỗ trợ.",
    });
  }

  if (!supportedLanguages.has(targetLanguage)) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng chọn ngôn ngữ đích hợp lệ.",
    });
  }

  if (sourceLanguage === targetLanguage) {
    return res.status(400).json({
      success: false,
      message: "Ngôn ngữ nguồn và ngôn ngữ đích phải khác nhau.",
    });
  }

  try {
    const result = await translateWithAI({
      text,
      sourceLanguage,
      targetLanguage,
    });

    // Lưu lịch sử sau khi dịch thành công.
    try {
      await TranslationHistory.create({
        originalText: text,
        translatedText: result.translatedText,
        sourceLanguage,
        targetLanguage,
        type: "text",
      });
    } catch (saveError) {
      console.error("Không thể lưu lịch sử dịch văn bản:", {
        name: saveError.name,
        message: saveError.message,
        code: saveError.code,
      });

      return res.status(500).json({
        success: false,
        code: "HISTORY_SAVE_FAILED",
        message: "Đã dịch xong nhưng không thể lưu lịch sử. Vui lòng thử lại.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dịch thành công.",
      data: {
        originalText: text,
        sourceLanguage,
        targetLanguage,
        translatedText: result.translatedText,
        detectedLanguage: result.detectedLanguage,
      },
    });
  } catch (error) {
    console.error("Lỗi dịch văn bản:", {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });

    if (error.code === "INVALID_INPUT") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "LANGUAGE_UNDETERMINED") {
      return res.status(422).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.code === "AI_TIMEOUT" ||
      error.name === "APIConnectionTimeoutError" ||
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      return res.status(504).json({
        success: false,
        message: "AI phản hồi quá lâu. Vui lòng thử lại.",
      });
    }

    if (error.code === "OLLAMA_CONNECTION_ERROR") {
      return res.status(503).json({
        success: false,
        message:
          "Không kết nối được Ollama. Hãy kiểm tra ứng dụng Ollama đang chạy.",
      });
    }

    if (
      error.code === "MISSING_API_KEY" ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404
    ) {
      return res.status(503).json({
        success: false,
        message:
          "Dịch vụ AI chưa sẵn sàng. Kiểm tra API key và model ở backend.",
      });
    }

    if (error.status === 429) {
      return res.status(503).json({
        success: false,
        message: "Dịch vụ AI đang bị giới hạn hoặc đã hết hạn mức sử dụng.",
      });
    }

    if (error.code === "UNTRANSLATED_TEXT") {
      return res.status(502).json({
        success: false,
        message:
          "Model trả lại văn bản gốc thay vì bản dịch. Hãy thử câu đầy đủ hơn hoặc model khác.",
      });
    }

    return res.status(502).json({
      success: false,
      message: "Không thể nhận bản dịch từ AI. Vui lòng thử lại.",
    });
  }
}
