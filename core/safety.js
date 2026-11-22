// Safety checks shared by the app, the CLI and the MCP server.
//  - safeUrl: only http(s) links may become clickable (job feed, pasted jobs, resume links).
//  - stripInvisible: remove zero-width and other invisible characters used to hide text.
//  - newFacts: list numbers, skills and names in AI output that are not in the source text,
//    so "never invents" is checked at runtime, not only in tests.
import { extractSkills } from './match.js';

/**
 * Return the link if it is an absolute http: or https: URL, otherwise ''.
 * Rejects javascript:, data:, vbscript:, file: and anything that does not parse.
 * A bare "linkedin.com/in/x" gets https:// added.
 */
export function safeUrl(value) {
  let s = String(value ?? '').trim().replace(/[\u0000-\u001F\u007F\s]+/g, '');
  if (!s) return '';
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    // No scheme: accept only something that looks like a host name ("example.com/...").
    if (!/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(s)) return '';
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

// Zero-width space/joiners, word joiner, BOM, soft hyphen, and the Unicode "tag" block.
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤﻿]|\uDB40[\uDC00-\uDC7F]/g;

/** @returns {{text:string, removed:number}} */
export function stripInvisible(text) {
  let removed = 0;
  const out = String(text ?? '').replace(INVISIBLE, () => { removed++; return ''; });
  return { text: out, removed };
}

const num = (s) => s.replace(/[,\s]/g, '').replace(/\.0+$/, '');
const NUMBERS = /\d+(?:[.,]\d+)*/g;
// Capitalized words that are not names: sentence starts are skipped separately; these are common mid-sentence.
const NOT_NAMES = new Set('I Dear Hiring Manager Sincerely Regards Best Thank Thanks Kind Team'.split(' '));

/**
 * Facts in `output` that none of the `sources` contain.
 * @param {string} output AI text
 * @param {string[]} sources resume text, the original bullet, the draft, job title, company…
 * @param {{names?:boolean}} opts names: also flag capitalized words (on for single bullets, off for letters)
 * @returns {string[]} the added numbers, skills and names, deduplicated
 */
export function newFacts(output, sources, { names = true } = {}) {
  const out = String(output ?? '');
  const src = sources.filter(Boolean).join('\n');
  const srcLower = src.toLowerCase();
  const srcNums = new Set((src.match(NUMBERS) || []).map(num));
  const found = [];

  for (const n of out.match(NUMBERS) || []) if (!srcNums.has(num(n))) found.push(n);

  const srcSkills = extractSkills(src);
  for (const k of extractSkills(out)) if (!srcSkills.has(k) && !srcLower.includes(k)) found.push(k);

  if (names) {
    // A capitalized word that does not start a sentence or line, e.g. "at Google" or "using Salesforce".
    for (const sentence of out.split(/(?<=[.!?:])\s+|\n+/)) {
      for (const raw of sentence.trim().split(/\s+/).slice(1)) {
        const w = raw.replace(/^[("'“]+|[)"'”.,;:!?]+$/g, '');
        if (/^[A-Z][a-zA-Z0-9&+.-]{2,}$/.test(w) && !NOT_NAMES.has(w) && !srcLower.includes(w.toLowerCase())) found.push(w);
      }
    }
  }
  return [...new Set(found)];
}
