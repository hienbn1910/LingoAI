import cron from "node-cron";
import TranslationHistory from "../models/TranslationHistory.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function startCronJobs() {
  // Chạy lúc 00:00 mỗi ngày
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Bắt đầu dọn dẹp các tài liệu vật lý cũ...");
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      // Tìm các bản ghi tài liệu hoặc ảnh có tuổi đời > 7 ngày và có filePath
      const oldRecords = await TranslationHistory.find({
        type: { $in: ["document", "image"] },
        createdAt: { $lt: oneWeekAgo },
        filePath: { $exists: true, $ne: null },
      });

      let count = 0;
      for (const record of oldRecords) {
        const fullPath = path.join(__dirname, "../../", record.filePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          count++;
        }
        // Có thể xóa luôn record trong database, hoặc chỉ xóa file và cập nhật filePath thành null.
        // Theo yêu cầu "xóa đi sau 1 tuần", ta xóa luôn record
        await TranslationHistory.findByIdAndDelete(record._id);
      }

      console.log(`[Cron] Đã dọn dẹp ${count} tài liệu/ảnh cũ (hơn 1 tuần).`);
    } catch (error) {
      console.error("[Cron] Lỗi khi dọn dẹp tài liệu cũ:", error);
    }
  });
}
