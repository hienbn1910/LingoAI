import { useState } from "react";

function ImageTranslator({ selectedImage, onImageSelect, onClearImage }) {
  const [localError, setLocalError] = useState("");

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setLocalError("Chỉ hỗ trợ định dạng: .jpg, .jpeg, .png, .webp.");
        return;
      }
      setLocalError("");
      onImageSelect(file);
    }
  }

  // Xử lý sự kiện dán ảnh trực tiếp từ bàn phím (Ctrl + V) không cần xin quyền trình duyệt
  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setLocalError("");
          onImageSelect(file);
          break;
        }
      }
    }
  }

  return (
    <div
      className="mt-2 flex flex-col gap-2 outline-none focus:ring-2 focus:ring-blue-400 rounded-lg p-1"
      tabIndex={0} // Giúp thẻ div có thể nhận focus để bắt sự kiện Ctrl + V trực tiếp
      onPaste={handlePaste}
    >
      <label className="block text-xs font-semibold text-gray-600 uppercase">
        Văn bản từ hình ảnh (Có thể nhấn{" "}
        <kbd className="bg-gray-100 px-1 py-0.5 rounded border text-[10px]">
          Ctrl + V
        </kbd>{" "}
        để dán ảnh)
      </label>

      {/* Input ẩn để gọi khi bấm nút Duyệt tệp */}
      <input
        type="file"
        id="image-file-input"
        className="hidden"
        accept=".jpg, .jpeg, .png, .webp"
        onChange={handleFileChange}
      />

      {/* Hiển thị Khung Preview nếu đã chọn ảnh, ngược lại hiển thị Dropzone */}
      {selectedImage ? (
        <div className="image-preview-container relative">
          <img src={URL.createObjectURL(selectedImage)} alt="Preview" />
          <button
            type="button"
            onClick={onClearImage}
            className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white rounded-full p-1.5 transition cursor-pointer shadow-md"
            title="Xóa ảnh"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      ) : (
        <div
          className="image-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (
              file &&
              ["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
              setLocalError("");
              onImageSelect(file);
            } else {
              setLocalError("Vui lòng thả tệp ảnh hợp lệ (.jpg, .png, .webp).");
            }
          }}
        >
          <div className="text-blue-500 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
          </div>
          <span className="text-sm font-medium text-gray-700 mb-3">
            Kéo thả ảnh, chọn tệp hoặc click vào đây rồi bấm{" "}
            <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border text-xs">
              Ctrl + V
            </kbd>
          </span>
          <div className="flex gap-2 w-full max-w-xs justify-center">
            <button
              type="button"
              onClick={() =>
                document.getElementById("image-file-input").click()
              }
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded transition cursor-pointer"
            >
              Duyệt tệp
            </button>
          </div>
        </div>
      )}

      {localError && <p className="text-xs text-red-600 mt-1">{localError}</p>}

      <div className="panel-footer mt-1 flex justify-between items-center text-xs text-gray-400">
        <span>Hỗ trợ: .jpg, .jpeg, .png, .webp</span>
        {selectedImage && (
          <button
            type="button"
            className="button-secondary text-red-500 hover:underline cursor-pointer"
            onClick={onClearImage}
          >
            Chọn ảnh khác
          </button>
        )}
      </div>
    </div>
  );
}

export default ImageTranslator;
