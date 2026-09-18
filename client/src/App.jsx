import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import TranslatorPage from "./pages/TranslatorPage";
import ImageTranslatorPage from "./pages/ImageTranslatorPage";

function App() {
  return <ImageTranslatorPage />; //chạy rieng dịch ảnh
  return <TranslatorPage />;
}

export default App;
