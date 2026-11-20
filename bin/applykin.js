#!/usr/bin/env node
// Applykin CLI: parse, score, render and export resumes from the terminal.
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadResume } from '../node/load.js';
import { scoreResume, renderResumeHTML, RUBRIC, LOCALES, TEMPLATES, rankJobs, tailorResume, templateLetter, letterPrompt, generate, fetchBoards } from '../core/index.js';
import { readFile } from 'node:fs/promises';

const HELP = `applykin — free, open-source job-search tools

Usage:
  applykin parse  <resume.pdf|docx|txt>            Print JSON Resume (or -o out.json)
  applykin score  <resume|resume.json> [--json]    Score with the open rubric
  applykin render <resume|resume.json> -o out.html Render a print-ready HTML resume
  applykin pdf    <resume|resume.json> -o out.pdf  Render a PDF (needs Chrome/Chromium; set CHROME_PATH)
  applykin rubric                                  List every scoring rule

  applykin jobs fetch [--boards data/boards.json] -o jobs.json   Collect jobs from public boards
  applykin match  <resume> <jobs.json> [--q text] [--remote] [--limit 20]   Rank jobs for a resume
  applykin tailor <resume> <job.txt|jobs.json --id ID>           Keyword gaps + reordered resume (-o out.json)
  applykin letter <resume> <job.txt|jobs.json --id ID> [--ai ollama|openai|anthropic] [--model M]
                                                   Cover letter from your resume's facts (AI optional;
                                                   keys from OPENAI_API_KEY / ANTHROPIC_API_KEY)

Options:
  -o, --out <file>        Output file
  --template <name>       ${Object.keys(TEMPLATES).join(' | ')} (default classic)
  --locale <code>         ${Object.keys(LOCALES).join(' | ')} (default us)
  --json                  Machine-readable output`;

function args(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '-o' || x === '--out') a.out = argv[++i];
    else if (x === '--template') a.template = argv[++i];
    else if (x === '--locale') a.locale = argv[++i];
    else if (x === '--json') a.json = true;
    else if (x === '--remote') a.remote = true;
    else if (['--q', '--limit', '--id', '--boards', '--ai', '--model', '--location'].includes(x)) a[x.slice(2)] = argv[++i];
    else if (x === '-h' || x === '--help') a.help = true;
    else a._.push(x);
  }
  return a;
}

function stripMeta(r) {
  const { meta, ...rest } = r;
  return rest;
}

async function loadJobs(path) {
  if (!path) throw new Error('Give a jobs.json file (from `applykin jobs fetch`).');
  const data = JSON.parse(await readFile(path, 'utf8'));
  return Array.isArray(data) ? data : data.jobs || [];
}

/** A job from a jobs.json (with --id) or a plain-text job description file (first line = title). */
async function loadJob(path, id) {
  if (!path) throw new Error('Give a job: a text file with the job description, or jobs.json with --id.');
  if (path.endsWith('.json')) {
    const jobs = await loadJobs(path);
    const job = id ? jobs.find((j) => j.id === id) : jobs[0];
    if (!job) throw new Error(`No job with id ${id}`);
    return job;
  }
  const text = await readFile(path, 'utf8');
  const [first, ...rest] = text.split('\n');
  const m = first.match(/^(.*?)\s+(?:at|@|—|-|\|)\s+(.*)$/);
  return { title: (m ? m[1] : first).trim(), company: m ? m[2].trim() : '', description: rest.join('\n').trim() || text };
}

function findChrome() {
  const c = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'];
  return c.find((p) => p && existsSync(p));
}

