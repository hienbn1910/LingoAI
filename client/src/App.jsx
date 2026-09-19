import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

import TranslatorPage from "./pages/TranslatorPage";
import UploadFileTranslatorPage from "./pages/UploadFileTranslatorPage";
import ImageTranslatorPage from "./pages/ImageTranslatorPage";

function App() {
  return (
    <BrowserRouter>
      <nav
        style={{
          display: "flex",
          gap: "20px",
          padding: "16px 24px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <NavLink to="/" end>
          Dịch văn bản
        </NavLink>

        <NavLink to="/upload-file">Dịch tài liệu</NavLink>

        <NavLink to="/image">Dịch hình ảnh</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<TranslatorPage />} />
        <Route path="/upload-file" element={<UploadFileTranslatorPage />} />
        <Route path="/image" element={<ImageTranslatorPage />} />
        <Route path="*" element={<p>Không tìm thấy trang.</p>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
