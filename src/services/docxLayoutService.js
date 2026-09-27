import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML = 'http://www.w3.org/XML/1998/namespace';
const normalize = (value) => String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function textNodes(paragraph) {
  return Array.from(paragraph.getElementsByTagNameNS(W, 't')).filter(node => {
    let parent = node.parentNode;
    while (parent && !(parent.namespaceURI === W && parent.localName === 'p')) parent = parent.parentNode;
    return parent === paragraph;
  });
}

function paragraphText(paragraph) {
  let text = '';
  function walk(node) {
    if (node !== paragraph && node.namespaceURI === W && node.localName === 'p') return;
    if (node.namespaceURI === W && node.localName === 't') { text += node.textContent; return; }
    if (node.namespaceURI === W && ['br', 'cr', 'tab'].includes(node.localName)) { text += ' '; return; }
    for (let child = node.firstChild; child; child = child.nextSibling) walk(child);
  }
  walk(paragraph);
  return normalize(text);
}

// Keep the original run properties, paragraph properties and break elements.
// Redistributing text approximately preserves mixed formatting, but not its meaning.
function replaceText(nodes, value) {
  const characters = Array.from(value.replace(/\r\n|\r|\n/g, ' '));
  const weights = nodes.map(node => Array.from(node.textContent).length);
  const total = weights.reduce((sum, n) => sum + n, 0);
  if (!total) throw conflict('Đoạn gốc không có vị trí văn bản để thay thế.');
  let start = 0;
  let weight = 0;
  nodes.forEach((node, index) => {
    weight += weights[index];
    const end = index === nodes.length - 1 ? characters.length : Math.round(characters.length * weight / total);
    node.textContent = characters.slice(start, end).join('');
    node.setAttributeNS(XML, 'xml:space', 'preserve');
    start = end;
  });
}

export async function exportDocxWithOriginalLayout(originalBuffer, blocks) {
  if (!Array.isArray(blocks) || !blocks.length) throw conflict('Không có dữ liệu bản dịch để tải.');
  const zip = await JSZip.loadAsync(originalBuffer);
  const entry = zip.file('word/document.xml');
  if (!entry) throw conflict('File gốc không phải DOCX tiêu chuẩn được hỗ trợ.');
  const xml = await entry.async('string');
  if (/<!DOCTYPE/i.test(xml)) throw conflict('Không hỗ trợ XML có DOCTYPE.');
  let invalid = false;
  const document = new DOMParser({ errorHandler: {
    warning: () => { invalid = true; },
    error: () => { invalid = true; },
    fatalError: () => { invalid = true; },
  } }).parseFromString(xml, 'application/xml');
  if (invalid) throw conflict('Không đọc được cấu trúc XML của DOCX gốc.');
  if (document.getElementsByTagNameNS(W, 'ins').length || document.getElementsByTagNameNS(W, 'del').length) {
    throw conflict('DOCX còn Track Changes. Hãy chấp nhận/từ chối các thay đổi trong Word rồi dịch lại.');
  }
  const paragraphs = Array.from(document.getElementsByTagNameNS(W, 'p'))
    .map(node => ({ node, text: paragraphText(node), nodes: textNodes(node) }))
    .filter(item => item.text && item.nodes.length);
  const used = new Set();
  const replacements = [];

  for (const block of blocks) {
    const translated = block.editedText ?? block.translatedText;
    if (typeof translated !== 'string' || !translated.trim()) throw conflict('Bản dịch chứa đoạn trống. Không thể xuất file đầy đủ.');
    const original = normalize(block.originalText);
    // Match by source text, never blindly pair paragraphs by array position.
    let indexes = [];
    const exact = paragraphs.findIndex((p, i) => !used.has(i) && p.text === original);
    if (exact !== -1) indexes = [exact];
    else {
      // Mammoth may join multiple paragraphs inside a list item into one block.
      for (let start = 0; start < paragraphs.length && !indexes.length; start++) {
        if (used.has(start)) continue;
        const texts = [];
        for (let end = start; end < paragraphs.length && !used.has(end); end++) {
          texts.push(paragraphs[end].text);
          if (texts.join(' ') === original || texts.join('') === original) {
            indexes = Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
            break;
          }
          if (texts.join('').length > original.length) break;
        }
      }
    }
    if (!indexes.length) throw conflict('Không ghép được bản dịch với đoạn trong DOCX gốc. Hãy dịch lại file gốc; tài liệu đặc biệt như chú thích có thể chưa được hỗ trợ.');
    for (const index of indexes) used.add(index);
    replacements.push({ nodes: indexes.flatMap(index => paragraphs[index].nodes), translated });
  }
  if (used.size !== paragraphs.length) throw conflict('Một số đoạn trong DOCX gốc chưa có bản dịch tương ứng. Không xuất file để tránh bỏ sót nội dung.');
  // Validate every mapping first; never deliver a half-patched document.
  for (const replacement of replacements) replaceText(replacement.nodes, replacement.translated);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
