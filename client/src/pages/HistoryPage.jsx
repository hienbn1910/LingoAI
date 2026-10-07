import { PencilLine, Save, RotateCcw, X } from "lucide-react";
import "../components/TranslationActions.css";
import { Button } from "../components/ui/button";
import { useEffect, useId, useRef, useState } from "react";
import TranslationAssistant from "../components/TranslationAssistant";

const panel = {
  padding: 12,
  borderRadius: 12,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
  fontSize: "0.95rem",
};
const column = { flex: "1 1 300px", minWidth: 0 };
const button = {
  padding: "8px 12px",
  border: "1px solid #d1d5db",
  borderRadius: 12,
  background: "white",
  color: "#374151",
  cursor: "pointer",
};
const formatDate = (value) => new Date(value).toLocaleString("vi-VN");

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new Error(
      data?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    );
  }
  return data;
}

// React không ghi lại DOM sau mỗi phím, tránh nhảy con trỏ khi nhập tiếng Việt.
function EditableText({ initialText, disabled, onChange, label }) {
  const element = useRef(null);
  const initial = useRef(initialText);
  useEffect(() => {
    element.current.textContent = initial.current;
  }, []);
  return (
    <div
      ref={element}
      contentEditable={disabled ? false : "plaintext-only"}
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline="true"
      aria-readonly={disabled}
      tabIndex={disabled ? -1 : 0}
      style={{
        outline: "none",
        minHeight: "1.5em",
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
      }}
      onInput={(event) => onChange(event.currentTarget.innerText)}
    />
  );
}

