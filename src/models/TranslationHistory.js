import mongoose from "mongoose";

const documentBlockSchema = new mongoose.Schema({
  id: String,
  order: Number,
  type: { type: String, enum: ['heading', 'paragraph', 'listItem'] },
  headingLevel: Number,
  listLevel: Number,
  listLabel: String,
  page: Number,
  originalText: String,
  translatedText: String,
  editedText: { type: String, default: null },
}, { _id: false });

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
  documentBlocks: { type: [documentBlockSchema], default: undefined },
  createdAt: { type: Date, default: Date.now },
});

const TranslationHistory = mongoose.model("TranslationHistory", translationHistorySchema);

export default TranslationHistory;
