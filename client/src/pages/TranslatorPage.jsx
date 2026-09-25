import { useEffect, useRef, useState, useCallback } from "react";
import LanguageSelect from "../components/LanguageSelect";
import { languages, MAX_TEXT_LENGTH } from "../constants/languages";
import { submitTranslation } from "../services/translationApi";
import { useSpeech } from "../hooks/useSpeech";

function TranslatorPage() {
  const [text, setText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedLanguage, setDetectedLanguage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function clearFeedback() {
    setError("");
    setMessage("");
    setTranslatedText("");
    setDetectedLanguage("");
  }

  const handleSpeechResult = useCallback((spokenText) => {
    setText(spokenText);
    clearFeedback();
  }, []);

  const { isListening, isSpeaking, toggleListening, speak } = useSpeech({
    onTranscript: handleSpeechResult,
    sourceLanguage: sourceLanguage,
  });
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
      formData.append("sourceLanguage", sourceLanguage);
      formData.append("targetLanguage", documentTargetLanguage || targetLanguage);

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
      setDocumentTranslationResult(result.data.translatedText || "");
      setMessage(`Tài liệu "${selectedFile.name}" đã được dịch thành công.`);
    } catch (error) {
      setDocumentTranslating(false);
      setError(error.message || "Không thể dịch tài liệu.");
      setMessage("");
    }
  }


  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setMessage("");
    setTranslatedText("");
    setDetectedLanguage("");
    setLoading(false);

    if (!text.trim()) {
      return;
    }

    if (text.length > MAX_TEXT_LENGTH) {
      setError(`Văn bản không được vượt quá ${MAX_TEXT_LENGTH} ký tự.`);
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setTranslatedText(text);
      setDetectedLanguage(sourceLanguage);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);

      try {
        const result = await submitTranslation(
          {
            text,
            sourceLanguage,
            targetLanguage,
          },
          {
            signal: controller.signal,
          },
        );

        if (!active) return;

        setTranslatedText(result.data.translatedText);
        setDetectedLanguage(result.data.detectedLanguage);
      } catch (error) {
        if (!active || error.name === "AbortError") return;

        setError(
          error instanceof TypeError
            ? "Không thể kết nối máy chủ. Vui lòng thử lại."
            : error.message,
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }

    }, 1500);


    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, sourceLanguage, targetLanguage]);

  async function handleCopy() {
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(translatedText);
      setMessage("Đã sao chép bản dịch.");
    } catch {
      setError("Lỗi khi sao chép!");
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
          <h1>LingoAI</h1>
          <p>Dịch văn bản đa ngôn ngữ với sự hỗ trợ của AI.</p>
        </header>

        <form onSubmit={(event) => event.preventDefault()}>
          <div className="translation-grid">
            <section className="translation-panel">
              <LanguageSelect
                id="source-language"
                label="Ngôn ngữ nguồn"
                value={sourceLanguage}
                onChange={(value) => {
                  setSourceLanguage(value);
                  clearFeedback();
                }}
                allowAuto
                disabled={loading}
              />

              <label htmlFor="source-text">Văn bản cần dịch</label>

              <textarea
                id="source-text"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  clearFeedback();
                }}
                maxLength={MAX_TEXT_LENGTH}
                placeholder="Nhập hoặc dán văn bản vào đây..."
                aria-describedby="text-count"
              />

              <div className="panel-footer">
                <span id="text-count">
                  {text.length}/{MAX_TEXT_LENGTH} ký tự
                </span>

                <button
                  type="button"
                  className="button-secondary"

                  onClick={toggleListening}
                  title="Nói qua micro"
                >
                  {isListening ? "🔴 Đang nghe..." : "🎤 Nói"}
                </button>

                <button
                  type="button"
                  className="button-secondary"

                  disabled={!text}
                  onClick={() => {
                    setText("");
                    clearFeedback();
                  }}
                >
                  Xóa
                </button>
              </div>
            </section>

            <section className="translation-panel">
              <LanguageSelect
                id="target-language"
                label="Ngôn ngữ đích"
                value={targetLanguage}
                onChange={(value) => {
                  setTargetLanguage(value);
                  clearFeedback();
                }}
                disabled={loading}
              />

              <label htmlFor="translated-text">Bản dịch</label>

              <textarea
                id="translated-text"
                value={translatedText}
                readOnly
                placeholder="Bản dịch sẽ xuất hiện tại đây."
              />

              <div className="panel-footer">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => speak(translatedText, targetLanguage)}
                  disabled={loading || !translatedText || isSpeaking}
                  title="Nghe phát âm"
                >
                  {isSpeaking ? "🔊 Đang đọc..." : "🔊 Nghe"}
                </button>

                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleCopy}
                  disabled={loading || !translatedText}
                >
                  Sao chép
                </button>
              </div>

              {detectedLanguage && (
                <p className="development-note">
                  {sourceLanguage === "auto"
                    ? "Ngôn ngữ được phát hiện: "
                    : "Ngôn ngữ nguồn: "}

                  {languages.find(
                    (language) => language.code === detectedLanguage,
                  )?.name || detectedLanguage}
                </p>
              )}
            </section>
          </div>

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

          <p className="development-note" role="status">
            {loading}
          </p>
        </form>
      </main>
    </div>
  );
}

export default TranslatorPage;