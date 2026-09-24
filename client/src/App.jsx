import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";

import TranslatorPage from "./pages/TranslatorPage";
import UploadFileTranslatorPage from "./pages/UploadFileTranslatorPage";
import ImageTranslatorPage from "./pages/ImageTranslatorPage";
import HistoryPage from "./pages/HistoryPage";

function App() {
  const navLinkStyle = ({ isActive }) => ({
    textDecoration: "none",
    padding: "8px 16px",
    borderRadius: "6px",
    fontWeight: "500",
    color: isActive ? "#ffffff" : "#4b5563",
    backgroundColor: isActive ? "#3b82f6" : "#f3f4f6",
    transition: "all 0.2s ease-in-out",
  });

  return (
    <BrowserRouter>
      <nav
        style={{
          display: "flex",
          gap: "12px",
          padding: "16px 24px",
          borderBottom: "1px solid #e2e8f0",
        }}
      >
        <NavLink to="/" end style={navLinkStyle}>
          Dịch văn bản
        </NavLink>

        <NavLink to="/image" style={navLinkStyle}>
          Dịch hình ảnh
        </NavLink>
        <NavLink to="/history" style={navLinkStyle}>
          Lịch sử dịch
        </NavLink>
        <NavLink to="/upload-file" style={navLinkStyle}>Dịch tài liệu</NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<TranslatorPage />} />
        <Route path="/upload-file" element={<UploadFileTranslatorPage />} />
        <Route path="/image" element={<ImageTranslatorPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<p>Không tìm thấy trang.</p>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
