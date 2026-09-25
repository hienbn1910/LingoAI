import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startCronJobs } from "./config/cron.js";

const PORT = Number(process.env.PORT || 5001);

async function startServer() {
  try {
    await connectDB();
    startCronJobs();

    app.listen(PORT, () => {
      console.log(`Backend đang chạy tại http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Không thể khởi động backend:", error.message);
    process.exit(1);
  }
}

startServer();
