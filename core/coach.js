// Resume coach: turns the scoring rules into a short, ordered list of concrete suggestions,
// grouped into steps. Every suggestion either rearranges or rewords text already on the resume,
// or asks the person a question. It never adds a fact the person did not write or type.
import { scoreResume, WEAK_OPENERS, FIRST_PERSON, CLICHES, NUMBER_RE, isActionVerb } from './score.js';
import { extractSkills } from './match.js';

export const COACH_STEPS = [
  { id: 'structure', label: 'Structure', blurb: 'Contact details, order, dates and your summary.' },
  { id: 'work', label: 'Work experience', blurb: 'Stronger bullets: action verbs, results and numbers.' },
  { id: 'education', label: 'Education and skills', blurb: 'Your degrees, certificates and skills list.' },
  { id: 'editor', label: 'Final polish in the editor', blurb: 'Review everything and download your resume.' },
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dateKey = (d) => { if (!d) return 999912; const [y, m] = String(d).split('-'); return Number(y) * 100 + Number(m || 6); };

// ---------- path helpers: "work.2.highlights.1" ----------
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  }
  o[keys[keys.length - 1]] = value;
  return obj;
}

/** Apply a suggestion's operations to a copy of the resume. */
export function applyOps(resume, ops) {
  const r = clone(resume);
  for (const op of ops) {
    if (op.op === 'set') setPath(r, op.path, op.value);
    if (op.op === 'splitBullet') {
      const list = getPath(r, op.path.replace(/\.\d+$/, ''));
      const i = Number(op.path.split('.').pop());
      list.splice(i, 1, ...op.value);
    }
    if (op.op === 'addBullet') { const w = getPath(r, op.path); w.highlights = [...(w.highlights || []), op.value]; }
    if (op.op === 'sortWork') r.work = [...(r.work || [])].sort((a, b) => dateKey(b.startDate) - dateKey(a.startDate));
    if (op.op === 'addSkills') {
      r.skills = r.skills?.length ? r.skills : [{ name: 'Skills', keywords: [] }];
      const have = new Set(r.skills.flatMap((s) => s.keywords || []).map((k) => k.toLowerCase()));
      r.skills[0].keywords = [...(r.skills[0].keywords || []), ...op.value.filter((k) => !have.has(k.toLowerCase()))];
    }
    if (op.op === 'addEducation') r.education = [...(r.education || []), op.value];
  }
  return r;
}

// ---------- rewording without new facts ----------
const GERUND_IRREGULAR = { leading: 'Led', building: 'Built', running: 'Ran', overseeing: 'Oversaw', growing: 'Grew', driving: 'Drove', writing: 'Wrote', selling: 'Sold', making: 'Made', setting: 'Set', teaching: 'Taught', bringing: 'Brought', holding: 'Held', winning: 'Won', cutting: 'Cut', paying: 'Paid', planning: 'Planned', shipping: 'Shipped' };
const MORE_IRREGULAR = { taking: 'Took', giving: 'Gave', keeping: 'Kept', meeting: 'Met', getting: 'Got', sending: 'Sent', spending: 'Spent', finding: 'Found', buying: 'Bought', speaking: 'Spoke', telling: 'Told', having: 'Had', doing: 'Did', seeing: 'Saw', choosing: 'Chose', putting: 'Put', hiring: 'Hired' };
function gerundToPast(g) {
  const w = g.toLowerCase();
  if (GERUND_IRREGULAR[w] || MORE_IRREGULAR[w]) return GERUND_IRREGULAR[w] || MORE_IRREGULAR[w];
  if (!w.endsWith('ing') || w.length < 6) return null;
  const stem = w.slice(0, -3); // managing -> manag(ed), loading -> load(ed), applying -> appl(ied)
  return cap(/[^aeiou]y$/.test(stem) ? stem.slice(0, -1) + 'ied' : stem + 'ed');
}

