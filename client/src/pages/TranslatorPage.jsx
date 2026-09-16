import { useState } from "react";
import LanguageSelect from "../components/LanguageSelect";
import { languages, MAX_TEXT_LENGTH } from "../constants/languages";
import { submitTranslation } from "../services/translationApi";

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

  async function handleSubmit(event) {
    event.preventDefault();
    clearFeedback();

    if (!text.trim()) {
      setError("Vui lòng nhập văn bản cần dịch.");
      return;
    }

    if (sourceLanguage === targetLanguage) {
      setError("Vui lòng chọn ngôn ngữ đích khác ngôn ngữ nguồn.");
      return;
    }

    setLoading(true);

    try {
      const result = await submitTranslation({
        text,
        sourceLanguage,
        targetLanguage,
      });

      setTranslatedText(result.data.translatedText);
      setDetectedLanguage(result.data.detectedLanguage);
      setMessage(result.message);
    } catch (error) {
      setError(
        error instanceof TypeError
          ? "Không thể kết nối máy chủ. Vui lòng thử lại."
          : error.message,
      );
    } finally {
      setLoading(false);
    }
  }
  async function handleCopy() {
    setError("");
    setMessage("");

    try {
      await navigator.clipboard.writeText(translatedText);
      setMessage("Đã sao chép bản dịch.");
    } catch {
      setError(
        "Không thể sao chép tự động. Bạn có thể chọn bản dịch và nhấn Ctrl + C.",
      );
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#fefcff] relative">
      {/* Dreamy Sky Pink Glow */}
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
          <h1>AI Translator</h1>
          <p>Dịch văn bản đa ngôn ngữ với sự hỗ trợ của AI.</p>
        </header>

        <form onSubmit={handleSubmit}>
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
                disabled={loading}
                aria-describedby="text-count"
              />

              <div className="panel-footer">
                <span id="text-count">
                  {text.length}/{MAX_TEXT_LENGTH} ký tự
                </span>

                <button
                  type="button"
                  className="button-secondary"
                  disabled={loading || !text}
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

          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={loading}>
              {loading ? "Đang gửi..." : "Dịch"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default TranslatorPage;
