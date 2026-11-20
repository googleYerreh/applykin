#!/usr/bin/env node
// Find which job-board system (Greenhouse, Lever, Ashby) each candidate company uses,
// and add the ones that answer with open jobs to data/boards.json.
// Usage: node scripts/find-boards.js [--candidates data/candidates.txt] [--boards data/boards.json] [--workers 4]
import { readFile, writeFile } from 'node:fs/promises';
import { SOURCES } from '../core/jobs.js';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const candidatesPath = arg('--candidates', 'data/candidates.txt');
const boardsPath = arg('--boards', 'data/boards.json');
const workers = Number(arg('--workers', 4));
const TRY = ['greenhouse', 'lever', 'ashby'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const candidates = (await readFile(candidatesPath, 'utf8')).split('\n')
  .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  .map((l) => { const [slug, ...name] = l.split(','); return { slug: slug.trim(), company: name.join(',').trim() || slug.trim() }; });

const boardsFile = JSON.parse(await readFile(boardsPath, 'utf8'));
const known = new Set(boardsFile.boards.map((b) => `${b.source}:${b.slug}`));

async function probe(source, slug) {
  try {
    const res = await fetch(SOURCES[source].endpoint(slug), { headers: { accept: 'application/json', 'user-agent': 'Applykin board finder (open-source)' } });
    if (!res.ok) return 0;
    const raw = await res.json();
    return SOURCES[source].normalize(raw, slug).length;
  } catch { return 0; }
}

const found = [];
let done = 0;
const queue = [...candidates];
async function worker() {
  while (queue.length) {
    const c = queue.shift();
    for (const source of TRY) {
      if (known.has(`${source}:${c.slug}`)) { found.push({ source, slug: c.slug, company: c.company, jobs: -1 }); break; }
      const n = await probe(source, c.slug);
      await sleep(300);
      if (n > 0) { found.push({ source, slug: c.slug, company: c.company, jobs: n }); break; }
    }
    process.stderr.write(`\r${++done}/${candidates.length} checked, ${found.length} found`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
process.stderr.write('\n');

const today = new Date().toISOString().slice(0, 10);
let added = 0;
for (const f of found) {
  if (known.has(`${f.source}:${f.slug}`)) continue;
  boardsFile.boards.push({ source: f.source, slug: f.slug, company: f.company, verified: today });
  known.add(`${f.source}:${f.slug}`);
  added++;
}
await writeFile(boardsPath, JSON.stringify(boardsFile, null, 2) + '\n');
const jobs = found.filter((f) => f.jobs > 0).reduce((a, f) => a + f.jobs, 0);
console.log(`Added ${added} new boards (${jobs} open jobs among them). ${boardsFile.boards.length} boards in ${boardsPath}.`);
const missing = candidates.filter((c) => !found.some((f) => f.slug === c.slug)).map((c) => c.slug);
if (missing.length) console.log(`Not found on Greenhouse, Lever or Ashby (${missing.length}): ${missing.join(', ')}`);
