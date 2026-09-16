# LingoAI

Ứng dụng dịch thuật đa ngôn ngữ tích hợp AI, sử dụng React + Vite cho frontend, Node.js + Express cho backend và Gemini API để dịch văn bản.

Frontend nằm trong `client/`. Backend nằm trực tiếp ở thư mục gốc, với mã nguồn trong `src/`. Toàn bộ dự án được quản lý trong cùng một repository.

## 1. Phạm vi hiện tại

- Nhập văn bản và chọn ngôn ngữ nguồn/đích.
- Tự động phát hiện ngôn ngữ nguồn bằng Gemini.
- Dịch văn bản, hiển thị và sao chép kết quả.
- Xử lý lỗi API và trạng thái đang dịch.
- Luồng tự động dịch đã được hướng dẫn triển khai: chờ khoảng 800 ms sau khi ngừng nhập (debounce) rồi gửi yêu cầu. Thành viên cần dùng branch đã có thay đổi này; phiên bản trước sử dụng nút Dịch.

MongoDB, lịch sử dịch, OCR, giọng nói và dịch tài liệu PDF/DOCX chưa thuộc phần cài đặt hiện tại. Thành viên chưa cần cài database để chạy chức năng dịch văn bản.

## 2. Yêu cầu môi trường

| Công cụ | Yêu cầu của dự án |
| --- | --- |
| Node.js | Dùng Node.js 24 LTS để thống nhất môi trường nhóm |
| npm | Đi kèm Node.js |
| Git | Clone repository và quản lý phiên bản |
| Trình soạn thảo | VS Code hoặc công cụ tương đương |
| Gemini API key | Key hợp lệ, model được hỗ trợ và còn quota |
| Internet | Cần khi cài dependencies và gọi Gemini |

