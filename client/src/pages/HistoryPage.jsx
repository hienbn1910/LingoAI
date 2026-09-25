import { useEffect, useState } from "react";

function HistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5001/api/history");
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải lịch sử:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const clearAllHistory = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử?")) return;
    try {
      const res = await fetch("http://localhost:5001/api/history", {
        method: "DELETE",
      });
      if (res.ok) {
        setHistory([]);
      }
    } catch (error) {
      console.error("Lỗi khi xóa lịch sử:", error);
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bản dịch này?")) return;
    try {
      const res = await fetch(`http://localhost:5001/api/history/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item._id !== id));
      }
    } catch (error) {
      console.error("Lỗi khi xóa bản dịch:", error);
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    return d.toLocaleString("vi-VN");
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h2>Lịch sử dịch</h2>
        {history.length > 0 && (
          <button
            onClick={clearAllHistory}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Xóa toàn bộ lịch sử
          </button>
        )}
      </div>

      {loading ? (
        <p>Đang tải...</p>
      ) : history.length === 0 ? (
        <p>Chưa có lịch sử dịch nào.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {history.map((item) => (
            <div
              key={item._id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                padding: "16px",
                backgroundColor: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                  Thời gian: {formatDate(item.createdAt)} | Loại: {item.type.toUpperCase()}
                  {item.fileName && ` | File: ${item.fileName}`}
                </span>
                <button
                  onClick={() => deleteItem(item._id)}
                  style={{
                    backgroundColor: "transparent",
                    color: "#ef4444",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.85rem",
                  }}
                >
                  Xóa
                </button>
              </div>

              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "300px" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#374151" }}>
                    Gốc ({item.sourceLanguage}):
                  </div>
                  <div
                    style={{
                      padding: "12px",
                      backgroundColor: "#f9fafb",
                      borderRadius: "6px",
                      whiteSpace: "pre-wrap",
                      fontSize: "0.95rem",
                    }}
                  >
                    {item.originalText}
                  </div>
                </div>

                {item.translatedText && (
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#374151" }}>
                      Bản dịch ({item.targetLanguage}):
                    </div>
                    <div
                      style={{
                        padding: "12px",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "6px",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.95rem",
                      }}
                    >
                      {item.translatedText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HistoryPage;
