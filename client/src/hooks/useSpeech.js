import { useState, useEffect, useRef } from "react";


const LANGUAGE_VOICE_MAP = {
  vi: "vi-VN",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
  fr: "fr-FR",
  de: "de-DE",
  es: "es-ES",
};

export function useSpeech({ onTranscript, sourceLanguage = "auto" }) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Trình duyệt không hỗ trợ Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Thu xong 1 lượt rồi tự dừng
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event) => {
      console.error("Lỗi Speech Recognition:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
  // Lấy toàn bộ đoạn text đang nói dở và đã nói xong ghép lại ngay lập tức
  const transcript = Array.from(event.results)
    .map((result) => result[0].transcript)
    .join("");

  if (transcript && onTranscript) {
    onTranscript(transcript);
  }
};

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [onTranscript]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      // Gán ngôn ngữ nhận diện (nếu auto thì mặc định vi-VN hoặc en-US)
      recognitionRef.current.lang =
        LANGUAGE_VOICE_MAP[sourceLanguage] || "vi-VN";
      recognitionRef.current.start();
    }
  };

  const speak = (text, targetLanguage) => {
    if (!("speechSynthesis" in window)) {
      alert("Trình duyệt không hỗ trợ Text-to-Speech.");
      return;
    }

    window.speechSynthesis.cancel(); // Dừng câu đang đọc dở nếu có

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGE_VOICE_MAP[targetLanguage] || "en-US";

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  return {
    isListening,
    isSpeaking,
    toggleListening,
    speak,
  };
}