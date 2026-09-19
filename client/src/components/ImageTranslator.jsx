import { useState } from "react";

function ImageTranslator({
  selectedImage,
  onImageSelect,
  onClearImage,
  onPasteClipboard,
}) {
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

  return (
    <div className="mt-2 flex flex-col gap-2">
      <label className="block text-xs font-semibold text-gray-600 uppercase">
        Văn bản từ hình ảnh
      </label>

      {/* Input tệp đã được ẩn hoàn toàn bằng display: none */}
      <input
        type="file"
        id="image-file-input"
        className="hidden"
        style={{ display: "none" }}
        accept=".jpg, .jpeg, .png, .webp"
        onChange={handleFileChange}
      />

      {/* Khung hiển thị ảnh preview hoặc vùng thả ảnh */}
      {selectedImage ? (
        <div className="image-preview-container relative">
          <img
            src={URL.createObjectURL(selectedImage)}
            alt="Preview"
            className="max-h-64 mx-auto rounded object-contain"
          />
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
            Kéo và thả hoặc chọn tệp ảnh
          </span>
          <div className="flex gap-2 w-full max-w-xs">
            <button
              type="button"
              onClick={() =>
                document.getElementById("image-file-input")?.click()
              }
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-3 rounded transition cursor-pointer"
            >
              Duyệt tệp
            </button>
            <button
              type="button"
              onClick={onPasteClipboard}
              className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3 rounded transition cursor-pointer"
            >
              Dán từ bộ nhớ tạm
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
