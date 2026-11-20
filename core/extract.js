// Text extraction from PDF and DOCX. The PDF and DOCX libraries are passed in,
// so the same code runs in the browser bundle, the CLI and the MCP server.

/**
 * Rebuild reading-order lines from a PDF's text layer.
 * @param {object} pdfjs pdfjs-dist module
 * @param {Uint8Array} data
 */
export async function extractPdfText(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items.filter((i) => 'str' in i);
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
  return pages.join('\n');
}

/** @param {object} mammoth mammoth module @param {ArrayBuffer|Buffer} data */
export async function extractDocxText(mammoth, data) {
  const input = typeof Buffer !== 'undefined' && Buffer.isBuffer?.(data) ? { buffer: data } : { arrayBuffer: data };
  const res = await mammoth.extractRawText(input);
  return res.value.replace(/\n{3,}/g, '\n\n');
}

export function detectKind(filename = '', bytes) {
  const n = filename.toLowerCase();
  if (n.endsWith('.pdf') || (bytes && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return 'pdf';
  if (n.endsWith('.docx') || (bytes && bytes[0] === 0x50 && bytes[1] === 0x4b)) return 'docx';
  if (n.endsWith('.json')) return 'json';
  return 'text';
}
