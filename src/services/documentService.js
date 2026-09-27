import mammoth from 'mammoth';
import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { Document, Paragraph, TextRun, HeadingLevel, Packer } from 'docx';

export async function extractDocument(file) {
  const raw = [];
  const warnings = [];
  const add = (text, metadata = {}) => {
    text = text.replace(/\u00a0/g, ' ').replace(/\r\n/g, '\n').trim();
    if (text) raw.push({ type: 'paragraph', ...metadata, originalText: text });
  };
  if (file.originalname.toLowerCase().endsWith('.docx')) {
    const result = await mammoth.convertToHtml({ buffer: file.buffer }, {
      convertImage: mammoth.images.imgElement(async () => ({ src: '' })),
    });
    const $ = load(result.value);
    $('br').replaceWith('\n');
    if ($('table').length) warnings.push('Bảng được chuyển thành các đoạn theo thứ tự ô, không giữ lưới bảng.');
    if ($('img').length) warnings.push('Ảnh trong tài liệu chưa được đưa vào bản xuất.');
    if (result.messages.length) warnings.push('Một số định dạng DOCX có thể không được giữ nguyên.');
    // Walk in document order; list descendants are handled separately.
    function walk(node) {
      const tag = node.name;
      if (/^h[1-6]$/.test(tag || '')) {
        add($(node).text(), { type: 'heading', headingLevel: Number(tag[1]) });
        return;
      }
      if (tag === 'li') {
        const clone = $(node).clone();
        clone.find('ul, ol').remove();
        add(clone.text(), {
          type: 'listItem',
          listLevel: Math.min($(node).parents('ul, ol').length - 1, 8),
          listLabel: node.parent?.name === 'ol'
            ? `${$(node).index() + 1}.` : '•',
        });
        $(node).children('ul, ol').each((_, child) => walk(child));
        return;
      }
      if (tag === 'p') { add($(node).text()); return; }
      for (const child of node.children || []) walk(child);
    }
    walk($('body')[0]);
  } else {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      for (const page of result.pages) {
        if (!page.text.trim()) warnings.push(`Trang ${page.num} không có lớp văn bản (trang trắng hoặc ảnh scan), chưa được dịch.`);
        for (const paragraph of page.text.split(/\n\s*\n/)) {
          add(paragraph, { page: page.num });
        }
      }
    } finally { await parser.destroy(); }
    warnings.push('PDF: chỉ giữ văn bản theo trang/đoạn; không tái tạo chính xác cột, bảng hoặc tiêu đề.');
  }
  if (!raw.length) throw new Error('Tài liệu không có văn bản đọc được. Nếu là PDF ảnh/scan, cần OCR trước khi dịch.');
  // Keep each original paragraph intact; never split it into translation chunks.
  const blocks = raw.map((block, order) => ({ ...block, id: randomUUID(), order }));
  return { blocks, warnings };
}

export async function exportDocument(blocks) {
  const children = blocks.map((block) => {
    const prefix = block.type === 'listItem' ? `${block.listLabel || '•'} ` : '';
    const lines = (prefix + (block.editedText ?? block.translatedText)).split('\n');
    return new Paragraph({
      children: lines.map((line, i) => new TextRun({ text: line, ...(i ? { break: 1 } : {}) })),
      ...(block.type === 'heading' ? { heading: HeadingLevel[`HEADING_${block.headingLevel || 1}`] } : {}),
      ...(block.type === 'listItem' ? { indent: { left: 360 * ((block.listLevel || 0) + 1) } } : {}),
      spacing: { after: 160 },
    });
  });
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}