function FoldText({ text = "", field, background }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const value = typeof text === "string" ? text : "";
  const preview = value.slice(0, 650).split("\n").slice(0, 10).join("\n");
  const long = preview.length < value.length;
  return (
    <div className="history-reading">
      <div
        id={id}
        data-ai-field={field}
        className="history-reading-content"
        tabIndex={expanded && long ? 0 : undefined}
        aria-label={
          field === "originalText" ? "Nội dung bản gốc" : "Nội dung bản dịch"
        }
        style={{
          ...panel,
          marginTop: 4,
          background,
          maxHeight: expanded ? 480 : undefined,
          overflowY: expanded ? "auto" : undefined,
        }}
      >
        {expanded ? value : preview}
      </div>
      {long && (
        <div className="history-reading-footer">
          <span>
            {expanded
              ? "Cuộn trong khung để đọc và bôi đen"
              : "Đang hiển thị một phần nội dung"}
          </span>
          <Button variant="outline"
            type="button"
            className="history-expand"
            aria-expanded={expanded}
            aria-controls={id}
            onClick={() => setExpanded((previous) => !previous)}
          >
            {expanded ? "Thu gọn" : "Xem thêm"}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
              style={{ transform: expanded ? "rotate(180deg)" : undefined }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const [draftBlocks, setDraftBlocks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [activeAssistantId, setActiveAssistantId] = useState(null);

  useEffect(() => {
    let active = true;
    request("/api/history")
      .then((data) => {
        if (active) setHistory(data.data || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Cảnh báo nếu rời trang bằng reload/đóng tab trong lúc đang sửa.
  useEffect(() => {
    if (!editingId) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editingId]);

  function startEdit(item) {
    setActiveAssistantId(null);
    setEditingId(item._id);
    setDraft(item.editedText ?? item.translatedText ?? "");
    setDraftBlocks(
      (item.documentBlocks || []).map((block) => ({
        id: block.id,
        editedText: block.editedText ?? block.translatedText ?? "",
      })),
    );
    setError("");
    setNotice("");
  }

  async function save(item, restore = false) {
    if (
      restore &&
      !window.confirm(
        "Khôi phục bản dịch AI ban đầu? Phần chỉnh sửa đã lưu sẽ bị bỏ.",
      )
    )
      return;
    setActiveAssistantId(null);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await request(
        `/api/history/${item._id}/${restore ? "restore" : "content"}`,
        {
          method: restore ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            revision: item.__v ?? 0,
            ...(!restore &&
              (item.documentBlocks?.length
                ? { blocks: draftBlocks }
                : { editedText: draft })),
          }),
        },
      );
      setHistory((previous) =>
        previous.map((entry) => (entry._id === item._id ? data.data : entry)),
      );
      setEditingId(null);
      setNotice(
        restore
          ? "Đã khôi phục bản dịch AI ban đầu."
          : "Đã lưu bản dịch chỉnh sửa.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    if (!window.confirm(id ? "Xóa bản dịch này?" : "Xóa toàn bộ lịch sử?"))
      return;
    setActiveAssistantId(null);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(id ? `/api/history/${id}` : "/api/history", {
        method: "DELETE",
      });
      setHistory((previous) =>
        id ? previous.filter((item) => item._id !== id) : [],
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="history-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div className="page-header"><span className="eyebrow">GÓC NGÔN NGỮ CỦA BẠN</span><h1>Những bản dịch đã lưu.</h1><p>Xem lại, chỉnh sửa và khám phá ý nghĩa cùng AI.</p></div>
        {history.length > 0 && (
          <Button variant="outline"
            disabled={busy || !!editingId}
            onClick={() => remove()}
            style={{ ...button, background: "#ef4444", color: "white" }}
          >
            Xóa toàn bộ lịch sử
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" style={{ color: "#b91c1c" }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" style={{ color: "#15803d" }}>
          {notice}
        </p>
      )}
      {loading ? (
        <p>Đang tải...</p>
      ) : !history.length ? (
        <p>Chưa có lịch sử dịch nào.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {history.map((item) => {
            const editing = editingId === item._id;
            const edited =
              item.editedText != null ||
              item.documentBlocks?.some((block) => block.editedText != null);
            const content = item.editedText ?? item.translatedText;
            return (
              <article className="history-card"
                data-ai-scope
                key={item._id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: 16,
                  background: "white",
                  color: "#111827",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: "#6b7280",
                      overflowWrap: "anywhere",
                    }}
                  >
                    Thời gian: {formatDate(item.createdAt)} | Loại:{" "}
                    {item.type?.toUpperCase()}
                    {item.fileName && ` | File: ${item.fileName}`}
                  </span>
                  <Button variant="outline"
                    style={{ ...button, color: "#dc2626" }}
                    disabled={busy || !!editingId}
                    onClick={() => remove(item._id)}
                  >
                    Xóa
                  </Button>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div style={column}>
                    <strong>Gốc ({item.sourceLanguage}):</strong>
                    <FoldText
                      text={item.originalText}
                      field="originalText"
                      background="#f9fafb"
                    />
                  </div>
                  {typeof content === "string" && (
                    <div style={column}>
                      <strong>Bản dịch ({item.targetLanguage}):</strong>
                      {edited && (
                        <p
                          style={{
                            color: "#6366f1",
                            fontSize: "0.85rem",
                            margin: "6px 0",
                          }}
                        >
                          Đã chỉnh sửa
                          {item.editedAt
                            ? ` · ${formatDate(item.editedAt)}`
                            : ""}
                        </p>
                      )}
                      {editing ? (
                        <div style={{ marginTop: 8 }}>
                          <div
                            style={{
                              ...panel,
                              background: "#f3f4f6",
                              border: "1px solid #818cf8",
                              minHeight: 100,
                            }}
                          >
                            {draftBlocks.length ? (
                              draftBlocks.map((block, index) => (
                                <div
                                  key={block.id}
                                  style={{
                                    marginBottom:
                                      index < draftBlocks.length - 1
                                        ? "1em"
                                        : 0,
                                  }}
                                >
                                  <EditableText
                                    initialText={block.editedText}
                                    disabled={busy}
                                    label={`Chỉnh sửa bản dịch, đoạn ${index + 1}`}
                                    onChange={(value) =>
                                      setDraftBlocks((previous) =>
                                        previous.map((entry, position) =>
                                          position === index
                                            ? { ...entry, editedText: value }
                                            : entry,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              ))
                            ) : (
                              <EditableText
                                initialText={draft}
                                disabled={busy}
                                label="Chỉnh sửa bản dịch"
                                onChange={setDraft}
                              />
                            )}
                          </div>
                          <div
                            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
                          >
                            <Button variant="outline"
                              className="translation-action translation-action-primary"
                              disabled={busy}
                              onClick={() => save(item)}
                            >
                              <Save size={16} aria-hidden="true" />
                              {busy ? "Đang lưu..." : "Lưu thay đổi"}
                            </Button>
                            <Button variant="outline"
                              className="translation-action translation-action-outline"
                              disabled={busy}
                              onClick={() => {
                                setEditingId(null);
                                setError("");
                              }}
                            >
                              <X size={16} aria-hidden="true" />
                              Hủy
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <FoldText
                            key={item.__v ?? content}
                            text={content}
                            field="translatedText"
                            background="#f3f4f6"
                          />
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 8,
                              marginTop: 12,
                            }}
                          >
                            <Button variant="secondary"
                              className="translation-action translation-action-soft"
                              disabled={busy || !!editingId}
                              onClick={() => startEdit(item)}
                            >
                              <PencilLine size={16} aria-hidden="true" />
                              Chỉnh sửa
                            </Button>
                            {edited && (
                              <Button variant="outline"
                                className="translation-action translation-action-outline"
                                disabled={busy || !!editingId}
                                onClick={() => save(item, true)}
                              >
                                <RotateCcw size={16} aria-hidden="true" />
                                Khôi phục bản ban đầu
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {!editing && (
                  <TranslationAssistant
                    key={JSON.stringify([
                      item._id,
                      item.__v,
                      item.originalText,
                      content,
                    ])}
                    active={activeAssistantId === item._id}
                    onActivate={() => setActiveAssistantId(item._id)}
                    disabled={busy || !!editingId}
                    context={
                      typeof item.originalText === "string" &&
                      item.originalText.trim() &&
                      typeof content === "string" &&
                      content.trim()
                        ? {
                            originalText: item.originalText,
                            translatedText: content,
                            sourceLanguage: item.sourceLanguage || "auto",
                            targetLanguage: item.targetLanguage,
                          }
                        : null
                    }
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
