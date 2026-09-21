import TranslationHistory from "../models/TranslationHistory.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function getHistory(req, res) {
  try {
    const history = await TranslationHistory.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function clearHistory(req, res) {
  try {
    const history = await TranslationHistory.find();
    // Delete physical files
    history.forEach((item) => {
      if (item.filePath) {
        const fullPath = path.join(__dirname, "../../", item.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
    });

    await TranslationHistory.deleteMany();
    res.status(200).json({ success: true, message: "Đã xóa toàn bộ lịch sử dịch." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteHistoryItem(req, res) {
  try {
    const { id } = req.params;
    const item = await TranslationHistory.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Không tìm thấy lịch sử." });
    }

    if (item.filePath) {
      const fullPath = path.join(__dirname, "../../", item.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    await TranslationHistory.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Đã xóa bản dịch." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}