Công cụ tải về: [Node.js](https://nodejs.org/), [Git](https://git-scm.com/downloads), [VS Code](https://code.visualstudio.com/), [Google AI Studio](https://aistudio.google.com/).

Kiểm tra trong terminal:

```powershell
node -v
npm -v
git --version
```

Các lệnh dưới đây dùng PowerShell trên Windows. Mở lại terminal sau khi cài Node.js hoặc Git để cập nhật PATH.

## 3. Cài đặt lần đầu

### Bước 1: Clone repository

Thay `URL_REPOSITORY_CUA_NHOM` bằng đường dẫn repository do nhóm cung cấp:

```powershell
git clone URL_REPOSITORY_CUA_NHOM ai-translator
cd ai-translator
```

Nếu đã có source code, chỉ cần mở terminal tại thư mục gốc chứa `package.json` và `client/`.

Không chạy lại `npm init` hoặc `npm create vite` khi clone dự án đã có sẵn.

### Bước 2: Cài dependencies

Dự án có hai bộ dependencies: backend ở gốc và frontend trong `client/`.

Nếu repository đã có `package-lock.json` ở cả hai vị trí:

```powershell
npm ci
npm ci --prefix client
```

Nếu chưa có lockfile tại vị trí tương ứng, dùng `npm install` cho vị trí đó:

```powershell
npm install
npm install --prefix client
```

Không cần chạy cả hai cách. Ưu tiên `npm ci` khi có lockfile để dùng đúng phiên bản mà nhóm đã chốt. Nếu lockfile không khớp `package.json`, người cập nhật dependencies cần sửa và commit cả hai file.

Service Gemini hiện sử dụng `fetch` có sẵn trong Node.js; không cần cài thêm SDK Google để chạy service này. Luôn cài dependencies theo các file `package.json` trong repository.

### Bước 3: Tạo cấu hình backend

Tại thư mục gốc, nếu chưa có `.env`:

```powershell
Copy-Item .env.example .env
```

Không ghi đè `.env` đang chứa cấu hình riêng của bạn.

Nội dung cấu hình:

```env
PORT=5001
GEMINI_API_KEY=THAY_BANG_API_KEY_CUA_BAN
GEMINI_MODEL=gemini-3.5-flash-lite
```

| Biến | Ý nghĩa |
| --- | --- |
| `PORT` | Cổng backend; mặc định của nhóm là `5001` |
| `GEMINI_API_KEY` | API key lấy từ Google AI Studio |
| `GEMINI_MODEL` | Tên model dùng cho dịch văn bản, không thêm tiền tố `models/` |

`gemini-3.5-flash-lite` là model đã chạy thành công trong quá trình thiết lập dự án. Khả năng truy cập và quota có thể khác theo tài khoản; kiểm tra lại trên AI Studio khi gặp lỗi.

Key chỉ nằm trong `.env` ở gốc. Không đưa key vào `client/`, biến `VITE_*`, Git hoặc ảnh chụp log. Không dùng OpenAI key cho Gemini.

Nếu repository thiếu `.env.example`, người phụ trách cần bổ sung file mẫu sau và commit:

```env
PORT=5001
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
```

## 4. Chạy dự án

Tại thư mục gốc:

```powershell
npm run dev
```

Lệnh này chạy đồng thời frontend và backend. Không chạy thêm phiên Vite hoặc backend trùng cổng.

| Thành phần | Địa chỉ |
| --- | --- |
| Frontend | http://localhost:5173 |
| Kiểm tra backend | http://localhost:5001/api/health |

Dừng ứng dụng bằng `Ctrl + C`. Sau khi sửa `.env`, cần dừng và chạy lại để backend nạp cấu hình mới.

Nếu muốn chạy riêng để kiểm tra lỗi, dùng hai terminal tại thư mục gốc, sau khi đã dừng lệnh chạy chung:

```powershell
# Terminal 1
npm run dev:server
```

```powershell
# Terminal 2
npm run dev:client
```

### Scripts chuẩn của nhóm

Đây là phần `scripts` trong `package.json` ở gốc, không phải toàn bộ file:

```json
{
  "dev": "concurrently --kill-others \"npm run dev:server\" \"npm run dev:client\"",
  "dev:server": "node --watch --env-file=.env src/server.js",
  "dev:client": "npm run dev --prefix client",
  "start": "node --env-file=.env src/server.js",
  "build": "npm run build --prefix client"
}
```

Backend sử dụng `"type": "module"` trong `package.json`. Trong `client/package.json`, lệnh `dev` là `vite`; chỉ file ở gốc sử dụng `concurrently`.

| Lệnh ở thư mục gốc | Chức năng |
| --- | --- |
| `npm run dev` | Chạy cả frontend và backend khi phát triển |
| `npm run dev:server` | Chạy backend và tự khởi động lại khi code thay đổi |
| `npm run dev:client` | Chạy Vite frontend |
| `npm run build` | Build frontend vào `client/dist/` |
| `npm start` | Chạy riêng backend, không bật chế độ watch |

`npm start` chưa phục vụ giao diện React. Build thành công cũng không đồng nghĩa đã triển khai website. Cấu hình production/deploy sẽ được thực hiện riêng.

## 5. Tổ chức thư mục và file

| Đường dẫn tính từ thư mục gốc | Trách nhiệm |
| --- | --- |
| `client/src/components/LanguageSelect.jsx` | Component chọn ngôn ngữ |
| `client/src/constants/languages.js` | Danh sách ngôn ngữ và giới hạn văn bản |
| `client/src/pages/TranslatorPage.jsx` | Trang dịch, state, debounce và hiển thị kết quả |
| `client/src/services/translationApi.js` | Gọi backend qua HTTP |
| `client/src/App.jsx` | Component gốc của ứng dụng |
| `client/src/main.jsx` | Điểm khởi động React |
| `client/src/index.css` | CSS giao diện |
| `client/vite.config.js` | Cấu hình Vite và proxy `/api` |
| `client/package.json` | Dependencies và scripts frontend |
| `src/routes/translationRoutes.js` | Khai báo route dịch |
| `src/controllers/translationController.js` | Kiểm tra đầu vào, gọi service và trả response |
| `src/services/llmService.js` | Gọi Gemini, đọc kết quả và xử lý lỗi service |
| `src/app.js` | Cấu hình Express, middleware và routes |
| `src/server.js` | Khởi động backend |
| `src/config/`, `src/models/`, `src/middlewares/` | Các folder dự kiến dùng khi mở rộng; có thể đang trống |
| `.env` | Cấu hình riêng của từng thành viên, không commit |
| `.env.example` | Mẫu biến môi trường, được commit |
| `package.json` | Dependencies backend và scripts chạy chung |
| `package-lock.json`, `client/package-lock.json` | Khóa phiên bản dependencies, được commit |

Git không lưu folder trống nên thành viên clone về có thể chưa thấy các folder dự kiến.

## 6. Kết nối frontend và backend

Frontend gọi đường dẫn tương đối `/api/translations`. Trong môi trường phát triển, Vite chuyển request `/api` tới backend.

Cấu hình tương ứng trong `client/vite.config.js`:

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:5001",
        changeOrigin: true,
      },
    },
  },
});
```

Nếu đổi `PORT` trong `.env`, cập nhật cả `proxy.target` rồi khởi động lại. Proxy này dành cho Vite dev server.

## 7. API hiện tại

### GET `/api/health`

Kiểm tra Express đang hoạt động. Response dự kiến:

```json
{
  "success": true,
  "message": "Backend AI Translator đang hoạt động."
}
```

Health API thành công chưa xác nhận Gemini key hoặc quota hợp lệ.

### POST `/api/translations`

Header: `Content-Type: application/json`.

Body mẫu:

```json
{
  "text": "Hello",
  "sourceLanguage": "auto",
  "targetLanguage": "vi"
}
```

Quy ước:

- Mã ngôn ngữ hiện tại: `vi`, `en`, `ja`, `ko`, `zh`, `fr`, `de`, `es`.
- `auto` chỉ dùng cho ngôn ngữ nguồn.
- Văn bản không được rỗng và tối đa 5.000 ký tự theo cách đếm `String.length` trong JavaScript.
- API hiện từ chối nguồn và đích giống nhau. Giao diện tự động dịch có thể trả lại nguyên văn tại frontend cho trường hợp này để tránh gọi API.

Response thành công minh họa; cách diễn đạt bản dịch có thể khác:

```json
{
  "success": true,
  "message": "Dịch thành công.",
  "data": {
    "originalText": "Hello",
    "sourceLanguage": "auto",
    "targetLanguage": "vi",
    "translatedText": "Xin chào",
    "detectedLanguage": "en"
  }
}
```

## 8. Kiểm tra sau khi cài đặt

1. Chạy `npm run dev` và mở health API.
2. Mở frontend, nhập `Hello`, chọn nguồn tiếng Anh và đích tiếng Việt.
3. Chờ debounce nếu branch đã có tự động dịch; nếu chưa, nhấn Dịch.
4. Kiểm tra bản dịch, thử nguồn tự động và nút Sao chép.
5. Xóa nội dung: kết quả cũ phải được xóa trong phiên bản tự động dịch.
6. Thử đổi ngôn ngữ hoặc nhập tiếp trong lúc chờ: kết quả cũ không được ghi đè kết quả mới.
7. Chạy `npm run build` ở terminal khác để kiểm tra frontend build được.

Kiểm tra riêng API bằng PowerShell:

```powershell
$body = @{
  text = "Hello"
  sourceLanguage = "en"
  targetLanguage = "vi"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "http://localhost:5001/api/translations" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Lệnh này gọi Gemini thật và sử dụng quota. Việc hủy request ở frontend không bảo đảm hủy lượt xử lý Gemini đã bắt đầu ở backend. Tránh thử liên tục; có thể thống nhất tăng debounce lên 1.200–1.500 ms nếu cần giảm số lượt gọi.

## 9. Lỗi thường gặp

| Hiện tượng | Kiểm tra và xử lý |
| --- | --- |
| `Port 5173 is already in use` | Dừng phiên Vite cũ bằng `Ctrl + C`; chỉ chạy một phiên dự án |
| Backend báo `EADDRINUSE` | Cổng 5001 đang bị chiếm; dừng phiên cũ hoặc đổi cả PORT và proxy |
| Log lồng nhiều lớp `[0] [1]` | Kiểm tra scripts; `dev:server` phải chạy Node trực tiếp, không gọi lại `npm run dev` ở gốc |
| `Missing script` | Kiểm tra đúng thư mục và scripts trong đúng `package.json` |
| Không tìm thấy `.env` | File phải nằm ở gốc; kiểm tra Windows không lưu thành `.env.txt` |
| PowerShell chặn `npm.ps1` | Có thể dùng `npm.cmd` thay cho `npm` trong terminal |
| Health chạy nhưng frontend không gọi được API | Kiểm tra Vite proxy và cổng backend; khởi động lại Vite sau khi sửa cấu hình |
| `MISSING_API_KEY` / `INVALID_API_KEY` | Kiểm tra GEMINI_API_KEY ở backend; không dùng key OpenAI |
| `404 NOT_FOUND` | Đọc `googleMessage`, kiểm tra tên model, endpoint và quyền truy cập; model xuất hiện trong danh sách chưa bảo đảm dùng được cho tài khoản mới |
| Model 2.5 báo không còn dành cho người dùng mới | Trong quá trình thiết lập, API đã yêu cầu đổi sang `gemini-3.5-flash-lite`, sau đó dự án dịch thành công |
| `429` | Kiểm tra quota/rate limit và billing của project Gemini; Free Tier không có nghĩa không giới hạn |
| `503 UNAVAILABLE` | Có thể là gián đoạn hoặc quá tải dịch vụ; thử lại có giới hạn, không gửi dồn request |
| `504 AI_TIMEOUT` | Service tự ngắt vì hết thời gian chờ; thử câu ngắn và kiểm tra model/kết nối; không tăng timeout vô hạn |
| `MAX_TOKENS`, kết quả trống hoặc JSON không hợp lệ | Thử văn bản ngắn hơn, kiểm tra cấu hình model và giới hạn đầu ra; không hiển thị bản dịch bị cắt |

Khi báo lỗi cho nhóm, gửi: branch/commit, các bước tái hiện, tên model, mã lỗi, thông báo chi tiết đã che dữ liệu riêng tư và thời gian chờ. Không gửi API key, headers chứa key hoặc toàn bộ `.env`.

## 10. Quy trình làm việc nhóm đề xuất

### Trước khi bắt đầu task

Kiểm tra và commit hoặc stash thay đổi đang làm trước khi chuyển branch. Các lệnh dưới giả định nhánh chính là `main`; thay bằng tên thực tế nếu nhóm dùng tên khác.

```powershell
git status
git switch main
git pull --ff-only
git switch -c feature/ten-chuc-nang
```

Nếu thay đổi từ nhóm cập nhật lockfile, chạy lại `npm ci` ở phần tương ứng. Nếu `.env.example` thay đổi, bổ sung biến mới vào `.env` cá nhân mà không ghi đè key.

### Trước khi tạo Pull Request

- Chạy thử chức năng đã thay đổi và luồng dịch cơ bản.
- Chạy `npm run build`; nếu có script lint, chạy `npm run lint --prefix client`.
- Xem `git diff` và `git status`, bảo đảm không có key, `.env`, `node_modules/` hoặc `dist/` bị đưa vào commit.
- Commit những file liên quan đến task; cập nhật README nếu đổi cách cài/chạy.
- Push branch và tạo Pull Request mô tả thay đổi, cách kiểm tra và lỗi còn biết.

Ví dụ:

```powershell
git add client/src/pages/TranslatorPage.jsx
git commit -m "feat: add automatic text translation"
git push -u origin feature/ten-chuc-nang
```

Chỉ cài thêm package ở đúng phần: backend tại gốc, frontend trong `client/`. Commit cả `package.json` và lockfile tương ứng. Tránh tự nâng cấp hàng loạt dependencies khi đang xử lý task khác.

### `.gitignore` tối thiểu

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
*.log
```

Nếu `.env` từng được commit, thêm `.gitignore` không xóa key khỏi lịch sử: cần thu hồi key đã lộ và thông báo người phụ trách repository để xử lý.

## 11. Tài liệu tham khảo

- [Vite](https://vite.dev/guide/)
- [Node.js](https://nodejs.org/docs/latest-v24.x/api/)
- [Express](https://expressjs.com/)
- [Gemini generateContent API](https://ai.google.dev/api/generate-content)
- [Danh sách model Gemini](https://ai.google.dev/api/models)
- [Giá và Free Tier Gemini](https://ai.google.dev/gemini-api/docs/pricing)

