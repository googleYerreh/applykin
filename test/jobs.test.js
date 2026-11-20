import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SOURCES, finalizeJob, fetchBoards, dedupeJobs, htmlToText, decodeEntities, parseResume, rankJobs, tailorResume, templateLetter,
  extractSkills, trackJob, moveApplication, generate } from '../core/index.js';

const fx = (n) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const sample = (n) => parseResume(readFileSync(new URL(`../samples/${n}.txt`, import.meta.url), 'utf8'));
const all = () => [['greenhouse', 'examplecorp'], ['lever', 'examplepay'], ['ashby', 'exampleco'], ['arbeitnow', 1]]
  .flatMap(([s, slug]) => SOURCES[s].normalize(fx(s), slug).map(finalizeJob));

test('each source normalizes to the shared Job shape', () => {
  const jobs = all();
  assert.equal(jobs.length, 4, 'unlisted Ashby job is dropped');
  for (const j of jobs) {
    for (const k of ['id', 'source', 'company', 'title', 'url', 'applyUrl', 'postedAt', 'description', 'attribution']) assert.ok(j[k], `${j.source} ${k}`);
    assert.ok(!/[<>]|&lt;/.test(j.description), `${j.source} description is plain text`);
  }
  const ashby = jobs.find((j) => j.source === 'ashby');
  assert.deepEqual([ashby.salary.min, ashby.salary.max, ashby.salary.currency], [160000, 190000, 'USD']);
  assert.equal(jobs.find((j) => j.source === 'greenhouse').remote, true);
  assert.match(jobs.find((j) => j.source === 'arbeitnow').attribution, /Arbeitnow/);
});

test('htmlToText handles Greenhouse double-encoded HTML', () => {
  const raw = '&lt;p&gt;A &amp;amp; B&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;/ul&gt;';
  assert.match(htmlToText(decodeEntities(raw)), /^A & B\n+• One$/);
});

test('fetchBoards survives failures, applies company names, dedupes', async () => {
  const hosts = { 'boards-api.greenhouse.io': 'greenhouse', 'api.lever.co': 'lever', 'www.arbeitnow.com': 'arbeitnow' };
  const fake = async (u) => (u.includes('broken') ? { ok: false, status: 404 } : { ok: true, json: async () => fx(hosts[new URL(u).host]) });
  for (const s of Object.values(SOURCES)) s.rateLimitMs = 0;
  const { jobs, errors } = await fetchBoards([{ source: 'greenhouse', slug: 'a', company: 'Acme' }, { source: 'greenhouse', slug: 'broken' }, { source: 'lever', slug: 'b' }, { source: 'arbeitnow', pages: 2 }], fake, { maxAgeDays: 9999 });
  assert.equal(errors.length, 1);
  assert.equal(jobs.length, 3);
  assert.ok(jobs.some((j) => j.company === 'Acme'));
});

test('stale listings are dropped', () => {
  const old = { title: 'x', url: 'u', company: 'c', postedAt: '2020-01-01T00:00:00Z' };
  assert.equal(dedupeJobs([old], { maxAgeDays: 45 }).length, 0);
});

test('matching puts the right job first for each sample resume', () => {
  const jobs = all();
  assert.equal(rankJobs(sample('strong'), jobs)[0].job.title, 'Senior Product Designer');
  assert.equal(rankJobs(sample('german'), jobs)[0].job.title, 'Backend Engineer (Kotlin)');
  assert.equal(rankJobs(sample('weak'), jobs)[0].job.title, 'Warehouse Team Lead');
});

test('skill extraction avoids false hits for short words', () => {
  const s = extractSkills('We go to great lengths. Experience with Go, React and SQL.');
  assert.ok(s.has('go') && s.has('react') && s.has('sql'));
  assert.ok(!extractSkills('Ready to go the extra mile').has('go'));
});

test('tailoring never adds content', () => {
  const r = sample('strong');
  const job = all().find((j) => j.source === 'ashby');
  const t = tailorResume(r, job);
  const count = (x) => x.work.flatMap((w) => w.highlights).sort().join('|');
  assert.equal(count(t.tailoredResume), count(r));
  assert.ok(t.missing.includes('user research'));
});

test('template letter uses only resume facts and reads cleanly', () => {
  const letter = templateLetter(sample('weak'), { title: 'Team Lead', company: 'Harbor', description: 'forklift inventory' });
  assert.ok(!/\bI (duties|responsible|i)\b/i.test(letter), letter);
  assert.match(letter, /John Smith/);
});

test('tracker moves keep history', () => {
  let apps = trackJob([], { id: 'j1', title: 'T', company: 'C' });
  apps = moveApplication(apps, 'j1', 'applied');
  assert.equal(apps[0].stage, 'applied');
  assert.deepEqual(apps[0].history.map((h) => h.stage), ['saved', 'applied']);
  assert.equal(trackJob(apps, { id: 'j1' }).length, 1);
});

test('AI providers build the right requests', async () => {
  const calls = [];
  const fake = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ message: { content: 'hi' }, choices: [{ message: { content: 'hi' } }], content: [{ text: 'hi' }] }) }; };
  assert.equal(await generate({ provider: 'ollama' }, { system: 's', prompt: 'p' }, fake), 'hi');
  assert.equal(await generate({ provider: 'openai', apiKey: 'k' }, { system: 's', prompt: 'p' }, fake), 'hi');
  assert.equal(await generate({ provider: 'anthropic', apiKey: 'k' }, { system: 's', prompt: 'p' }, fake), 'hi');
  assert.match(calls[0].url, /11434\/api\/chat$/);
  assert.equal(calls[1].init.headers.authorization, 'Bearer k');
  assert.equal(calls[2].init.headers['x-api-key'], 'k');
  await assert.rejects(generate({ provider: 'openai' }, { system: '', prompt: '' }, fake), /API key/);
});

test('tailoring per job: spelling, trim, headline are opt-in and never add facts', async () => {
  const { tailorResume } = await import('../core/index.js');
  const r = sample('german');
  r.skills[0].keywords = r.skills[0].keywords.map((k) => (k === 'PostgreSQL' ? 'Postgres' : k));
  const job = { title: 'Senior Backend Engineer (Kotlin)', company: 'X', description: 'We use Kotlin, Java, Spring Boot and PostgreSQL on Kubernetes.' };
  const t = tailorResume(r, job);
  assert.ok(t.tailoredResume.skills[0].keywords.includes('PostgreSQL'), 'uses the ad spelling');
  assert.ok(t.changes.some((c) => c.kind === 'spelling'));
  assert.equal(t.tailoredResume.basics.label, r.basics.label, 'headline unchanged unless asked');
  assert.equal(t.headlineOption, 'Senior Backend Engineer');
  const t2 = tailorResume(r, job, { headline: true });
  assert.equal(t2.tailoredResume.basics.label, 'Senior Backend Engineer');
  const all = (x) => new Set(x.work.flatMap((w) => w.highlights));
  for (const h of all(t2.tailoredResume)) assert.ok(all(r).has(h), 'no new bullets');
});
