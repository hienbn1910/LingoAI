import { useEffect, useRef, useState } from "react";
import { streamExplanation } from "../services/explanationApi";
import "./TranslationAssistant.css";

const FIRST =
  "Hãy giải thích ngắn gọn bản dịch này: ý nghĩa và những điểm đáng chú ý về từ ngữ, ngữ pháp hoặc sắc thái. Không lặp lại toàn bộ bản dịch.";
const keyOf = (context) => (context ? JSON.stringify(context) : "");

export default function TranslationAssistant({ context }) {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [metrics, setMetrics] = useState(null);
  const [retry, setRetry] = useState(null);
  const request = useRef(null);
  const end = useRef(null);
  const currentKey = keyOf(context);
  const stale = !!snapshot && keyOf(snapshot) !== currentKey;

  useEffect(() => {
    if (stale) request.current?.abort();
  }, [stale]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "nearest" });
  }, [messages, open]);

  async function ask(question, history = messages, selected = snapshot) {
    if (!selected || request.current || keyOf(selected) !== currentKey) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setNote("");
    setMetrics(null);
    setRetry(null);
    const questionText = question.trim();
    const prefix = [...history, { role: "user", content: questionText }];
    let answer = "";
    setMessages([
      ...prefix,
      { role: "assistant", content: "", complete: false },
    ]);
    const pairs = [];
    for (let i = 0; i + 1 < history.length; i += 2) {
      if (
        history[i].role === "user" &&
        history[i + 1].role === "assistant" &&
        history[i + 1].complete
      ) {
        pairs.push(
          { role: "user", content: history[i].content },
          { role: "assistant", content: history[i + 1].content },
        );
      }
    }
    if (pairs.length > 12)
      setNote(
        "AI chỉ nhận các lượt gần đây; nội dung cũ vẫn hiển thị tại đây.",
      );
    try {
      await streamExplanation(
        {
          context: selected,
          question: questionText,
          history: pairs.slice(-12),
        },
        controller.signal,
        (event) => {
          if (event.type === "meta" && event.dropped)
            setNote(
              "Một số lượt cũ không được gửi để giới hạn ngữ cảnh. Hãy nhắc lại chi tiết nếu cần.",
            );
          if (event.type === "token") {
            answer += event.text;
            setMessages([
              ...prefix,
              { role: "assistant", content: answer, complete: false },
            ]);
          }
          if (event.type === "done") {
            setMetrics(event);
            setMessages([
              ...prefix,
              {
                role: "assistant",
                content: answer,
                complete: true,
                truncated: event.truncated,
              },
            ]);
            if (event.truncated)
              setNote(
                "Câu trả lời đạt giới hạn độ dài. Bạn có thể hỏi thêm để làm rõ.",
              );
          }
        },
      );
    } catch (err) {
      setMessages([
        ...prefix,
        { role: "assistant", content: answer, complete: false },
      ]);
      setError(
        controller.signal.aborted
          ? "Đã dừng phản hồi. Phần chưa hoàn thành sẽ không được gửi làm ngữ cảnh."
          : err.message,
      );
      setRetry({ question: questionText, history });
    } finally {
      request.current = null;
      setBusy(false);
    }
  }

  function start() {
    if (!context || busy) return;
    setSnapshot({ ...context });
    setMessages([]);
    setInput("");
    setOpen(true);
    ask(FIRST, [], { ...context });
  }
  function toggle() {
    if (!snapshot) start();
    else setOpen((value) => !value);
  }
  function submit(event) {
    event.preventDefault();
    if (!input.trim() || busy || stale) return;
    const question = input;
    setInput("");
    ask(question);
  }

  return (
    <section className="translation-assistant">
      <button
        type="button"
        className="button-secondary"
        onClick={toggle}
        disabled={!snapshot && !context}
      >
        {open ? "Ẩn AI giải thích" : "✨ AI giải thích"}
      </button>
      {open && (
        <div className="ta-panel">
          <div className="ta-header">
            <strong>Trợ lý giải thích bản dịch</strong>
            <button
              type="button"
              className="button-secondary"
              disabled={!context || busy}
              onClick={start}
            >
              Cuộc trò chuyện mới
            </button>
          </div>
          <p className="ta-muted">
            Phân tích bản dịch {snapshot?.sourceLanguage} →{" "}
            {snapshot?.targetLanguage}. AI có thể giải thích sai; hãy đối chiếu
            bản gốc.
          </p>
          {stale && (
            <p role="status" className="ta-warning">
              Bản dịch đã thay đổi. Khi có kết quả mới, bấm “Cuộc trò chuyện
              mới” để giải thích bản hiện tại.
            </p>
          )}
          <div className="ta-messages" aria-label="Cuộc trò chuyện">
            {messages.map((message, index) => (
              <div key={index} className={`ta-message ta-${message.role}`}>
                <strong>{message.role === "user" ? "Bạn" : "AI"}</strong>
                <div>
                  {message.content ||
                    (busy ? "Đang chờ AI..." : "Chưa có câu trả lời.")}
                </div>
                {message.role === "assistant" &&
                  !message.complete &&
                  !busy &&
                  message.content && <small>Phản hồi chưa hoàn thành</small>}
              </div>
            ))}
            <div ref={end} />
          </div>
          {busy && <p role="status">AI đang phản hồi…</p>}
          {metrics && (
            <p className="ta-muted">
              Bắt đầu trả lời: {(metrics.firstTokenMs / 1000).toFixed(1)} giây ·
              Hoàn thành: {(metrics.totalMs / 1000).toFixed(1)} giây
            </p>
          )}
          {note && (
            <p className="ta-muted" role="status">
              {note}
            </p>
          )}
          {error && (
            <p role="alert" className="ta-error">
              {error}
            </p>
          )}
          {retry && !stale && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={() => ask(retry.question, retry.history)}
            >
              Thử lại câu hỏi vừa rồi
            </button>
          )}
          <div className="ta-suggestions">
            {[
              "Giải thích từ khó trong đoạn này.",
              "Có cách diễn đạt tự nhiên hơn không?",
              "Cho tôi một ví dụ dễ hiểu.",
            ].map((question) => (
              <button
                type="button"
                key={question}
                disabled={busy || stale}
                onClick={() => ask(question)}
              >
                {question}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="ta-form">
            <label htmlFor="translation-question">Hỏi thêm về bản dịch</label>
            <textarea
              id="translation-question"
              rows={3}
              maxLength={1000}
              value={input}
              disabled={stale}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ví dụ: Tại sao câu này dùng thì quá khứ?"
            />
            <div className="ta-actions">
              <span className="ta-muted">{input.length}/1.000 ký tự</span>
              {busy ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => request.current?.abort()}
                >
                  Dừng
                </button>
              ) : (
                <button
                  type="submit"
                  className="button-primary"
                  disabled={stale || !input.trim()}
                >
                  Gửi câu hỏi
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
