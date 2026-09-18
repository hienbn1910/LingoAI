import { useState } from "react";
import LanguageSelect from "../components/LanguageSelect";
import ImageTranslator from "../components/ImageTranslator";
import { languages } from "../constants/languages";
import { submitTranslation } from "../services/translationApi";
import { submitImageOCR } from "../services/ocrApi";

function ImageTranslatorPage() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("vi");
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

    if (!selectedImage) {
      setError("Vui lòng chọn hoặc tải lên một hình ảnh.");
      return;
    }

    setLoading(true);

    try {
      setMessage("Đang quét chữ từ hình ảnh (OCR)...");
      const ocrResult = await submitImageOCR(selectedImage);
      const extractedText =
        ocrResult.data?.extractedText || ocrResult.extractedText;

      if (!extractedText) {
        throw new Error("Không thể trích xuất văn bản từ hình ảnh này.");
      }

      setMessage("Đang dịch văn bản...");
      const result = await submitTranslation({
        text: extractedText,
        sourceLanguage,
        targetLanguage,
      });

      setTranslatedText(result.data.translatedText);
      setDetectedLanguage(result.data.detectedLanguage);
      setMessage("Dịch ảnh thành công!");
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
          <h1>AI Image Translator</h1>
          <p>
            Trích xuất và dịch văn bản từ hình ảnh tự động với sự hỗ trợ của AI.
          </p>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="translation-grid">
            {/* Cột trái: Ngôn ngữ nguồn (Tự nhận diện) + Chọn ảnh */}
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

              <ImageTranslator
                selectedImage={selectedImage}
                onImageSelect={(file) => {
                  setSelectedImage(file);
                  clearFeedback();
                  setMessage(`Đã chọn tệp: ${file.name}`);
                }}
                onClearImage={() => {
                  setSelectedImage(null);
                  clearFeedback();
                }}
              />
            </section>

            {/* Cột phải: Ngôn ngữ đích + Kết quả dịch */}
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
                placeholder="Bản dịch từ hình ảnh sẽ xuất hiện tại đây."
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
                  Ngôn ngữ nhận diện:{" "}
                  {languages.find((lang) => lang.code === detectedLanguage)
                    ?.name || detectedLanguage}
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
              {loading ? "Đang xử lý..." : "Dịch ảnh"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default ImageTranslatorPage;
