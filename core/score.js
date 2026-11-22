import { TEMPLATES } from './render.js';

// Open resume scoring rubric. Every rule, weight and fix text is public and editable.
// Scores are rule-based and explainable; no model call is needed.

export const ACTION_VERBS = new Set(`averaged reached processed closed booked sourced owned hosted handled answered assisted maintained performed accomplished acted adjusted advanced aligned allocated amplified anchored accelerated achieved acquired adapted addressed administered advised advocated analyzed applied appointed architected arranged assembled assessed assisted attained audited authored automated balanced boosted briefed budgeted built calculated captured centralized chaired championed clarified coached collaborated combined commissioned communicated compiled completed composed computed conceived conceptualized condensed conducted configured consolidated constructed consulted contracted contributed controlled converted convinced coordinated corrected counseled created cultivated cut debugged decreased defined delegated delivered demonstrated deployed designed detected determined developed devised diagnosed directed discovered documented doubled drafted drove earned edited educated eliminated enabled encouraged engineered enhanced ensured established estimated evaluated examined exceeded executed expanded expedited facilitated finalized forecasted formed formulated founded generated grew guided halved handled headed hired identified implemented improved increased influenced initiated innovated inspected installed instituted instructed integrated interviewed introduced invented investigated launched led leveraged lowered maintained managed mapped marketed maximized measured mentored merged migrated minimized modeled modernized monitored motivated negotiated operated optimized orchestrated organized originated overhauled oversaw partnered performed persuaded piloted pioneered planned prepared presented prevented prioritized processed produced programmed projected promoted proposed prototyped provided published purchased raised ran rebuilt recommended reconciled recruited redesigned reduced refactored refined regulated released remodeled renegotiated reorganized replaced reported represented researched resolved restored restructured revamped reviewed revised saved scaled scheduled secured selected served shaped shipped simplified sold solved spearheaded specified standardized streamlined strengthened structured supervised supported surpassed synthesized systematized tested trained transformed translated tripled troubleshot unified upgraded utilized validated won wrote`.split(/\s+/));

// Present-tense and third-person forms count too: "Lead", "Manages", "Oversee" (current roles).
const IRREGULAR = { lead: 'led', oversee: 'oversaw', build: 'built', run: 'ran', grow: 'grew', drive: 'drove', win: 'won', write: 'wrote',
  sell: 'sold', make: 'made', cut: 'cut', teach: 'taught', bring: 'brought', set: 'set', hold: 'held', spearhead: 'spearheaded' };
export function isActionVerb(word) {
  const w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return false;
  const bases = [w, w.replace(/(es|s)$/, ''), w.replace(/s$/, '')];
  return bases.some((b) => ACTION_VERBS.has(b) || ACTION_VERBS.has(b + 'ed') || ACTION_VERBS.has(b + 'd') ||
    ACTION_VERBS.has(b.replace(/y$/, 'ied')) || ACTION_VERBS.has(IRREGULAR[b]));
}

export const WEAK_OPENERS = /^(responsible for|duties included|worked on|helped( to)?|assisted with|tasked with|involved in|in charge of|participated in)\b/i;
export const FIRST_PERSON = /\b(i|me|my|mine|we|our)\b/i;
export const CLICHES = ['team player', 'hard worker', 'hardworking', 'go-getter', 'results-driven', 'results driven', 'detail-oriented', 'detail oriented', 'self-starter', 'self starter', 'think outside the box', 'synergy', 'dynamic', 'passionate', 'motivated individual', 'proven track record', 'best of breed', 'go-to person', 'rockstar', 'ninja', 'guru', 'excellent communication skills'];
export const NUMBER_RE = /(\d|%|\$|€|£|\bpercent\b|\bmillion\b|\bthousand\b|\bdoubled\b|\btripled\b|\bhalved\b|\bx\d|\d+x)/i;

const words = (s) => (s || '').trim().split(/\s+/).filter(Boolean);
const allBullets = (r) => (r.work || []).flatMap((w) => w.highlights || []);
const ratio = (n, d) => (d ? n / d : 0);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

