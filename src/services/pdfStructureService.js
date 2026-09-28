import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function openPdf(buffer) {
  return getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;
}

// Nhận diện theo cỡ chữ và khoảng cách dòng: phù hợp PDF văn bản một cột.
// Đây là heuristic, không phải OCR hoặc bộ phục dựng bảng/cột.
export async function extractPdfStructure(buffer) {
  const pdf = await openPdf(buffer);
  const blocks = [];
  const warnings = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const { items } = await page.getTextContent();
      const lines = [];
      let current;
      for (const item of items) {
        if (typeof item.str !== "string") continue;
        const size =
          Math.hypot(item.transform[2], item.transform[3]) || item.height || 12;
        const x = item.transform[4],
          y = item.transform[5];
        if (
          current &&
          (Math.abs(current.y - y) > size * 0.35 || x < current.x - size)
        )
          current = null;
        if (!current && item.str.trim()) {
          current = { text: "", x, y, end: x, size };
          lines.push(current);
        }
        if (current) {
          if (
            current.text &&
            x - current.end > size * 0.2 &&
            !/\s$/.test(current.text) &&
            !/^\s/.test(item.str)
          )
            current.text += " ";
          current.text += item.str;
          current.end = x + item.width;
          current.size = Math.max(current.size, size);
        }
        if (item.hasEOL) current = null;
      }
      const nonempty = lines.filter((line) => line.text.trim());
      if (!nonempty.length) {
        // Không xuất bản dịch thiếu âm thầm đối với tài liệu scan hoặc scan xen kẽ.
        throw new Error(
          `Trang ${pageNumber} không có văn bản đọc được. Cần OCR (hoặc loại bỏ trang trắng) trước khi dịch.`,
        );
      }
      const sizes = new Map();
      for (const line of nonempty) {
        const key = Math.round(line.size);
        sizes.set(key, (sizes.get(key) || 0) + line.text.length);
      }
      const bodySize = [...sizes].sort((a, b) => b[1] - a[1])[0][0];
      let paragraph = null,
        previous = null;
      for (const line of nonempty) {
        const heading = line.size >= bodySize * 1.2 && line.text.length < 200;
        const separate =
          heading ||
          !previous ||
          previous.heading ||
          Math.abs(previous.y - line.y) >
            Math.max(previous.size, line.size) * 1.7;
        if (separate || !paragraph) {
          paragraph = {
            type: heading ? "heading" : "paragraph",
            ...(heading
              ? { headingLevel: line.size >= bodySize * 1.6 ? 1 : 2 }
              : {}),
            page: pageNumber,
            originalText: line.text.trim(),
          };
          blocks.push(paragraph);
        } else paragraph.originalText += "\n" + line.text.trim();
        previous = { ...line, heading };
      }
    }
    warnings.push(
      "PDF giữ đoạn, xuống dòng và tiêu đề nhận diện theo cỡ chữ. Bảng, nhiều cột, ảnh và font gốc chưa được phục dựng chính xác.",
    );
    return { blocks, warnings };
  } finally {
    await pdf.destroy();
  }
}
