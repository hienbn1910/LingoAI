import mongoose from "mongoose";

const translationHistorySchema = new mongoose.Schema({
  originalText: { type: String, required: false },
  translatedText: { type: String, required: false },
  sourceLanguage: { type: String, required: true },
  targetLanguage: { type: String, required: false }, // Cho image có thể không cần
  type: {
    type: String,
    enum: ["text", "document", "image"],
    required: true,
  },
  filePath: { type: String, required: false }, // Nơi lưu trữ file vật lý (nếu có)
  fileName: { type: String, required: false }, // Tên file gốc
  createdAt: { type: Date, default: Date.now },
});

const TranslationHistory = mongoose.model("TranslationHistory", translationHistorySchema);

export default TranslationHistory;
