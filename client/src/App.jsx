import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Languages, Image, FileText, History, ArrowUpRight, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from './components/ui/button';
import TranslatorPage from './pages/TranslatorPage';
import UploadFileTranslatorPage from './pages/UploadFileTranslatorPage';
import ImageTranslatorPage from './pages/ImageTranslatorPage';
import HistoryPage from './pages/HistoryPage';
import './App.css';
const links = [
  { to: '/', label: 'Dịch văn bản', icon: Languages },
  { to: '/image', label: 'Dịch hình ảnh', icon: Image },
  { to: '/upload-file', label: 'Dịch tài liệu', icon: FileText },
  { to: '/history', label: 'Lịch sử dịch', icon: History },
];
function Workspace() {
  const { pathname } = useLocation();
  const page = links.find(item => item.to === pathname);
  return <div className="app-shell">
    <a className="skip-link" href="#workspace-content">Đến nội dung chính</a>
    <aside className="app-sidebar">
      <NavLink to="/" className="brand" aria-label="LingoAI — Trang chủ"><span className="brand-mark"><Languages size={23}/></span><span>Lingo<span className="brand-ai">AI</span></span></NavLink>
      <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
      <nav className="app-nav" aria-label="Điều hướng chính">{links.map(({to,label,icon:Icon}) => <NavLink key={to} to={to} end={to === '/'} className={({isActive}) => `nav-item ${isActive ? 'is-active' : ''}`}><Icon size={19}/><span>{label}</span><ChevronRight className="nav-arrow" size={15}/></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={20}/><strong>Hiểu nhiều hơn một bản dịch.</strong><p>Khám phá từ ngữ và ngữ cảnh cùng trợ lý AI.</p><Button asChild variant="secondary" size="sm"><NavLink to="/history">Khám phá lịch sử <ArrowUpRight/></NavLink></Button></div><span className="sidebar-caption">LingoAI · Không gian ngôn ngữ của bạn</span></div>
    </aside>
    <div className="app-body">
      <header className="app-topbar"><div className="breadcrumb">Không gian làm việc <ChevronRight size={14}/><span>{page?.label || 'Không tìm thấy trang'}</span></div><span className="topbar-tag"><Sparkles size={14}/> Ngôn ngữ kết nối chúng ta</span></header>
      <div id="workspace-content" className="workspace-content" tabIndex={-1}>
        <Routes><Route path="/" element={<TranslatorPage/>}/><Route path="/image" element={<ImageTranslatorPage/>}/><Route path="/upload-file" element={<UploadFileTranslatorPage/>}/><Route path="/history" element={<HistoryPage/>}/><Route path="*" element={<div className="empty-page"><h1>Không tìm thấy trang</h1><Button asChild><NavLink to="/">Về trang dịch</NavLink></Button></div>}/></Routes>
      </div>
      <footer className="workspace-footer"><span>LingoAI</span><span>Mỗi ngôn ngữ, một kết nối mới.</span></footer>
    </div>
  </div>;
}
export default function App() { return <BrowserRouter><Workspace/></BrowserRouter>; }
