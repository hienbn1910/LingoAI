import { Router } from "express";
import {
  prepareMessages,
  openExplanation,
  readOllamaLines,
} from "../services/explanationService.js";

const router = Router();
// Một lượt chat mỗi process backend; không khóa các route dịch hiện có.
let occupied = false;
router.post("/chat", async (req, res) => {
  let prepared;
  try {
    prepared = prepareMessages(req.body);
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
  if (occupied)
    return res
      .status(429)
      .json({
        message: "AI đang trả lời một yêu cầu khác. Vui lòng thử lại sau.",
      });
  occupied = true;
  const controller = new AbortController();
  const started = Date.now();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 120000);
  const disconnected = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on("close", disconnected);
  const send = (value) => {
    if (!res.destroyed && !res.writableEnded) {
      res.write(JSON.stringify(value) + "\n");
      res.flush?.();
    }
  };
  try {
    const upstream = await openExplanation(
      prepared.messages,
      controller.signal,
    );
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    send({ type: "meta", dropped: prepared.dropped });
    let completed = false,
      count = 0,
      firstTokenMs = null;
    for await (const item of readOllamaLines(upstream.body)) {
      if (item.error) throw new Error("Ollama báo lỗi trong khi trả lời.");
      const token = item.message?.content;
      if (typeof token === "string" && token) {
        count += token.length;
        if (count > 24000) throw new Error("Câu trả lời vượt giới hạn.");
        firstTokenMs ??= Date.now() - started;
        send({ type: "token", text: token });
      }
      if (item.done) {
        if (!count)
          throw new Error(
            "AI chưa trả về nội dung. Thử lại hoặc kiểm tra chế độ thinking của model.",
          );
        send({
          type: "done",
          truncated: item.done_reason === "length",
          firstTokenMs,
          totalMs: Date.now() - started,
        });
        completed = true;
        break;
      }
    }
    if (!completed)
      throw new Error("Kết nối AI kết thúc trước khi trả lời xong.");
  } catch (error) {
    if (!res.destroyed) {
      const message = timedOut
        ? "AI xử lý quá 120 giây. Hãy thử đoạn ngắn hơn."
        : error instanceof TypeError
          ? "Không kết nối được Ollama. Hãy mở Ollama và kiểm tra địa chỉ backend."
          : error.message || "Không thể giải thích bản dịch.";
      if (res.headersSent) send({ type: "error", message });
      else res.status(error.status || (timedOut ? 504 : 502)).json({ message });
    }
  } finally {
    controller.abort();
    clearTimeout(timeout);
    occupied = false;
    res.off("close", disconnected);
    if (!res.destroyed && !res.writableEnded) res.end();
  }
});
export default router;
