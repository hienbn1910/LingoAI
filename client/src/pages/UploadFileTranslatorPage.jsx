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

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function UploadFileTranslatorPage() {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [documentTargetLanguage, setDocumentTargetLanguage] = useState("en");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [documentTranslating, setDocumentTranslating] = useState(false);
  const [documentTranslated, setDocumentTranslated] = useState(false);
  const [documentTranslationResult, setDocumentTranslationResult] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function validateDocument(file) {
    if (!file) return false;

    const extension = file.name.split(".").pop()?.toLowerCase();
    const validType = extension === "docx" || extension === "pdf";

    if (!validType) {
      setError("Tệp không hợp lệ. Chỉ hỗ trợ định dạng DOCX hoặc PDF.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`Tệp vượt quá dung lượng cho phép (${MAX_FILE_SIZE / (1024 * 1024)}MB).`);
      return false;
    }

    return true;
  }

  function handleDocumentSelect(file) {
    if (!file || !validateDocument(file)) {
      return;
    }

    setSelectedFile(file);
    setUploaded(false);
    setDocumentTranslating(false);
    setDocumentTranslated(false);
    setDocumentTranslationResult("");
    setUploadProgress(0);
    setUploading(true);
    setError("");
    setMessage("");

    let progress = 0;
    const timer = setInterval(() => {
      progress += 18;

      if (progress >= 100) {
        clearInterval(timer);
        setUploadProgress(100);
        setUploading(false);
        setUploaded(true);
        setMessage("Tải lên tài liệu thành công. Bạn có thể bắt đầu dịch.");
        return;
      }

      setUploadProgress(progress);
    }, 180);

    return () => clearInterval(timer);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    handleDocumentSelect(file);
    event.target.value = "";
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    handleDocumentSelect(file);
  }

  function handleRemoveFile(event) {
    event.stopPropagation();
    setSelectedFile(null);
    setUploadProgress(0);
    setUploading(false);
    setUploaded(false);
    setDocumentTranslating(false);
    setDocumentTranslated(false);
    setDocumentTranslationResult("");
    setError("");
    setMessage("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleStartDocumentTranslation() {
    if (!selectedFile || !uploaded || documentTranslating) {
      return;
    }

    setDocumentTranslating(true);
    setDocumentTranslated(false);
    setDocumentTranslationResult("");
    setError("");
    setMessage("Đang dịch tài liệu, vui lòng chờ...");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("sourceLanguage", "auto");
      formData.append("targetLanguage", documentTargetLanguage);

      const response = await fetch("/api/translations/document", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Không thể dịch tài liệu.");
      }

      setDocumentTranslating(false);
      setDocumentTranslated(true);
      setDocumentTranslationResult(result.data?.translatedText || "");
      setMessage(`Tài liệu "${selectedFile.name}" đã được dịch thành công.`);
    } catch (error) {
      setDocumentTranslating(false);
      setError(error.message || "Không thể dịch tài liệu.");
      setMessage("");
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#fefcff] relative">
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
        radial-gradient(circle at 30% 70%, rgba(173, 216, 230, 0.35), transparent 60%),
        radial-gradient(circle at 70% 30%, rgba(255, 182, 193, 0.4), transparent 60%)`,
        }}
      />

      <main className="translator">
        <header className="page-header">
          <h1>Dịch tài liệu</h1>
          <p>Tải lên file DOCX hoặc PDF để dịch sang ngôn ngữ mong muốn.</p>
        </header>

        <section className="document-upload-section">
          <button
            type="button"
            className="button-primary upload-trigger"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Đang tải lên..." : "Tải tài liệu lên để dịch"}
          </button>

          <div
            className={`upload-dropzone ${dragOver ? "drag-over" : ""} ${selectedFile ? "has-file" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.pdf"
              onChange={handleFileChange}
              hidden
            />

            {!selectedFile ? (
              <>
                <div className="upload-icon" aria-hidden="true">
                  📄
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
                      <span>{selectedFile.name.split(".").pop()?.toUpperCase() || "FILE"}</span>
                      <span>{formatFileSize(selectedFile.size)}</span>
                    </div>
                  </div>

                  <div className="file-actions">
                    <button
                      type="button"
                      className="button-secondary small-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Thay đổi
                    </button>
                    <button
                      type="button"
                      className="button-secondary small-button"
                      onClick={handleRemoveFile}
                    >
                      Xóa
                    </button>
                  </div>
                </div>

                <div className="upload-status-row">
                  <span>
                    {uploading
                      ? "Đang tải lên..."
                      : uploaded
                        ? "Tải lên thành công"
                        : "Chưa tải lên"}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>

                <div className="progress-bar" aria-label="Tiến độ upload">
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
                  onChange={(event) => setDocumentTargetLanguage(event.target.value)}
                  disabled={documentTranslating}
                >
                  {languages.map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="button-primary start-button"
                onClick={handleStartDocumentTranslation}
                disabled={documentTranslating}
              >
                {documentTranslating ? "Đang dịch tài liệu..." : documentTranslated ? "Đã dịch xong" : "Bắt đầu dịch"}
              </button>
            </div>
          )}

          {documentTranslated && documentTranslationResult && (
            <div className="document-result-panel">
              <div className="document-result-header">
                <h3>Kết quả dịch</h3>
                <span>{selectedFile?.name || "Tài liệu"}</span>
              </div>

              <textarea
                className="document-result-text"
                value={documentTranslationResult}
                readOnly
              />
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
