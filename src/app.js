import express from "express";
import translationRoutes from "./routes/translationRoutes.js";
import cors from "cors"; // <--- 1. Thêm import cors ở đây
import ocrRoutes from "./routes/ocrRoutes.js"; // <-- Thêm import route OCR

const app = express();

app.use(cors()); // <--- 2. Kích hoạt cors middleware cho phép mọi nguồn gọi vào
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Backend AI Translator đang hoạt động.",
  });
});

app.use("/api/translations", translationRoutes);
app.use("/api/ocr", ocrRoutes); // <-- Đăng ký route /api/ocr tại đây

// Đặt sau tất cả các route hợp lệ.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "API không tồn tại.",
  });
});

// Middleware xử lý lỗi cần đủ 4 tham số.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu JSON không hợp lệ.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Dữ liệu gửi lên quá lớn.",
    });
  }

  console.error("Lỗi xử lý API:", error.message);

  return res.status(500).json({
    success: false,
    message: "Đã xảy ra lỗi máy chủ.",
  });
});

export default app;
