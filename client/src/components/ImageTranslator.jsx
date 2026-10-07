import { useState, useRef } from "react";
import { ClipboardPaste, ImagePlus, UploadCloud } from "lucide-react";
import { Button } from "./ui/button";
import "./TranslationActions.css";

function ImageTranslator({
  selectedImage,
  onImageSelect,
  onClearImage,
  onPasteClipboard,
}) {
  const [localError, setLocalError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  function validateAndSelectFile(file) {
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setLocalError("Chỉ hỗ trợ định dạng: .jpg, .jpeg, .png, .webp.");
      return;
    }

    setLocalError("");
    onImageSelect(file);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    validateAndSelectFile(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    validateAndSelectFile(file);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <label className="block text-xs font-semibold text-gray-600 uppercase">
        Văn bản từ hình ảnh
      </label>

      <input
        type="file"
        id="image-file-input"
        ref={fileInputRef}
        className="hidden"
        style={{ display: "none" }}
        accept=".jpg, .jpeg, .png, .webp"
        onChange={handleFileChange}
      />

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
          className={`image-dropzone transition-all duration-200 cursor-pointer ${
            isDragging
              ? "image-dropzone-active"
              : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="upload-icon-badge" aria-hidden="true">
            <UploadCloud size={28} strokeWidth={1.7} />
          </div>
          <span className="text-sm font-medium text-gray-700 mb-3">
            {isDragging
              ? "Thả tệp ảnh vào đây..."
              : "Kéo và thả hoặc chọn tệp ảnh"}
          </span>
          <div className="image-upload-actions">
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="translation-action translation-action-primary"
            >
              <ImagePlus size={17} aria-hidden="true" />
              Duyệt tệp
            </Button>
            <Button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onPasteClipboard) onPasteClipboard();
              }}
              variant="outline"
              className="translation-action translation-action-outline"
              title="Dán ảnh từ bộ nhớ tạm"
            >
              <ClipboardPaste size={17} aria-hidden="true" />
              Dán ảnh
            </Button>
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
