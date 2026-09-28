import { useEffect, useRef, useState } from "react";

const panel = { padding: 12, borderRadius: 6, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "0.95rem" };
const column = { flex: "1 1 300px", minWidth: 0 };
const button = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", color: "#374151", cursor: "pointer" };
const formatDate = (value) => new Date(value).toLocaleString("vi-VN");

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.success === false) {
    throw new Error(data?.message || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
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
    <div ref={element} contentEditable={disabled ? false : "plaintext-only"}
      suppressContentEditableWarning role="textbox" aria-label={label}
      aria-multiline="true" aria-readonly={disabled} tabIndex={disabled ? -1 : 0}
      style={{ outline: "none", minHeight: "1.5em", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
      onInput={(event) => onChange(event.currentTarget.innerText)} />
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

  useEffect(() => {
    let active = true;
    request("/api/history")
      .then((data) => { if (active) setHistory(data.data || []); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  // Cảnh báo nếu rời trang bằng reload/đóng tab trong lúc đang sửa.
  useEffect(() => {
    if (!editingId) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editingId]);

  function startEdit(item) {
    setEditingId(item._id);
    setDraft(item.editedText ?? item.translatedText ?? "");
    setDraftBlocks((item.documentBlocks || []).map((block) => ({
      id: block.id, editedText: block.editedText ?? block.translatedText ?? "",
    })));
    setError(""); setNotice("");
  }

  async function save(item, restore = false) {
    if (restore && !window.confirm("Khôi phục bản dịch AI ban đầu? Phần chỉnh sửa đã lưu sẽ bị bỏ.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await request(`/api/history/${item._id}/${restore ? "restore" : "content"}`, {
        method: restore ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: item.__v ?? 0,
          ...(!restore && (item.documentBlocks?.length ? { blocks: draftBlocks } : { editedText: draft })),
        }),
      });
      setHistory((previous) => previous.map((entry) => entry._id === item._id ? data.data : entry));
      setEditingId(null);
      setNotice(restore ? "Đã khôi phục bản dịch AI ban đầu." : "Đã lưu bản dịch chỉnh sửa.");
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function remove(id) {
    if (!window.confirm(id ? "Xóa bản dịch này?" : "Xóa toàn bộ lịch sử?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await request(id ? `/api/history/${id}` : "/api/history", { method: "DELETE" });
      setHistory((previous) => id ? previous.filter((item) => item._id !== id) : []);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <h2>Lịch sử dịch</h2>
        {history.length > 0 && <button disabled={busy || !!editingId} onClick={() => remove()}
          style={{ ...button, background: "#ef4444", color: "white" }}>Xóa toàn bộ lịch sử</button>}
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {notice && <p role="status" style={{ color: "#15803d" }}>{notice}</p>}
      {loading ? <p>Đang tải...</p> : !history.length ? <p>Chưa có lịch sử dịch nào.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {history.map((item) => {
            const editing = editingId === item._id;
            const edited = item.editedText != null || item.documentBlocks?.some((block) => block.editedText != null);
            const content = item.editedText ?? item.translatedText;
            return (
              <article key={item._id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "white", color: "#111827", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: "0.85rem", color: "#6b7280", overflowWrap: "anywhere" }}>
                    Thời gian: {formatDate(item.createdAt)} | Loại: {item.type?.toUpperCase()}
                    {item.fileName && ` | File: ${item.fileName}`}
                  </span>
                  <button style={{ ...button, color: "#dc2626" }} disabled={busy || !!editingId} onClick={() => remove(item._id)}>Xóa</button>
                </div>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <div style={column}>
                    <strong>Gốc ({item.sourceLanguage}):</strong>
                    <div style={{ ...panel, marginTop: 4, background: "#f9fafb" }}>{item.originalText}</div>
                  </div>
                  {typeof content === "string" && (
                    <div style={column}>
                      <strong>Bản dịch ({item.targetLanguage}):</strong>
                      {edited && <p style={{ color: "#6366f1", fontSize: "0.85rem", margin: "6px 0" }}>Đã chỉnh sửa{item.editedAt ? ` · ${formatDate(item.editedAt)}` : ""}</p>}
                      {editing ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ ...panel, background: "#f3f4f6", border: "1px solid #818cf8", minHeight: 100 }}>
                            {draftBlocks.length ? draftBlocks.map((block, index) => (
                              <div key={block.id} style={{ marginBottom: index < draftBlocks.length - 1 ? "1em" : 0 }}>
                                <EditableText initialText={block.editedText} disabled={busy}
                                  label={`Chỉnh sửa bản dịch, đoạn ${index + 1}`}
                                  onChange={(value) => setDraftBlocks((previous) => previous.map((entry, position) =>
                                    position === index ? { ...entry, editedText: value } : entry))} />
                              </div>
                            )) : <EditableText initialText={draft} disabled={busy} label="Chỉnh sửa bản dịch" onChange={setDraft} />}
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button style={{ ...button, background: "#4f46e5", color: "white" }} disabled={busy} onClick={() => save(item)}>{busy ? "Đang lưu..." : "Lưu thay đổi"}</button>
                            <button style={button} disabled={busy} onClick={() => { setEditingId(null); setError(""); }}>Hủy</button>
                          </div>
                        </div>
                      ) : <>
                        <div style={{ ...panel, marginTop: 4, background: "#f3f4f6" }}>{content}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                          <button style={button} disabled={busy || !!editingId} onClick={() => startEdit(item)}>Chỉnh sửa</button>
                          {edited && <button style={button} disabled={busy || !!editingId} onClick={() => save(item, true)}>Khôi phục bản ban đầu</button>}
                        </div>
                      </>}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
