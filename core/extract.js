// Text extraction from PDF and DOCX. The PDF and DOCX libraries are passed in,
// so the same code runs in the browser bundle, the CLI and the MCP server.
//
// Hidden text: some resumes carry keywords or instructions a reader cannot see (tiny type,
// text placed off the page, zero-width characters) to game matching or AI screeners. That text
// is removed here and reported, so it never inflates a score or ends up on the person's resume.
// Not yet detected: white-on-white text (needs pdf.js's operator list to read fill colours).
import { stripInvisible } from './safety.js';

const TINY_PT = 3; // type smaller than this cannot be read on paper

/**
 * Rebuild reading-order lines from a PDF's text layer.
 * @param {object} pdfjs pdfjs-dist module
 * @param {Uint8Array} data
 * @param {{hidden?:{reason:string,text:string}[], invisibleChars?:number}} [report] filled with what was removed
 */
export async function extractPdfText(pdfjs, data, report = {}) {
  report.hidden = report.hidden || [];
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const [vx0, vy0, vx1, vy1] = page.view || [-Infinity, -Infinity, Infinity, Infinity];
    const items = content.items.filter((i) => {
      if (!('str' in i)) return false;
      if (!i.str.trim()) return true;
      const size = Math.hypot(i.transform[2], i.transform[3]);
      const x = i.transform[4], y = i.transform[5];
      const reason = size > 0 && size < TINY_PT ? 'tiny'
        : (x > vx1 || x + (i.width || 0) < vx0 || y > vy1 || y + size < vy0) ? 'off-page' : null;
      if (reason) { report.hidden.push({ reason, text: i.str.trim() }); return false; }
      return true;
    });
    // Group items into lines by their baseline.
    const lines = [];
    for (const it of items) {
      const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || 10;
      let line = lines.find((l) => Math.abs(l.y - y) < h * 0.45);
      if (!line) { line = { y, h, parts: [] }; lines.push(line); }
      line.parts.push({ x, w: it.width, s: it.str, eol: it.hasEOL });
    }
    lines.sort((a, b) => b.y - a.y);
    let prevY = null;
    for (const l of lines) {
      l.parts.sort((a, b) => a.x - b.x);
      let text = '', end = null;
      for (const part of l.parts) {
        if (end !== null) {
          const gap = part.x - end;
          if (gap > l.h * 2.5) text += '   '; // a wide gap: likely a separate column (date on the right)
          else if (gap > l.h * 0.15 && !text.endsWith(' ') && !part.s.startsWith(' ')) text += ' ';
        }
        text += part.s;
        end = part.x + part.w;
      }
      // A larger vertical gap means a paragraph break.
      if (prevY !== null && prevY - l.y > l.h * 2.2) pages.push('');
      pages.push(text.replace(/\s+$/, ''));
      prevY = l.y;
    }
    pages.push('');
  }
  const { text, removed } = stripInvisible(pages.join('\n'));
  report.invisibleChars = (report.invisibleChars || 0) + removed;
  return text;
}

/**
 * @param {object} mammoth mammoth module @param {ArrayBuffer|Buffer} data
 * @param {{invisibleChars?:number}} [report] filled with what was removed
 */
export async function extractDocxText(mammoth, data, report = {}) {
  const input = typeof Buffer !== 'undefined' && Buffer.isBuffer?.(data) ? { buffer: data } : { arrayBuffer: data };
  const res = await mammoth.extractRawText(input);
  const { text, removed } = stripInvisible(res.value);
  report.invisibleChars = (report.invisibleChars || 0) + removed;
  return text.replace(/\n{3,}/g, '\n\n');
}

/** One plain sentence for the person about hidden text that was removed, or ''. */
export function hiddenTextNote(report = {}) {
  const n = (report.hidden || []).length, z = report.invisibleChars || 0;
  if (!n && !z) return '';
  const sample = (report.hidden || []).map((h) => h.text).join(' ').slice(0, 80);
  return `Your file contains text a reader can't see${n ? ` (${n} hidden piece${n === 1 ? '' : 's'}${sample ? `, e.g. "${sample}${sample.length >= 80 ? '…' : ''}"` : ''})` : ''}${z ? `${n ? ' and' : ''} ${z} invisible character${z === 1 ? '' : 's'}` : ''}. We left it out. Recruiters and screening tools now look for hidden text, and finding it can get an application rejected.`;
}

export function detectKind(filename = '', bytes) {
  const n = filename.toLowerCase();
  if (n.endsWith('.pdf') || (bytes && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return 'pdf';
  if (n.endsWith('.docx') || (bytes && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'docx';
  if (n.endsWith('.json')) return 'json';
  return 'text';
}
