// src/services/ocrApi.js

export async function submitImageOCR(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile); // Tên trường 'image' tùy thuộc vào backend của bạn quy định

  const response = await fetch("http://localhost:5001/api/ocr", {
    // Thay đổi URL endpoint theo backend thực tế của bạn
    method: "POST",
    body: formData,
    // Không cần set 'Content-Type': 'multipart/form-data', fetch sẽ tự động đính kèm boundary chuẩn
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || "Không thể trích xuất văn bản từ hình ảnh.",
    );
  }

  return await response.json();
}
