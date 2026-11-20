// Node adapter: read a resume file (PDF, DOCX, TXT, or JSON Resume) and return a JSON Resume.
import { readFile } from 'node:fs/promises';
import { parseResume, extractPdfText, extractDocxText, detectKind } from '../core/index.js';

export async function fileToText(path) {
  const buf = await readFile(path);
  const kind = detectKind(path, buf);
  if (kind === 'pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    return extractPdfText(pdfjs, new Uint8Array(buf));
  }
  if (kind === 'docx') {
    const mammoth = (await import('mammoth')).default;
    return extractDocxText(mammoth, buf);
  }
  return buf.toString('utf8');
}

/** Loads a JSON Resume directly, or parses any other file into one. */
export async function loadResume(path) {
  if (path.toLowerCase().endsWith('.json')) return JSON.parse(await readFile(path, 'utf8'));
  return parseResume(await fileToText(path));
}