function resumeWordCount(r) {
  const parts = [r.basics?.summary, ...allBullets(r), ...(r.work || []).map((w) => [w.position, w.name, w.summary].join(' ')),
    ...(r.education || []).map((e) => [e.institution, e.studyType, e.area].join(' ')), ...(r.skills || []).flatMap((s) => s.keywords || [])];
  return words(parts.filter(Boolean).join(' ')).length;
}

function dateKey(d) {
  if (!d) return 9999_12; // empty end date = present
  const [y, m] = d.split('-');
  return Number(y) * 100 + Number(m || 6);
}

/**
 * Each rule: id, category, weight (relative within category), title, check(resume) -> { score 0..1, detail, fix }.
 */
export const RUBRIC = [
  // ---------- Completeness ----------
  { id: 'name', category: 'completeness', weight: 2, title: 'Name at the top',
    check: (r) => r.basics?.name ? ok('Name found: ' + r.basics.name) : bad('No name found at the top.', 'Put your full name as the first line.') },
  { id: 'email', category: 'completeness', weight: 2, title: 'Email address',
    check: (r) => r.basics?.email ? ok('Email found.') : bad('No email address found.', 'Add a professional email address in the header.') },
  { id: 'phone', category: 'completeness', weight: 1, title: 'Phone number',
    check: (r) => r.basics?.phone ? ok('Phone found.') : bad('No phone number found.', 'Add a phone number with country code if you apply abroad.') },
  { id: 'location', category: 'completeness', weight: 1, title: 'Location',
    check: (r) => r.basics?.location?.city ? ok('Location found.') : bad('No city found.', 'Add "City, Region" (or "Remote"). Many job filters use it.') },
  { id: 'profile-link', category: 'completeness', weight: 0.5, title: 'Profile or portfolio link',
    check: (r) => (r.basics?.profiles?.length || r.basics?.url) ? ok('Link found.') : bad('No LinkedIn, GitHub or portfolio link.', 'Add one link recruiters can check, e.g. LinkedIn or a portfolio.') },
  { id: 'summary', category: 'completeness', weight: 1.5, title: 'Short summary',
    check: (r) => {
      const n = words(r.basics?.summary).length;
      if (!n) return bad('No summary.', 'Add 2–3 sentences: who you are, your strongest skill, the role you want.');
      if (n > 90) return part(0.5, `Summary is ${n} words.`, 'Trim the summary to under 80 words.');
      return ok(`Summary is ${n} words.`);
    } },
  { id: 'work', category: 'completeness', weight: 3, title: 'Work experience',
    check: (r) => r.work?.length ? ok(`${r.work.length} roles found.`) : bad('No work experience section found.', 'Add an "Experience" section (internships, freelance and volunteer work count).') },
  { id: 'education', category: 'completeness', weight: 1.5, title: 'Education',
    check: (r) => r.education?.length ? ok(`${r.education.length} education entries found.`) : bad('No education section found.', 'Add an "Education" section, even if it is one line.') },
  { id: 'skills', category: 'completeness', weight: 2, title: 'Skills list',
    check: (r) => {
      const n = (r.skills || []).reduce((a, s) => a + (s.keywords?.length || 0), 0);
      if (!n) return bad('No skills section found.', 'Add a "Skills" section with 8–20 concrete tools and skills.');
      if (n < 6) return part(0.6, `${n} skills listed.`, 'List at least 8 concrete skills; ATS keyword filters read this section.');
      if (n > 40) return part(0.7, `${n} skills listed.`, 'Cut to the 20–30 most relevant skills.');
      return ok(`${n} skills listed.`);
    } },

  // ---------- Structure ----------
  { id: 'dates', category: 'structure', weight: 2, title: 'Dates on every role',
    check: (r) => {
      const w = r.work || []; if (!w.length) return na();
      const withDates = w.filter((x) => x.startDate).length;
      const s = ratio(withDates, w.length);
      return s === 1 ? ok('Every role has dates.') : part(s, `${w.length - withDates} of ${w.length} roles have no dates.`, 'Add start and end dates (month and year) to every role.');
    } },
  { id: 'order', category: 'structure', weight: 1.5, title: 'Newest role first',
    check: (r) => {
      const w = (r.work || []).filter((x) => x.startDate); if (w.length < 2) return na();
      let inOrder = 0;
      for (let i = 1; i < w.length; i++) if (dateKey(w[i - 1].startDate) >= dateKey(w[i].startDate)) inOrder++;
      const s = ratio(inOrder, w.length - 1);
      return s === 1 ? ok('Roles are in reverse date order.') : part(s, 'Roles are not in reverse date order.', 'List roles newest first.');
    } },
  { id: 'titles', category: 'structure', weight: 1.5, title: 'Job title and employer on every role',
    check: (r) => {
      const w = r.work || []; if (!w.length) return na();
      const good = w.filter((x) => x.position && x.name).length;
      const s = ratio(good, w.length);
      return s === 1 ? ok('Every role has a title and employer.') : part(s, `${w.length - good} roles are missing a title or employer.`, 'Write each role as "Job title — Employer" on its own line.');
    } },
  { id: 'bullets-per-role', category: 'structure', weight: 1.5, title: '2–6 bullet points per role',
    check: (r) => {
      const w = r.work || []; if (!w.length) return na();
      const good = w.filter((x) => (x.highlights?.length || 0) >= 2 && x.highlights.length <= 7).length;
      const s = ratio(good, w.length);
      return s === 1 ? ok('Each role has 2–6 bullets.') : part(s, `${w.length - good} roles have too few or too many bullets.`, 'Give recent roles 3–6 bullets and older roles 2–3.');
    } },
  { id: 'length', category: 'structure', weight: 1.5, title: 'Length',
    check: (r) => {
      const n = resumeWordCount(r);
      if (n < 150) return part(0.3, `About ${n} words: too short.`, 'Aim for 350–800 words (one page early in a career, two pages later).');
      if (n < 300) return part(0.7, `About ${n} words.`, 'Add detail to your recent roles; aim for 350–800 words.');
      if (n > 1100) return part(0.5, `About ${n} words: likely over two pages.`, 'Cut older roles to one line each; aim for under 900 words.');
      return ok(`About ${n} words.`);
    } },
  { id: 'headings', category: 'structure', weight: 1, title: 'Standard section headings',
    check: (r) => {
      const unknown = r.meta?.applykin?.unparsed?.filter((u) => u.title) || [];
      return unknown.length ? part(0.6, `Unrecognized headings: ${unknown.map((u) => u.title).join(', ')}.`, 'Use standard headings (Summary, Experience, Education, Skills) so ATS software finds each section.') : ok('All headings recognized.');
    } },

  // ---------- Clarity ----------
  { id: 'action-verbs', category: 'clarity', weight: 2.5, title: 'Bullets start with an action verb',
    check: (r) => {
      const b = allBullets(r); if (!b.length) return na();
      const good = b.filter((x) => isActionVerb(words(x)[0])).length;
      const s = ratio(good, b.length);
      return s >= 0.8 ? ok(`${Math.round(s * 100)}% of bullets start with an action verb.`) : part(s / 0.8, `${Math.round(s * 100)}% of bullets start with an action verb.`, 'Start bullets with a verb: "Led", "Built", "Cut", "Grew" (present tense like "Lead" is fine for your current job).');
    } },
  { id: 'weak-openers', category: 'clarity', weight: 1, title: 'No "Responsible for…" bullets',
    check: (r) => {
      const b = allBullets(r); if (!b.length) return na();
      const weak = b.filter((x) => WEAK_OPENERS.test(x));
      return weak.length ? part(1 - ratio(weak.length, b.length), `${weak.length} bullets start with a weak phrase, e.g. "${weak[0].slice(0, 50)}…".`, 'Replace "Responsible for X" with what you did and what changed.') : ok('No weak openers.');
    } },
  { id: 'numbers', category: 'clarity', weight: 2.5, title: 'Results with numbers',
    check: (r) => {
      const b = allBullets(r); if (!b.length) return na();
      const s = ratio(b.filter((x) => NUMBER_RE.test(x)).length, b.length);
      return s >= 0.4 ? ok(`${Math.round(s * 100)}% of bullets include a number.`) : part(s / 0.4, `${Math.round(s * 100)}% of bullets include a number.`, 'Add numbers to at least 4 in 10 bullets: money, %, time saved, users, team size.');
    } },
  { id: 'bullet-length', category: 'clarity', weight: 1.5, title: 'Bullets of readable length',
    check: (r) => {
      const b = allBullets(r); if (!b.length) return na();
      const good = b.filter((x) => { const n = words(x).length; return n >= 5 && n <= 32; }).length;
      const s = ratio(good, b.length);
      return s >= 0.9 ? ok('Bullets are 5–32 words.') : part(s, `${b.length - good} bullets are too short or too long.`, 'Keep each bullet to one or two lines (about 10–30 words).');
    } },
  { id: 'first-person', category: 'clarity', weight: 1, title: 'No "I", "my", "we"',
    check: (r) => {
      const b = [...allBullets(r)]; if (!b.length) return na();
      const hits = b.filter((x) => FIRST_PERSON.test(x)).length;
      return hits ? part(1 - ratio(hits, b.length), `${hits} bullets use "I", "my" or "we".`, 'Drop pronouns: "I led the team" becomes "Led a team of 6".') : ok('No pronouns in bullets.');
    } },
  { id: 'cliches', category: 'clarity', weight: 1, title: 'No filler phrases',
    check: (r) => {
      const text = [r.basics?.summary, ...allBullets(r)].join(' ').toLowerCase();
      const found = CLICHES.filter((c) => text.includes(c));
      return found.length ? part(Math.max(0, 1 - found.length * 0.25), `Filler found: ${found.slice(0, 4).join(', ')}.`, 'Swap filler words for a concrete example that proves the trait.') : ok('No filler phrases.');
    } },
  { id: 'verb-variety', category: 'clarity', weight: 0.5, title: 'Varied verbs',
    check: (r) => {
      const v = allBullets(r).map((x) => words(x)[0]?.toLowerCase()).filter((x) => isActionVerb(x));
      if (v.length < 4) return na();
      const counts = {}; v.forEach((x) => (counts[x] = (counts[x] || 0) + 1));
      const [top, n] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return n / v.length > 0.3 ? part(0.5, `"${top}" starts ${n} bullets.`, `Vary the verbs; "${top}" starts too many bullets.`) : ok('Verbs are varied.');
    } },

  // ---------- ATS readiness ----------
  { id: 'text-layer', category: 'ats', weight: 3, title: 'Readable text (not an image)',
    check: (r) => {
      if (typeof r.meta?.applykin?.sourceText !== 'string') return na(); // JSON input: nothing was extracted
      const n = words(r.meta.applykin.sourceText).length;
      if (n < 60) return bad(`Only ${n} words could be read from the file.`, 'Export your resume from Word or Docs as a text PDF. Scanned or image PDFs are invisible to ATS software.');
      return ok(`${n} words read from the file.`);
    } },
  { id: 'sections-found', category: 'ats', weight: 2, title: 'Core sections detected',
    check: (r) => {
      const found = ['work', 'education', 'skills'].filter((k) => r[k]?.length).length;
      return found === 3 ? ok('Experience, Education and Skills were all detected.') : part(found / 3, `${3 - found} of 3 core sections could not be detected.`, 'Use plain headings and a single-column layout so software can find each section.');
    } },
  { id: 'contact-in-body', category: 'ats', weight: 1, title: 'Contact details in the body text',
    check: (r) => (r.basics?.email && r.basics?.phone) ? ok('Contact details are readable text.') : part(r.basics?.email ? 0.5 : 0, 'Email or phone could not be read.', 'Put contact details in the main text, not in a header/footer or an image.') },
  { id: 'layout', category: 'ats', weight: 1.5, title: 'ATS-safe design',
    check: (r, o) => {
      const t = TEMPLATES[o?.template];
      if (!t) return na();
      if (t.ats === 'best') return ok(`${t.label} is a single-column design every system reads.`);
      if (t.ats === 'good') return part(0.85, `${t.label} reads well in almost all systems.`, 'For the safest online applications, switch to Classic, Modern, Executive or Compact.');
      return part(0.4, `${t.label} has two columns, which some systems read out of order.`, 'Switch to a single-column design (Classic, Modern, Executive or Compact) for online applications.');
    } },
  { id: 'special-chars', category: 'ats', weight: 1, title: 'No odd symbols',
    check: (r) => {
      const t = r.meta?.applykin?.sourceText || '';
      const odd = (t.match(/[\uf000-\uf8ff\ufffd]/g) || []).length;
      return odd > 3 ? part(0.5, `${odd} unreadable symbols found (icon fonts or broken characters).`, 'Replace icons (phone, mail symbols) with plain words like "Email:".') : ok('No unreadable symbols.');
    } },
];

