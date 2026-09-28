export async function downloadTranslatedDocument(info) {
  if (!info?.historyId) throw new Error("Chưa có bản dịch để tải.");
  const response = await fetch(
    `/api/translations/document/${encodeURIComponent(info.historyId)}/download`,
  );
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Không tải được bản dịch.");
  }
  const mime = response.headers.get("content-type")?.split(";")[0].trim();
  const extension =
    mime === "application/pdf"
      ? ".pdf"
      : mime ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? ".docx"
        : null;
  if (!extension) throw new Error("Server không trả về PDF hoặc DOCX hợp lệ.");
  const expected = /\.pdf$/i.test(info.fileName || "") ? ".pdf" : ".docx";
  if (extension !== expected)
    throw new Error(
      "Backend vẫn xuất sai loại file. Kiểm tra hàm downloadDocument.",
    );
  const blob = await response.blob();
  if (extension === ".pdf" && (await blob.slice(0, 5).text()) !== "%PDF-") {
    throw new Error("Dữ liệu nhận được không phải file PDF thực sự.");
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    (info.fileName || "document").replace(/\.[^.]+$/, "") +
    "-translated" +
    extension;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
