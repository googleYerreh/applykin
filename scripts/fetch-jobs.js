#!/usr/bin/env node
// Collect jobs from the boards in data/boards.json into a static JSON feed.
// Run on a schedule (see .github/workflows/fetch-jobs.yml) and serve the output from any static host/CDN.
// Usage: node scripts/fetch-jobs.js [--boards data/boards.json] [--out dist/jobs.json] [--max-age 45]
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchBoards, SOURCES } from '../core/jobs.js';

const arg = (name, def) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : def; };
const boardsPath = arg('--boards', 'data/boards.json');
const outPath = arg('--out', 'dist/jobs.json');
const maxAgeDays = Number(arg('--max-age', 45));

const { boards: companyBoards } = JSON.parse(await readFile(boardsPath, 'utf8'));
// Shared feeds (Arbeitnow, Jobicy…) live in data/feeds.json; a feed listed there replaces any copy in boards.json.
let feeds = [];
try { feeds = JSON.parse(await readFile(arg('--feeds', 'data/feeds.json'), 'utf8')).feeds || []; } catch {}
const feedSources = new Set(feeds.map((f) => f.source));
const boards = [...companyBoards.filter((b) => !feedSources.has(b.source)), ...feeds];
const started = Date.now();
const { jobs, errors } = await fetchBoards(boards, fetch, {
  maxAgeDays,
  headers: { 'user-agent': 'Applykin job feed (open-source, free job search)' },
  onProgress: (n, total) => process.stderr.write(`\r${n}/${total} boards`),
});
process.stderr.write('\n');

const feed = {
  generatedAt: new Date().toISOString(),
  count: jobs.length,
  sources: Object.fromEntries(Object.entries(SOURCES).map(([k, s]) => [k, { label: s.label, terms: s.terms, docs: s.docs }])),
  errors,
  jobs,
};
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(feed));
console.log(`${jobs.length} jobs from ${boards.length} boards in ${Math.round((Date.now() - started) / 1000)}s -> ${outPath}`);
if (errors.length) console.log(`${errors.length} errors:\n  ` + errors.join('\n  '));