// Two separate scores, never merged:
//  - quality: a checklist of how complete, well-structured and clear the resume is
//  - ats:     whether applicant tracking systems can read the file and find each section
// Weights are our judgment, informed by the evidence in EVIDENCE below. They are not fitted to hiring outcomes.
export const CATEGORIES = {
  completeness: { label: 'Completeness', weight: 0.40, score: 'quality' },
  structure: { label: 'Structure', weight: 0.35, score: 'quality' },
  clarity: { label: 'Clarity', weight: 0.25, score: 'quality' },
  ats: { label: 'ATS readability', weight: 1, score: 'ats' },
};

// How strong the support is for each rule.
export const EVIDENCE_LEVELS = {
  strong: { label: 'Strong evidence', note: 'Follows from how tracking software reads files, or from what recruiters were measured looking at.' },
  moderate: { label: 'Some evidence', note: 'Supported by research on how recruiters skim resumes, but not tested against hiring results.' },
  advice: { label: 'Common advice', note: 'Widely recommended by recruiters and career coaches. Not proven to change interview rates.' },
};

export const EVIDENCE_SOURCES = {
  ladders: { label: 'Ladders eye-tracking study, 2018 (recruiters spend about 7.4 seconds; look at name, titles, companies, dates, education; columns and clutter hurt)', url: 'https://www.hrdive.com/news/eye-tracking-study-shows-recruiters-look-at-resumes-for-7-seconds/541582/' },
  enhancv: { label: 'Enhancv interviews with 25 U.S. recruiters, 2025 (92% say their ATS does not auto-reject on formatting or content)', url: 'https://enhancv.com/blog/does-ats-reject-resumes/' },
  parsing: { label: 'Colorado State University career center: complex formatting, graphics and unusual fonts can stop an ATS from parsing a resume', url: 'https://bizcareers.colostate.edu/resources/what-is-an-applicant-tracking-system-ats/' },
};