export async function htmlToPdf(html, outPath) {
  const chrome = findChrome();
  if (!chrome) throw new Error('No Chrome/Chromium found. Set CHROME_PATH, or use `render` and print the HTML to PDF from a browser.');
  const dir = await mkdtemp(join(tmpdir(), 'applykin-'));
  try {
    const src = join(dir, 'resume.html');
    await writeFile(src, html);
    await promisify(execFile)(chrome, ['--headless', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
      `--print-to-pdf=${resolve(outPath)}`, 'file://' + src], { timeout: 60000 });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function bar(n) { const f = Math.round(n / 5); return '█'.repeat(f) + '░'.repeat(20 - f); }

async function main() {
  const a = args(process.argv.slice(2));
  const [cmd, file] = a._;
  if (a.help || !cmd) return console.log(HELP);

  if (cmd === 'rubric') {
    if (a.json) return console.log(JSON.stringify(RUBRIC.map(({ check, ...r }) => r), null, 2));
    for (const r of RUBRIC) console.log(`${r.category.padEnd(13)} w${String(r.weight).padEnd(4)} ${r.id.padEnd(18)} ${r.title}`);
    return;
  }
  if (cmd === 'jobs') {
    if (file !== 'fetch') throw new Error('Usage: applykin jobs fetch [--boards data/boards.json] -o jobs.json');
    const { boards } = JSON.parse(await readFile(a.boards || 'data/boards.json', 'utf8'));
    const { jobs, errors } = await fetchBoards(boards, fetch, { headers: { 'user-agent': 'Applykin job feed (open-source)' }, onProgress: (n, t) => process.stderr.write(`\r${n}/${t} boards`) });
    process.stderr.write('\n');
    const out = a.out || 'jobs.json';
    await writeFile(out, JSON.stringify({ generatedAt: new Date().toISOString(), count: jobs.length, errors, jobs }));
    console.error(`Wrote ${jobs.length} jobs to ${out}${errors.length ? ` (${errors.length} boards failed)` : ''}`);
    return;
  }
  if (!file) throw new Error(`Missing input file.\n\n${HELP}`);
  const resume = await loadResume(file);
  const opts = { template: a.template || 'classic', locale: a.locale || 'us' };

  switch (cmd) {
    case 'parse': {
      const json = JSON.stringify(stripMeta(resume), null, 2);
      if (a.out) { await writeFile(a.out, json); console.error(`Wrote ${a.out}`); } else console.log(json);
      break;
    }
    case 'score': {
      const s = scoreResume(resume);
      if (a.json) return console.log(JSON.stringify(s, null, 2));
      console.log(`\n  ${resume.basics?.name || 'Resume'}: ${s.overall}/100\n`);
      for (const c of Object.values(s.categories)) console.log(`  ${c.label.padEnd(14)} ${bar(c.score)} ${c.score}`);
      if (s.fixes.length) {
        console.log('\n  Top fixes:');
        s.fixes.slice(0, 8).forEach((f, i) => console.log(`  ${i + 1}. [+${f.gain}] ${f.title}: ${f.detail}\n       → ${f.fix}`));
      }
      console.log('');
      break;
    }
    case 'render': {
      const html = renderResumeHTML(resume, opts);
      const out = a.out || 'resume.html';
      await writeFile(out, html);
      console.error(`Wrote ${out}`);
      break;
    }
    case 'pdf': {
      const out = a.out || 'resume.pdf';
      await htmlToPdf(renderResumeHTML(resume, opts), out);
      console.error(`Wrote ${out}`);
      break;
    }
    case 'match': {
      const jobs = await loadJobs(a._[2]);
      const ranked = rankJobs(resume, jobs, { query: a.q, remote: a.remote, location: a.location, limit: Number(a.limit) || 20 });
      if (a.json) return console.log(JSON.stringify(ranked.map(({ job, match }) => ({ score: match.score, id: job.id, title: job.title, company: job.company, location: job.location, url: job.applyUrl, matched: match.matched, missing: match.missing })), null, 2));
      for (const { job, match } of ranked) console.log(`${String(match.score).padStart(3)}  ${job.title} — ${job.company}${job.location ? ' (' + job.location + ')' : ''}\n     ${match.reasons.join(' · ')}\n     ${job.applyUrl}  [${job.id}]`);
      break;
    }
    case 'tailor': {
      const job = await loadJob(a._[2], a.id);
      const t = tailorResume(resume, job);
      if (a.out) { const { meta, ...plain } = t.tailoredResume; await writeFile(a.out, JSON.stringify(plain, null, 2)); console.error(`Wrote ${a.out}`); }
      const { tailoredResume, ...report } = t;
      if (a.json) return console.log(JSON.stringify(report, null, 2));
      console.log(`\n  ${job.title || 'Job'}${job.company ? ' — ' + job.company : ''}: covers ${t.coverage ?? '?'}% of the skills it names\n`);
      console.log(`  In your bullets:  ${t.matched.join(', ') || '—'}\n  Listed only:      ${t.listedOnly.join(', ') || '—'}\n  Missing:          ${t.missing.join(', ') || '—'}\n`);
      t.suggestions.forEach((x) => console.log('  • ' + x));
      console.log('');
      break;
    }
    case 'letter': {
      const job = await loadJob(a._[2], a.id);
      let text = templateLetter(resume, job);
      if (a.ai) {
        const apiKey = a.ai === 'openai' ? process.env.OPENAI_API_KEY : a.ai === 'anthropic' ? process.env.ANTHROPIC_API_KEY : undefined;
        text = await generate({ provider: a.ai, model: a.model, apiKey, baseUrl: process.env.APPLYKIN_AI_BASE_URL }, letterPrompt(resume, job, text, { locale: opts.locale }));
      }
      if (a.out) { await writeFile(a.out, text); console.error(`Wrote ${a.out}`); } else console.log(text);
      break;
    }
    default:
      throw new Error(`Unknown command "${cmd}".\n\n${HELP}`);
  }
}

main().catch((e) => { console.error('applykin: ' + e.message); process.exit(1); });