/** "Responsible for managing the team" -> "Managed the team". Returns null when unsure. */
export function strengthenOpener(bullet) {
  const b = String(bullet).trim();
  const m = b.match(WEAK_OPENERS);
  if (!m) return null;
  const rest = b.slice(m[0].length).trim();
  const first = rest.split(/\s+/)[0] || '';
  const opener = m[0].toLowerCase();
  if (/ing$/i.test(first)) {
    const past = gerundToPast(first);
    if (past) return `${past}${rest.slice(first.length)}`;
  }
  // "Responsible for the budget" -> "Owned the budget"; "In charge of X" -> "Oversaw X"
  if (/^(responsible for|in charge of)$/.test(opener) && rest) return `${opener.startsWith('in') ? 'Oversaw' : 'Owned'} ${rest}`;
  if (/^(assisted with|helped( to)?)$/.test(opener) && rest) {
    const obj = rest.replace(/^(with|to)\s+/i, '');
    const w0 = obj.split(/\s+/)[0] || '';
    // "Helped organize events" names an action, not an object; leave it for the person to reword.
    if (isActionVerb(w0 + 'ed') || isActionVerb(w0 + 'd') || isActionVerb(w0)) return null;
    return `Supported ${obj}`;
  }
  return null;
}

/** "I managed my team of 5" -> "Managed a team of 5". */
export function removeFirstPerson(text) {
  let t = String(text).trim()
    .replace(/^(i|we)\s+/i, '')
    .replace(/\b(my|our)\s+/gi, 'the ')
    .replace(/\s+\b(i|we)\s+/gi, ' ')
    .replace(/\b(me|us)\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
  return cap(t);
}

const OBJECTIVE = /\b(looking for|seeking (a|an)|where i can grow|to grow my|opportunity to)\b/i;
/**
 * Clean a summary: drop sentences built on clichés or job-seeking objectives, remove "I".
 * Returns '' when too little is left, so the caller can offer a fact-based draft instead.
 */
export function cleanSummary(text) {
  const sentences = String(text).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
  const keep = sentences.filter((x) => !OBJECTIVE.test(x) && !CLICHES.some((c) => x.toLowerCase().includes(c)));
  const out = keep.map((x) => (FIRST_PERSON.test(x) ? removeFirstPerson(x) : x)).join(' ').trim();
  return words(out).length >= 10 ? out : '';
}
export const removeCliches = cleanSummary;

/** Split a long bullet at "; " into two complete bullets, when both halves stand alone. */
export function splitLong(bullet) {
  const parts = String(bullet).split(/;\s+/);
  if (parts.length !== 2) return null;
  const [a, b] = parts.map((p) => cap(p.trim().replace(/\.$/, '')));
  if (words(a).length < 5 || words(b).length < 5) return null;
  return [a, isActionVerb(words(b)[0]) ? b : null].every(Boolean) ? [a, b] : null;
}

// ---------- the plan ----------
const s0 = (r) => scoreResume(r);
function gainOf(before, after) {
  const a = s0(before), b = s0(after);
  return { quality: b.quality - a.quality, ats: b.ats - a.ats };
}

/**
 * Build the coach's suggestions for one step, most valuable first.
 * Each suggestion: { id, step, kind: 'patch'|'ask', title, why, fields?, ops?, question?, answer?(text)->ops, gain }
 */
export function coachSuggestions(resume, step) {
  const r = resume;
  const out = [];
  const b = r.basics || {};
  const work = r.work || [];

  if (step === 'structure') {
    const ask = (id, title, why, question, path, placeholder) =>
      out.push({ id, step, kind: 'ask', title, why, question, placeholder, answer: (t) => [{ op: 'set', path, value: t.trim() }] });
    if (!b.name) ask('name', 'Add your name', 'A resume without a name at the top is easy to lose.', 'What is your full name?', 'basics.name', 'e.g. Alex Rivera');
    if (!b.email) ask('email', 'Add your email', 'Recruiters need a way to reply. Email is the one they use most.', 'What email should employers use?', 'basics.email', 'name@example.com');
    if (!b.phone) ask('phone', 'Add a phone number', 'Many recruiters call before they email.', 'What phone number should employers use?', 'basics.phone', '(555) 555-0100');
    if (!b.location?.city) ask('city', 'Add your city', 'Recruiters and job search tools filter by location.', 'Which city and state do you live in?', 'basics.location.city', 'e.g. Temecula, CA');
    if (!(b.profiles || []).length && !b.url) out.push({ id: 'link', step, kind: 'ask', title: 'Add a profile link', why: 'A LinkedIn or portfolio link lets a recruiter check your background in one click.', question: 'Paste your LinkedIn or portfolio link (or type "skip").', placeholder: 'linkedin.com/in/yourname', answer: (t) => (/^skip$/i.test(t.trim()) ? [] : [{ op: 'set', path: 'basics.profiles', value: [{ network: /linkedin/i.test(t) ? 'LinkedIn' : 'Website', url: t.trim() }] }]) });

    // Order: newest first.
    const dated = work.filter((w) => w.startDate);
    if (dated.length > 1 && dated.some((w, i) => i && dateKey(dated[i - 1].startDate) < dateKey(w.startDate))) {
      const ops = [{ op: 'sortWork' }];
      out.push({ id: 'order', step, kind: 'patch', title: 'Put your newest job first', why: 'Recruiters read top-down and expect your current or latest role first.',
        fields: [{ label: 'New order', value: applyOps(r, ops).work.map((w) => `${w.position || ''}, ${w.name || ''}`).join('\n'), readonly: true }], ops });
    }
    // Missing dates.
    work.forEach((w, i) => {
      if (!w.startDate) out.push({ id: `dates-${i}`, step, kind: 'ask', title: `Add dates for ${w.position || 'this role'}`, why: 'Roles without dates look like something is being hidden.',
        question: `When did you start and end at ${w.name || 'this job'}? (e.g. "2019 - 2023" or "2021 - present")`, placeholder: '2019 - 2023',
        answer: (t) => { const m = t.match(/(\d{4})(?:-(\d{1,2}))?\s*[-–to]+\s*(\d{4}|present|now|current)?/i); if (!m) return null;
          return [{ op: 'set', path: `work.${i}.startDate`, value: m[1] + (m[2] ? '-' + m[2].padStart(2, '0') : '') }, { op: 'set', path: `work.${i}.endDate`, value: /\d{4}/.test(m[3] || '') ? m[3] : '' }]; } });
    });
    // Summary.
    const summ = b.summary || '';
    if (words(summ).length < 15) {
      const draft = draftSummary(r);
      if (draft) out.push({ id: 'summary', step, kind: 'patch', title: summ ? 'Make your summary say more' : 'Add a short summary', why: 'Two or three lines at the top tell a recruiter what you do before they read anything else.',
        fields: [{ label: 'Summary (built only from your resume)', path: 'basics.summary', value: draft }], ops: [{ op: 'set', path: 'basics.summary', value: draft }] });
    } else {
      const hasIssue = FIRST_PERSON.test(summ) || OBJECTIVE.test(summ) || CLICHES.some((c) => summ.toLowerCase().includes(c));
      const clean = hasIssue ? (cleanSummary(summ) || draftSummary(r)) : summ;
      if (clean && clean !== summ) out.push({ id: 'summary-clean', step, kind: 'patch', title: 'Tighten your summary', why: 'Phrases like "team player" or "results-driven" appear on so many resumes that readers skip them. Resumes are written without "I".',
        fields: [{ label: 'Before', value: summ, readonly: true, old: true }, { label: 'After', path: 'basics.summary', value: clean }], ops: [{ op: 'set', path: 'basics.summary', value: clean }] });
    }
  }

  if (step === 'work') {
    work.forEach((w, i) => {
      const hl = w.highlights || [];
      const where = `${w.position || 'Role'}${w.name ? ', ' + w.name : ''}`;
      if (hl.length < 2) out.push({ id: `few-${i}`, step, kind: 'ask', title: `Add a result to ${where}`, why: 'Roles with one bullet or none look thin. Two to five bullets is typical.',
        question: `What is one thing you achieved as ${w.position || 'this role'}${w.name ? ' at ' + w.name : ''}? Include a number if you can.`, placeholder: 'e.g. Trained 12 new staff, cutting onboarding time by a week',
        answer: (t) => [{ op: 'addBullet', path: `work.${i}`, value: cap(t.trim().replace(/\.$/, '')) }] });
      hl.forEach((h, j) => {
        const path = `work.${i}.highlights.${j}`;
        const strong = strengthenOpener(h);
        if (strong && strong !== h) out.push({ id: `opener-${i}-${j}`, step, kind: 'patch', title: 'Start with an action verb', why: `"${words(h).slice(0, 3).join(' ')}…" describes a duty. Starting with what you did reads stronger.`, where, bullet: h,
          fields: [{ label: 'Before', value: h, readonly: true, old: true }, { label: 'After', path, value: strong }], ops: [{ op: 'set', path, value: strong }] });
        else if (FIRST_PERSON.test(h)) { const v = removeFirstPerson(h); if (v !== h) out.push({ id: `fp-${i}-${j}`, step, kind: 'patch', title: 'Drop "I" and "my"', why: 'Resume bullets are written without personal pronouns.', where, bullet: h, fields: [{ label: 'Before', value: h, readonly: true, old: true }, { label: 'After', path, value: v }], ops: [{ op: 'set', path, value: v }] }); }
        const parts = words(h).length > 32 ? splitLong(h) : null;
        if (parts) out.push({ id: `long-${i}-${j}`, step, kind: 'patch', title: 'Split a long bullet', why: 'Bullets over about 30 words are skimmed past. Two short ones get read.', where, bullet: h,
          fields: [{ label: 'Before', value: h, readonly: true, old: true }, { label: 'After (two bullets)', value: parts.join('\n'), path: `${path}#split` }], ops: [{ op: 'splitBullet', path, value: parts }] });
        if (!NUMBER_RE.test(h) && words(h).length >= 4) out.push({ id: `num-${i}-${j}`, step, kind: 'ask', title: 'Add a number to this bullet', where, bullet: h,
          why: 'Numbers (how many, how much, how often) make a result concrete. Only add one you know is true.',
          question: `"${h}"\nHow many, how much, or how often? Type just the detail to add, or "skip".`, placeholder: 'e.g. for 25 rental units / saving $40K a year',
          answer: (t) => (/^skip$/i.test(t.trim()) ? [] : [{ op: 'set', path, value: `${h.replace(/[.\s]+$/, '')} ${/^[,(]/.test(t.trim()) ? '' : ''}${t.trim().replace(/^[,\s]+/, '')}`.replace(/\s+/g, ' ') }]) });
      });
    });
    // Most valuable first: verbs and pronouns, then splits, then numbers, then gaps.
    const rank = (s) => (s.id.startsWith('opener') || s.id.startsWith('fp') ? 0 : s.id.startsWith('long') ? 1 : s.id.startsWith('few') ? 2 : 3);
    out.sort((a, c) => rank(a) - rank(c));
  }

  if (step === 'education') {
    // Skills that a line break split in two ("KPI &" + "Performance Management").
    (r.skills || []).forEach((grp, gi) => {
      const kw = grp.keywords || [];
      const joined = [];
      for (const k of kw) {
        const prev = joined[joined.length - 1];
        if (prev && (/(&|\band|\/|,)$/i.test(prev.trim()) || /^(&|and\b)/i.test(k.trim()))) joined[joined.length - 1] = `${prev.trim()} ${k.trim()}`;
        else joined.push(k);
      }
      if (joined.length < kw.length) {
        const broken = kw.filter((k) => /(&|\band|,)$/i.test(k.trim()));
        out.push({ id: `skills-join-${gi}`, step, kind: 'patch', title: 'Fix skills split across two lines', why: `"${broken[0]}" was cut off when your file was read. Tracking systems would see half a skill.`,
          fields: [{ label: 'Fixed list', value: joined.join(', '), path: '#skills' }], ops: [{ op: 'set', path: `skills.${gi}.keywords`, value: joined }] });
      }
    });
    if (!(r.education || []).length) out.push({ id: 'edu', step, kind: 'ask', title: 'Add your education', why: 'Many tracking systems filter on education. Include a degree, a diploma or a certificate.',
      question: 'What is your highest degree, diploma or certificate, and where? (e.g. "B.A. Business, Cal State San Marcos, 2010"; or "none")', placeholder: 'Degree, school, year',
      answer: (t) => { if (/^none$/i.test(t.trim())) return []; const [area, inst, yr] = t.split(',').map((x) => x.trim()); return [{ op: 'addEducation', value: { studyType: '', area: area || t.trim(), institution: inst || '', endDate: (yr || '').match(/\d{4}/)?.[0] || '' } }]; } });
    const listed = new Set((r.skills || []).flatMap((s) => s.keywords || []).map((k) => k.toLowerCase()));
    const text = (r.work || []).flatMap((w) => [w.position, ...(w.highlights || [])]).join('\n') + '\n' + (b.summary || '');
    const found = [...extractSkills(text)].filter((k) => !listed.has(k) && k.length > 2 && !['development', 'growth', 'marketplace', 'listing'].includes(k));
    if (found.length) {
      const nice = found.slice(0, 12).map((k) => (k.length <= 4 ? k.toUpperCase() : k.replace(/\b\w/g, (c) => c.toUpperCase())));
      out.push({ id: 'skills', step, kind: 'patch', title: 'Add skills your bullets already show', why: 'Tracking systems search the skills section. These appear in your experience but not in your skills list.',
        fields: [{ label: 'Skills to add (remove any you prefer not to list)', value: nice.join(', '), path: '#skills' }], ops: [{ op: 'addSkills', value: nice }] });
    }
  }

  for (const s of out) if (s.kind === 'patch') s.gain = gainOf(r, applyOps(r, s.ops));
  // Never suggest a change that would make the resume score worse.
  return out.filter((s) => s.kind !== 'patch' || s.gain.quality >= 0 && s.gain.quality + s.gain.ats >= 0);
}

/** A summary made only of facts on the resume: latest title, years, top skills, one strong result. */
export function draftSummary(r) {
  const work = (r.work || []).filter((w) => w.position);
  if (!work.length) return '';
  const latest = [...work].sort((a, b) => dateKey(b.startDate) - dateKey(a.startDate))[0];
  const years = (() => { const ys = work.map((w) => Number(String(w.startDate || '').slice(0, 4))).filter(Boolean); return ys.length ? new Date().getFullYear() - Math.min(...ys) : 0; })();
  const skills = [...new Set((r.skills || []).flatMap((s) => s.keywords || []))].slice(0, 4);
  const best = work.flatMap((w) => w.highlights || []).find((h) => NUMBER_RE.test(h) && words(h).length <= 24);
  const title = r.basics?.label || latest.position.replace(/^owner\s*&\s*/i, '');
  let s = `${cap(title)}${years >= 2 ? ` with ${years}+ years of experience` : ''}${skills.length ? ` in ${skills.slice(0, -1).join(', ')}${skills.length > 1 ? ' and ' : ''}${skills[skills.length - 1]}` : ''}.`;
  if (best) s += ` ${best.replace(/\.$/, '')}.`;
  return s;
}

/** Progress for the step list: how many suggestions remain per step. */
export function coachOverview(resume) {
  return COACH_STEPS.map((s) => ({ ...s, remaining: s.id === 'editor' ? 0 : coachSuggestions(resume, s.id).length }));
}
