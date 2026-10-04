import { Button } from "../components/ui/button";
import { Copy, Mic, Volume2, X, Sparkles } from "lucide-react";
import TranslationAssistant from "../components/TranslationAssistant";
import { useEffect, useState, useCallback } from "react";
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

  const [translatedContext, setTranslatedContext] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function clearFeedback() {
    setError("");
    setMessage("");
    setTranslatedText("");
    setTranslatedContext(null);
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
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setError("");
    setMessage("");
    setTranslatedText("");
    setTranslatedContext(null);
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
      setTranslatedContext({
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        requestedSource: sourceLanguage,
      });
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
        setTranslatedContext({
          originalText: text,
          translatedText: result.data.translatedText,
          sourceLanguage: result.data.detectedLanguage || sourceLanguage,
          targetLanguage,
          requestedSource: sourceLanguage,
        });
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

  const explanationContext =
    !loading &&
    translatedContext &&
    translatedContext.originalText === text &&
    translatedContext.requestedSource === sourceLanguage &&
    translatedContext.targetLanguage === targetLanguage &&
    translatedContext.translatedText === translatedText &&
    translatedText.trim()
      ? {
          originalText: text,
          translatedText,
          sourceLanguage: translatedContext.sourceLanguage,
          targetLanguage,
        }
      : null;

  return (
    <div className="page-surface">
      <main className="translator" style={{ position: "relative" }}>
        <header className="page-header">
          <span className="eyebrow">TỪ NGỮ KHÔNG BIÊN GIỚI</span><h1>Bạn muốn dịch gì hôm nay?</h1>
          <p>Diễn đạt tự nhiên. Thấu hiểu ngữ cảnh. Kết nối mọi ngôn ngữ.</p>
        </header>

        <div className="workspace-hint"><span><Sparkles size={15}/> Dịch tự động khi bạn ngừng nhập</span><span>Văn bản · Đa ngôn ngữ</span></div>
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
                data-ai-field="originalText"
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

                <Button variant="outline"
                  type="button"
                  className="button-secondary"
                  onClick={toggleListening}
                  title="Nói qua micro"
                >
                  <Mic size={16}/>{isListening ? "Đang nghe..." : "Nói"}
                </Button>

                <Button variant="outline"
                  type="button"
                  className="button-secondary"
                  disabled={!text}
                  onClick={() => {
                    setText("");
                    clearFeedback();
                  }}
                >
                  <X size={16}/> Xóa
                </Button>
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
                data-ai-field="translatedText"
                id="translated-text"
                value={translatedText}
                readOnly
                placeholder="Bản dịch sẽ xuất hiện tại đây."
              />

              <div className="panel-footer">
                <Button variant="outline"
                  type="button"
                  className="button-secondary"
                  onClick={() => speak(translatedText, targetLanguage)}
                  disabled={loading || !translatedText || isSpeaking}
                  title="Nghe phát âm"
                >
                  <Volume2 size={16}/>{isSpeaking ? "Đang đọc..." : "Nghe"}
                </Button>

                <Button variant="outline"
                  type="button"
                  className="button-secondary"
                  onClick={handleCopy}
                  disabled={loading || !translatedText}
                >
                  <Copy size={16}/> Sao chép
                </Button>
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
            {loading ? "Đang dịch..." : ""}
          </p>
        </form>
        <TranslationAssistant context={explanationContext} />
      </main>
    </div>
  );
}

export default TranslatorPage;
