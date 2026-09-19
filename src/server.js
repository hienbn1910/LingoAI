import app from "./app.js";
import { connectDB } from "./config/db.js";

const PORT = Number(process.env.PORT || 5001);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`Backend đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Không thể khởi động backend:", error.message);
    process.exit(1);
  }
}

startServer();
