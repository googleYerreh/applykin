import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseResume, scoreResume, renderResumeHTML, normalizeDate, findDateRange } from '../core/index.js';
import { loadResume } from '../node/load.js';

const txt = (n) => readFileSync(new URL(`../samples/${n}.txt`, import.meta.url), 'utf8');

test('dates normalize across formats', () => {
  assert.equal(normalizeDate('Mar 2021'), '2021-03');
  assert.equal(normalizeDate('04/2021'), '2021-04');
  assert.equal(normalizeDate('2019'), '2019');
  assert.equal(normalizeDate('Present'), '');
  assert.deepEqual(findDateRange('Engineer  Jun 2018 – Feb 2021').startDate, '2018-06');
  assert.equal(findDateRange('10/2018 – heute').current, true);
});

test('parses a well-formed English resume', () => {
  const r = parseResume(txt('strong'));
  assert.equal(r.basics.name, 'Maria Gonzalez');
  assert.equal(r.basics.email, 'maria.gonzalez@example.com');
  assert.equal(r.basics.url, 'https://mariagonzalez.design');
  assert.equal(r.work.length, 3);
  assert.deepEqual([r.work[1].position, r.work[1].name, r.work[1].location], ['Product Designer', 'Brightloop', 'Remote']);
  assert.equal(r.work[0].highlights.length, 4);
  assert.equal(r.education[0].institution, 'University of Texas at Austin');
  assert.equal(r.skills.length, 3);
});

test('parses German headings and dates', () => {
  const r = parseResume(txt('german'));
  assert.equal(r.work[0].name, 'Alpenbank AG');
  assert.equal(r.work[0].endDate, '');
  assert.equal(r.education.length, 2);
  assert.equal(r.languages[1].fluency, 'C1');
});

test('scores rank a weak resume well below a strong one', () => {
  const strong = scoreResume(parseResume(txt('strong')));
  const weak = scoreResume(parseResume(txt('weak')));
  assert.ok(strong.overall >= 90, `strong ${strong.overall}`);
  assert.ok(weak.overall < 60, `weak ${weak.overall}`);
  assert.ok(weak.fixes.some((f) => f.id === 'action-verbs'));
  assert.ok(weak.fixes.some((f) => f.id === 'cliches'));
});

test('JSON round trip keeps the score', () => {
  const r = parseResume(txt('strong'));
  const { meta, ...plain } = r;
  assert.equal(scoreResume(JSON.parse(JSON.stringify(plain))).overall, scoreResume(r).overall);
});

test('renders escaped HTML with locale headings', () => {
  const r = parseResume(txt('german'));
  r.basics.name = '<script>x</script>';
  const html = renderResumeHTML(r, { locale: 'de' });
  assert.ok(!html.includes('<script>x'));
  assert.ok(html.includes('Berufserfahrung') && html.includes('size: A4'));
});

test('reads PDF and DOCX files', async () => {
  for (const f of ['strong.pdf', 'strong.docx', 'german.pdf']) {
    const r = await loadResume(new URL(`../samples/${f}`, import.meta.url).pathname);
    assert.ok(r.work.length >= 2, f);
  }
});

test('multi-role employer, wrapped bullets, bulleted education, present tense', () => {
  const r = parseResume(txt('multirole'));
  assert.equal(r.basics.location.city, 'Riverside');
  assert.deepEqual(r.work.map((w) => [w.position, w.name]), [
    ['Owner & Operations Manager', 'Northwind Goods LLC'],
    ['General Manager', 'Contoso Fitness'],
    ['Sales Counselor', 'Contoso Fitness'],
  ]);
  assert.match(r.work[1].highlights[0], /112% of quota\.$/, 'wrapped line joins its bullet');
  assert.deepEqual(r.education.map((e) => [e.studyType, e.area, e.institution]), [
    ['MBA', 'Finance', 'Example State University'],
    ['Bachelor of Science', 'Business Administration', 'École Supérieure de Commerce, Lyon, France'],
  ]);
  assert.equal(r.languages.length, 2);
  const s = scoreResume(r);
  assert.equal(s.checks.find((c) => c.id === 'action-verbs').score, 1, 'Lead / Manage count as action verbs');
});

test('weak resume: unknown heading stays out of bullets, titles are not cities', () => {
  const r = parseResume(txt('weak'));
  assert.deepEqual([r.work[0].position, r.work[0].name], ['Warehouse Associate', 'QuickShip Logistics']);
  assert.ok(!r.work.some((w) => (w.highlights || []).some((h) => /Stuff I Know/.test(h))));
});

test('every design renders, and two-column designs cost ATS points', async () => {
  const { TEMPLATES } = await import('../core/index.js');
  const r = parseResume(txt('strong'));
  for (const t of Object.keys(TEMPLATES)) assert.match(renderResumeHTML(r, { template: t }), /Maria Gonzalez/);
  const best = scoreResume(r, { template: 'classic' }), side = scoreResume(r, { template: 'sidebar' });
  assert.ok(best.ats > side.ats, 'two-column design lowers ATS readability');
  assert.equal(best.quality, side.quality, 'design does not change resume quality');
  assert.ok(side.fixes.some((f) => f.id === 'layout'));
  assert.equal(scoreResume(r).checks.find((c) => c.id === 'layout').score, null, 'no design given: not applicable');
});

test('two separate scores with evidence for every rule; letter PDF uses the resume design', async () => {
  const C = await import('../core/index.js');
  const s = scoreResume(parseResume(txt('strong')), { template: 'classic' });
  assert.ok(Number.isInteger(s.quality) && Number.isInteger(s.ats));
  for (const c of s.checks) assert.ok(C.EVIDENCE_LEVELS[c.evidence] && c.why, `evidence for ${c.id}`);
  const html = C.renderLetterHTML(parseResume(txt('strong')), 'Dear team,\n\nHello <b>there</b>.', { template: 'modern', company: 'Acme' });
  assert.match(html, /Maria Gonzalez/); assert.match(html, /#0b5cad/); assert.ok(!html.includes('<b>there'));
});
