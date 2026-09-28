import puppeteer from "puppeteer";
import { openPdf } from "./pdfStructureService.js";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );
const clamp = (value, min, max, fallback) =>
  Number.isFinite(Number(value))
    ? Math.min(max, Math.max(min, Number(value)))
    : fallback;

export function buildPdfHtml(
  blocks,
  { width = 595.28, height = 841.89, language = "vi" } = {},
) {
  let previousPage;
  const content = blocks
    .map((block) => {
      const text = block.editedText ?? block.translatedText;
      if (typeof text !== "string")
        throw new Error("Thiếu nội dung bản dịch để xuất PDF.");
      const pageNumber =
        Number.isInteger(block.page) && block.page > 0 ? block.page : null;
      const pageBreak =
        previousPage != null &&
        pageNumber != null &&
        pageNumber !== previousPage;
      if (pageNumber != null) previousPage = pageNumber;
      const level = clamp(block.headingLevel, 1, 6, 1);
      const tag = block.type === "heading" ? `h${Math.round(level)}` : "p";
      const prefix =
        block.type === "listItem" ? `${block.listLabel || "•"} ` : "";
      const indent =
        block.type === "listItem"
          ? 16 * (clamp(block.listLevel, 0, 8, 0) + 1)
          : 0;
      return `<${tag} dir="auto" style="${pageBreak ? "break-before:page;" : ""}margin-left:${indent}pt">${escape(prefix + text)}</${tag}>`;
    })
    .join("\n");
  return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:">
  <style>
    @page { size: ${clamp(width, 200, 3000, 595.28)}pt ${clamp(height, 200, 3000, 841.89)}pt; margin: 42pt; }
    body { margin:0; color:#111; font:11pt/1.55 'Noto Sans','Noto Sans CJK SC','Noto Sans CJK JP','Noto Sans CJK KR','Arial','Microsoft YaHei','Yu Gothic','Malgun Gothic',sans-serif; }
    p,h1,h2,h3,h4,h5,h6 { white-space:pre-wrap; overflow-wrap:anywhere; margin:0 0 10pt; orphans:3; widows:3; }
    h1,h2,h3,h4,h5,h6 { break-after:avoid; line-height:1.3; font-weight:700; }
    h1 {font-size:20pt} h2 {font-size:16pt} h3 {font-size:14pt} h4,h5,h6 {font-size:12pt}
  </style></head><body>${content}</body></html>`;
}

export async function exportTranslatedPdf(blocks, originalBuffer, language) {
  if (!Array.isArray(blocks) || !blocks.length)
    throw new Error("Không có bản dịch để xuất.");
  let width = 595.28,
    height = 841.89;
  if (originalBuffer) {
    const source = await openPdf(originalBuffer);
    try {
      const viewport = (await source.getPage(1)).getViewport({ scale: 1 });
      width = viewport.width;
      height = viewport.height;
    } finally {
      await source.destroy();
    }
  }
  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.PDF_BROWSER_PATH
      ? { executablePath: process.env.PDF_BROWSER_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => request.abort());
    await page.setContent(buildPdfHtml(blocks, { width, height, language }), {
      waitUntil: "load",
      timeout: 30_000,
    });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      waitForFonts: true,
      timeout: 60_000,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
