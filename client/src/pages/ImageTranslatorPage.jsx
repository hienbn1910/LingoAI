import { useState, useEffect } from "react";
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

  // Hàm xử lý tự động OCR và Dịch ảnh
  async function processImageTranslation(
    fileToProcess,
    srcLang = sourceLanguage,
    tgtLang = targetLanguage,
  ) {
    if (!fileToProcess) {
      setError("Vui lòng chọn hoặc tải lên một hình ảnh.");
      return;
    }

    clearFeedback();
    setLoading(true);

    try {
      setMessage("Đang quét chữ từ hình ảnh (OCR)...");
      const ocrResult = await submitImageOCR(fileToProcess);
      const extractedText =
        ocrResult.data?.extractedText || ocrResult.extractedText;

      if (!extractedText) {
        throw new Error("Không thể trích xuất văn bản từ hình ảnh này.");
      }

      setMessage("Đang dịch văn bản...");
      const result = await submitTranslation({
        text: extractedText,
        sourceLanguage: srcLang,
        targetLanguage: tgtLang,
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

  // 1. Xử lý khi nhấn nút "Dán từ bộ nhớ tạm"
  async function handlePasteClipboard() {
    try {
      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], "clipboard-image.png", {
            type: imageType,
          });
          setSelectedImage(file);
          processImageTranslation(file, sourceLanguage, targetLanguage);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        setError("Không tìm thấy hình ảnh nào trong bộ nhớ tạm.");
      }
    } catch (err) {
      console.error("Lỗi đọc clipboard:", err);
      setError(
        "Không thể tự động đọc bộ nhớ tạm. Bạn có thể nhấn tổ hợp phím Ctrl + V để dán.",
      );
    }
  }

  // 2. Tự động lắng nghe sự kiện nhấn Ctrl + V toàn trang
  useEffect(() => {
    function handleGlobalPaste(e) {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setSelectedImage(file);
            processImageTranslation(file, sourceLanguage, targetLanguage);
            break;
          }
        }
      }
    }

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [sourceLanguage, targetLanguage]);

  function handleSubmit(event) {
    if (event) event.preventDefault();
    processImageTranslation(selectedImage);
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
            <section className="translation-panel">
              <LanguageSelect
                id="source-language"
                label="Ngôn ngữ nguồn"
                value={sourceLanguage}
                onChange={(value) => {
                  setSourceLanguage(value);
                  if (selectedImage) {
                    processImageTranslation(
                      selectedImage,
                      value,
                      targetLanguage,
                    );
                  }
                }}
                allowAuto
                disabled={loading}
              />

              <ImageTranslator
                selectedImage={selectedImage}
                onImageSelect={(file) => {
                  setSelectedImage(file);
                  processImageTranslation(file, sourceLanguage, targetLanguage);
                }}
                onClearImage={() => {
                  setSelectedImage(null);
                  clearFeedback();
                }}
                onPasteClipboard={handlePasteClipboard}
              />
            </section>

            <section className="translation-panel">
              <LanguageSelect
                id="target-language"
                label="Ngôn ngữ đích"
                value={targetLanguage}
                onChange={(value) => {
                  setTargetLanguage(value);
                  if (selectedImage) {
                    processImageTranslation(
                      selectedImage,
                      sourceLanguage,
                      value,
                    );
                  }
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
            <button
              type="submit"
              className="button-primary"
              disabled={loading || !selectedImage}
            >
              {loading ? "Đang xử lý..." : "Dịch ảnh"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default ImageTranslatorPage;
