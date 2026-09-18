import multer from "multer";
import { createWorker } from "tesseract.js";

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
