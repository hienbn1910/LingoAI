import mongoose from "mongoose";

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn("MONGODB_URI chưa được cấu hình, bỏ qua kết nối MongoDB.");
    return false;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Đã kết nối MongoDB.");
    return true;
  } catch (error) {
    console.warn("Không thể kết nối MongoDB, tiếp tục chạy backend mà không cần database:", error.message);
    return false;
  }
}