// Per-rule evidence level, the reason in plain words, and supporting sources.
export const RULE_EVIDENCE = {
  name: ['strong', 'Recruiters look at your name first, and tracking systems file you under it.', ['ladders', 'parsing']],
  email: ['strong', 'Without an email address, nobody can contact you.', ['parsing']],
  phone: ['strong', 'Many recruiters call first; systems store the number as a contact field.', ['parsing']],
  location: ['moderate', 'Recruiters and job filters often search by city or region.', []],
  'profile-link': ['advice', 'A LinkedIn or portfolio link lets recruiters check your work quickly.', []],
  summary: ['advice', 'A short summary frames the rest of the page.', []],
  work: ['strong', 'Job titles and employers are what recruiters spend the most time reading.', ['ladders']],
  education: ['strong', 'Education is one of the few sections recruiters were measured looking at in every review.', ['ladders']],
  skills: ['moderate', 'Recruiters search their systems by keyword, and the skills list is where most keywords live.', ['ladders']],
  dates: ['strong', 'Start and end dates are among the first things recruiters check.', ['ladders']],
  order: ['moderate', 'Recruiters read top to bottom and expect your current role first.', ['ladders']],
  titles: ['strong', 'Titles and companies are where recruiters look longest.', ['ladders']],
  'bullets-per-role': ['advice', 'A few bullets per job is easy to skim; one is thin, ten is a wall.', []],
  length: ['advice', 'One page early in a career, two later, is the usual expectation.', []],
  headings: ['strong', 'Systems find sections by their headings; unusual headings get missed.', ['parsing', 'ladders']],
  'action-verbs': ['advice', 'Starting with a verb makes bullets about what you did.', []],
  'weak-openers': ['advice', '"Responsible for" describes a duty, not a result.', []],
  numbers: ['advice', 'Numbers make results concrete and easy to compare.', []],
  'bullet-length': ['moderate', 'Long sentences slowed recruiters down in eye-tracking tests.', ['ladders']],
  'first-person': ['advice', 'Resumes are conventionally written without "I".', []],
  cliches: ['advice', 'Phrases like "team player" say little without an example.', []],
  'verb-variety': ['advice', 'Repeating the same verb makes bullets blur together.', []],
  'text-layer': ['strong', 'Scanned or image-only PDFs have no text for a system to read.', ['parsing']],
  'sections-found': ['strong', 'If a system cannot find your experience, education or skills, it cannot search them.', ['parsing']],
  'contact-in-body': ['strong', 'Some systems skip page headers, footers and images.', ['parsing']],
  layout: ['strong', 'Two-column layouts can be read out of order; recruiters also skimmed multi-column resumes less well.', ['parsing', 'ladders']],
  'special-chars': ['moderate', 'Icon fonts and odd symbols can come through as garbage characters.', ['parsing']],
};

