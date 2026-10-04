import { Button } from "./ui/button";
import { useEffect, useId, useRef, useState } from "react";
import { streamExplanation } from "../services/explanationApi";
import "./TranslationAssistant.css";

const FIRST =
  "Giải thích ngắn gọn ý nghĩa, từ ngữ và ngữ pháp của nội dung đang chọn bằng tiếng Việt.";
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).length;
function Icon({ name }) {
  const paths = {
    plus: "M12 5v14M5 12h14",
    send: "m22 2-7 20-4-9-9-4 20-7ZM22 2 11 13",
    stop: "M7 7h10v10H7z",
    change: "M4 7h15m-4-4 4 4-4 4M20 17H5m4-4-4 4 4 4",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  };
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

const fieldOf = (element) =>
  element?.dataset.aiField ||
  { "source-text": "originalText", "translated-text": "translatedText" }[
    element?.id
  ];
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
      // Clicking chatbot controls must not erase the saved selection.
      if (
        root.current?.contains(event.target) ||
        root.current?.contains(document.activeElement)
      )
        return;
      const element = document.activeElement;
      let zone;
      let text;
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
    if (disabled || request.current || !chosen || !question.trim()) return;
    if (question.length > 1000) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setNote("");
    setRetry(null);
    const prefix = [...history, { role: "user", content: question.trim() }];
    let answer = "";
    const past = [];
    for (let i = 0; i + 1 < history.length; i += 2) {
      if (history[i + 1].complete) past.push(history[i], history[i + 1]);
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
          history: past
            .slice(-12)
            .map(({ role, content }) => ({ role, content })),
        },
        controller.signal,
        (event) => {
          if (request.current !== controller || controller.signal.aborted)
            return;
          if (event.type === "token") {
            answer += event.text;
            setMessages([
              ...prefix,
              { role: "assistant", content: answer, complete: false },
            ]);
          }
          if (event.type === "done") {
            setMessages([
              ...prefix,
              { role: "assistant", content: answer, complete: true },
            ]);
            if (event.truncated)
              setNote("Phản hồi đạt giới hạn độ dài. Bạn có thể hỏi tiếp.");
          }
          if (event.type === "meta" && event.dropped)
            setNote("AI chỉ nhận các lượt gần đây để giới hạn ngữ cảnh.");
        },
      );
    } catch (err) {
      if (request.current !== controller) return;
      // A failed empty response does not leave an empty bubble.
      setMessages(
        answer
          ? [...prefix, { role: "assistant", content: answer, complete: false }]
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
    if (chosen) ask(FIRST, [], chosen);
  }

  function useSelection() {
    if (
      !candidate ||
      candidate.text.length > 1200 ||
      bytes(candidate.text) > 5000
    )
      return;
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
    // Selecting text does not call the API.
  }

  const blocked = disabled || busy || !selected;
  return (
    <section className="translation-assistant" ref={root}>
      <Button variant="outline"
        type="button"
        className="ta-toggle"
        disabled={disabled || !valid}
        aria-expanded={open}
        onClick={() =>
          open
            ? setOpen(false)
            : selected
              ? (onActivate?.(), setOpen(true))
              : start()
        }
      >
        <Icon name="spark" />
        {open ? "Ẩn AI giải thích" : "AI giải thích"}
      </Button>
      {open && (
        <div className="ta-panel">
          <div className="ta-header">
            <div className="ta-heading">
              <span className="ta-avatar">
                <Icon name="spark" />
              </span>
              <div>
                <strong>Trợ lý bản dịch</strong>
                <span className="ta-subtitle">
                  Hỏi sâu hơn về đoạn bạn chọn
                </span>
              </div>
            </div>
            <Button variant="outline"
              type="button"
              className="ta-icon-button"
              title="Cuộc trò chuyện mới"
              aria-label="Cuộc trò chuyện mới"
              disabled={disabled || busy}
              onClick={start}
            >
              <Icon name="plus" />
            </Button>
          </div>
          <p className="ta-muted">
            Bôi đen trong bản gốc hoặc bản dịch, rồi bấm “Hỏi AI về đoạn này”.
          </p>
          {candidate && (
            <div className="ta-context">
              <strong>
                {candidate.field === "originalText"
                  ? "Đoạn gốc được bôi đen"
                  : "Đoạn dịch được bôi đen"}
              </strong>
              <p className="ta-context-text">
                {candidate.text.slice(0, 1200)}
                {candidate.text.length > 1200 ? "…" : ""}
              </p>
              <Button variant="outline"
                type="button"
                className="ta-select-button"
                disabled={
                  disabled ||
                  candidate.text.length > 1200 ||
                  bytes(candidate.text) > 5000
                }
                onClick={useSelection}
              >
                Hỏi AI về đoạn này
              </Button>
              {candidate.text.length > 1200 && (
                <p role="status">Hãy chọn tối đa 1.200 ký tự mỗi lần.</p>
              )}
            </div>
          )}
          {selected ? (
            <div className="ta-context">
              <strong>
                {selected.mode === "pair"
                  ? "Đang hỏi về bản dịch ngắn"
                  : selected.originalText
                    ? "Đang hỏi về đoạn gốc"
                    : "Đang hỏi về đoạn dịch"}
              </strong>
              <p className="ta-context-text">
                {selected.originalText || selected.translatedText}
              </p>
              {selected.mode === "excerpt" && (
                <small>
                  Chỉ gửi đoạn này. Chưa có cặp gốc–dịch để đối chiếu độ chính
                  xác.
                </small>
              )}
              <div>
                <Button variant="outline"
                  type="button"
                  className="ta-change-button"
                  disabled={disabled}
                  onClick={() => {
                    clearChat();
                    setSelected(null);
                    setCandidate(null);
                  }}
                >
                  <Icon name="change" />
                  Chọn đoạn khác
                </Button>
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
            <Button variant="outline"
              type="button"
              disabled={blocked}
              onClick={() => ask(retry.question, retry.history)}
            >
              Thử lại câu hỏi vừa rồi
            </Button>
          )}
          <div className="ta-suggestions">
            {[
              "Giải thích đoạn này.",
              "Giải thích từ khó trong đoạn này.",
              "Cho một ví dụ dễ hiểu.",
            ].map((question) => (
              <Button variant="outline"
                key={question}
                type="button"
                disabled={blocked}
                onClick={() => ask(question)}
              >
                {question}
              </Button>
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
                <Button variant="outline"
                  type="button"
                  className="ta-icon-button ta-stop"
                  title="Dừng phản hồi"
                  aria-label="Dừng phản hồi"
                  onClick={() => request.current?.abort()}
                >
                  <Icon name="stop" />
                </Button>
              ) : (
                <Button variant="outline"
                  type="submit"
                  className="ta-icon-button ta-send"
                  title="Gửi câu hỏi"
                  aria-label="Gửi câu hỏi"
                  disabled={blocked || !input.trim()}
                >
                  <Icon name="send" />
                </Button>
              )}
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
