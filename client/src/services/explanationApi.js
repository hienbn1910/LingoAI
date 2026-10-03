export async function streamExplanation(payload, signal, onEvent) {
  const response = await fetch("/api/explanations/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `Không gọi được AI (${response.status}).`);
  }
  if (
    !response.body ||
    !response.headers.get("content-type")?.includes("application/x-ndjson")
  ) {
    throw new Error(
      "API chat chưa trả đúng luồng dữ liệu. Kiểm tra mount route và Vite proxy.",
    );
  }
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    finished = false;
  function consume(line) {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "done") finished = true;
    onEvent(event);
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done
        ? decoder.decode()
        : decoder.decode(value, { stream: true });
      if (buffer.length > 1000000) throw new Error("Phản hồi quá lớn.");
      let index;
      while ((index = buffer.indexOf("\n")) !== -1) {
        consume(buffer.slice(0, index));
        buffer = buffer.slice(index + 1);
      }
      if (done) break;
    }
    consume(buffer);
    if (!finished)
      throw new Error("Phản hồi bị ngắt. Bạn có thể thử lại câu hỏi.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