function ok(detail) { return { score: 1, detail }; }
function bad(detail, fix) { return { score: 0, detail, fix }; }
function part(score, detail, fix) { return { score: clamp01(score), detail, fix }; }
function na() { return { score: null, detail: 'Not applicable.' }; }

/**
 * Score a JSON Resume.
 * @param {object} resume
 * @param {{template?:string}} opts the chosen design, used by the ATS layout check
 * @returns {{ quality:number, ats:number, overall:number, categories:object, checks:Array, fixes:Array }}
 */
export function scoreResume(resume, opts = {}) {
  const checks = RUBRIC.map((rule) => {
    let res;
    try { res = rule.check(resume, opts); } catch (e) { res = { score: null, detail: 'Check failed: ' + e.message }; }
    const [evidence, why, sources] = RULE_EVIDENCE[rule.id] || ['advice', '', []];
    return { id: rule.id, category: rule.category, title: rule.title, weight: rule.weight, evidence, why, sources, ...res };
  });
  const categories = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const cs = checks.filter((c) => c.category === key && c.score !== null);
    const w = cs.reduce((a, c) => a + c.weight, 0);
    const s = w ? cs.reduce((a, c) => a + c.score * c.weight, 0) / w : 0;
    categories[key] = { label: cat.label, score: Math.round(s * 100), of: cat.score };
  }
  const quality = Math.round(['completeness', 'structure', 'clarity'].reduce((a, k) => a + categories[k].score * CATEGORIES[k].weight, 0));
  const ats = categories.ats.score;
  // Fixes ranked by points they would add to the score they belong to.
  const fixes = checks
    .filter((c) => c.fix && c.score !== null && c.score < 1)
    .map((c) => {
      const catChecks = checks.filter((x) => x.category === c.category && x.score !== null);
      const catW = catChecks.reduce((a, x) => a + x.weight, 0);
      const gain = ((1 - c.score) * c.weight / catW) * CATEGORIES[c.category].weight * 100;
      return { id: c.id, title: c.title, detail: c.detail, fix: c.fix, gain: Math.round(gain * 10) / 10, score: CATEGORIES[c.category].score, evidence: c.evidence };
    })
    .sort((a, b) => (b.score === 'ats') - (a.score === 'ats') || b.gain - a.gain);
  return { quality, ats, overall: quality, categories, checks, fixes, rubricVersion: '0.2.0' };
}
