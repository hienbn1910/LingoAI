import { Button } from "../components/ui/button";
import { UploadCloud, Download } from "lucide-react";
import { useRef, useState } from "react";
import { languages } from "../constants/languages";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

function UploadFileTranslatorPage() {
  const fileInputRef = useRef(null);
  const translationInFlight = useRef(false);
  const downloadInFlight = useRef(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [documentTargetLanguage, setDocumentTargetLanguage] = useState("en");

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [documentTranslating, setDocumentTranslating] = useState(false);
  const [documentTranslated, setDocumentTranslated] = useState(false);

  // Chuỗi văn bản dùng để hiển thị.
  const [documentTranslationResult, setDocumentTranslationResult] =
    useState("");

  // Object chứa historyId, fileName, targetLanguage... dùng để tải file.
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const busy = documentTranslating || downloading;

  function resetTranslationResult() {
    setDocumentTranslated(false);
    setDocumentTranslationResult("");
    setDownloadInfo(null);
    setError("");
    setMessage("");
  }

  function validateDocument(file) {
    if (!file) return false;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension !== "docx" && extension !== "pdf") {
      setError("Tệp không hợp lệ. Chỉ hỗ trợ định dạng DOCX hoặc PDF.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        `Tệp vượt quá dung lượng cho phép (${
          MAX_FILE_SIZE / (1024 * 1024)
        }MB).`,
      );
      return false;
    }

    if (file.size === 0) {
      setError("Tệp đang trống. Vui lòng chọn tài liệu khác.");
      return false;
    }

    return true;
  }

  function handleDocumentSelect(file) {
    if (
      translationInFlight.current ||
      downloadInFlight.current ||
      !validateDocument(file)
    ) {
      return;
    }

    resetTranslationResult();
    setSelectedFile(file);
    setUploadProgress(0);
    setUploading(false);

    // Giữ state này để hiện hàng chọn ngôn ngữ và nút dịch.
    // File chỉ thực sự được gửi khi bấm Bắt đầu dịch.
    setUploaded(true);
    setMessage("Đã chọn tài liệu. Bấm Bắt đầu dịch để gửi file.");
  }

  function handleFileChange(event) {
    handleDocumentSelect(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setDragOver(false);

    if (busy) return;

    handleDocumentSelect(event.dataTransfer.files?.[0]);
  }

  function handleRemoveFile(event) {
    event.stopPropagation();

    if (busy) return;

    resetTranslationResult();
    setSelectedFile(null);
    setUploadProgress(0);
    setUploading(false);
    setUploaded(false);
    setDragOver(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleLanguageChange(event) {
    if (busy) return;

    setDocumentTargetLanguage(event.target.value);
    resetTranslationResult();
  }

  async function handleStartDocumentTranslation() {
    if (
      !selectedFile ||
      !uploaded ||
      translationInFlight.current ||
      downloadInFlight.current
    ) {
      return;
    }

    translationInFlight.current = true;

    const file = selectedFile;
    const targetLanguage = documentTargetLanguage;

    resetTranslationResult();
    setDocumentTranslating(true);
    setUploading(true);
    setUploadProgress(0);
    setMessage("Đang gửi tài liệu lên server...");

    try {
      const formData = new FormData();

      formData.append("file", file);
      formData.append("sourceLanguage", "auto");
      formData.append("targetLanguage", targetLanguage);

      // Theo dõi tiến độ gửi file thực tế.
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", "/api/translations/document");
        xhr.timeout = 300_000;

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        xhr.upload.onload = () => {
          setUploading(false);
          setUploadProgress(100);
          setMessage("Đã gửi file. Đang xử lý và dịch tài liệu...");
        };

        xhr.onload = () => {
          let data;

          try {
            data = JSON.parse(xhr.responseText);
          } catch {
            reject(new Error("Backend trả về dữ liệu không hợp lệ."));
            return;
          }

          if (xhr.status < 200 || xhr.status >= 300 || data.success === false) {
            reject(new Error(data.message || "Không thể dịch tài liệu."));
            return;
          }

          resolve(data);
        };

        xhr.onerror = () => {
          reject(new Error("Không kết nối được backend. Kiểm tra server."));
        };

        xhr.ontimeout = () => {
          reject(
            new Error(
              "Hết thời gian chờ. Backend có thể vẫn đang xử lý; hãy kiểm tra lịch sử trước khi dịch lại.",
            ),
          );
        };

        xhr.onabort = () => {
          reject(new Error("Yêu cầu dịch đã bị hủy."));
        };

        xhr.send(formData);
      });

      const data = result.data;

      if (!data || typeof data.translatedText !== "string") {
        throw new Error("Backend không trả về nội dung bản dịch hợp lệ.");
      }

      setDocumentTranslationResult(data.translatedText);
      setDownloadInfo({
        ...data,
        fileName: data.fileName || file.name,
        targetLanguage: data.targetLanguage || targetLanguage,
      });

      setDocumentTranslated(true);
      setUploadProgress(100);
      setMessage(`Tài liệu "${file.name}" đã được dịch thành công.`);

      if (!data.historyId) {
        setError(
          "Đã dịch xong nhưng backend không trả về historyId nên chưa thể tải file. Kiểm tra phản hồi trong documentController.js.",
        );
      }
    } catch (error) {
      setError(error.message || "Không thể dịch tài liệu.");
      setMessage("");
    } finally {
      translationInFlight.current = false;
      setUploading(false);
      setDocumentTranslating(false);
    }
  }

  async function handleDownloadTranslation() {
    if (
      !downloadInfo?.historyId ||
      downloadInFlight.current ||
      translationInFlight.current
    ) {
      return;
    }

    downloadInFlight.current = true;
    setDownloading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/translations/document/${encodeURIComponent(
          downloadInfo.historyId,
        )}/download`,
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));

        throw new Error(
          data.message || `Không tải được bản dịch (${response.status}).`,
        );
      }

      const contentType = (response.headers.get("content-type") || "")
        .split(";")[0]
        .trim()
        .toLowerCase();

      let extension;

      if (contentType === "application/pdf") {
        extension = ".pdf";
      } else if (
        contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        extension = ".docx";
      } else {
        throw new Error("Backend không trả về file PDF hoặc DOCX hợp lệ.");
      }

      const originalName = downloadInfo.fileName;

      if (!originalName) {
        throw new Error("Kết quả dịch thiếu tên file gốc.");
      }

      const matchedExtension = originalName.match(/\.(pdf|docx)$/i);
      const expectedExtension = matchedExtension
        ? matchedExtension[0].toLowerCase()
        : null;

      if (extension !== expectedExtension) {
        throw new Error(
          "Backend đang xuất sai định dạng. Kiểm tra hàm downloadDocument: file PDF phải được xuất thành PDF.",
        );
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("Backend trả về file rỗng.");
      }

      if (extension === ".pdf" && (await blob.slice(0, 5).text()) !== "%PDF-") {
        throw new Error("Nội dung nhận được không phải file PDF thực sự.");
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        originalName.replace(/\.[^.]+$/, "") + "-translated" + extension;

      document.body.appendChild(link);

      try {
        link.click();
      } finally {
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    } catch (error) {
      setError(error.message || "Không tải được bản dịch.");
    } finally {
      downloadInFlight.current = false;
      setDownloading(false);
    }
  }

  return (
    <div className="page-surface">
      <main className="translator" style={{ position: "relative" }}>
        <header className="page-header">
          <span className="eyebrow">TÀI LIỆU, THÊM MỘT NGÔN NGỮ</span><h1>Mở rộng thế giới tài liệu.</h1>
          <p>Tải lên file DOCX hoặc PDF để dịch sang ngôn ngữ mong muốn.</p>
        </header>

        <section className="document-upload-section">
          <Button variant="default"
            type="button"
            className="button-primary upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <UploadCloud size={17}/>{uploading ? "Đang tải lên..." : "Chọn tài liệu"}
          </Button>

          <div
            className={`upload-dropzone ${
              dragOver ? "drag-over" : ""
            } ${selectedFile ? "has-file" : ""}`}
            onClick={() => {
              if (!busy) fileInputRef.current?.click();
            }}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || busy) return;

              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={busy ? -1 : 0}
            aria-disabled={busy}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf"
              onChange={handleFileChange}
              onClick={(event) => event.stopPropagation()}
              disabled={busy}
              hidden
            />

            {!selectedFile ? (
              <>
                <div className="upload-icon" aria-hidden="true">
                  <UploadCloud size={34}/>
                </div>

                <p className="upload-hint">
                  Kéo thả file vào đây hoặc nhấn để chọn tài liệu
                </p>

                <span className="upload-format">Hỗ trợ DOCX, PDF</span>
              </>
            ) : (
              <div className="file-preview">
                <div className="file-header">
                  <div className="file-info">
                    <div className="file-name-wrap">
                      <strong>{selectedFile.name}</strong>
                    </div>

                    <div className="file-meta-row">
                      <span>
                        {selectedFile.name.split(".").pop()?.toUpperCase() ||
                          "FILE"}
                      </span>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                  </div>

                  <div className="file-actions">
                    <Button variant="outline"
                      type="button"
                      className="button-secondary small-button"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Thay đổi
                    </Button>

                    <Button variant="outline"
                      type="button"
                      className="button-secondary small-button"
                      disabled={busy}
                      onClick={handleRemoveFile}
                    >
                      Xóa
                    </Button>
                  </div>
                </div>

                <div className="upload-status-row">
                  <span>
                    {uploading
                      ? "Đang gửi file..."
                      : uploadProgress === 100
                        ? "Đã gửi file lên server"
                        : "Đã chọn tài liệu"}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>

                <div
                  className="progress-bar"
                  role="progressbar"
                  aria-label="Tiến độ gửi tài liệu"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={uploadProgress}
                >
                  <span style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}
          </div>

          {uploaded && (
            <div className="document-action-row">
              <div className="document-language-picker">
                <label htmlFor="document-target-language">Ngôn ngữ đích</label>

                <select
                  id="document-target-language"
                  value={documentTargetLanguage}
                  onChange={handleLanguageChange}
                  disabled={busy}
                >
                  {languages
                    .filter((language) => language.code !== "auto")
                    .map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.name}
                      </option>
                    ))}
                </select>
              </div>

              <Button variant="outline"
                type="button"
                className="button-primary start-button"
                onClick={handleStartDocumentTranslation}
                disabled={busy}
              >
                {documentTranslating
                  ? "Đang dịch tài liệu..."
                  : documentTranslated
                    ? "Dịch lại tài liệu"
                    : "Bắt đầu dịch"}
              </Button>
            </div>
          )}

          {documentTranslated && (
            <div className="document-result-panel">
              <div className="document-result-header">
                <h3>Kết quả dịch</h3>
                <span>
                  {downloadInfo?.fileName || selectedFile?.name || "Tài liệu"}
                </span>
              </div>

              <textarea
                className="document-result-text"
                value={documentTranslationResult}
                aria-label="Nội dung bản dịch tài liệu"
                readOnly
              />

              <Button variant="outline"
                type="button"
                className="button-primary"
                onClick={handleDownloadTranslation}
                disabled={downloading || !downloadInfo?.historyId}
              >
                <Download size={17}/>{downloading ? "Đang tạo file..." : "Tải tài liệu đã dịch"}
              </Button>
            </div>
          )}
        </section>

        {error && (
          <p className="feedback error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="feedback success" role="status">
            {message}
          </p>
        )}
      </main>
    </div>
  );
}

export default UploadFileTranslatorPage;
