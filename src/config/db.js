import mongoose from "mongoose";

export async function connectDB() {
  if (!process.env.MONGODB_URI) {
    throw new Error("Chưa cấu hình MONGODB_URI.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  console.log("Đã kết nối MongoDB.");
}
