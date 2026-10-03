import { useEffect, useId, useRef, useState } from "react";
import { streamExplanation } from "../services/explanationApi";
import "./TranslationAssistant.css";

const FIRST =
  "Giải thích ngắn gọn ý nghĩa, từ ngữ và ngữ pháp của nội dung đang chọn bằng tiếng Việt.";

const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

const box = {
  padding: 12,
  background: "#f8fafc",
  border: "1px solid #ddd6fe",
  borderRadius: 8,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  maxHeight: 180,
  overflowY: "auto",
};

const fieldOf = (element) =>
  element?.dataset.aiField ||
  {
    "source-text": "originalText",
    "translated-text": "translatedText",
  }[element?.id];

const zoneSelector =
  "[data-ai-field], textarea#source-text, textarea#translated-text";

export default function TranslationAssistant({
  context,
  active = true,
  onActivate,
  disabled = false,
}) {
  const id = useId();
  const root = useRef(null);
  const request = useRef(null);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [retry, setRetry] = useState(null);

  const contextKey = JSON.stringify(context);

  const valid =
    !!context?.originalText?.trim() && !!context?.translatedText?.trim();

  // Ngưỡng tự giải thích của giao diện, không phải giới hạn model.
  const short =
    valid &&
    context.originalText.length <= 1200 &&
    context.translatedText.length <= 1200 &&
    bytes(context) <= 4000;

  function cancel() {
    const controller = request.current;
    request.current = null;
    controller?.abort();
  }

  function clearChat() {
    cancel();
    setBusy(false);
    setMessages([]);
    setInput("");
    setError("");
    setNote("");
    setRetry(null);
  }

  // Nội dung bản dịch thay đổi thì bỏ ngữ cảnh cũ.
  useEffect(() => {
    cancel();
    setOpen(false);
    setSelected(null);
    setCandidate(null);
    setMessages([]);
    setInput("");
    setBusy(false);
    setError("");
    setNote("");
    setRetry(null);
  }, [contextKey]);

  // Chỉ một chatbot hoạt động trong trang lịch sử.
  useEffect(() => {
    if (active) return;

    cancel();
    setOpen(false);
    setSelected(null);
    setCandidate(null);
    setMessages([]);
    setBusy(false);
    setError("");
    setRetry(null);
  }, [active]);

  useEffect(() => () => cancel(), []);

  useEffect(() => {
    if (!open || !valid || disabled) return;

    const scope = root.current?.closest("[data-ai-scope], article, main");

    if (!scope) return;

    function capture(event) {
      // Không mất đoạn đã chọn khi tương tác với chatbot.
      if (
        root.current?.contains(event.target) ||
        root.current?.contains(document.activeElement)
      ) {
        return;
      }

      const element = document.activeElement;
      let zone;
      let text = "";

      if (
        element?.matches(zoneSelector) &&
        element.tagName === "TEXTAREA" &&
        scope.contains(element)
      ) {
        zone = element;
        text = element.value.slice(
          element.selectionStart,
          element.selectionEnd,
        );
      } else {
        const selection = window.getSelection();

        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);

        const start =
          range.startContainer.nodeType === 1
            ? range.startContainer
            : range.startContainer.parentElement;

        zone = start?.closest(zoneSelector);

        // Không nhận lựa chọn kéo qua hai cột hoặc bản dịch khác.
        if (
          !zone ||
          !scope.contains(zone) ||
          !zone.contains(range.endContainer)
        ) {
          setCandidate(null);
          return;
        }

        text = selection.toString();
      }

      const field = fieldOf(zone);
      text = text.trim();

      if (
        !text ||
        !["originalText", "translatedText"].includes(field) ||
        !context[field]?.includes(text)
      ) {
        setCandidate(null);
        return;
      }

      setCandidate({ field, text });
    }

    document.addEventListener("pointerup", capture);
    document.addEventListener("keyup", capture);
    document.addEventListener("selectionchange", capture);

    return () => {
      document.removeEventListener("pointerup", capture);
      document.removeEventListener("keyup", capture);
      document.removeEventListener("selectionchange", capture);
    };
  }, [open, valid, disabled, contextKey]);

  async function ask(question, history = messages, chosen = selected) {
    if (
      disabled ||
      request.current ||
      !chosen ||
      !question.trim() ||
      question.length > 1000
    ) {
      return;
    }

    const controller = new AbortController();
    request.current = controller;

    setBusy(true);
    setError("");
    setNote("");
    setRetry(null);

    const prefix = [...history, { role: "user", content: question.trim() }];

    let answer = "";
    const past = [];

    // Chỉ gửi những cặp hỏi–đáp đã hoàn thành.
    for (let i = 0; i + 1 < history.length; i += 2) {
      if (history[i + 1].complete) {
        past.push(history[i], history[i + 1]);
      }
    }

    setMessages([
      ...prefix,
      { role: "assistant", content: "", complete: false },
    ]);

    try {
      await streamExplanation(
        {
          context: chosen,
          question: question.trim(),
          history: past.slice(-12).map(({ role, content }) => ({
            role,
            content,
          })),
        },
        controller.signal,
        (event) => {
          if (request.current !== controller || controller.signal.aborted) {
            return;
          }

          if (event.type === "token") {
            answer += event.text;

            setMessages([
              ...prefix,
              {
                role: "assistant",
                content: answer,
                complete: false,
              },
            ]);
          }

          if (event.type === "done") {
            setMessages([
              ...prefix,
              {
                role: "assistant",
                content: answer,
                complete: true,
              },
            ]);

            if (event.truncated) {
              setNote("Phản hồi đạt giới hạn độ dài. Bạn có thể hỏi tiếp.");
            }
          }

          if (event.type === "meta" && event.dropped) {
            setNote("AI chỉ nhận các lượt gần đây để giới hạn ngữ cảnh.");
          }
        },
      );
    } catch (err) {
      if (request.current !== controller) return;

      // Không để lại bong bóng trống khi API thất bại.
      setMessages(
        answer
          ? [
              ...prefix,
              {
                role: "assistant",
                content: answer,
                complete: false,
              },
            ]
          : history,
      );

      setError(controller.signal.aborted ? "Đã dừng phản hồi." : err.message);

      setRetry({ question, history });
    } finally {
      if (request.current === controller) {
        request.current = null;
        setBusy(false);
      }
    }
  }

  function start() {
    if (!valid || disabled) return;

    clearChat();
    onActivate?.();

    setOpen(true);
    setCandidate(null);

    const chosen = short ? { ...context, mode: "pair" } : null;

    setSelected(chosen);

    // Nội dung dài chỉ mở chatbot, chưa gửi yêu cầu.
    if (chosen) ask(FIRST, [], chosen);
  }

  function useSelection() {
    if (
      !candidate ||
      candidate.text.length > 1200 ||
      bytes(candidate.text) > 5000
    ) {
      return;
    }

    clearChat();

    setSelected({
      mode: "excerpt",
      originalText: candidate.field === "originalText" ? candidate.text : "",
      translatedText:
        candidate.field === "translatedText" ? candidate.text : "",
      sourceLanguage: context.sourceLanguage || "auto",
      targetLanguage: context.targetLanguage,
    });

    setCandidate(null);

    // Chờ người dùng gửi câu hỏi; chưa gọi API tại đây.
  }

  const blocked = disabled || busy || !selected;

  return (
    <section className="translation-assistant" ref={root}>
      <button
        type="button"
        className="button-secondary"
        disabled={disabled || !valid}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else if (selected) {
            onActivate?.();
            setOpen(true);
          } else {
            start();
          }
        }}
      >
        {open ? "Ẩn AI giải thích" : "✨ AI giải thích"}
      </button>

      {open && (
        <div className="ta-panel">
          <div className="ta-header">
            <strong>Trợ lý giải thích bản dịch</strong>

            <button type="button" disabled={disabled || busy} onClick={start}>
              Cuộc trò chuyện mới
            </button>
          </div>

          <p className="ta-muted">
            Bôi đen trong bản gốc hoặc bản dịch, rồi bấm “Hỏi AI về đoạn này”.
          </p>

          {candidate && (
            <div style={box}>
              <strong>
                {candidate.field === "originalText"
                  ? "Đoạn gốc được bôi đen"
                  : "Đoạn dịch được bôi đen"}
              </strong>

              <p>
                {candidate.text.slice(0, 1200)}
                {candidate.text.length > 1200 ? "…" : ""}
              </p>

              <button
                type="button"
                disabled={
                  disabled ||
                  candidate.text.length > 1200 ||
                  bytes(candidate.text) > 5000
                }
                onClick={useSelection}
              >
                Hỏi AI về đoạn này
              </button>

              {candidate.text.length > 1200 && (
                <p role="status">Hãy chọn tối đa 1.200 ký tự mỗi lần.</p>
              )}
            </div>
          )}

          {selected ? (
            <div style={box}>
              <strong>
                {selected.mode === "pair"
                  ? "Đang hỏi về bản dịch ngắn"
                  : selected.originalText
                    ? "Đang hỏi về đoạn gốc"
                    : "Đang hỏi về đoạn dịch"}
              </strong>

              <p>{selected.originalText || selected.translatedText}</p>

              {selected.mode === "excerpt" && (
                <small>
                  Chỉ gửi đoạn này. Chưa có cặp gốc–dịch để đối chiếu độ chính
                  xác.
                </small>
              )}

              <div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    clearChat();
                    setSelected(null);
                    setCandidate(null);
                  }}
                >
                  Chọn đoạn khác
                </button>
              </div>
            </div>
          ) : (
            <p role="status" className="ta-warning">
              Hãy chọn một đoạn để bắt đầu. Chưa có yêu cầu nào được gửi đến AI.
            </p>
          )}

          <div className="ta-messages" aria-label="Cuộc trò chuyện">
            {messages.map((message, index) => (
              <div key={index} className={`ta-message ta-${message.role}`}>
                <strong>{message.role === "user" ? "Bạn" : "AI"}</strong>

                <div>{message.content || "Đang chờ AI…"}</div>

                {!busy && message.role === "assistant" && !message.complete && (
                  <small>Phản hồi chưa hoàn thành</small>
                )}
              </div>
            ))}
          </div>

          {note && <p className="ta-muted">{note}</p>}

          {error && (
            <p role="alert" className="ta-error">
              {error}
            </p>
          )}

          {retry && (
            <button
              type="button"
              disabled={blocked}
              onClick={() => ask(retry.question, retry.history)}
            >
              Thử lại câu hỏi vừa rồi
            </button>
          )}

          <div className="ta-suggestions">
            {[
              "Giải thích đoạn này.",
              "Giải thích từ khó trong đoạn này.",
              "Cho một ví dụ dễ hiểu.",
            ].map((question) => (
              <button
                key={question}
                type="button"
                disabled={blocked}
                onClick={() => ask(question)}
              >
                {question}
              </button>
            ))}
          </div>

          <form
            className="ta-form"
            onSubmit={(event) => {
              event.preventDefault();

              if (!blocked && input.trim()) {
                ask(input);
                setInput("");
              }
            }}
          >
            <label htmlFor={id}>Câu hỏi của bạn</label>

            <textarea
              id={id}
              rows={3}
              maxLength={1000}
              value={input}
              disabled={disabled || !selected}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Bạn muốn tìm hiểu gì về đoạn này?"
            />

            <div className="ta-actions">
              <span>{input.length}/1.000 ký tự</span>

              {busy ? (
                <button type="button" onClick={() => request.current?.abort()}>
                  Dừng
                </button>
              ) : (
                <button type="submit" disabled={blocked || !input.trim()}>
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
