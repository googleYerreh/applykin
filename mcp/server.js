#!/usr/bin/env node
// Applykin MCP server (stdio). Lets any MCP client (Claude, IDE agents) parse, score and export resumes.
import { safeUrl } from '../core/safety.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { writeFile } from 'node:fs/promises';
import { loadResume } from '../node/load.js';
import { readFile } from 'node:fs/promises';
import { parseResume, scoreResume, renderResumeHTML, RUBRIC, LOCALES, TEMPLATES, rankJobs, tailorResume, templateLetter, fetchBoards, SOURCES } from '../core/index.js';

const server = new McpServer({ name: 'applykin', version: '0.1.0' });

const json = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const stripMeta = ({ meta, ...rest }) => rest;

async function resolveResume({ path, text, resume }) {
  if (resume) return typeof resume === 'string' ? JSON.parse(resume) : resume;
  if (path) return loadResume(path);
  if (text) return parseResume(text);
  throw new Error('Give one of: path, text, or resume.');
}

const source = {
  path: z.string().optional().describe('Path to a PDF, DOCX, TXT or JSON Resume file'),
  text: z.string().optional().describe('Plain resume text'),
  resume: z.union([z.string(), z.record(z.any())]).optional().describe('A JSON Resume object (or JSON string)'),
};

server.tool('parse_resume', 'Convert a resume (PDF, DOCX, text) into JSON Resume.', source,
  async (a) => json(stripMeta(await resolveResume(a))));

server.tool('score_resume', 'Score a resume with the open Applykin rubric. Returns overall, category scores, every check, and fixes ranked by points gained.', source,
  async (a) => json(scoreResume(await resolveResume(a))));

server.tool('render_resume', 'Render a resume to print-ready HTML. Writes to output_path if given, otherwise returns the HTML.',
  { ...source,
    template: z.enum(Object.keys(TEMPLATES)).default('classic'),
    locale: z.enum(Object.keys(LOCALES)).default('us'),
    output_path: z.string().optional().describe('Where to write the .html file') },
  async (a) => {
    const html = renderResumeHTML(await resolveResume(a), { template: a.template, locale: a.locale });
    if (a.output_path) { await writeFile(a.output_path, html); return json({ written: a.output_path, bytes: html.length }); }
    return { content: [{ type: 'text', text: html }] };
  });

server.tool('get_rubric', 'List every scoring rule with its category and weight.', {},
  async () => json(RUBRIC.map(({ check, ...r }) => r)));

async function loadJobs(jobs_path) {
  const data = JSON.parse(await readFile(jobs_path, 'utf8'));
  return Array.isArray(data) ? data : data.jobs || [];
}
const jobInput = {
  jobs_path: z.string().optional().describe('jobs.json feed file (use with job_id)'),
  job_id: z.string().optional().describe('Job id inside jobs_path'),
  job_title: z.string().optional(), job_company: z.string().optional(),
  job_description: z.string().optional().describe('Full job ad text, if not using jobs_path'),
};
async function resolveJob(a) {
  if (a.jobs_path) {
    const jobs = await loadJobs(a.jobs_path);
    const job = a.job_id ? jobs.find((j) => j.id === a.job_id) : null;
    if (!job) throw new Error('job_id not found in jobs_path');
    return job;
  }
  if (!a.job_description) throw new Error('Give job_description, or jobs_path + job_id.');
  return { title: a.job_title || '', company: a.job_company || '', description: a.job_description };
}
const resumeInput = {
  resume_path: z.string().optional().describe('Resume file (PDF, DOCX, TXT or JSON Resume)'),
  resume: z.union([z.string(), z.record(z.any())]).optional().describe('JSON Resume object'),
};
const getResume = (a) => resolveResume({ path: a.resume_path, resume: a.resume });

server.tool('fetch_jobs', `Collect current jobs from public job boards (${Object.keys(SOURCES).join(', ')}) and save them to a jobs.json file.`,
  { boards: z.array(z.object({ source: z.enum(Object.keys(SOURCES)), slug: z.string().optional(), company: z.string().optional(), pages: z.number().optional() })),
    output_path: z.string().describe('Where to write jobs.json') },
  async ({ boards, output_path }) => {
    const { jobs, errors } = await fetchBoards(boards, fetch, { headers: { 'user-agent': 'Applykin job feed (open-source)' } });
    await writeFile(output_path, JSON.stringify({ generatedAt: new Date().toISOString(), count: jobs.length, errors, jobs }));
    return json({ written: output_path, jobs: jobs.length, errors });
  });

server.tool('match_jobs', 'Rank jobs in a jobs.json file for a resume, with matched and missing skills for each.',
  { ...resumeInput, jobs_path: z.string(), query: z.string().optional(), location: z.string().optional(), remote_only: z.boolean().optional(), limit: z.number().default(20) },
  async (a) => {
    const ranked = rankJobs(await getResume(a), await loadJobs(a.jobs_path), { query: a.query, location: a.location, remote: a.remote_only, limit: a.limit });
    return json(ranked.map(({ job, match }) => ({ score: match.score, id: job.id, title: job.title, company: job.company, location: job.location, remote: job.remote, salary: job.salary?.text, apply_url: safeUrl(job.applyUrl), matched: match.matched, missing: match.missing, source: job.attribution })));
  });

server.tool('tailor_resume', 'Compare a resume with a job: skills shown, skills only listed, skills missing, suggestions, and a version with the most relevant bullets first (nothing invented).',
  { ...resumeInput, ...jobInput, output_path: z.string().optional().describe('Write the reordered JSON Resume here') },
  async (a) => {
    const t = tailorResume(await getResume(a), await resolveJob(a));
    if (a.output_path) { const { meta, ...plain } = t.tailoredResume; await writeFile(a.output_path, JSON.stringify(plain, null, 2)); }
    const { tailoredResume, ...report } = t;
    return json({ ...report, written: a.output_path || null });
  });

server.tool('write_cover_letter', 'Draft a cover letter using only facts from the resume. The user should review it before sending.',
  { ...resumeInput, ...jobInput },
  async (a) => ({ content: [{ type: 'text', text: templateLetter(await getResume(a), await resolveJob(a)) }] }));

await server.connect(new StdioServerTransport());
